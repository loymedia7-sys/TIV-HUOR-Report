import React, { useState, useEffect, useMemo } from 'react';
import { AppState, DayReport, DefaultTimeSlotTemplate, UserProfile, AuthUser, TaskScope, ScheduleTask, WorkSession, TaskStatus } from './types';
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
import { PermissionModal } from './components/PermissionModal';
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
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);

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
  }, [appState]);

  // Set Company name / Logo in PWA manifest & document title on boot
  useEffect(() => {
    if (appState.userProfile?.companyName) {
      document.title = `${appState.userProfile.companyName} - Daily Work Report`;
    }
  }, [appState.userProfile?.companyName]);

  // Get or initialize DayReport for selectedDate
  const currentReport = useMemo(() => {
    if (appState.reports[selectedDate]) {
      return appState.reports[selectedDate];
    }
    return createNewDayReport(selectedDate, appState.defaultSchedule, appState.userProfile);
  }, [appState.reports, selectedDate, appState.defaultSchedule, appState.userProfile]);

  const dateHeaderInfo = useMemo(() => {
    return formatFullDateHeader(selectedDate);
  }, [selectedDate]);

  // Helpers to update day report
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

  // ==========================================
  // Attendance: Check-In & Check-Out Handlers
  // ==========================================
  const handleCheckIn = (customTime?: string) => {
    const nowTimeStr = customTime || getCurrentTimeString();
    const nowTimestamp = Date.now();

    updateCurrentReport((rep) => ({
      ...rep,
      isCheckedIn: true,
      currentCheckInTime: nowTimeStr,
      currentCheckInTimestamp: nowTimestamp,
      isAbsent: false,
    }));
  };

  const handleCheckOut = (customTime?: string, notes?: string) => {
    const nowTimeStr = customTime || getCurrentTimeString();
    const inTime = currentReport.currentCheckInTime || '08:00';
    const durationMins = calculateSessionMinutes(inTime, nowTimeStr);

    const newSession: WorkSession = {
      id: `session_${Date.now()}`,
      checkInTime: inTime,
      checkInTimestamp: currentReport.currentCheckInTimestamp || Date.now(),
      checkOutTime: nowTimeStr,
      checkOutTimestamp: Date.now(),
      durationMinutes: durationMins,
      notes: notes || undefined,
    };

    const existingSessions = currentReport.workSessions || [];
    const updatedSessions = [...existingSessions, newSession];
    const totalMinutes = updatedSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    updateCurrentReport((rep) => ({
      ...rep,
      isCheckedIn: false,
      currentCheckInTime: undefined,
      currentCheckInTimestamp: undefined,
      workSessions: updatedSessions,
      totalWorkedMinutes: totalMinutes,
    }));
  };

  const handleDeleteWorkSession = (sessionId: string) => {
    const existingSessions = currentReport.workSessions || [];
    const filtered = existingSessions.filter((s) => s.id !== sessionId);
    const totalMinutes = filtered.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    updateCurrentReport((rep) => ({
      ...rep,
      workSessions: filtered,
      totalWorkedMinutes: totalMinutes,
    }));
  };

  // ==========================================
  // Permission (P) / Absent Handlers
  // ==========================================
  const handleSavePermission = (permData: {
    isPermission: boolean;
    permissionType: string;
    permissionReason: string;
    isAbsent?: boolean;
    absentReason?: string;
  }) => {
    updateCurrentReport((rep) => ({
      ...rep,
      isPermission: permData.isPermission,
      permissionType: permData.permissionType,
      permissionReason: permData.permissionReason,
      isAbsent: permData.isAbsent ?? false,
      absentReason: permData.absentReason ?? permData.permissionReason,
    }));
  };

  const handleRemovePermission = () => {
    updateCurrentReport((rep) => ({
      ...rep,
      isPermission: false,
      permissionType: undefined,
      permissionReason: undefined,
      isAbsent: false,
      absentReason: undefined,
    }));
  };

  // ==========================================
  // Tasks actions & Check (✓) / Cross (✗)
  // ==========================================
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
            status: nextCompleted ? 'completed' : 'pending',
            completedAt: nextCompleted ? (t.completedAt || time) : undefined,
          };
        }
        return t;
      }),
    }));
  };

  const handleSetTaskStatus = (taskId: string, status: TaskStatus) => {
    const time = getCurrentTimeString();
    updateCurrentReport((rep) => ({
      ...rep,
      tasks: rep.tasks.map((t) => {
        if (t.id === taskId) {
          const isDone = status === 'completed';
          return {
            ...t,
            status,
            isCompleted: isDone,
            completedAt: isDone ? (t.completedAt || time) : undefined,
          };
        }
        return t;
      }),
    }));
  };

  const handleUpdateCrossReason = (taskId: string, crossReason: string) => {
    updateCurrentReport((rep) => ({
      ...rep,
      tasks: rep.tasks.map((t) => (t.id === taskId ? { ...t, crossReason, status: crossReason ? 'crossed' : t.status } : t)),
    }));
  };

  const handleUpdateOther = (taskId: string, other: string) => {
    updateCurrentReport((rep) => ({
      ...rep,
      tasks: rep.tasks.map((t) => (t.id === taskId ? { ...t, other, notes: other } : t)),
    }));
  };

  const handleUpdateNotes = (taskId: string, notes: string) => {
    updateCurrentReport((rep) => ({
      ...rep,
      tasks: rep.tasks.map((t) => (t.id === taskId ? { ...t, notes, other: notes } : t)),
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
    scope: TaskScope = 'today',
    daysOfWeek?: number[]
  ) => {
    const newTask: ScheduleTask = {
      id: `task_${Date.now()}`,
      timeSlot,
      taskName,
      scheduleType,
      isCompleted: false,
      status: 'pending',
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
        daysOfWeek: daysOfWeek,
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
              status: 'completed',
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
      status: 'pending',
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
        status: 'completed',
        completedAt: t.completedAt || time,
      })),
    }));
  };

  const handleResetTasks = () => {
    updateCurrentReport((rep) => ({
      ...rep,
      isDoneForToday: false,
      doneAt: undefined,
      tasks: rep.tasks.map((t) => ({
        ...t,
        isCompleted: false,
        status: 'pending',
        completedAt: undefined,
        crossReason: undefined,
      })),
    }));
  };

  // Google Login & Logout
  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('Google Sign-in failed:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setAuthUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Template Save
  const handleSaveScheduleTemplate = (newSchedule: DefaultTimeSlotTemplate[]) => {
    setAppState((prev) => ({
      ...prev,
      defaultSchedule: newSchedule,
    }));

    if (authUser) {
      saveTemplatesToFirestore(authUser.uid, newSchedule);
    }
  };

  // Profile Save
  const handleSaveProfile = (newProfile: UserProfile) => {
    setAppState((prev) => ({
      ...prev,
      userProfile: newProfile,
    }));

    if (newProfile.companyLogoUrl) {
      updatePwaManifestAndIcons(newProfile.companyLogoUrl, newProfile.companyName);
    }

    if (authUser) {
      saveUserProfileToFirestore(authUser.uid, newProfile);
    }
  };

  // Import Tasks
  const handleImportTasks = (importedTasks: ScheduleTask[]) => {
    updateCurrentReport((rep) => ({
      ...rep,
      tasks: [...rep.tasks, ...importedTasks],
    }));
  };

  // Restore State & Reset Data
  const handleRestoreState = (restored: AppState) => {
    setAppState(restored);
    saveAppState(restored);
  };

  const handleResetAllData = async () => {
    const fresh = getFreshInitialState();
    if (authUser) {
      await resetAllFirestoreUserData(authUser.uid, fresh);
    }
    resetAppState();
    setAppState(fresh);
  };

  // Completion calculation for header/nav
  const completedTasksCount = currentReport.tasks.filter((t) => t.isCompleted || t.status === 'completed').length;
  const totalTasksCount = currentReport.tasks.length;
  const completionPercentage =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const currentLanguage = appState.userProfile?.language || 'en';

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
                report={currentReport}
                selectedDate={selectedDate}
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
                onOpenPermissionModal={() => setIsPermissionModalOpen(true)}
                onToggleTask={handleToggleTask}
                onSetTaskStatus={handleSetTaskStatus}
                onUpdateCrossReason={handleUpdateCrossReason}
                onUpdateOther={handleUpdateOther}
                onUpdateNotes={handleUpdateNotes}
                onUpdateTaskName={handleUpdateTaskName}
                onUpdateScheduleType={handleUpdateScheduleType}
                onAddTask={handleAddTask}
                onDeleteTask={handleDeleteTask}
                onMarkAllComplete={handleMarkAllComplete}
                onResetTasks={handleResetTasks}
                onToggleDoneForToday={handleToggleDoneForToday}
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
        defaultSchedule={appState.defaultSchedule}
        language={currentLanguage}
      />

      <PermissionModal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        report={currentReport}
        onSavePermission={handleSavePermission}
        onRemovePermission={handleRemovePermission}
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
