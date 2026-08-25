import React, { useState, useEffect, useMemo } from 'react';
import { AppState, DayReport, DefaultTimeSlotTemplate, UserProfile, AuthUser, TaskScope, ScheduleTask, WorkSession } from './types';
import {
  loadAppState,
  saveAppState,
  resetAppState,
  getFreshInitialState,
  createNewDayReport,
  INITIAL_DEFAULT_SCHEDULE,
  INITIAL_USER_PROFILE
} from './utils/storage';
import {
  formatDateKey,
  formatFullDateHeader,
  getCurrentTimeString,
  getFormattedTimeString,
  calculateSessionMinutes
} from './utils/dateUtils';
import {
  subscribeToAuth,
  loginWithGoogle,
  logout
} from './lib/firebase';
import {
  saveUserProfileToFirestore,
  saveTemplatesToFirestore,
  saveDayReportToFirestore,
  subscribeToUserProfile,
  subscribeToTemplates,
  subscribeToReports,
  seedInitialFirestoreData,
  resetAllFirestoreUserData
} from './utils/firestoreService';

import { Header } from './components/Header';
import { DateNavigator } from './components/DateNavigator';
import { Checklist } from './components/Checklist';
import { MondayHolidayCard } from './components/MondayHolidayCard';
import { SummaryTable } from './components/SummaryTable';
import { TemplateEditorModal } from './components/TemplateEditorModal';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { InstallPromptModal } from './components/InstallPromptModal';
import { ImportSheetModal } from './components/ImportSheetModal';
import { DayTimeCounterModal } from './components/DayTimeCounterModal';
import { usePWAInstall } from './hooks/usePWAInstall';
import { updatePwaManifestAndIcons } from './utils/pwaIconUpdater';
import confetti from 'canvas-confetti';

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => loadAppState());
  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateKey(new Date()));
  const [currentView, setCurrentView] = useState<'checklist' | 'summary'>('checklist');

  // PWA Install Hook
  const {
    canInstall,
    deferredPromptAvailable,
    isInstalled,
    isIOS,
    isInstallModalOpen,
    openInstallModal,
    closeInstallModal,
    triggerInstall,
  } = usePWAInstall();

  // Firebase Auth state
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Modal open states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTimeCounterModalOpen, setIsTimeCounterModalOpen] = useState(false);

  // Subscribe to Firebase Auth changes
  useEffect(() => {
    const unsubscribeAuth = subscribeToAuth(async (user) => {
      if (user) {
        const authData: AuthUser = {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        };
        setAuthUser(authData);

        // Seed initial data if first time user on Cloud
        await seedInitialFirestoreData(user.uid, appState);
      } else {
        setAuthUser(null);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Realtime Firestore listeners when logged in
  useEffect(() => {
    if (!authUser) return;

    setIsSyncing(true);

    const unsubProfile = subscribeToUserProfile(authUser.uid, (cloudProfile) => {
      if (cloudProfile) {
        setAppState((prev) => ({ ...prev, userProfile: cloudProfile }));
        if (cloudProfile.companyLogoUrl) {
          updatePwaManifestAndIcons(cloudProfile.companyLogoUrl, cloudProfile.companyName);
        }
      }
    });

    const unsubTemplates = subscribeToTemplates(authUser.uid, (cloudTemplates) => {
      if (cloudTemplates && cloudTemplates.length > 0) {
        setAppState((prev) => ({ ...prev, defaultSchedule: cloudTemplates }));
      }
    });

    const unsubReports = subscribeToReports(authUser.uid, (cloudReports) => {
      if (cloudReports && Object.keys(cloudReports).length > 0) {
        setAppState((prev) => ({
          ...prev,
          reports: { ...prev.reports, ...cloudReports },
        }));
      }
      setIsSyncing(false);
    });

    return () => {
      unsubProfile();
      unsubTemplates();
      unsubReports();
    };
  }, [authUser?.uid]);

  // Save to LocalStorage whenever appState changes
  useEffect(() => {
    saveAppState(appState);
    if (appState.userProfile.companyLogoUrl) {
      updatePwaManifestAndIcons(
        appState.userProfile.companyLogoUrl,
        appState.userProfile.companyName
      );
    }
  }, [appState]);

  // Ensure current day's report exists
  useEffect(() => {
    if (!appState.reports[selectedDate]) {
      const newReport = createNewDayReport(selectedDate, appState.defaultSchedule);
      setAppState((prev) => ({
        ...prev,
        reports: {
          ...prev.reports,
          [selectedDate]: newReport,
        },
      }));

      if (authUser) {
        saveDayReportToFirestore(authUser.uid, newReport);
      }
    }
  }, [selectedDate, appState.defaultSchedule, authUser]);

  const currentReport: DayReport = useMemo(() => {
    return (
      appState.reports[selectedDate] ||
      createNewDayReport(selectedDate, appState.defaultSchedule)
    );
  }, [appState.reports, selectedDate, appState.defaultSchedule]);

  const dateHeaderInfo = useMemo(() => {
    return formatFullDateHeader(selectedDate);
  }, [selectedDate]);

  // Calculate day completion percentage
  const { completedTasksCount, totalTasksCount, completionPercentage } = useMemo(() => {
    if (!currentReport.tasks || currentReport.tasks.length === 0) {
      return { completedTasksCount: 0, totalTasksCount: 0, completionPercentage: 0 };
    }
    const total = currentReport.tasks.length;
    const completed = currentReport.tasks.filter((t) => t.isCompleted).length;
    const pct = Math.round((completed / total) * 100);
    return { completedTasksCount: completed, totalTasksCount: total, completionPercentage: pct };
  }, [currentReport.tasks]);

  // Auth Handlers
  const handleGoogleLogin = async () => {
    try {
      setIsSyncing(true);
      await loginWithGoogle();
    } catch {
      // Handled safely within loginWithGoogle
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setAuthUser(null);
    } catch {
      // Handled safely
    }
  };

  // Helper to update current day report
  const updateCurrentReport = (updater: (prevReport: DayReport) => DayReport) => {
    const updated = updater(currentReport);
    setAppState((prev) => ({
      ...prev,
      reports: {
        ...prev.reports,
        [selectedDate]: updated,
      },
    }));

    if (authUser) {
      saveDayReportToFirestore(authUser.uid, updated);
    }
  };

  // Tasks actions
  const handleToggleTask = (taskId: string) => {
    const time = getCurrentTimeString();
    updateCurrentReport((rep) => ({
      ...rep,
      tasks: rep.tasks.map((t) => {
        if (t.id === taskId) {
          const nextCompleted = !t.isCompleted;
          return {
            ...t,
            isCompleted: nextCompleted,
            completedAt: nextCompleted ? (t.completedAt || time) : undefined,
          };
        }
        return t;
      }),
    }));
  };

  const handleUpdateNotes = (taskId: string, notes: string) => {
    updateCurrentReport((rep) => ({
      ...rep,
      tasks: rep.tasks.map((t) => (t.id === taskId ? { ...t, notes } : t)),
    }));
  };

  const handleUpdateTaskName = (taskId: string, taskName: string) => {
    updateCurrentReport((rep) => ({
      ...rep,
      tasks: rep.tasks.map((t) => (t.id === taskId ? { ...t, taskName } : t)),
    }));
  };

  const handleUpdateScheduleType = (taskId: string, scheduleType: 'Schedule' | 'Over Time') => {
    updateCurrentReport((rep) => ({
      ...rep,
      tasks: rep.tasks.map((t) => (t.id === taskId ? { ...t, scheduleType } : t)),
    }));
  };

  const handleAddTask = (
    timeSlot: string, 
    taskName: string, 
    scheduleType: 'Schedule' | 'Over Time' = 'Schedule',
    scope: TaskScope = 'today'
  ) => {
    const newTask: ScheduleTask = {
      id: `task_${Date.now()}`,
      timeSlot,
      taskName,
      scheduleType,
      isCompleted: false,
    };

    updateCurrentReport((rep) => ({
      ...rep,
      tasks: [...rep.tasks, newTask],
    }));

    if (scope !== 'today') {
      const isOt = scheduleType === 'Over Time';
      const newTemplate: DefaultTimeSlotTemplate = {
        id: `slot_${Date.now()}`,
        timeSlot,
        taskName,
        scheduleType,
        isOvertime: isOt,
        applicableScope: scope,
      };

      const updatedSchedule = [...appState.defaultSchedule, newTemplate];
      setAppState((prev) => ({
        ...prev,
        defaultSchedule: updatedSchedule,
      }));

      if (authUser) {
        saveTemplatesToFirestore(authUser.uid, updatedSchedule);
      }
    }
  };

  const handleDeleteTask = (taskId: string) => {
    updateCurrentReport((rep) => ({
      ...rep,
      tasks: rep.tasks.filter((t) => t.id !== taskId),
    }));
  };

  const handleToggleDoneForToday = () => {
    const time = getCurrentTimeString();
    updateCurrentReport((rep) => {
      const nextDone = !rep.isDoneForToday;
      if (nextDone) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch {
          // ignore if canvas not supported
        }
      }
      return {
        ...rep,
        isDoneForToday: nextDone,
        doneAt: nextDone ? (rep.doneAt || time) : undefined,
        tasks: nextDone
          ? rep.tasks.map((t) => ({
              ...t,
              isCompleted: true,
              completedAt: t.completedAt || time,
            }))
          : rep.tasks,
      };
    });
  };

  const handleOverrideHoliday = () => {
    const templateTasks: ScheduleTask[] = appState.defaultSchedule.map((item) => ({
      id: `task_${Date.now()}_${item.id}`,
      timeSlot: item.timeSlot,
      taskName: item.taskName,
      scheduleType: item.scheduleType,
      isCompleted: false,
    }));

    updateCurrentReport((rep) => ({
      ...rep,
      isHoliday: false,
      holidayReason: undefined,
      tasks: templateTasks,
    }));
  };

  const handleMarkAllComplete = () => {
    const time = getCurrentTimeString();
    updateCurrentReport((rep) => ({
      ...rep,
      tasks: rep.tasks.map((t) => ({
        ...t,
        isCompleted: true,
        completedAt: t.completedAt || time,
      })),
    }));
  };

  const handleResetTasks = () => {
    updateCurrentReport((rep) => ({
      ...rep,
      tasks: rep.tasks.map((t) => ({
        ...t,
        isCompleted: false,
        completedAt: undefined,
      })),
    }));
  };

  // --- CHECK-IN / CHECK-OUT HANDLERS ---
  const handleCheckIn = (customTime?: string) => {
    const timeStr = customTime || getFormattedTimeString();
    const now = Date.now();
    updateCurrentReport((rep) => ({
      ...rep,
      isCheckedIn: true,
      currentCheckInTime: timeStr,
      currentCheckInTimestamp: now,
    }));
  };

  const handleCheckOut = (customTime?: string, notes?: string) => {
    const timeStr = customTime || getFormattedTimeString();
    const now = Date.now();
    updateCurrentReport((rep) => {
      const inTime = rep.currentCheckInTime || getFormattedTimeString();
      const inTs = rep.currentCheckInTimestamp || now;
      const durationMins = calculateSessionMinutes(inTime, timeStr);

      const newSession: WorkSession = {
        id: `sess_${Date.now()}`,
        checkInTime: inTime,
        checkInTimestamp: inTs,
        checkOutTime: timeStr,
        checkOutTimestamp: now,
        durationMinutes: durationMins,
        type: 'regular',
        notes: notes || '',
      };

      const prevSessions = rep.workSessions || [];
      const updatedSessions = [...prevSessions, newSession];
      const totalMins = updatedSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

      return {
        ...rep,
        isCheckedIn: false,
        currentCheckInTime: undefined,
        currentCheckInTimestamp: undefined,
        workSessions: updatedSessions,
        totalWorkedMinutes: totalMins,
      };
    });
  };

  const handleDeleteWorkSession = (sessionId: string) => {
    updateCurrentReport((rep) => {
      const updatedSessions = (rep.workSessions || []).filter((s) => s.id !== sessionId);
      const totalMins = updatedSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
      return {
        ...rep,
        workSessions: updatedSessions,
        totalWorkedMinutes: totalMins,
      };
    });
  };

  // --- IMPORT FROM SHEET HANDLER ---
  const handleImportTasks = (
    importedTasks: Array<{
      timeSlot: string;
      taskName: string;
      scheduleType?: string;
      notes?: string;
      isCompleted?: boolean;
    }>,
    mode: 'replace' | 'append' | 'template'
  ) => {
    if (mode === 'template') {
      const newTemplates: DefaultTimeSlotTemplate[] = importedTasks.map((t, idx) => {
        const isOt = (t.scheduleType || '').toLowerCase().includes('over') || (t.scheduleType || '').toLowerCase().includes('ot');
        return {
          id: `tpl_imp_${Date.now()}_${idx}`,
          timeSlot: t.timeSlot,
          taskName: t.taskName,
          scheduleType: isOt ? 'Over Time' : 'Schedule',
          isOvertime: isOt,
          applicableScope: 'all',
        };
      });

      setAppState((prev) => ({
        ...prev,
        defaultSchedule: newTemplates,
      }));

      if (authUser) {
        saveTemplatesToFirestore(authUser.uid, newTemplates);
      }
      return;
    }

    const newTasks: ScheduleTask[] = importedTasks.map((t, idx) => ({
      id: `task_imp_${Date.now()}_${idx}`,
      timeSlot: t.timeSlot,
      taskName: t.taskName,
      scheduleType: (t.scheduleType || '').toLowerCase().includes('over') ? 'Over Time' : 'Schedule',
      notes: t.notes || '',
      isCompleted: !!t.isCompleted,
    }));

    if (mode === 'replace') {
      updateCurrentReport((rep) => ({
        ...rep,
        isHoliday: false,
        tasks: newTasks,
      }));
    } else {
      updateCurrentReport((rep) => ({
        ...rep,
        isHoliday: false,
        tasks: [...rep.tasks, ...newTasks],
      }));
    }
  };

  const handleSaveScheduleTemplate = (updatedSchedule: DefaultTimeSlotTemplate[]) => {
    setAppState((prev) => ({
      ...prev,
      defaultSchedule: updatedSchedule,
    }));

    if (authUser) {
      saveTemplatesToFirestore(authUser.uid, updatedSchedule);
    }
  };

  const handleSaveProfile = (updatedProfile: UserProfile) => {
    setAppState((prev) => ({
      ...prev,
      userProfile: updatedProfile,
    }));

    if (authUser) {
      saveUserProfileToFirestore(authUser.uid, updatedProfile);
    }
  };

  const handleRestoreState = (restoredState: AppState) => {
    setAppState(restoredState);
    if (authUser) {
      saveUserProfileToFirestore(authUser.uid, restoredState.userProfile);
      saveTemplatesToFirestore(authUser.uid, restoredState.defaultSchedule);
      for (const dateKey of Object.keys(restoredState.reports)) {
        saveDayReportToFirestore(authUser.uid, restoredState.reports[dateKey]);
      }
    }
  };

  const handleResetAllData = async () => {
    const freshState = resetAppState();
    setAppState(freshState);
    const today = formatDateKey(new Date());
    setSelectedDate(today);

    if (authUser) {
      setIsSyncing(true);
      await resetAllFirestoreUserData(authUser.uid, freshState);
      setIsSyncing(false);
    }
  };

  const currentLanguage = appState.userProfile.language || 'en';

  useEffect(() => {
    document.documentElement.lang = currentLanguage;
  }, [currentLanguage]);

  const handleToggleLanguage = (newLang: 'en' | 'km') => {
    const updatedProfile = {
      ...appState.userProfile,
      language: newLang,
    };
    setAppState((prev) => ({
      ...prev,
      userProfile: updatedProfile,
    }));
    if (authUser) {
      saveUserProfileToFirestore(authUser.uid, updatedProfile);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-battambang selection:bg-indigo-200 selection:text-slate-900">
      
      {/* Header */}
      <Header
        currentView={currentView}
        setCurrentView={setCurrentView}
        formattedDateText={dateHeaderInfo.formattedText}
        userProfile={appState.userProfile}
        authUser={authUser}
        onGoogleLogin={handleGoogleLogin}
        onLogout={handleLogout}
        isSyncing={isSyncing}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenTimeCounterModal={() => setIsTimeCounterModalOpen(true)}
        onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenInstallModal={triggerInstall}
        isInstalled={isInstalled}
        completionPercentage={completionPercentage}
        isHoliday={currentReport.isHoliday}
        language={currentLanguage}
        onToggleLanguage={handleToggleLanguage}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        
        {/* Daily Schedule View */}
        {currentView === 'checklist' && (
          <>
            <DateNavigator
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              formattedDateText={dateHeaderInfo.formattedText}
              dayOfWeek={dateHeaderInfo.dayOfWeek}
              isHoliday={currentReport.isHoliday}
              completedTasksCount={completedTasksCount}
              totalTasksCount={totalTasksCount}
              completionPercentage={completionPercentage}
              onOpenTimeCounterModal={() => setIsTimeCounterModalOpen(true)}
              language={currentLanguage}
            />

            {currentReport.isHoliday ? (
              <MondayHolidayCard
                dayOfWeek={dateHeaderInfo.dayOfWeek}
                onOverrideHoliday={handleOverrideHoliday}
                language={currentLanguage}
              />
            ) : (
              <Checklist
                tasks={currentReport.tasks}
                isDoneForToday={currentReport.isDoneForToday}
                doneAt={currentReport.doneAt}
                workSessions={currentReport.workSessions}
                isCheckedIn={currentReport.isCheckedIn}
                currentCheckInTime={currentReport.currentCheckInTime}
                currentCheckInTimestamp={currentReport.currentCheckInTimestamp}
                totalWorkedMinutes={currentReport.totalWorkedMinutes}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
                onDeleteWorkSession={handleDeleteWorkSession}
                onToggleTask={handleToggleTask}
                onUpdateNotes={handleUpdateNotes}
                onUpdateTaskName={handleUpdateTaskName}
                onUpdateScheduleType={handleUpdateScheduleType}
                onAddTask={handleAddTask}
                onDeleteTask={handleDeleteTask}
                onMarkAllComplete={handleMarkAllComplete}
                onResetTasks={handleResetTasks}
                onToggleDoneForToday={handleToggleDoneForToday}
                onOpenTimeCounterModal={() => setIsTimeCounterModalOpen(true)}
                language={currentLanguage}
              />
            )}
          </>
        )}

        {/* Summary Table View */}
        {currentView === 'summary' && (
          <>
            <DateNavigator
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              formattedDateText={dateHeaderInfo.formattedText}
              dayOfWeek={dateHeaderInfo.dayOfWeek}
              isHoliday={currentReport.isHoliday}
              completedTasksCount={completedTasksCount}
              totalTasksCount={totalTasksCount}
              completionPercentage={completionPercentage}
              onOpenTimeCounterModal={() => setIsTimeCounterModalOpen(true)}
              language={currentLanguage}
            />

            <SummaryTable
              reports={appState.reports}
              userProfile={appState.userProfile}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              language={currentLanguage}
            />
          </>
        )}

      </main>

      {/* Modals */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        report={currentReport}
        reportsMap={appState.reports}
        userProfile={appState.userProfile}
        language={currentLanguage}
      />

      <TemplateEditorModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        defaultSchedule={appState.defaultSchedule}
        onSaveSchedule={handleSaveScheduleTemplate}
        language={currentLanguage}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        userProfile={appState.userProfile}
        onSaveProfile={handleSaveProfile}
        appState={appState}
        onRestoreState={handleRestoreState}
        onResetAllData={handleResetAllData}
        language={currentLanguage}
      />

      <ImportSheetModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        selectedDate={selectedDate}
        formattedDateText={dateHeaderInfo.formattedText}
        reportsMap={appState.reports}
        userProfile={appState.userProfile}
        language={currentLanguage}
        onImportTasks={handleImportTasks}
      />

      <DayTimeCounterModal
        isOpen={isTimeCounterModalOpen}
        onClose={() => setIsTimeCounterModalOpen(false)}
        tasks={currentReport.tasks}
        dateKey={selectedDate}
        formattedDateText={dateHeaderInfo.formattedText}
        dayOfWeek={dateHeaderInfo.dayOfWeek}
        language={currentLanguage}
      />

      <InstallPromptModal
        isOpen={isInstallModalOpen}
        onClose={closeInstallModal}
        onNativeInstall={triggerInstall}
        deferredPromptAvailable={deferredPromptAvailable}
        isIOS={isIOS}
        isInstalled={isInstalled}
        userProfile={appState.userProfile}
      />

    </div>
  );
}
