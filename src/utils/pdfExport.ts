import { jsPDF } from 'jspdf';
import { DayReport, DefaultTimeSlotTemplate, UserProfile } from '../types';
import { formatFullDateHeader, getWeekDays7, getWeekRangeLabel } from './dateUtils';
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
 * Generates a clean PDF document of the Daily Report with Company Logo using jsPDF
 * Clean 5-column layout: No., Time Slot, Task Name / Activity, Schedule (Red), Remarks / Work Log
 */
export async function exportReportToPDF(report: DayReport, userProfile: UserProfile): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const { formattedText } = formatFullDateHeader(report.date);

  // Colors
  const yellowColor = [253, 224, 71]; // #FDE047
  const darkNavy = [30, 41, 59]; // #1E293B
  const redColor = [220, 38, 38]; // #DC2626
  const lightRed = [254, 226, 226]; // #FEE2E2
  const lightGray = [248, 250, 252];

  // Try to load company logo
  let logoDataUrl: string | null = null;
  if (userProfile.companyLogoUrl) {
    try {
      logoDataUrl = await loadImageDataUrl(userProfile.companyLogoUrl);
    } catch (err) {
      console.warn('Could not load logo for PDF:', err);
    }
  }

  // 1. TOP HEADER BANNER (Yellow background)
  doc.setFillColor(yellowColor[0], yellowColor[1], yellowColor[2]);
  doc.rect(10, 10, 190, 18, 'F');

  // If logo exists, render on the left of the banner
  if (logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, 11.5, 15, 15, 1.5, 1.5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(12, 11.5, 15, 15, 1.5, 1.5, 'S');
      doc.addImage(logoDataUrl, 'PNG', 12.5, 12, 14, 14, undefined, 'FAST');
    } catch (err) {
      console.warn('Failed to embed logo into PDF canvas:', err);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42); // slate-900
  const companyPrefix = userProfile.companyName ? `${userProfile.companyName.toUpperCase()} - ` : '';
  const headerTitle = `${companyPrefix}DAILY REPORT / ${formattedText.toUpperCase()} / ${userProfile.employeeName.toUpperCase()}`;
  
  const titleX = logoDataUrl ? 112 : 105;
  doc.text(headerTitle, titleX, 21, { align: 'center' });

  // 2. METADATA
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Department: ${userProfile.department}`, 10, 34);
  doc.text(`Supervisor: ${userProfile.supervisorName}`, 200, 34, { align: 'right' });

  // 3. TABLE HEADERS
  let currentY = 40;
  const colX = [10, 22, 60, 130, 156];
  const colWidths = [12, 38, 70, 26, 44];
  const headers = ['No.', 'Time Slot', 'Task Name / Activity', 'Schedule', 'Remarks / Work Log'];

  // Draw Header Background
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.rect(10, currentY, 190, 8, 'F');

  // Draw Header Labels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);

  headers.forEach((h, i) => {
    if (h === 'Schedule') {
      doc.setFillColor(redColor[0], redColor[1], redColor[2]);
      doc.rect(colX[i], currentY, colWidths[i], 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(h, colX[i] + colWidths[i] / 2, currentY + 5.5, { align: 'center' });
    } else {
      const align = i === 2 || i === 4 ? 'left' : 'center';
      const posX = align === 'left' ? colX[i] + 2 : colX[i] + colWidths[i] / 2;
      doc.text(h, posX, currentY + 5.5, { align: align as any });
    }
  });

  currentY += 8;

  // 4. TABLE CONTENT
  if (report.isHoliday) {
    doc.setFillColor(254, 243, 199);
    doc.rect(10, currentY, 190, 14, 'F');
    doc.setDrawColor(217, 119, 6);
    doc.rect(10, currentY, 190, 14, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(180, 83, 9);
    doc.text(`HOLIDAY — ${report.dayOfWeek.toUpperCase()} OFF DAY (NO SCHEDULED TASKS)`, 105, currentY + 8.5, { align: 'center' });
    currentY += 14;
  } else if (!report.tasks || report.tasks.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No scheduled tasks recorded for this date.', 105, currentY + 8, { align: 'center' });
    currentY += 12;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    report.tasks.forEach((task, idx) => {
      const rowHeight = 8;

      if (idx % 2 === 1) {
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.rect(10, currentY, 190, rowHeight, 'F');
      }

      // Schedule cell background
      doc.setFillColor(lightRed[0], lightRed[1], lightRed[2]);
      doc.rect(colX[3], currentY, colWidths[3], rowHeight, 'F');

      // Grid line
      doc.setDrawColor(226, 232, 240);
      doc.line(10, currentY + rowHeight, 200, currentY + rowHeight);

      // Data Values
      doc.setTextColor(15, 23, 42);
      doc.text(String(idx + 1), colX[0] + colWidths[0] / 2, currentY + 5.5, { align: 'center' });
      doc.text(task.timeSlot, colX[1] + colWidths[1] / 2, currentY + 5.5, { align: 'center' });

      // Task Name
      const taskTruncated = doc.splitTextToSize(task.taskName, colWidths[2] - 3)[0] || '';
      doc.text(taskTruncated, colX[2] + 2, currentY + 5.5);

      // Schedule / Over Time text in RED
      const schedLabel = task.scheduleType || (task.isOvertime ? 'Over Time' : 'Schedule');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(redColor[0], redColor[1], redColor[2]);
      doc.text(schedLabel, colX[3] + colWidths[3] / 2, currentY + 5.5, { align: 'center' });

      // Remarks / Work Log
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const notesTruncated = doc.splitTextToSize(task.notes || '-', colWidths[4] - 3)[0] || '-';
      doc.text(notesTruncated, colX[4] + 2, currentY + 5.5);

      currentY += rowHeight;
    });
  }

  // 5. SUMMARY METRICS
  currentY += 8;
  if (!report.isHoliday && report.tasks.length > 0) {
    const totalCount = report.tasks.length;
    const overtimeCount = report.tasks.filter((t) => t.scheduleType === 'Over Time' || t.isOvertime).length;
    const regularCount = totalCount - overtimeCount;
    const notesCount = report.tasks.filter((t) => t.notes && t.notes.trim().length > 0).length;

    doc.setFillColor(241, 245, 249);
    doc.rect(10, currentY, 190, 9, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const summaryText = overtimeCount > 0
      ? `SUMMARY: ${totalCount} Slots (${regularCount} Regular, ${overtimeCount} Over Time)  |  ${notesCount} Remarks Logged`
      : `SUMMARY: ${totalCount} Scheduled Slots  |  ${notesCount} Remarks Logged`;
    doc.text(summaryText, 15, currentY + 6);
    currentY += 15;
  } else {
    currentY += 10;
  }

  // 6. SIGNATURE BLOCK
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Prepared by: ________________________ (${userProfile.employeeName})`, 10, currentY);
  doc.text(`Approved by: ________________________ (${userProfile.supervisorName})`, 200, currentY, { align: 'right' });

  // Save PDF
  doc.save(`Daily_Report_${report.date}_${userProfile.employeeName.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Generates a 1-Week PDF Report containing 7 SEPARATE TABLES FOR 7 DAYS
 */
export async function exportWeeklyReportToPDF(
  targetDateStr: string,
  reportsMap: Record<string, DayReport>,
  userProfile: UserProfile,
  defaultSchedule?: DefaultTimeSlotTemplate[]
): Promise<void> {
  const weekDays = getWeekDays7(targetDateStr);
  const weekRangeLabel = getWeekRangeLabel(weekDays);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const yellowColor = [253, 224, 71]; // #FDE047
  const darkNavy = [30, 41, 59]; // #1E293B
  const redColor = [220, 38, 38]; // #DC2626
  const lightRed = [254, 226, 226];
  const lightGray = [248, 250, 252];

  // Try to load company logo
  let logoDataUrl: string | null = null;
  if (userProfile.companyLogoUrl) {
    try {
      logoDataUrl = await loadImageDataUrl(userProfile.companyLogoUrl);
    } catch (err) {
      console.warn('Could not load logo for PDF:', err);
    }
  }

  // Gather 7 days reports
  const sevenDaysReports: DayReport[] = weekDays.map((dateStr) => {
    let rep = reportsMap[dateStr];
    if (!rep && defaultSchedule) {
      rep = createNewDayReport(dateStr, defaultSchedule, userProfile);
    } else if (!rep) {
      rep = {
        date: dateStr,
        dayOfWeek: formatFullDateHeader(dateStr).dayOfWeek,
        isHoliday: formatFullDateHeader(dateStr).dayOfWeek === 'Monday',
        holidayReason: formatFullDateHeader(dateStr).dayOfWeek === 'Monday' ? 'Monday Off Day' : undefined,
        tasks: [],
        lastUpdated: new Date().toISOString()
      };
    }
    return rep;
  });

  const pageHeight = 297;
  let currentY = 10;

  // 1. TOP HEADER BANNER (Page 1)
  doc.setFillColor(yellowColor[0], yellowColor[1], yellowColor[2]);
  doc.rect(10, currentY, 190, 16, 'F');

  if (logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, currentY + 1, 14, 14, 1.5, 1.5, 'F');
      doc.addImage(logoDataUrl, 'PNG', 12.5, currentY + 1.5, 13, 13, undefined, 'FAST');
    } catch (err) {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const companyPrefix = userProfile.companyName ? `${userProfile.companyName.toUpperCase()} - ` : '';
  const headerTitle = `${companyPrefix}WEEKLY REPORT (7 DAYS) / ${weekRangeLabel.toUpperCase()} / ${userProfile.employeeName.toUpperCase()}`;
  const titleX = logoDataUrl ? 112 : 105;
  doc.text(headerTitle, titleX, currentY + 10, { align: 'center' });
  currentY += 21;

  // Metadata Line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Department: ${userProfile.department}`, 10, currentY);
  doc.text(`Supervisor: ${userProfile.supervisorName}`, 200, currentY, { align: 'right' });
  currentY += 6;

  const colX = [10, 20, 56, 126, 152];
  const colWidths = [10, 36, 70, 26, 48];
  const headers = ['No.', 'Time Slot', 'Task Name / Activity', 'Schedule', 'Remarks / Notes'];

  // Render 7 Tables for the 7 Days
  sevenDaysReports.forEach((rep, dayIdx) => {
    const { dayOfWeek } = formatFullDateHeader(rep.date);
    const requiredSpace = rep.isHoliday ? 24 : Math.max(26, 16 + (rep.tasks?.length || 1) * 7);

    // If not enough room on page, create new page
    if (currentY + requiredSpace > pageHeight - 20) {
      doc.addPage();
      currentY = 12;
    }

    // --- DAY TABLE TITLE BANNER ---
    doc.setFillColor(rep.isHoliday ? 217 : 30, rep.isHoliday ? 119 : 41, rep.isHoliday ? 6 : 59);
    doc.rect(10, currentY, 190, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    const otCountInDay = rep.tasks ? rep.tasks.filter(t => t.scheduleType === 'Over Time' || t.isOvertime).length : 0;
    const slotsTag = rep.tasks && rep.tasks.length > 0
      ? ` [${rep.tasks.length} Slots${otCountInDay > 0 ? ` (${otCountInDay} Over Time)` : ''}]`
      : ' [0 Slots Scheduled]';
    const holidayTag = rep.isHoliday ? ' [HOLIDAY / OFF DAY]' : slotsTag;
    doc.text(`${dayOfWeek.toUpperCase()} (${rep.date})${holidayTag}`, 13, currentY + 4.8);
    currentY += 7;

    // --- COLUMN HEADERS ---
    doc.setFillColor(51, 65, 85);
    doc.rect(10, currentY, 190, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    headers.forEach((h, i) => {
      if (h === 'Schedule') {
        doc.setFillColor(redColor[0], redColor[1], redColor[2]);
        doc.rect(colX[i], currentY, colWidths[i], 6, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(h, colX[i] + colWidths[i] / 2, currentY + 4.2, { align: 'center' });
      } else {
        const align = i === 2 || i === 4 ? 'left' : 'center';
        const posX = align === 'left' ? colX[i] + 2 : colX[i] + colWidths[i] / 2;
        doc.text(h, posX, currentY + 4.2, { align: align as any });
      }
    });
    currentY += 6;

    // --- ROWS ---
    if (rep.isHoliday) {
      doc.setFillColor(254, 243, 199);
      doc.rect(10, currentY, 190, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text(`[HOLIDAY] ${dayOfWeek.toUpperCase()} — ${rep.holidayReason || 'Off Day (No tasks scheduled)'}`, 105, currentY + 5.2, { align: 'center' });
      currentY += 8;
    } else if (!rep.tasks || rep.tasks.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`No scheduled tasks recorded for ${dayOfWeek} (${rep.date})`, 105, currentY + 5, { align: 'center' });
      currentY += 7;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      rep.tasks.forEach((task, tIdx) => {
        const rowH = 6.5;
        if (tIdx % 2 === 1) {
          doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
          doc.rect(10, currentY, 190, rowH, 'F');
        }

        // Red schedule col bg
        doc.setFillColor(lightRed[0], lightRed[1], lightRed[2]);
        doc.rect(colX[3], currentY, colWidths[3], rowH, 'F');

        doc.setDrawColor(226, 232, 240);
        doc.line(10, currentY + rowH, 200, currentY + rowH);

        doc.setTextColor(15, 23, 42);
        doc.text(String(tIdx + 1), colX[0] + colWidths[0] / 2, currentY + 4.5, { align: 'center' });
        doc.text(task.timeSlot, colX[1] + colWidths[1] / 2, currentY + 4.5, { align: 'center' });

        const taskTruncated = doc.splitTextToSize(task.taskName, colWidths[2] - 3)[0] || '';
        doc.text(taskTruncated, colX[2] + 2, currentY + 4.5);

        // Schedule or Over Time text
        const schedLabel = task.scheduleType || (task.isOvertime ? 'Over Time' : 'Schedule');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(redColor[0], redColor[1], redColor[2]);
        doc.text(schedLabel, colX[3] + colWidths[3] / 2, currentY + 4.5, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const notesTruncated = doc.splitTextToSize(task.notes || '-', colWidths[4] - 3)[0] || '-';
        doc.text(notesTruncated, colX[4] + 2, currentY + 4.5);

        currentY += rowH;
      });
    }

    currentY += 4; // Margin between day tables
  });

  // Final Signature Block
  if (currentY + 15 > pageHeight - 15) {
    doc.addPage();
    currentY = 15;
  }
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Prepared by: ________________________ (${userProfile.employeeName})`, 10, currentY + 6);
  doc.text(`Approved by: ________________________ (${userProfile.supervisorName})`, 200, currentY + 6, { align: 'right' });

  // Download
  doc.save(`Weekly_Report_7Days_${weekDays[0]}_to_${weekDays[6]}_${userProfile.employeeName.replace(/\s+/g, '_')}.pdf`);
}

