import React from 'react';
import { ViewMode, GoogleSheetsConfig } from '../types';
import { useTranslation } from '../lib/i18n';
import logoSgas from '../assets/logo-sgas.png';
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
    <header className="bg-white text-slate-900 border-b border-slate-200 md:sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <img src={logoSgas} alt="SOLTILO GSA After School" className="h-9 sm:h-10 w-auto shrink-0" />
            <div className="min-w-0 border-l border-slate-200 pl-3">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold whitespace-nowrap text-slate-900 tracking-tight leading-tight">
                  {t('header.badge')}
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-slate-600 border border-sky-200 font-bold whitespace-nowrap hidden sm:inline-flex items-center gap-1" title={language === 'en' ? 'Running on public sample data' : '公開用サンプルデータ稼働中'}>
                  {language === 'en' ? 'Sample Data' : '公開サンプル版'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                {t('header.description')}
              </p>
            </div>
          </div>

          {/* Controls: Mode Switcher + Language Toggle + Google Sheets Integration */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Language Switcher Button (JA / EN) */}
            <div className="bg-slate-100 p-0.5 rounded-xl border border-slate-200 flex items-center shadow-2xs">
              <div className="flex items-center pl-2 pr-1 text-slate-500">
                <Globe className="w-3.5 h-3.5" />
              </div>
              <button
                id="btn-lang-ja"
                type="button"
                onClick={() => setLanguage('ja')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  language === 'ja'
                    ? 'bg-[#1F3C6B] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
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
            <div className="bg-slate-100 p-0.5 rounded-xl border border-slate-200 flex items-center shadow-2xs">
              <button
                id="btn-parent-mode"
                onClick={() => onViewModeChange('parent')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 whitespace-nowrap ${
                  viewMode === 'parent'
                    ? 'bg-[#1F3C6B] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
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
                    ? 'bg-[#1F3C6B] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('header.adminMode')}</span>
              </button>
            </div>

            {/* Google Sheets Sync Button */}
            {sheetsConfig.spreadsheetId ? (
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
                <button
                  id="btn-sync-sheets"
                  onClick={onSyncSheets}
                  disabled={isSyncing}
                  className="flex items-center gap-1 text-slate-700 hover:text-slate-900 font-medium transition whitespace-nowrap"
                  title="Google Sheets Sync"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden md:inline">{t('header.sheetsSync')}</span>
                </button>

                <a
                  href={sheetsConfig.spreadsheetUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-500 hover:text-slate-900 flex items-center gap-1 pl-2 border-l border-slate-200 text-xs"
                  title={t('header.sheetsOpen')}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden lg:inline text-slate-600">{t('header.sheetsOpen')}</span>
                </a>
              </div>
            ) : (
              <button
                id="btn-connect-sheets"
                onClick={onOpenSheetsModal}
                className="flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-2.5 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">{t('header.sheetsSettings')}</span>
              </button>
            )}

          </div>
        </div>
      </div>
    </header>
  );
};
