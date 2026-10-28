import React from 'react';
import { Student, AbsenceRecord, TransferBooking } from '../../types';
import { SOLTILO_CLASSES } from '../../data/constants';
import { getEarliestExpiry, getStudentTransferTickets, formatJapaneseDate, formatAbsenceLabel } from '../../lib/expiration';
import { useTranslation } from '../../lib/i18n';
import { User, Calendar, CreditCard, Sparkles, Clock, AlertTriangle, Ticket } from 'lucide-react';

interface StudentSelectorProps {
  students: Student[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  absences?: AbsenceRecord[];
  bookings?: TransferBooking[];
  profile?: React.ReactNode;
  tabs?: React.ReactNode;
}

export const StudentSelector: React.FC<StudentSelectorProps> = ({
  students,
  selectedStudentId,
  onSelectStudent,
  absences = [],
  bookings = [],
  profile,
  tabs
}) => {
  const { language, t, getClassName, getWeekdayName } = useTranslation();

  const currentStudent = students.find((s) => s.id === selectedStudentId) || students[0];
  const currentClass = currentStudent
    ? SOLTILO_CLASSES.find((c) => c.id === currentStudent.classId)
    : null;

  const earliestExpiry = currentStudent
    ? getEarliestExpiry(currentStudent.id, absences, bookings, currentStudent.transferBalance)
    : null;

  const studentTickets = currentStudent
    ? getStudentTransferTickets(currentStudent.id, absences, bookings)
    : [];

  const availableTickets = studentTickets.filter((t) => !t.isBooked && !t.isExpired);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
        <div className="flex flex-col gap-4 min-w-0">
        {profile}

        {/* Child Selector Switcher (Only shown if parent has multiple children) */}
        {students.length > 1 && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              {language === 'en' ? 'Select Child (Siblings in Same Household)' : 'お子さまの選択（同一ご家庭のお子さま）'}
            </label>
            <div className="flex flex-wrap gap-2">
              {students.map((s) => {
                const cls = SOLTILO_CLASSES.find((c) => c.id === s.classId);
                const isSelected = s.id === selectedStudentId;
                return (
                  <button
                    key={s.id}
                    id={`select-student-${s.id}`}
                    onClick={() => onSelectStudent(s.id)}
                    className={`flex items-center space-x-2 px-4 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-150 ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10 ring-2 ring-sky-500 ring-offset-1'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/60'
                    }`}
                  >
                    <User className={`w-4 h-4 ${isSelected ? 'text-sky-400' : 'text-slate-400'}`} />
                    <span>{s.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-md ${cls?.badgeBg || 'bg-slate-200'}`}>
                      {getClassName(s.classId)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex-1" />
        {tabs}
        </div>

        {/* Selected Student Transfer Balance Showcase Card */}
        {currentStudent && (
          <div className="bg-white text-slate-900 rounded-xl p-4 sm:p-5 flex flex-col justify-between w-full shadow-xs border border-slate-200 border-t-4 border-t-amber-400 relative overflow-hidden">
            
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>{t('parent.remainingTickets')}</span>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                    {currentStudent.transferBalance}
                  </span>
                  <span className="text-sm font-semibold text-slate-500">{t('parent.ticketsUnit')}</span>
                </div>
              </div>

              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>

            {/* Active Missed Days Tickets Pills */}
            {availableTickets.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {availableTickets.map((t) => (
                  <span
                    key={t.absenceId}
                    className="inline-flex items-center gap-1 bg-amber-50 border border-amber-300 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md"
                  >
                    <Ticket className="w-2.5 h-2.5 text-amber-600" />
                    <span>【{language === 'en' ? `${t.absenceDate} Missed` : formatAbsenceLabel(t.absenceDate)}】</span>
                  </span>
                ))}
              </div>
            )}

            {/* Transfer Expiry Date Section */}
            <div className="mt-3 pt-2.5 border-t border-slate-200 space-y-1 text-[11px]">
              {currentStudent.transferBalance > 0 && earliestExpiry ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      {language === 'en' ? 'Valid until: ' : '有効期限: '}
                      {language === 'en' ? earliestExpiry.expiryDate : `${formatJapaneseDate(earliestExpiry.expiryDate)} まで`}
                    </span>
                  </div>
                  {earliestExpiry.isExpiringSoon ? (
                    <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold flex items-center gap-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {language === 'en' ? `${earliestExpiry.daysRemaining}d left` : `あと${earliestExpiry.daysRemaining}日`}
                    </span>
                  ) : (
                    <span className="text-slate-500 font-medium text-[10px]">
                      ({language === 'en' ? `${earliestExpiry.daysRemaining}d left` : `残り${earliestExpiry.daysRemaining}日`})
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {language === 'en'
                      ? 'Credits valid until end of month after next'
                      : '振替有効期限: 欠席日の翌々月末まで有効'}
                  </span>
                </div>
              )}

              <div className="text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-sky-600" />
                <span>
                  {t('parent.regularDays')}:{' '}
                  {currentStudent.regularDays.map((d) => getWeekdayName(d, 'long')).join(', ')}
                </span>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
