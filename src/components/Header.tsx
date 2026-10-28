import React from 'react';
import { ViewMode, GoogleSheetsConfig } from '../types';
import { useTranslation } from '../lib/i18n';
import { UserCheck, ShieldCheck, FileSpreadsheet, RefreshCw, Globe } from 'lucide-react';

interface HeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sheetsConfig: GoogleSheetsConfig;
  onOpenSheetsModal: () => void;
  onSyncSheets: () => void;
  isSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onViewModeChange,
  sheetsConfig,
  onOpenSheetsModal,
  onSyncSheets,
  isSyncing
}) => {
  const { language, setLanguage, t } = useTranslation();

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 md:sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-amber-400 p-0.5 flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <span className="text-amber-400 font-extrabold text-base tracking-tight">SG</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold whitespace-nowrap text-slate-100 tracking-tight leading-tight">
                  SOLTILO GSA <span className="text-sky-400 font-medium text-xs sm:text-sm">{t('header.subtitle')}</span>
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800 font-medium whitespace-nowrap">
                  {t('header.badge')}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-bold whitespace-nowrap hidden sm:inline-flex items-center gap-1" title={language === 'en' ? 'Running on public sample data' : '公開用サンプルデータ稼働中'}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {language === 'en' ? 'Sample Data' : '公開サンプル版'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                {t('header.description')}
              </p>
            </div>
          </div>

          {/* Controls: Mode Switcher + Language Toggle + Google Sheets Integration */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Language Switcher Button (JA / EN) */}
            <div className="bg-slate-800/90 p-0.5 rounded-xl border border-slate-700 flex items-center shadow-2xs">
              <div className="flex items-center pl-2 pr-1 text-slate-400">
                <Globe className="w-3.5 h-3.5" />
              </div>
              <button
                id="btn-lang-ja"
                type="button"
                onClick={() => setLanguage('ja')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  language === 'ja'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="日本語に切り替え / Switch to Japanese"
              >
                JA
              </button>
              <button
                id="btn-lang-en"
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  language === 'en'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch to English"
              >
                EN
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/80 flex items-center shadow-2xs">
              <button
                id="btn-parent-mode"
                onClick={() => onViewModeChange('parent')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 whitespace-nowrap ${
                  viewMode === 'parent'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{t('header.parentMode')}</span>
              </button>

              <button
                id="btn-admin-mode"
                onClick={() => onViewModeChange('admin')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 whitespace-nowrap ${
                  viewMode === 'admin'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('header.adminMode')}</span>
              </button>
            </div>

            {/* Google Sheets Sync Button */}
            {sheetsConfig.spreadsheetId ? (
              <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs shadow-2xs">
                <button
                  id="btn-sync-sheets"
                  onClick={onSyncSheets}
                  disabled={isSyncing}
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium transition whitespace-nowrap"
                  title="Google Sheets Sync"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden md:inline">{t('header.sheetsSync')}</span>
                </button>

                <a
                  href={sheetsConfig.spreadsheetUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-sky-300 flex items-center gap-1 pl-2 border-l border-slate-700 text-xs"
                  title={t('header.sheetsOpen')}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden lg:inline text-slate-300">{t('header.sheetsOpen')}</span>
                </a>
              </div>
            ) : (
              <button
                id="btn-connect-sheets"
                onClick={onOpenSheetsModal}
                className="flex items-center space-x-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-2.5 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">{t('header.sheetsSettings')}</span>
              </button>
            )}

          </div>
        </div>
      </div>
    </header>
  );
};
