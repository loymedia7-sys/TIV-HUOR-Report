import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  MessageSquare,
  Plus,
  Trash2,
  AlertCircle,
  Tag,
  MessageCircle,
  MonitorCheck,
  Lightbulb,
  Palette,
  Film,
  Send,
  Layers,
  Video,
  ChevronDown,
  CheckCheck,
  RotateCcw,
  CheckCircle2,
  CalendarCheck,
  CalendarDays,
  ChevronUp,
  LogIn,
  LogOut,
  History,
  Play,
  Timer
} from 'lucide-react';
import { ScheduleTask, TaskScope, PRESET_ACTIVITIES, WorkSession, Language } from '../types';
import {
  calculateDayWorkHours,
  formatMinutesToHours
} from '../utils/dateUtils';
import { TRANSLATIONS } from '../utils/translations';

interface ChecklistProps {
  tasks: ScheduleTask[];
  isDoneForToday?: boolean;
  doneAt?: string;
  // Check-In and Check-Out props
  workSessions?: WorkSession[];
  isCheckedIn?: boolean;
  currentCheckInTime?: string;
  currentCheckInTimestamp?: number;
  totalWorkedMinutes?: number;
  onCheckIn?: (timeStr?: string) => void;
  onCheckOut?: (timeStr?: string, notes?: string) => void;
  onDeleteWorkSession?: (sessionId: string) => void;
  // Task operations
  onToggleTask: (taskId: string, completed: boolean, timestamp?: string) => void;
  onUpdateNotes: (taskId: string, notes: string) => void;
  onUpdateTaskName: (taskId: string, taskName: string) => void;
  onUpdateScheduleType?: (taskId: string, scheduleType: string) => void;
  onAddTask: (
    timeSlot: string,
    taskName: string,
    scheduleType?: string,
    scope?: TaskScope,
    daysOfWeek?: number[]
  ) => void;
  onDeleteTask: (taskId: string) => void;
  onMarkAllComplete?: () => void;
  onResetTasks?: () => void;
  onToggleDoneForToday?: () => void;
  onOpenTimeCounterModal?: () => void;
  language?: Language;
}

const TIME_SLOT_PRESETS = [
  { label: '08:00 - 09:00', start: '08:00', end: '09:00', type: 'Schedule' },
  { label: '09:00 - 10:00', start: '09:00', end: '10:00', type: 'Schedule' },
  { label: '10:00 - 11:00', start: '10:00', end: '11:00', type: 'Schedule' },
  { label: '11:00 - 12:00', start: '11:00', end: '12:00', type: 'Schedule' },
  { label: '12:00 - 13:00 (Lunch)', start: '12:00', end: '13:00', type: 'Schedule' },
  { label: '13:00 - 14:00', start: '13:00', end: '14:00', type: 'Schedule' },
  { label: '14:00 - 15:00', start: '14:00', end: '15:00', type: 'Schedule' },
  { label: '15:00 - 16:00', start: '15:00', end: '16:00', type: 'Schedule' },
  { label: '16:00 - 17:00', start: '16:00', end: '17:00', type: 'Schedule' },
  { label: '17:00 - 18:00 (OT)', start: '17:00', end: '18:00', type: 'Over Time' },
  { label: '18:00 - 19:00 (OT)', start: '18:00', end: '19:00', type: 'Over Time' },
  { label: '19:00 - 20:00 (OT)', start: '19:00', end: '20:00', type: 'Over Time' },
  { label: '20:00 - 21:00 (OT)', start: '20:00', end: '21:00', type: 'Over Time' },
];

function getActivityIcon(activityName: string) {
  const lower = (activityName || '').toLowerCase();
  if (lower.includes('chat') || lower.includes('facebook') || lower.includes('reply') || lower.includes('replay') || lower.includes('ឆ្លើយតប')) {
    return <MessageCircle className="w-4 h-4 text-blue-600 shrink-0" />;
  }
  if (lower.includes('platform') || lower.includes('platfrom') || lower.includes('ពិនិត្យ')) {
    return <MonitorCheck className="w-4 h-4 text-emerald-600 shrink-0" />;
  }
  if (lower.includes('idea') || lower.includes('គំនិត')) {
    return <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />;
  }
  if (lower.includes('poster') || lower.includes('design poster') || lower.includes('ឌីហ្សាញ')) {
    return <Palette className="w-4 h-4 text-purple-600 shrink-0" />;
  }
  if (lower.includes('edit video') || lower.includes('កាត់ត')) {
    return <Film className="w-4 h-4 text-indigo-600 shrink-0" />;
  }
  if (lower.includes('post') || lower.includes('page') || lower.includes('ផុស')) {
    return <Send className="w-4 h-4 text-rose-600 shrink-0" />;
  }
  if (lower.includes('element') || lower.includes('ស្វែងរក element')) {
    return <Layers className="w-4 h-4 text-cyan-600 shrink-0" />;
  }
  if (lower.includes('take video') || lower.includes('ថត')) {
    return <Video className="w-4 h-4 text-orange-600 shrink-0" />;
  }
  return <Tag className="w-4 h-4 text-slate-500 shrink-0" />;
}

export const Checklist: React.FC<ChecklistProps> = ({
  tasks,
  isDoneForToday = false,
  doneAt,
  workSessions = [],
  isCheckedIn = false,
  currentCheckInTime,
  currentCheckInTimestamp,
  totalWorkedMinutes = 0,
  onCheckIn,
  onCheckOut,
  onDeleteWorkSession,
  onToggleTask,
  onUpdateNotes,
  onUpdateTaskName,
  onUpdateScheduleType,
  onAddTask,
  onDeleteTask,
  onMarkAllComplete,
  onResetTasks,
  onToggleDoneForToday,
  onOpenTimeCounterModal,
  language = 'en',
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  
  const weekdays = [
    { label: t.sunShort, value: 0 },
    { label: t.monShort, value: 1 },
    { label: t.tueShort, value: 2 },
    { label: t.wedShort, value: 3 },
    { label: t.thuShort, value: 4 },
    { label: t.friShort, value: 5 },
    { label: t.satShort, value: 6 },
  ];

  const [showAddForm, setShowAddForm] = useState(false);
  const [startHourTime, setStartHourTime] = useState('17:00');
  const [endHourTime, setEndHourTime] = useState('18:00');
  const [newTimeSlot, setNewTimeSlot] = useState('17:00 - 18:00');
  const [newTaskName, setNewTaskName] = useState(language === 'km' ? 'ពិនិត្យមើលគ្រប់ Platform' : 'Check platform');
  const [newScheduleType, setNewScheduleType] = useState<'Schedule' | 'Over Time'>('Over Time');
  const [addScope, setAddScope] = useState<TaskScope>('specific_date');
  const [addDaysOfWeek, setAddDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);

  // Check In / Check Out Session States
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [elapsedActiveSeconds, setElapsedActiveSeconds] = useState(0);

  // Live timer for active check-in session
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isCheckedIn && currentCheckInTimestamp) {
      const updateTimer = () => {
        const diff = Math.max(0, Math.floor((Date.now() - currentCheckInTimestamp) / 1000));
        setElapsedActiveSeconds(diff);
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      setElapsedActiveSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCheckedIn, currentCheckInTimestamp]);

  const formatElapsed = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleToggleAddDay = (val: number) => {
    setAddDaysOfWeek((prev) =>
      prev.includes(val) ? prev.filter((d) => d !== val) : [...prev, val]
    );
  };

  // When time pickers change
  const handleStartTimeChange = (val: string) => {
    setStartHourTime(val);
    const combined = `${val} - ${endHourTime}`;
    setNewTimeSlot(combined);
    const startH = parseInt(val.split(':')[0], 10);
    if (!isNaN(startH) && startH >= 17) {
      setNewScheduleType('Over Time');
    }
  };

  const handleEndTimeChange = (val: string) => {
    setEndHourTime(val);
    const combined = `${startHourTime} - ${val}`;
    setNewTimeSlot(combined);
  };

  const handlePresetSelect = (preset: typeof TIME_SLOT_PRESETS[0]) => {
    setStartHourTime(preset.start);
    setEndHourTime(preset.end);
    setNewTimeSlot(`${preset.start} - ${preset.end}`);
    setNewScheduleType(preset.type as 'Schedule' | 'Over Time');
  };

  const handleTimeSlotDirectTextChange = (val: string) => {
    setNewTimeSlot(val);
    const match = val.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (match) {
      setStartHourTime(match[1]);
      setEndHourTime(match[2]);
      const startH = parseInt(match[1].split(':')[0], 10);
      if (!isNaN(startH) && startH >= 17) {
        setNewScheduleType('Over Time');
      }
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    onAddTask(
      newTimeSlot,
      newTaskName.trim(),
      newScheduleType,
      addScope,
      addScope === 'specific_days' ? addDaysOfWeek : undefined
    );
    setNewTaskName(language === 'km' ? 'ពិនិត្យមើលគ្រប់ Platform' : 'Check platform');
    setShowAddForm(false);
  };

  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const overtimeCount = tasks.filter((t) => t.scheduleType === 'Over Time' || t.isOvertime).length;

  const timeStats = useMemo(() => calculateDayWorkHours(tasks), [tasks]);

  // Total session minutes calculation
  const totalSessionMinutes = useMemo(() => {
    if (totalWorkedMinutes && totalWorkedMinutes > 0) return totalWorkedMinutes;
    return workSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  }, [totalWorkedMinutes, workSessions]);

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6">

      {/* ======================================================== */}
      {/* ⏱️ DAILY CHECK-IN & CHECK-OUT TIME TRACKER BANNER */}
      {/* ======================================================== */}
      <div className="mb-6 bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xs transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Left: Status & Work Session Info */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-all ${
              isCheckedIn
                ? 'bg-emerald-500 text-white animate-pulse'
                : workSessions.length > 0
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}>
              {isCheckedIn ? <Play className="w-6 h-6 fill-white" /> : <Timer className="w-6 h-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg uppercase tracking-wider flex items-center gap-1.5 ${
                  isCheckedIn
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : workSessions.length > 0
                    ? 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isCheckedIn ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
                  {isCheckedIn ? (language === 'km' ? 'កំពុងស្ថិតក្នុងម៉ោងធ្វើការ' : 'Active Work Shift') : (language === 'km' ? 'កត់ត្រាម៉ោង ចូល / ចេញ' : 'Daily Work Check In / Out')}
                </span>

                {totalSessionMinutes > 0 && (
                  <span className="text-xs font-extrabold text-indigo-950 bg-indigo-100/80 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                    ⏱️ {t.totalWorkedToday}: {formatMinutesToHours(totalSessionMinutes)}
                  </span>
                )}

                {workSessions.length > 0 && (
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                    {workSessions.length} {t.sessionsLogged}
                  </span>
                )}
              </div>

              <div className="mt-1 flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                {isCheckedIn ? (
                  <p className="font-bold text-emerald-800 flex items-center gap-1.5">
                    <span>{t.checkedInAt} <strong className="text-slate-900">{currentCheckInTime || (language === 'km' ? 'ឥឡូវនេះ' : 'now')}</strong></span>
                    <span className="font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-extrabold text-xs">
                      ⏱️ {formatElapsed(elapsedActiveSeconds)}
                    </span>
                  </p>
                ) : workSessions.length > 0 ? (
                  <p>
                    {language === 'km' ? 'វេនមុនបានចេញនៅម៉ោង' : 'Last session ended at'} <strong className="text-slate-900 font-semibold">{workSessions[workSessions.length - 1].checkOutTime}</strong>. 
                  </p>
                ) : (
                  <p className="text-slate-500">
                    {language === 'km'
                      ? 'ចុច «ចុះឈ្មោះចូល (Check In)» ដើម្បីចាប់ផ្ដើមកត់ត្រាម៉ោងធ្វើការ។ ពេលបញ្ចប់ ឬសម្រាក ចុច «ចុះឈ្មោះចេញ (Check Out)»។'
                      : 'Click Check In to begin timing work. When finished or taking a break, click Check Out.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Check In / Check Out Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap self-end md:self-center">
            
            {/* View Session History Button */}
            {workSessions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSessionHistory(!showSessionHistory)}
                className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95 cursor-pointer"
                title={t.workSessions}
              >
                <History className="w-3.5 h-3.5 text-slate-600" />
                <span>{language === 'km' ? 'ប្រវត្តិ' : 'Logs'} ({workSessions.length})</span>
                {showSessionHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}

            {!isCheckedIn ? (
              /* CHECK IN BUTTON */
              <button
                type="button"
                onClick={() => onCheckIn?.()}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md hover:shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
                title="Check In now and record your start time"
              >
                <LogIn className="w-4 h-4" />
                <span>{workSessions.length > 0 ? (language === 'km' ? 'ចូលធ្វើការម្ដងទៀត (Check In)' : 'Check In Again') : (language === 'km' ? 'ចុះឈ្មោះចូល (Check In)' : t.checkIn)}</span>
              </button>
            ) : (
              /* CHECK OUT BUTTON */
              <button
                type="button"
                onClick={() => onCheckOut?.()}
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md hover:shadow-rose-600/30 transition-all active:scale-95 cursor-pointer"
                title="Check Out now to calculate daily work time"
              >
                <LogOut className="w-4 h-4" />
                <span>{language === 'km' ? 'ចុះឈ្មោះចេញ (Check Out)' : t.checkOut}</span>
              </button>
            )}

          </div>

        </div>

        {/* Expandable Work Session Breakdown Table */}
        {showSessionHistory && workSessions.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              <span>{t.workSessions}</span>
              <span>{t.totalWorkedToday}: {formatMinutesToHours(totalSessionMinutes)}</span>
            </div>

            <div className="space-y-1.5">
              {workSessions.map((session, idx) => (
                <div
                  key={session.id || idx}
                  className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-slate-800">
                      {session.checkInTime} ➔ {session.checkOutTime || (language === 'km' ? 'កំពុងដំណើរការ' : 'In Progress')}
                    </span>
                    {session.type === 'overtime' && (
                      <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                        OT
                      </span>
                    )}
                    {session.notes && (
                      <span className="text-slate-500 text-[11px] truncate max-w-xs">
                        ({session.notes})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-mono">
                      ⏱️ {formatMinutesToHours(session.durationMinutes || 0)}
                    </span>
                    {onDeleteWorkSession && (
                      <button
                        onClick={() => onDeleteWorkSession(session.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                        title={t.deleteSession}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Done For Today Celebration Banner (When active) */}
      {isDoneForToday && (
        <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 rounded-2xl text-white shadow-lg border border-emerald-500 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner shrink-0">
              <CheckCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">✓ {t.doneForTodayCompleted}</h3>
                <span className="px-2 py-0.5 rounded-md bg-white/25 text-[10px] font-black uppercase tracking-wider">
                  {language === 'km' ? 'បានបញ្ជាក់' : 'Verified'}
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                {t.doneForTodayLoggedOn} {doneAt || (language === 'km' ? 'ថ្ងៃនេះ' : 'today')}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onToggleDoneForToday}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/30 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{language === 'km' ? 'បើកកែប្រែឡើងវិញ' : 'Re-open & Edit'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Action Bar with Add Slot and Done Today */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>{t.dailySchedule}</span>
            </h2>

            {overtimeCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-lg bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-black flex items-center gap-1">
                <Clock className="w-3 h-3 text-rose-600" />
                <span>{overtimeCount} {t.overtimeBadge}</span>
              </span>
            )}
            
            {isDoneForToday && (
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-black flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>{t.doneForTodayCompleted}</span>
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-1">
            {language === 'km' 
              ? 'ជ្រើសរើសសកម្មភាព បញ្ជាក់ម៉ោងធម្មតា ឬថែមម៉ោង (OT) និងកត់ត្រាកំណត់សម្គាល់លម្អិត។'
              : 'Select your activity, specify schedule or overtime, and write notes for each time slot.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Done For Today Button */}
          <button
            onClick={onToggleDoneForToday}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer ${
              isDoneForToday
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
            title={isDoneForToday ? 'Click to re-open day' : 'Mark all tasks and day as Done for Today'}
          >
            <CheckCheck className="w-4 h-4" />
            <span>{isDoneForToday ? t.doneForTodayCompleted : t.doneForToday}</span>
          </button>

          {/* Add Extra Time Slot Button */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? (language === 'km' ? 'បិទផ្ទាំង' : 'Close Form') : t.addSlotOt}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🕒 ADD NEW TIME SLOT FORM WITH TIME SELECTORS & PRESETS */}
      {/* ======================================================== */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="mb-6 p-4 sm:p-6 bg-indigo-50/95 border border-indigo-200 rounded-2xl sm:rounded-3xl shadow-xs animate-fadeIn flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>{t.addTimeSlotTitle}</span>
            </h3>

            {/* Schedule vs Over Time Switcher */}
            <div className="flex items-center bg-white p-0.5 rounded-xl border border-indigo-200 shadow-2xs text-xs">
              <button
                type="button"
                onClick={() => setNewScheduleType('Schedule')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  newScheduleType === 'Schedule'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.scheduleRegular}
              </button>
              <button
                type="button"
                onClick={() => setNewScheduleType('Over Time')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  newScheduleType === 'Over Time'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.overTimeOt}
              </button>
            </div>
          </div>

          {/* Quick 1-Click Time Slot Presets */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
              ⚡ {language === 'km' ? 'ជ្រើសរើសចន្លោះពេលរហ័ស៖' : 'Quick Select Time Slot:'}
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {TIME_SLOT_PRESETS.map((preset) => {
                const isSelected = newTimeSlot.includes(preset.start) && newTimeSlot.includes(preset.end);
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : preset.type === 'Over Time'
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Picker Inputs: Start Time & End Time */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-indigo-100">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {language === 'km' ? 'ម៉ោងចាប់ផ្ដើម' : 'Start Time'}
              </label>
              <input
                type="time"
                value={startHourTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white cursor-pointer"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {language === 'km' ? 'ម៉ោងបញ្ចប់' : 'End Time'}
              </label>
              <input
                type="time"
                value={endHourTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white cursor-pointer"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {t.timeSlotLabel}
              </label>
              <input
                type="text"
                value={newTimeSlot}
                onChange={(e) => handleTimeSlotDirectTextChange(e.target.value)}
                placeholder={t.timeSlotPlaceholder}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white font-bold text-indigo-900"
                required
              />
            </div>
          </div>

          {/* Task / Activity Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.selectActivityOrCustom}</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <select
                  value={PRESET_ACTIVITIES.some((a) => a.name === newTaskName) ? newTaskName : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') {
                      setNewTaskName(e.target.value);
                    }
                  }}
                  className="w-full text-xs font-semibold bg-white border border-slate-300 text-slate-800 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none pr-8"
                >
                  <option value="">{t.selectActivityDefault}</option>
                  {PRESET_ACTIVITIES.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                  <option value="__custom__">{t.customTaskOption}</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder={t.taskTitlePlaceholder}
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                required
              />
            </div>
          </div>

          {/* Scope selection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-indigo-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700">{t.applyToLabel}</span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setAddScope('specific_date')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    addScope === 'specific_date' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.thisDateOnly}
                </button>
                <button
                  type="button"
                  onClick={() => setAddScope('all')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    addScope === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.allWorkingDays}
                </button>
                <button
                  type="button"
                  onClick={() => setAddScope('specific_days')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    addScope === 'specific_days' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.selectedDays}
                </button>
              </div>
            </div>

            {addScope === 'specific_days' && (
              <div className="flex items-center gap-1">
                {weekdays.map((w) => {
                  const isSel = addDaysOfWeek.includes(w.value);
                  return (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => handleToggleAddDay(w.value)}
                      className={`w-6 h-6 text-[10px] font-bold rounded-md border transition-all ${
                        isSel
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {w.label[0]}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold rounded-xl whitespace-nowrap shadow-xs transition-all flex items-center gap-1.5 self-end sm:self-auto active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.saveAndAddSlot}</span>
            </button>
          </div>
        </form>
      )}

      {/* Tasks List Cards */}
      {tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">{t.noTasksToday}</p>
          <p className="text-xs text-slate-500 mt-1">{t.noTasksHint}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task, index) => {
            const isMatchPreset = PRESET_ACTIVITIES.some(
              (a) => a.name.toLowerCase() === (task.taskName || '').toLowerCase()
            );
            const isOvertime = task.scheduleType === 'Over Time' || task.isOvertime;

            return (
              <div
                key={task.id}
                className={`group bg-white border rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-2xs hover:shadow-sm ${
                  task.isCompleted
                    ? 'border-emerald-200 bg-emerald-50/10'
                    : isOvertime
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header of Task Item */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Completion Checkbox */}
                    <button
                      type="button"
                      onClick={() => onToggleTask(task.id, !task.isCompleted)}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                        task.isCompleted
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'bg-white border-slate-300 text-transparent hover:border-emerald-500'
                      }`}
                      title={task.isCompleted ? 'Mark uncompleted' : 'Mark completed'}
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>

                    {/* Number badge */}
                    <span className="text-[11px] font-extrabold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                      #{index + 1}
                    </span>

                    {/* Time Slot Badge */}
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{task.timeSlot}</span>
                    </span>

                    {/* RED "SCHEDULE" / "OVER TIME" TAG WITH 1-CLICK TOGGLE */}
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateScheduleType?.(
                          task.id,
                          isOvertime ? 'Schedule' : 'Over Time'
                        )
                      }
                      className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                        isOvertime
                          ? 'text-rose-800 bg-rose-100 border-rose-300 shadow-2xs'
                          : 'text-red-700 bg-red-100 border-red-200'
                      }`}
                      title="Toggle Schedule / Over Time"
                    >
                      <Tag className="w-3.5 h-3.5 text-red-600" />
                      <span>
                        {language === 'km' 
                          ? (isOvertime ? 'ថែមម៉ោង (OT)' : 'កាលវិភាគ')
                          : (task.scheduleType || (task.isOvertime ? 'Over Time' : 'Schedule'))}
                      </span>
                      <span className="text-[9px] opacity-60 ml-0.5">⇄</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1 ml-auto">
                    {task.completedAt && (
                      <span className="text-[10px] text-emerald-600 font-semibold hidden sm:inline mr-1">
                        ✓ {task.completedAt}
                      </span>
                    )}

                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Delete time slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Main Body: Activity Selector + Description + Notes */}
                <div className="mt-3.5 space-y-3">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Activity Select Dropdown */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {language === 'km' ? 'ជ្រើសរើសសកម្មភាព' : 'Select Activity'}
                      </label>
                      <div className="relative">
                        <select
                          value={isMatchPreset ? task.taskName : '__custom__'}
                          onChange={(e) => {
                            if (e.target.value && e.target.value !== '__custom__') {
                              onUpdateTaskName(task.id, e.target.value);
                            }
                          }}
                          className="w-full text-xs sm:text-sm font-semibold bg-slate-50 hover:bg-white text-slate-800 pl-3 pr-8 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white cursor-pointer shadow-2xs transition-all appearance-none"
                        >
                          <option value="">{t.selectActivityDefault}</option>
                          {PRESET_ACTIVITIES.map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                          <option value="__custom__">{t.customTaskOption}</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                      </div>
                    </div>

                    {/* Task Name Editable Input */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {language === 'km' ? 'ឈ្មោះការងារ / ការពិពណ៌នា' : 'Task Name / Description'}
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 top-2.5 flex items-center pointer-events-none">
                          {getActivityIcon(task.taskName)}
                        </div>
                        <input
                          type="text"
                          value={task.taskName}
                          onChange={(e) => onUpdateTaskName(task.id, e.target.value)}
                          placeholder="Activity name..."
                          className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-bold bg-white border border-slate-300 text-slate-900 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes / Remarks / Work Log Box */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                        <span>{t.notesLabel}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {task.notes ? `${task.notes.length} chars` : (language === 'km' ? 'កំណត់សម្គាល់បន្ថែម' : 'Optional remarks')}
                      </span>
                    </label>

                    <input
                      type="text"
                      value={task.notes || ''}
                      onChange={(e) => onUpdateNotes(task.id, e.target.value)}
                      placeholder={t.notesPlaceholder}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Completion Bar & Quick Done for Today Action */}
      {tasks.length > 0 && (
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDoneForToday ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}>
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                {isDoneForToday
                  ? t.doneForTodayCompleted
                  : `${completedCount} / ${tasks.length} ${t.completedOfSlots} (${timeStats.completedHoursFormatted})`}
              </p>
              <p className="text-[11px] text-slate-500">
                {isDoneForToday
                  ? `${t.doneForTodayLoggedOn} ${doneAt || (language === 'km' ? 'ថ្ងៃនេះ' : 'today')}`
                  : t.doneForTodayHint}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleDoneForToday}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                isDoneForToday
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              }`}
            >
              <CheckCheck className="w-4 h-4" />
              <span>{isDoneForToday ? t.doneForTodayCompleted : t.doneForToday}</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
