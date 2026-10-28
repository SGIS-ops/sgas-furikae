import React, { useState } from 'react';
import { Student, AbsenceRecord, TransferBooking, DailyClassOverride, ClassId, WeekdayQuotaSettings, SpecialScheduleDay } from '../../types';
import { StudentSelector } from './StudentSelector';
import { AbsenceReportModal } from './AbsenceReportModal';
import { TransferBookingModal } from './TransferBookingModal';
import { ParentLogin } from './ParentLogin';
import { ChangeCredentialsModal } from './ChangeCredentialsModal';
import { CalendarView } from './CalendarView';
import { SOLTILO_CLASSES } from '../../data/constants';
import { getStudentTransferTickets, formatJapaneseDate, formatAbsenceLabel } from '../../lib/expiration';
import { useTranslation } from '../../lib/i18n';
import { Calendar as CalendarIcon, Clock, PlusCircle, XCircle, BookmarkCheck, LogOut, Key, ShieldCheck, Ticket, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ParentDashboardProps {
  students: Student[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  absences: AbsenceRecord[];
  bookings: TransferBooking[];
  overrides: DailyClassOverride[];
  weekdayQuotas?: WeekdayQuotaSettings;
  specialDays?: SpecialScheduleDay[];
  onSubmitAbsence: (data: {
    studentId: string;
    studentName: string;
    classId: ClassId;
    date: string;
    reason: string;
  }) => boolean | void | Promise<boolean>;
  onBookTransfer: (data: {
    studentId: string;
    studentName: string;
    fromClassId: ClassId;
    targetClassId: ClassId;
    targetDate: string;
  }) => boolean | void | Promise<boolean>;
  onCancelBooking: (bookingId: string) => void;
  onCancelAbsence: (absenceId: string) => void;
  /** サーバー版のログイン（指定時はサーバーで照合） */
  onRemoteLogin?: (loginId: string, password: string) => Promise<string>;
  onLogout?: () => void;
  onUpdateCredentials: (data: { studentId: string; newLoginId: string; newPassword: string }) => boolean | void | Promise<boolean>;
}

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  students,
  selectedStudentId,
  onSelectStudent,
  absences,
  bookings,
  overrides,
  weekdayQuotas,
  specialDays,
  onSubmitAbsence,
  onBookTransfer,
  onCancelBooking,
  onCancelAbsence,
  onRemoteLogin,
  onLogout,
  onUpdateCredentials
}) => {
  const { language, t, getClassName, getReasonLabel } = useTranslation();

  // Authentication state for parent
  // 初期状態は未ログイン（他のご家庭の情報が表示されないよう、必ずID・PWでログインしてから表示する）
  const [loggedInStudentId, setLoggedInStudentId] = useState<string | null>(null);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isChangeCredentialsOpen, setIsChangeCredentialsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'cards'>('calendar');

  // If not logged in, render Parent Login Screen
  if (!loggedInStudentId) {
    return (
      <ParentLogin
        students={students}
        onRemoteLogin={onRemoteLogin}
        onLoginSuccess={(id) => {
          setLoggedInStudentId(id);
          onSelectStudent(id);
        }}
      />
    );
  }

  const currentStudent = students.find((s) => s.id === loggedInStudentId) || students[0];
  const currentClass = currentStudent
    ? SOLTILO_CLASSES.find((c) => c.id === currentStudent.classId)
    : null;

  if (!currentStudent) return null;

  // IMPORTANT PRIVACY FIX: Filter students list so that logged-in parent ONLY sees their own child(ren)
  const parentStudents = students.filter(
    (s) => s.id === currentStudent.id || (s.parentName && s.parentName === currentStudent.parentName)
  );

  // Filter student-specific records
  const studentAbsences = absences.filter((a) => a.studentId === currentStudent.id);
  const studentBookings = bookings.filter((b) => b.studentId === currentStudent.id);
  const activeBookings = studentBookings.filter((b) => b.status === 'booked');

  const handleLogout = () => {
    setLoggedInStudentId(null);
    onSelectStudent('');
    onLogout?.();
  };

  return (
    <div className="space-y-6">
      
      {/* Logged-in Parent Profile Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {currentStudent.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-sm">
                {currentStudent.name} {language === 'ja' ? '様' : ''}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${currentClass?.badgeBg}`}>
                {getClassName(currentStudent.classId)}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              Codmon ID: <span className="font-mono text-slate-700">{currentStudent.loginId}</span>
              <span className="mx-2 text-slate-300">|</span>
              {language === 'en' ? 'Guardian:' : '保護者:'} {currentStudent.parentName}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setIsChangeCredentialsOpen(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center space-x-1 border border-slate-200"
            title={language === 'en' ? 'Change Codmon ID / Password' : 'Codmon ID・パスワードの変更'}
          >
            <Key className="w-3.5 h-3.5 text-blue-600" />
            <span>{language === 'en' ? 'Change ID/PW' : 'ID・PW変更'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition flex items-center space-x-1 border border-rose-200"
            title={language === 'en' ? 'Sign Out' : 'ログアウト'}
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span>{t('login.logout')}</span>
          </button>
        </div>
      </div>

      {/* Default Password Security Warning Callout */}
      {currentStudent.isDefaultPassword && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-start space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">
                {language === 'en' ? 'Using default Codmon password.' : 'Codmon初期パスワードをご使用中です。'}
              </span>
              <span className="text-amber-800 ml-1">
                {language === 'en'
                  ? 'For security, we recommend changing to a unique password.'
                  : 'セキュリティ向上のため、独自のパスワードへ変更することをお勧めします。'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsChangeCredentialsOpen(true)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition shadow-2xs shrink-0 self-start sm:self-auto"
          >
            {language === 'en' ? 'Change PW Now' : '今すぐPWを変更する'}
          </button>
        </div>
      )}

      {/* Parent Tab Switcher: Calendar vs Action Cards */}
      <div className="bg-slate-200/60 p-1 rounded-2xl flex gap-1 border border-slate-300/60 max-w-md">
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'calendar'
              ? 'bg-[#1E3A8A] text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-300/60'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          <span>{language === 'en' ? '📅 Calendar View (12 Wks)' : '📅 カレンダー表示 (12週間空き枠)'}</span>
        </button>

        <button
          onClick={() => setActiveTab('cards')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'cards'
              ? 'bg-[#1E3A8A] text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-300/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{language === 'en' ? '📋 Actions & History' : '📋 手続き・履歴一覧'}</span>
        </button>
      </div>

      {/* Student Selector Card (Restricted strictly to this parent's child/children) */}
      <StudentSelector
        students={parentStudents}
        selectedStudentId={currentStudent.id}
        onSelectStudent={(id) => {
          setLoggedInStudentId(id);
          onSelectStudent(id);
        }}
        absences={absences}
        bookings={bookings}
      />

      {/* Main Content Area depending on Active Tab */}
      {activeTab === 'calendar' ? (
        <CalendarView
          student={currentStudent}
          students={students}
          absences={absences}
          bookings={bookings}
          overrides={overrides}
          weekdayQuotas={weekdayQuotas}
          specialDays={specialDays}
          onOpenBookingForDate={() => setIsBookingModalOpen(true)}
          onOpenAbsenceModal={() => setIsAbsenceModalOpen(true)}
        />
      ) : (
        <div className="space-y-6">
          {/* Main Action Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Report Absence Card */}
            <div className="bg-[#1E3A8A] text-white rounded-2xl p-6 shadow-lg shadow-blue-900/10 flex flex-col justify-between space-y-4">
              <div>
                <div className="inline-flex items-center space-x-1.5 bg-blue-800/80 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-200 mb-2">
                  <Clock className="w-3.5 h-3.5 text-blue-300" />
                  <span>{language === 'en' ? 'Absence Notice' : '欠席連絡'}</span>
                </div>
                <h3 className="text-xl font-extrabold tracking-tight">
                  {language === 'en' ? 'Report Missed Lesson' : 'レッスンのお休み連絡'}
                </h3>
                <p className="text-xs text-blue-100 mt-1 font-medium">
                  {language === 'en'
                    ? 'Advance notice automatically adds +1 make-up credit (valid until end of month after next).'
                    : '事前連絡で【振替残数 +1回】が自動付与されます（翌々月末まで有効）。'}
                </p>
              </div>

              <button
                id="btn-report-absence-trigger"
                onClick={() => setIsAbsenceModalOpen(true)}
                className="w-full bg-white text-[#1E3A8A] hover:bg-blue-50 font-bold py-2.5 px-4 rounded-xl text-xs shadow-xs transition flex items-center justify-center space-x-1.5"
              >
                <PlusCircle className="w-4 h-4 text-[#1E3A8A]" />
                <span>{language === 'en' ? 'Open Absence Form' : '欠席連絡フォームを開く'}</span>
              </button>
            </div>

            {/* Book Transfer Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="inline-flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 mb-2">
                  <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>{language === 'en' ? 'Make-up Booking' : '振替予約'}</span>
                </div>
                <h3 className="text-xl font-extrabold tracking-tight text-slate-900">
                  {language === 'en' ? 'Book / Change Make-up Lesson' : '振替レッスンの予約・変更'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {language === 'en'
                    ? 'Up to 2 make-up slots per day. Valid classes can be booked up to 12 weeks ahead.'
                    : '各日振替枠【最大2名】・有効期限内のクラス（12週間先まで）をご予約可能です。'}
                </p>
              </div>

              <button
                id="btn-book-transfer-trigger"
                onClick={() => setIsBookingModalOpen(true)}
                disabled={currentStudent.transferBalance <= 0}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center space-x-1.5 border border-slate-200/80"
              >
                <BookmarkCheck className="w-4 h-4 text-blue-600" />
                <span>
                  {currentStudent.transferBalance > 0
                    ? (language === 'en' ? 'Find Open Slots & Book' : '振替枠を探して予約する')
                    : (language === 'en' ? 'No Credits Available (0 left)' : '振替残数が0回のため予約不可')}
                </span>
              </button>
            </div>

          </div>

          {/* Active Transfer Tickets & Expiry Status Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center space-x-2">
                <Ticket className="w-5 h-5 text-amber-600" />
                <h2 className="text-base font-extrabold text-slate-900">
                  {language === 'en' ? 'Active Transfer Credits & Expiry' : '保有中の振替チケット・有効期限'}
                </h2>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200 self-start sm:self-auto">
                {language === 'en'
                  ? `Balance: ${currentStudent.transferBalance} credits (Rule: end of month after next)`
                  : `有効残数: ${currentStudent.transferBalance} 回分 (ルール: 欠席日の翌々月末まで)`}
              </span>
            </div>

            {(() => {
              const tickets = getStudentTransferTickets(currentStudent.id, absences, bookings);
              if (tickets.length === 0) {
                return (
                  <div className="bg-slate-50 rounded-xl p-5 text-center border border-dashed border-slate-200 text-slate-500 text-xs font-medium">
                    {language === 'en'
                      ? 'No active make-up credits. (Reporting an absence automatically generates a credit).'
                      : '現在、保有中の振替チケットはありません。（欠席連絡を行うと自動でチケットと有効期限が付与されます）'}
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tickets.map((t, idx) => (
                    <div
                      key={t.absenceId || idx}
                      className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                        t.isBooked
                          ? 'bg-sky-50/70 border-sky-300'
                          : t.isExpired
                          ? 'bg-slate-100 border-slate-300 opacity-60'
                          : t.isExpiringSoon
                          ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-300/60 shadow-xs'
                          : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          {/* Ticket Missed Date Name (e.g. 8/17欠席分) */}
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="inline-flex items-center gap-1 bg-[#1E3A8A] text-white text-xs font-black px-2.5 py-0.5 rounded-lg shadow-2xs">
                              <Ticket className="w-3.5 h-3.5 text-amber-300" />
                              <span>【{language === 'en' ? `${t.absenceDate} Missed` : formatAbsenceLabel(t.absenceDate)}】</span>
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              ({t.reason ? getReasonLabel(t.reason) : (language === 'en' ? 'Absent' : '欠席')})
                            </span>
                          </div>

                          <div className="text-xs font-bold text-slate-800 mt-2 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-700" />
                            <span>
                              {language === 'en' ? 'Valid until:' : '有効期限:'}{' '}
                              <strong className="text-slate-950 font-black">
                                {language === 'en' ? t.expiryDate : formatJapaneseDate(t.expiryDate)}
                              </strong>
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        {t.isBooked ? (
                          <span className="px-2.5 py-1 bg-sky-100 text-sky-800 border border-sky-300 rounded-lg text-xs font-black shrink-0 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                            {language === 'en' ? 'Booked' : '予約済'}
                          </span>
                        ) : t.isExpired ? (
                          <span className="px-2.5 py-1 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold shrink-0">
                            {language === 'en' ? 'Expired' : '期限切れ'}
                          </span>
                        ) : t.isExpiringSoon ? (
                          <span className="px-2.5 py-1 bg-rose-500 text-white rounded-lg text-xs font-black shrink-0 flex items-center gap-1 shadow-2xs animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {language === 'en' ? `${t.daysRemaining} days left` : `あと${t.daysRemaining}日`}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold shrink-0">
                            {language === 'en' ? `Available (${t.daysRemaining}d left)` : `利用可能 (残り${t.daysRemaining}日)`}
                          </span>
                        )}
                      </div>

                      {t.isBooked && t.linkedBookingDate && (
                        <div className="mt-3 pt-2.5 border-t border-sky-200 text-xs text-sky-900 font-bold flex items-center gap-1.5">
                          <BookmarkCheck className="w-4 h-4 text-sky-700" />
                          <span>
                            {language === 'en' ? 'Applied to: ' : '振替予約日: '}
                            <strong>{t.linkedBookingDate}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Active Transfer Bookings Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <BookmarkCheck className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">
                  {language === 'en' ? 'Booked Make-up Lessons' : '予約中の振替レッスン'}
                </h2>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100">
                {activeBookings.length} {language === 'en' ? 'bookings' : '件'}
              </span>
            </div>

            {activeBookings.length === 0 ? (
              <div className="bg-slate-50 rounded-xl p-6 text-center border border-dashed border-slate-200 text-slate-500 text-xs font-medium">
                {language === 'en' ? 'No active make-up lessons booked.' : '現在予約中の振替レッスンはありません。'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeBookings.map((b) => {
                  return (
                    <div
                      key={b.id}
                      className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs text-slate-500 font-medium">
                          {language === 'en' ? 'Make-up Date' : '振替希望日'}
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                          {b.targetDate}
                        </div>
                        <div className="text-xs text-blue-800 font-semibold mt-1">
                          {language === 'en' ? 'Class: ' : 'クラス: '}{getClassName(b.targetClassId)}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const msg = language === 'en'
                            ? `Cancel booking for ${b.targetDate}? (+1 credit will be restored)`
                            : `${b.targetDate} の振替予約をキャンセルしますか？ (振替残数が1回戻ります)`;
                          if (confirm(msg)) {
                            onCancelBooking(b.id);
                          }
                        }}
                        className="px-3 py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-lg transition shadow-xs"
                      >
                        {language === 'en' ? 'Cancel' : 'キャンセル'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activity History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              <span>{language === 'en' ? 'Absence & Make-up History' : '欠席連絡・振替利用の履歴'}</span>
            </h2>

            {studentAbsences.length === 0 && studentBookings.length === 0 ? (
              <div className="bg-slate-50 rounded-xl p-6 text-center border border-dashed border-slate-200 text-slate-500 text-xs font-medium">
                {language === 'en' ? 'No history available.' : '過去の欠席連絡・振替履歴はありません。'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {studentAbsences.map((a) => {
                  return (
                    <div key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center space-x-3">
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                        <div>
                          <span className="font-bold text-slate-800">
                            {language === 'en' ? 'Absent: ' : '欠席: '}{a.date}
                          </span>
                          <span className="text-slate-500 ml-2">({getReasonLabel(a.reason)})</span>
                          <span className="text-[11px] text-amber-700 ml-2 font-medium">
                            [{language === 'en' ? 'Expiry: ' : '有効期限: '}
                            {language === 'en' ? (a.expiryDate || 'End of next month') : (formatJapaneseDate(a.expiryDate || '') || '翌々月末まで')}]
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 self-end sm:self-auto">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                          {language === 'en' ? '+1 Credit Granted' : '+1回 振替付与'}
                        </span>
                        {a.status === 'confirmed' && (
                          <button
                            onClick={() => {
                              const cancelMsg = language === 'en' ? 'Cancel this absence report?' : '欠席連絡を取り消しますか？';
                              if (confirm(cancelMsg)) {
                                onCancelAbsence(a.id);
                              }
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title={language === 'en' ? 'Cancel absence' : '欠席取り消し'}
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {studentBookings.map((b) => (
                  <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-800">
                          {language === 'en' ? 'Make-up: ' : '振替: '}{b.targetDate}
                        </span>
                        <span className="text-slate-500 ml-2">
                          ({b.status === 'booked' ? (language === 'en' ? 'Booked' : '予約中') : (language === 'en' ? 'Completed' : '利用済')})
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                      {language === 'en' ? '-1 Credit Used' : '-1回 振替消費'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Modals */}
      <AbsenceReportModal
        student={currentStudent}
        isOpen={isAbsenceModalOpen}
        onClose={() => setIsAbsenceModalOpen(false)}
        onSubmitAbsence={onSubmitAbsence}
      />

      <TransferBookingModal
        student={currentStudent}
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        students={students}
        absences={absences}
        bookings={bookings}
        overrides={overrides}
        weekdayQuotas={weekdayQuotas}
        specialDays={specialDays}
        onBookTransfer={onBookTransfer}
      />

      <ChangeCredentialsModal
        student={currentStudent}
        isOpen={isChangeCredentialsOpen}
        onClose={() => setIsChangeCredentialsOpen(false)}
        onUpdateCredentials={onUpdateCredentials}
      />

    </div>
  );
};
