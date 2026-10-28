import React, { useState } from 'react';
import {
  Student,
  AbsenceRecord,
  TransferBooking,
  DailyClassOverride,
  ClassId,
  GoogleSheetsConfig,
  WeekdayQuotaSettings,
  SpecialScheduleDay
} from '../../types';
import { DailyRoster } from './DailyRoster';
import { StudentManagement } from './StudentManagement';
import { QuotaSettingsModal } from './QuotaSettingsModal';
import { CodmonIntegrationPanel } from './CodmonIntegrationPanel';
import { QuotaAndScheduleSettings } from './QuotaAndScheduleSettings';
import {
  CodmonStudentParsedRow,
  CodmonAbsenceParsedRow,
  CodmonDailyAbsenceItem,
  CodmonDailyTransferItem,
  getCollisionSafetyInfo
} from '../../lib/codmonParser';
import { CodmonSyncLog } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { Users, Calendar, UserX, FileSpreadsheet, RefreshCw, ShieldCheck, Sparkles, Upload, Sliders, Clock, AlertTriangle } from 'lucide-react';
import { toLocalDateString } from '../../lib/dateUtils';

interface AdminDashboardProps {
  students: Student[];
  absences: AbsenceRecord[];
  bookings: TransferBooking[];
  overrides: DailyClassOverride[];
  weekdayQuotas: WeekdayQuotaSettings;
  specialDays: SpecialScheduleDay[];
  sheetsConfig: GoogleSheetsConfig;
  lastSync?: CodmonSyncLog | null;
  syncLogs?: CodmonSyncLog[];
  onOpenSheetsModal: () => void;
  onSyncSheets: () => void;
  isSyncing: boolean;
  onUpdateTransferBalance: (studentId: string, delta: number) => void;
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onSaveOverride: (override: DailyClassOverride) => void;
  onDeleteOverride?: (date: string, classId: ClassId) => void;
  onSaveWeekdayQuotas: (quotas: WeekdayQuotaSettings) => void;
  onSaveSpecialDays: (specialDays: SpecialScheduleDay[]) => void;
  onImportCodmonStudents: (
    importedList: CodmonStudentParsedRow[],
    mode: 'merge' | 'replace'
  ) => void;
  onImportCodmonAbsences: (
    importedAbsences: CodmonAbsenceParsedRow[]
  ) => void;
  onApplyCodmonDailySync?: (result: {
    absences: CodmonDailyAbsenceItem[];
    transfers: CodmonDailyTransferItem[];
    newStudents?: Student[];
    targetDate: string;
    summary: string;
  }) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  students,
  absences,
  bookings,
  overrides,
  weekdayQuotas,
  specialDays,
  sheetsConfig,
  lastSync = null,
  syncLogs = [],
  onOpenSheetsModal,
  onSyncSheets,
  isSyncing,
  onUpdateTransferBalance,
  onAddStudent,
  onSaveOverride,
  onDeleteOverride,
  onSaveWeekdayQuotas,
  onSaveSpecialDays,
  onImportCodmonStudents,
  onImportCodmonAbsences,
  onApplyCodmonDailySync
}) => {
  const { language, t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'roster' | 'students' | 'settings' | 'codmon' | 'sheets'>('roster');
  const [quotaModalState, setQuotaModalState] = useState<{
    isOpen: boolean;
    date: string;
    classId: ClassId;
  }>({
    isOpen: false,
    date: toLocalDateString(new Date()),
    classId: 'ex1'
  });

  const todayStr = toLocalDateString(new Date());
  const todayAbsences = absences.filter((a) => a.date === todayStr && a.status === 'confirmed');
  const todayTransfers = bookings.filter((b) => b.targetDate === todayStr && b.status === 'booked');
  const safetyInfo = getCollisionSafetyInfo(lastSync?.timestamp, language);

  return (
    <div className="space-y-6">
      
      {/* Top Admin Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Students */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">{t('admin.totalStudents')}</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {students.length} <span className="text-xs text-slate-500 font-normal">{language === 'en' ? 'students' : '名'}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Today Absences */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">{t('admin.todayAbsences')}</span>
            <div className="text-2xl font-extrabold text-rose-600 mt-0.5">
              {todayAbsences.length} <span className="text-xs text-slate-500 font-normal">{language === 'en' ? 'absent' : '名'}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <UserX className="w-5 h-5" />
          </div>
        </div>

        {/* Today Transfers */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">{t('admin.todayTransfers')}</span>
            <div className="text-2xl font-extrabold text-sky-600 mt-0.5">
              {todayTransfers.length} <span className="text-xs text-slate-500 font-normal">{language === 'en' ? 'transfers' : '名'}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Google Sheets Status */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">{t('admin.sheetsConnected')}</span>
            <div className="text-xs font-bold text-slate-800 mt-1">
              {sheetsConfig.spreadsheetId ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {language === 'en' ? 'Connected' : '連携中'}
                </span>
              ) : (
                <span className="text-slate-400">{language === 'en' ? 'Not connected' : '未連携'}</span>
              )}
            </div>
          </div>

          <button
            onClick={sheetsConfig.spreadsheetId ? onSyncSheets : onOpenSheetsModal}
            className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition"
            title={sheetsConfig.spreadsheetId ? (language === 'en' ? 'Sync Sheets' : 'Google Sheetsへ同期') : (language === 'en' ? 'Configure' : '連携設定')}
          >
            <FileSpreadsheet className="w-5 h-5" />
          </button>
        </div>

      </div>

      {/* Admin Tab Switcher */}
      <div className="bg-slate-200/60 p-1 rounded-2xl flex flex-wrap gap-1 border border-slate-300/60">
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-extrabold transition ${
            activeTab === 'roster'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-700 hover:bg-slate-300/60'
          }`}
        >
          {t('admin.tabs.roster')}
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-extrabold transition ${
            activeTab === 'students'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-700 hover:bg-slate-300/60'
          }`}
        >
          {t('admin.tabs.students')}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'settings'
              ? 'bg-indigo-900 text-white shadow-sm ring-1 ring-indigo-500'
              : 'text-indigo-950 font-black hover:bg-indigo-100/60'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span>{t('admin.tabs.settings')}</span>
        </button>

        <button
          onClick={() => setActiveTab('codmon')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'codmon'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-700 hover:bg-slate-300/60'
          }`}
        >
          <Upload className="w-3.5 h-3.5 text-slate-400" />
          <span>{t('admin.tabs.codmon')}</span>
        </button>

        <button
          onClick={() => setActiveTab('sheets')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-extrabold transition ${
            activeTab === 'sheets'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-700 hover:bg-slate-300/60'
          }`}
        >
          {t('admin.tabs.sheets')}
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'roster' && (
        <DailyRoster
          students={students}
          absences={absences}
          bookings={bookings}
          overrides={overrides}
          weekdayQuotas={weekdayQuotas}
          specialDays={specialDays}
          lastSync={lastSync}
          syncLogs={syncLogs}
          onOpenQuotaModal={(date, classId) =>
            setQuotaModalState({ isOpen: true, date, classId })
          }
          onApplyCodmonDailySync={onApplyCodmonDailySync}
        />
      )}

      {activeTab === 'students' && (
        <StudentManagement
          students={students}
          onUpdateTransferBalance={onUpdateTransferBalance}
          onAddStudent={onAddStudent}
          onOpenCodmonTab={() => setActiveTab('codmon')}
        />
      )}

      {activeTab === 'settings' && (
        <QuotaAndScheduleSettings
          weekdayQuotas={weekdayQuotas}
          specialDays={specialDays}
          overrides={overrides}
          onSaveWeekdayQuotas={onSaveWeekdayQuotas}
          onSaveSpecialDays={onSaveSpecialDays}
          onSaveOverride={onSaveOverride}
          onDeleteOverride={onDeleteOverride}
        />
      )}

      {activeTab === 'codmon' && (
        <CodmonIntegrationPanel
          students={students}
          absences={absences}
          onImportStudents={onImportCodmonStudents}
          onImportAbsences={onImportCodmonAbsences}
        />
      )}

      {activeTab === 'sheets' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {language === 'en' ? 'Google Sheets Real-time Sync' : 'Googleスプレッドシート リアルタイム同期'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'en' ? 'Automatically export and sync the student list, remaining make-up credits, absence notices, and make-up bookings to Google Sheets.' : 'アプリ内の生徒一覧、振替残数、欠席連絡、振替予約状況をGoogle Sheetsに自動エクスポート・同期できます。'}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-700 space-y-2">
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>{language === 'en' ? 'Synced sheet contents:' : '同期されるシート内容:'}</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 pl-2">
              <li>{language === 'en' ? '[Students & Remaining Credits]: student name, class, weekdays attended, current make-up credits' : '【生徒一覧・振替残数】: 生徒名、クラス、通学曜日、現在の振替残数'}</li>
              <li>{language === 'en' ? '[Absence Notices]: past and upcoming absences with reasons' : '【欠席連絡一覧】: 過去・将来の欠席履歴と理由'}</li>
              <li>{language === 'en' ? '[Make-up Bookings]: booked make-up dates and classes' : '【振替予約一覧】: 予約済みの振替日とクラス'}</li>
            </ul>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {sheetsConfig.spreadsheetId ? (
              <>
                <button
                  onClick={onSyncSheets}
                  disabled={isSyncing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow transition flex items-center space-x-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{language === 'en' ? 'Sync to Spreadsheet Now' : '今すぐスプレッドシートへ手動同期'}</span>
                </button>

                <a
                  href={sheetsConfig.spreadsheetUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow transition flex items-center space-x-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>{language === 'en' ? 'Open Google Sheets' : 'Googleスプレッドシートを開く'}</span>
                </a>
              </>
            ) : (
              <button
                onClick={onOpenSheetsModal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow transition flex items-center space-x-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{language === 'en' ? 'Create / Connect Google Sheets' : 'Googleスプレッドシートを新規作成・連携する'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quota Settings Modal */}
      <QuotaSettingsModal
        isOpen={quotaModalState.isOpen}
        date={quotaModalState.date}
        classId={quotaModalState.classId}
        overrides={overrides}
        onClose={() => setQuotaModalState((prev) => ({ ...prev, isOpen: false }))}
        onSaveOverride={onSaveOverride}
      />

    </div>
  );
};
