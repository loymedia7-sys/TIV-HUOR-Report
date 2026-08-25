import React, { useState } from 'react';
import { 
  Download, 
  Settings, 
  SlidersHorizontal, 
  Table, 
  CalendarDays, 
  FileSpreadsheet, 
  LogIn, 
  LogOut, 
  RefreshCw,
  Clock, 
  Menu,
  X
} from 'lucide-react';
import { AuthUser, UserProfile, Language } from '../types';
import { TRANSLATIONS } from '../utils/translations';
import { CambodiaFlag, USAFlag } from './CountryFlags';

interface HeaderProps {
  currentView: 'checklist' | 'summary';
  setCurrentView: (view: 'checklist' | 'summary') => void;
  formattedDateText: string;
  userProfile: UserProfile;
  authUser: AuthUser | null;
  onGoogleLogin: () => void;
  onLogout: () => void;
  isSyncing?: boolean;
  onOpenExportModal: () => void;
  onOpenTemplateModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenInstallModal: () => void;
  isInstalled?: boolean;
  completionPercentage: number;
  isHoliday: boolean;
  language: Language;
  onToggleLanguage: (lang: Language) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  formattedDateText,
  userProfile,
  authUser,
  onGoogleLogin,
  onLogout,
  isSyncing = false,
  onOpenExportModal,
  onOpenTemplateModal,
  onOpenSettingsModal,
  onOpenInstallModal,
  isInstalled = false,
  completionPercentage,
  isHoliday,
  language = 'en',
  onToggleLanguage,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMobileAction = (action: () => void) => {
    setIsMobileMenuOpen(false);
    action();
  };

  return (
    <header className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Left: App Branding, Custom Logo & Company / User Info */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {userProfile.companyLogoUrl ? (
              <div 
                onClick={onOpenSettingsModal}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white border-2 border-indigo-100 shadow-xs overflow-hidden flex items-center justify-center p-0.5 cursor-pointer hover:border-indigo-400 transition-all shrink-0"
                title={t.settings}
              >
                <img
                  src={userProfile.companyLogoUrl}
                  alt={userProfile.companyName || 'Company Logo'}
                  className="w-full h-full object-contain rounded-lg"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div 
                onClick={onOpenSettingsModal}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/20 cursor-pointer hover:opacity-90 transition-all shrink-0"
                title={t.settings}
              >
                <FileSpreadsheet className="w-5 h-5" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-slate-800 truncate">
                  <span>{userProfile.companyName || (language === 'km' ? 'ប្រព័ន្ធកត់ត្រាការងារ' : 'Daily Report')}</span>
                  <span className="text-slate-400 font-normal text-xs sm:text-sm ml-1.5 hidden xs:inline">
                    / {userProfile.employeeName || authUser?.displayName || 'ROTH DARO'}
                  </span>
                </h1>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                <p className="text-[10px] sm:text-[11px] text-indigo-600 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500"></span>
                  <span>{authUser ? t.cloudSync : t.localStorageMode}</span>
                  {isSyncing && <RefreshCw className="w-2.5 h-2.5 text-indigo-500 animate-spin ml-0.5" />}
                </p>
                {authUser?.email && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono hidden md:inline truncate max-w-[140px]">
                    👤 {authUser.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center: View Switcher Tabs (Desktop / Tablet) */}
          <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setCurrentView('checklist')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentView === 'checklist'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{t.dailySchedule}</span>
            </button>

            <button
              onClick={() => setCurrentView('summary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentView === 'summary'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>{t.summaryTable}</span>
            </button>
          </div>

          {/* Right: Desktop Action Buttons (Hidden on Mobile) */}
          <div className="hidden md:flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* Language Switcher Feature with Original Country Flag (Cambodia / USA) */}
            <button
              onClick={() => onToggleLanguage(language === 'en' ? 'km' : 'en')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs border active:scale-95 cursor-pointer ${
                language === 'km'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-950 hover:bg-indigo-100'
                  : 'bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100'
              }`}
              title={language === 'en' ? 'Switch to Khmer (ប្តូរជាភាសាខ្មែរ)' : 'Switch to English'}
            >
              {language === 'km' ? (
                <>
                  <CambodiaFlag className="w-5 h-3.5 shadow-xs" />
                  <span>ភាសាខ្មែរ</span>
                </>
              ) : (
                <>
                  <USAFlag className="w-5 h-3.5 shadow-xs" />
                  <span>English</span>
                </>
              )}
            </button>

            {/* Google Authentication Section */}
            {authUser ? (
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200/80 p-1 pr-2 rounded-xl">
                {authUser.photoURL ? (
                  <img
                    src={authUser.photoURL}
                    alt={authUser.displayName || 'Google Account'}
                    className="w-6 h-6 rounded-lg object-cover border border-indigo-300"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                    {authUser.displayName?.[0] || authUser.email?.[0] || 'U'}
                  </div>
                )}
                <button
                  onClick={onLogout}
                  className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-all cursor-pointer"
                  title={`Sign out (${authUser.email})`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onGoogleLogin}
                className="p-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs transition-all active:scale-95 cursor-pointer"
                title="Google Login"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </button>
            )}

            <button
              onClick={onOpenExportModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-2xs transition-all active:scale-95 cursor-pointer"
              title={t.exportReport}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.exportReport}</span>
            </button>

            <button
              onClick={onOpenTemplateModal}
              className="p-1.5 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 transition-all active:scale-95 cursor-pointer"
              title={t.templateSchedule}
            >
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            </button>

            <button
              onClick={onOpenSettingsModal}
              className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all active:scale-95 cursor-pointer"
              title={t.settings}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Mobile Menu Hamburger Icon (Responsive Conversion) */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            {/* Quick Language Toggle on Mobile with Original Flag */}
            <button
              onClick={() => onToggleLanguage(language === 'en' ? 'km' : 'en')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200 active:scale-95 cursor-pointer"
              title="Toggle Language"
            >
              {language === 'km' ? (
                <>
                  <CambodiaFlag className="w-4 h-3" />
                  <span>KM</span>
                </>
              ) : (
                <>
                  <USAFlag className="w-4 h-3" />
                  <span>EN</span>
                </>
              )}
            </button>

            {/* Mobile Hamburger Button */}
            <button
              id="mobile-menu-toggle-btn"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-all active:scale-95 cursor-pointer shadow-2xs"
              aria-label="Open Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-slate-900" /> : <Menu className="w-5 h-5 text-slate-900" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer / Slide-Down Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 space-y-2 shadow-xl animate-fadeIn">
          
          {/* View Selection on Mobile */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl mb-3">
            <button
              onClick={() => {
                setCurrentView('checklist');
                setIsMobileMenuOpen(false);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all text-center flex flex-col items-center gap-1 ${
                currentView === 'checklist' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>{t.dailySchedule}</span>
            </button>
            <button
              onClick={() => {
                setCurrentView('summary');
                setIsMobileMenuOpen(false);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all text-center flex flex-col items-center gap-1 ${
                currentView === 'summary' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>{t.summaryTable}</span>
            </button>
          </div>

          {/* Action List Items */}
          <div className="space-y-1.5">
            {/* Language Switch with Original Flag */}
            <button
              onClick={() => {
                onToggleLanguage(language === 'en' ? 'km' : 'en');
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                {language === 'km' ? <CambodiaFlag className="w-5 h-3.5" /> : <USAFlag className="w-5 h-3.5" />}
                <span>{language === 'km' ? 'ភាសា៖ ភាសាខ្មែរ (Cambodia)' : 'Language: English (US)'}</span>
              </div>
              <span className="flex items-center gap-1 text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                {language === 'km' ? (
                  <>
                    <USAFlag className="w-3.5 h-2.5" />
                    <span>Switch to EN</span>
                  </>
                ) : (
                  <>
                    <CambodiaFlag className="w-3.5 h-2.5" />
                    <span>ប្តូរជាភាសាខ្មែរ</span>
                  </>
                )}
              </span>
            </button>

            {/* Export Reports */}
            <button
              onClick={() => handleMobileAction(onOpenExportModal)}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-bold text-amber-950 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{t.exportReport} (Excel / PDF)</span>
            </button>

            {/* Template Schedule */}
            <button
              onClick={() => handleMobileAction(onOpenTemplateModal)}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{t.templateSchedule}</span>
            </button>

            {/* Settings */}
            <button
              onClick={() => handleMobileAction(onOpenSettingsModal)}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-600 shrink-0" />
              <span>{t.settings}</span>
            </button>

            {/* Google Authentication */}
            <div className="pt-2 border-t border-slate-200/80">
              {authUser ? (
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 min-w-0">
                    {authUser.photoURL ? (
                      <img
                        src={authUser.photoURL}
                        alt="Profile"
                        className="w-6 h-6 rounded-md object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                        {authUser.displayName?.[0] || 'U'}
                      </div>
                    )}
                    <div className="text-xs font-bold truncate">{authUser.displayName || authUser.email}</div>
                  </div>
                  <button
                    onClick={() => {
                      onLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    onGoogleLogin();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 transition-all shadow-2xs cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{t.googleLogin}</span>
                </button>
              )}
            </div>
          </div>

        </div>
      )}
    </header>
  );
};


