import { jsPDF } from 'jspdf';
import { DayReport, DefaultTimeSlotTemplate, UserProfile } from '../types';
import {
  formatFullDateHeader,
  formatDateToScreenshotBanner,
  formatTimeSlotToTwoDigitHours,
  getWeekDays7,
  getWeekRangeLabel
} from './dateUtils';
import { createNewDayReport } from './storage';

/**
 * Loads an image URL and converts it to base64 Data URL for jsPDF embedding
 */
async function loadImageDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:image/')) {
    return url;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 200;
        canvas.height = img.naturalHeight || img.height || 200;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      } catch (err) {
        console.warn('Canvas toDataURL conversion failed:', err);
        resolve(null);
      }
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Renders a single day table into a jsPDF document matching the screenshot:
 * - Date 25 August 2026 (Yellow or Red for permission)
 * - Headers: No | Time | Task / Activity | checking | Reason | Other
 */
function renderPdfDayTable(doc: jsPDF, report: DayReport, startY: number): number {
  let y = startY;
  const isPermission = Boolean(report.isPermission);
  const bannerText = formatDateToScreenshotBanner(report.date);

  // 1. DATE BANNER
  if (isPermission) {
    doc.setFillColor(239, 68, 68); // Red
    doc.rect(10, y, 190, 8, 'F');
    doc.setTextColor(255, 255, 255);
  } else {
    doc.setFillColor(254, 240, 138); // Bright Yellow #FEF08A
    doc.rect(10, y, 190, 8, 'F');
    doc.setTextColor(0, 0, 0);
  }

  doc.setDrawColor(0, 0, 0);
  doc.rect(10, y, 190, 8, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(bannerText, 14, y + 5.8);
  y += 8;

  // 2. COLUMN HEADERS
  // No | Time | Task / Activity | checking | Reason | Other
  const colX = [10, 20, 42, 112, 134, 166];
  const colW = [10, 22, 70, 22, 32, 34];
  const headers = ['No', 'Time', 'Task / Activity', 'checking', 'Reason', 'Other'];

  doc.setFillColor(248, 250, 252);
  doc.rect(10, y, 190, 6.5, 'F');
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);

  headers.forEach((h, i) => {
    doc.rect(colX[i], y, colW[i], 6.5, 'S');
    const align = i === 2 || i === 4 || i === 5 ? 'left' : 'center';
    const posX = align === 'left' ? colX[i] + 2 : colX[i] + colW[i] / 2;
    doc.text(h, posX, y + 4.5, { align: align as any });
  });
  y += 6.5;

  // 3. PERMISSION ROW
  if (isPermission) {
    doc.setFillColor(254, 226, 226);
    doc.rect(10, y, 190, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(185, 28, 28);

    doc.rect(colX[0], y, colW[0], 7, 'S');
    doc.text('1', colX[0] + colW[0] / 2, y + 4.8, { align: 'center' });

    doc.rect(colX[1], y, colW[1], 7, 'S');
    doc.text(report.permissionType || 'P', colX[1] + colW[1] / 2, y + 4.8, { align: 'center' });

    doc.rect(colX[2], y, colW[2], 7, 'S');
    const reasonText = report.permissionReason ? `(${report.permissionReason})` : '(sick can go need to rest and sleep)';
    doc.text(reasonText, colX[2] + 2, y + 4.8);

    doc.rect(colX[3], y, colW[3], 7, 'S');
    doc.text('✓', colX[3] + colW[3] / 2, y + 4.8, { align: 'center' });

    doc.rect(colX[4], y, colW[4], 7, 'S');
    doc.text(report.absentReason || '', colX[4] + 2, y + 4.8);

    doc.rect(colX[5], y, colW[5], 7, 'S');
    doc.text(report.notes || '', colX[5] + 2, y + 4.8);

    y += 7;
    return y + 6;
  }

  // 4. REGULAR TASKS
  const allTasks = report.tasks || [];
  const regularTasks = allTasks.filter(t => t.scheduleType !== 'Over Time' && !t.isOvertime);
  const overtimeTasks = allTasks.filter(t => t.scheduleType === 'Over Time' || t.isOvertime);

  let taskNum = 1;

  regularTasks.forEach((task) => {
    const isCompleted = task.isCompleted || task.status === 'completed';
    const isCrossed = task.status === 'crossed';
    const checkSymbol = isCompleted ? '✓' : isCrossed ? '✗' : '';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    doc.rect(colX[0], y, colW[0], 6, 'S');
    doc.text(String(taskNum), colX[0] + colW[0] / 2, y + 4.2, { align: 'center' });

    doc.rect(colX[1], y, colW[1], 6, 'S');
    const timeText = formatTimeSlotToTwoDigitHours(task.timeSlot) || task.timeSlot;
    doc.text(timeText, colX[1] + colW[1] / 2, y + 4.2, { align: 'center' });

    doc.rect(colX[2], y, colW[2], 6, 'S');
    const truncTask = doc.splitTextToSize(task.taskName, colW[2] - 4)[0] || '';
    doc.text(truncTask, colX[2] + 2, y + 4.2);

    doc.rect(colX[3], y, colW[3], 6, 'S');
    if (checkSymbol === '✗') {
      doc.setTextColor(225, 29, 72);
      doc.setFont('helvetica', 'bold');
    } else if (checkSymbol === '✓') {
      doc.setTextColor(16, 185, 129);
      doc.setFont('helvetica', 'bold');
    }
    doc.text(checkSymbol, colX[3] + colW[3] / 2, y + 4.2, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    doc.rect(colX[4], y, colW[4], 6, 'S');
    const truncReason = doc.splitTextToSize(task.crossReason || '', colW[4] - 4)[0] || '';
    doc.text(truncReason, colX[4] + 2, y + 4.2);

    doc.rect(colX[5], y, colW[5], 6, 'S');
    const truncOther = doc.splitTextToSize(task.other || task.notes || '', colW[5] - 4)[0] || '';
    doc.text(truncOther, colX[5] + 2, y + 4.2);

    taskNum++;
    y += 6;
  });

  // 5. GREEN "OVER TIME" ROW
  doc.setFillColor(34, 197, 94); // Green
  doc.rect(10, y, 190, 6, 'F');
  doc.rect(10, y, 190, 6, 'S');
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('OVER TIME', 105, y + 4.2, { align: 'center' });
  y += 6;

  // 6. OVERTIME TASKS
  overtimeTasks.forEach((task) => {
    const isCompleted = task.isCompleted || task.status === 'completed';
    const isCrossed = task.status === 'crossed';
    const checkSymbol = isCompleted ? '✓' : isCrossed ? '✗' : '';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    doc.rect(colX[0], y, colW[0], 6, 'S');
    doc.text(String(taskNum), colX[0] + colW[0] / 2, y + 4.2, { align: 'center' });

    doc.rect(colX[1], y, colW[1], 6, 'S');
    const timeText = formatTimeSlotToTwoDigitHours(task.timeSlot) || task.timeSlot;
    doc.text(timeText, colX[1] + colW[1] / 2, y + 4.2, { align: 'center' });

    doc.rect(colX[2], y, colW[2], 6, 'S');
    const truncTask = doc.splitTextToSize(task.taskName, colW[2] - 4)[0] || '';
    doc.text(truncTask, colX[2] + 2, y + 4.2);

    doc.rect(colX[3], y, colW[3], 6, 'S');
    if (checkSymbol === '✗') {
      doc.setTextColor(225, 29, 72);
      doc.setFont('helvetica', 'bold');
    } else if (checkSymbol === '✓') {
      doc.setTextColor(16, 185, 129);
      doc.setFont('helvetica', 'bold');
    }
    doc.text(checkSymbol, colX[3] + colW[3] / 2, y + 4.2, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    doc.rect(colX[4], y, colW[4], 6, 'S');
    const truncReason = doc.splitTextToSize(task.crossReason || '', colW[4] - 4)[0] || '';
    doc.text(truncReason, colX[4] + 2, y + 4.2);

    doc.rect(colX[5], y, colW[5], 6, 'S');
    const truncOther = doc.splitTextToSize(task.other || task.notes || '', colW[5] - 4)[0] || '';
    doc.text(truncOther, colX[5] + 2, y + 4.2);

    taskNum++;
    y += 6;
  });

  return y + 6;
}

/**
 * Generates a clean PDF document of the Daily Report matching template
 */
export async function exportReportToPDF(report: DayReport, userProfile: UserProfile): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let logoDataUrl: string | null = null;
  if (userProfile.companyLogoUrl) {
    try {
      logoDataUrl = await loadImageDataUrl(userProfile.companyLogoUrl);
    } catch (err) {
      console.warn('Could not load logo for PDF:', err);
    }
  }

  let startY = 12;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 12, 10, 14, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(userProfile.companyName || 'Daily Work Report', 30, 18);
      startY = 28;
    } catch (e) {
      // ignore
    }
  }

  renderPdfDayTable(doc, report, startY);

  doc.save(`Daily_Report_${report.date}_${(userProfile.employeeName || 'Report').replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generates 1-Week PDF containing 7 Daily Tables
 */
export async function exportWeeklyReportToPDF(
  targetDate: string,
  reportsMap: Record<string, DayReport>,
  userProfile: UserProfile,
  defaultSchedule: DefaultTimeSlotTemplate[]
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const weekDays = getWeekDays7(targetDate);
  let y = 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(`1-WEEK WORK REPORT (${getWeekRangeLabel(weekDays)})`, 105, y, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Employee: ${userProfile.employeeName} | ${userProfile.department}`, 105, y + 5, { align: 'center' });
  y += 12;

  for (let i = 0; i < weekDays.length; i++) {
    const dateKey = weekDays[i];
    const report = reportsMap[dateKey] || createNewDayReport(dateKey, defaultSchedule, userProfile);

    // If nearing bottom of page, add new page
    if (y > 240) {
      doc.addPage();
      y = 14;
    }

    y = renderPdfDayTable(doc, report, y);
  }

  doc.save(`1_Week_Report_${weekDays[0]}_to_${weekDays[6]}_${(userProfile.employeeName || 'Report').replace(/\s+/g, '_')}.pdf`);
}
