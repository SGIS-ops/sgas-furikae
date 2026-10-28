import React, { useState } from 'react';
import {
  Student,
  AbsenceRecord,
  TransferBooking,
  DailyClassOverride,
  ClassId,
  WeekdayQuotaSettings,
  SpecialScheduleDay,
  CodmonSyncLog
} from '../../types';
import { SOLTILO_CLASSES } from '../../data/constants';
import { getClassCapacityForDate } from '../../lib/storage';
import { getStudentTransferTickets, formatAbsenceLabel } from '../../lib/expiration';
import { getCollisionSafetyInfo, CodmonDailyAbsenceItem, CodmonDailyTransferItem } from '../../lib/codmonParser';
import { useTranslation } from '../../lib/i18n';
import { CodmonDailySmartPasteModal } from './CodmonDailySmartPasteModal';
import {
  Calendar,
  Users,
  UserX,
  UserCheck,
  Settings,
  Clock,
  Sparkles,
  ClipboardPaste,
  AlertTriangle
} from 'lucide-react';
import { toLocalDateString } from '../../lib/dateUtils';

interface DailyRosterProps {
  students: Student[];
  absences: AbsenceRecord[];
  bookings: TransferBooking[];
  overrides: DailyClassOverride[];
  weekdayQuotas?: WeekdayQuotaSettings;
  specialDays?: SpecialScheduleDay[];
  lastSync?: CodmonSyncLog | null;
  syncLogs?: CodmonSyncLog[];
  onOpenQuotaModal: (date: string, classId: ClassId) => void;
  onApplyCodmonDailySync?: (result: {
    absences: CodmonDailyAbsenceItem[];
    transfers: CodmonDailyTransferItem[];
    newStudents?: Student[];
    targetDate: string;
    summary: string;
  }) => void;
}

export const DailyRoster: React.FC<DailyRosterProps> = ({
  students,
  absences,
  bookings,
  overrides,
  weekdayQuotas,
  specialDays,
  lastSync = null,
  syncLogs = [],
  onOpenQuotaModal,
  onApplyCodmonDailySync
}) => {
  const { language, getClassName, getReasonLabel } = useTranslation();
  const todayStr = toLocalDateString(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedClassId, setSelectedClassId] = useState<ClassId | 'all'>('all');
  const [isSmartPasteOpen, setIsSmartPasteOpen] = useState(false);

  const activeClasses = selectedClassId === 'all'
    ? SOLTILO_CLASSES
    : SOLTILO_CLASSES.filter((c) => c.id === selectedClassId);

  const dateObj = new Date(selectedDate + 'T00:00:00');
  const dayOfWeek = dateObj.getDay(); // 0=Sun, 1=Mon...
  const dayNames = language === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['日', '月', '火', '水', '木', '金', '土'];

  const safetyInfo = getCollisionSafetyInfo(lastSync?.timestamp, language);

  return (
    <div className="space-y-6">
      {/* Top Banner: Collision Guard & Codmon Smart Paste Callout */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-900 font-extrabold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'CoDMON Daily Screen Paste Sync' : 'コドモン デイリー画面 全選択ペースト連携'}</span>
            </span>

            {/* Last update timestamp badge */}
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${safetyInfo.badgeBg}`}>
              <Clock className="w-3 h-3" />
              <span>
                {language === 'ja' ? '最終更新:' : 'Last Synced:'} {safetyInfo.relativeText}
              </span>
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-black text-slate-100">
            {language === 'ja'
              ? 'コドモン画面を全選択コピーして貼り付けるだけで自動分析・反映'
              : 'One-Click CoDMON Daily Sync with Auto Analysis'}
          </h3>
          <p className="text-xs text-slate-300">
            {safetyInfo.warningMessage ? (
              <span className="text-amber-300 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {safetyInfo.warningMessage}
              </span>
            ) : (
              <span>{language === 'en' ? 'Select all (Ctrl+A) on the CoDMON daily screen, copy, and paste it into one box to automatically apply absences and make-up bookings.' : 'コドモンのデイリー画面で全選択(Ctrl+A)コピーした内容を一つのセルに貼るだけで、欠席登録や振替予約を自動反映します。'}</span>
            )}
          </p>
        </div>

        <button
          type="button"
          id="btn-open-daily-smart-paste"
          onClick={() => setIsSmartPasteOpen(true)}
          className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-black rounded-2xl shadow-lg hover:shadow-indigo-500/25 border border-indigo-400/40 transition flex items-center justify-center space-x-2 shrink-0 group"
        >
          <ClipboardPaste className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform" />
          <span>{language === 'ja' ? '⚡ デイリー画面まるごと貼付（自動分析）' : '⚡ CoDMON Smart Paste'}</span>
        </button>
      </div>

      {/* Date & Class Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Date Selector */}
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-indigo-600 shrink-0" />
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {language === 'ja' ? '確認日選択' : 'Selected Date'}
            </label>
            <div className="flex items-center space-x-2 mt-0.5">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs font-bold text-slate-600">
                {language === 'en' ? `(${dayNames[dayOfWeek]})` : `(${dayNames[dayOfWeek]}曜日)`}
              </span>
            </div>
          </div>
        </div>

        {/* Class Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setSelectedClassId('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              selectedClassId === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'ja' ? '全クラス' : 'All Classes'}
          </button>
          {SOLTILO_CLASSES.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                selectedClassId === cls.id
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'ja' ? cls.jpName : cls.name}
            </button>
          ))}
        </div>
      </div>

      {/* Class Roster Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeClasses.map((cls) => {
          const cap = getClassCapacityForDate(
            selectedDate,
            cls.id,
            students,
            absences,
            bookings,
            overrides,
            weekdayQuotas,
            specialDays
          );

          // Find regulars present
          const regularEnrolled = students.filter(
            (s) => s.classId === cls.id && s.regularDays.includes(dayOfWeek)
          );
          const absentStudentIds = absences
            .filter((a) => a.classId === cls.id && a.date === selectedDate && a.status === 'confirmed')
            .map((a) => a.studentId);

          const regularPresent = regularEnrolled.filter((s) => !absentStudentIds.includes(s.id));
          const regularAbsent = regularEnrolled.filter((s) => absentStudentIds.includes(s.id));

          // Find transfer students
          const transfersBooked = bookings.filter(
            (b) => b.targetClassId === cls.id && b.targetDate === selectedDate && b.status === 'booked'
          );

          return (
            <div
              key={cls.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col"
            >
              {/* Card Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs px-2.5 py-0.5 rounded-md font-bold ${cls.badgeBg}`}>
                      {cls.jpName} ({cls.name})
                    </span>
                    {cls.ageRange && <span className="text-xs text-slate-300">{language === 'en' ? `Ages: ${cls.ageRange}` : `対象: ${cls.ageRange}`}</span>}
                  </div>
                  <div className="text-xs text-slate-300 mt-1 flex items-center gap-3">
                    <span>
                      {language === 'en' ? 'Make-up slots: ' : '振替枠: '}<strong className="text-amber-400">{cap.transferBookedCount} / {cap.maxTransferQuota}{language === 'en' ? '' : '名'}</strong>
                    </span>
                    <span>
                      {language === 'en' ? 'Expected attendance: ' : '総出席予定: '}<strong className="text-sky-300">{cap.totalPresentCount} / {cap.maxTotalCapacity}{language === 'en' ? '' : '名'}</strong>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onOpenQuotaModal(selectedDate, cls.id)}
                  className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1 border border-slate-700 transition"
                  title={language === 'en' ? 'Customize capacity & make-up slots' : '定員・振替枠のカスタマイズ'}
                >
                  <Settings className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">{language === 'en' ? 'Slots' : '枠設定'}</span>
                </button>
              </div>

              {/* Attendance Roster Content */}
              <div className="p-5 space-y-4 flex-1">
                {/* 1. Attending Regular Students */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                    <span className="flex items-center space-x-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      <span>{language === 'en' ? `Regular Students (${regularPresent.length})` : `通常受講生 (${regularPresent.length}名)`}</span>
                    </span>
                  </div>

                  {regularPresent.length === 0 ? (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {language === 'en' ? 'No regular students scheduled' : '通常受講予定者はいません'}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {regularPresent.map((s) => (
                        <div
                          key={s.id}
                          className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>{s.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Transfer Students */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                    <span className="flex items-center space-x-1.5">
                      <Users className="w-4 h-4 text-sky-600" />
                      <span>{language === 'en' ? `Make-up Students (${transfersBooked.length} / max ${cap.maxTransferQuota} slots)` : `振替受講生 (${transfersBooked.length}名 / 最大${cap.maxTransferQuota}枠)`}</span>
                    </span>
                  </div>

                  {transfersBooked.length === 0 ? (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {language === 'en' ? 'No make-up bookings' : '振替予約はありません'}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {transfersBooked.map((b) => {
                        const tickets = getStudentTransferTickets(b.studentId, absences, bookings);
                        const matched = tickets.find((t) => t.linkedBookingDate === b.targetDate);
                        return (
                          <div
                            key={b.id}
                            className="bg-sky-50 text-sky-900 border border-sky-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5"
                          >
                            <span className="w-2 h-2 rounded-full bg-sky-500" />
                            <span>{b.studentName}</span>
                            {matched ? (
                              <span className="text-[10px] text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded border border-sky-200 font-bold">
                                {language === 'en' ? `Make-up for ${Number(matched.absenceDate.split('-')[1])}/${Number(matched.absenceDate.split('-')[2])} absence` : `【${formatAbsenceLabel(matched.absenceDate)}】振替`}
                              </span>
                            ) : (
                              <span className="text-[10px] text-sky-700 bg-white px-1.5 rounded border border-sky-200">
                                {language === 'en' ? 'Make-up' : '振替受講'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Absences */}
                {regularAbsent.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-rose-700 mb-2">
                      <UserX className="w-4 h-4 text-rose-600" />
                      <span>{language === 'en' ? `Absent Today (${regularAbsent.length})` : `本日の欠席生徒 (${regularAbsent.length}名)`}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {regularAbsent.map((s) => {
                        const rec = absences.find(
                          (a) => a.studentId === s.id && a.date === selectedDate && a.status === 'confirmed'
                        );
                        return (
                          <div
                            key={s.id}
                            className="bg-rose-50 text-rose-900 border border-rose-200 px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5"
                          >
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span className="line-through">{s.name}</span>
                            <span className="text-[10px] text-rose-700 font-normal">
                              ({language === 'en' ? (rec?.reason ? getReasonLabel(rec.reason) : 'Absent') : (rec?.reason || '欠席')})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Codmon Daily Screen Smart Paste Modal */}
      <CodmonDailySmartPasteModal
        isOpen={isSmartPasteOpen}
        onClose={() => setIsSmartPasteOpen(false)}
        defaultDate={selectedDate}
        students={students}
        absences={absences}
        bookings={bookings}
        lastSync={lastSync}
        syncLogs={syncLogs}
        onApplySync={(res) => {
          if (onApplyCodmonDailySync) {
            onApplyCodmonDailySync(res);
          }
        }}
      />
    </div>
  );
};
