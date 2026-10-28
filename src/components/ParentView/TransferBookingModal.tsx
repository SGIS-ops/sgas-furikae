import React, { useState } from 'react';
import { Student, AbsenceRecord, TransferBooking, DailyClassOverride, ClassId, WeekdayQuotaSettings, SpecialScheduleDay } from '../../types';
import { SOLTILO_CLASSES } from '../../data/constants';
import { getClassCapacityForDate } from '../../lib/storage';
import { getHolidayName } from '../../lib/holidays';
import { getEarliestExpiry, getStudentTransferTickets, formatJapaneseDate, formatAbsenceLabel } from '../../lib/expiration';
import { useTranslation } from '../../lib/i18n';
import { X, Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Ticket, ShieldCheck, Sparkles, Clock, AlertTriangle } from 'lucide-react';
import { toLocalDateString } from '../../lib/dateUtils';

interface TransferBookingModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  absences: AbsenceRecord[];
  bookings: TransferBooking[];
  overrides: DailyClassOverride[];
  weekdayQuotas?: WeekdayQuotaSettings;
  specialDays?: SpecialScheduleDay[];
  onBookTransfer: (data: {
    studentId: string;
    studentName: string;
    fromClassId: ClassId;
    targetClassId: ClassId;
    targetDate: string;
  }) => boolean | void | Promise<boolean>;
}

const TransferBookingModalInner: React.FC<React.PropsWithChildren<TransferBookingModalProps>> = ({
  student,
  isOpen,
  onClose,
  students,
  absences,
  bookings,
  overrides,
  weekdayQuotas,
  specialDays,
  onBookTransfer
}) => {
  const { language, t, getClassName, getWeekdayName, getSpecialTypeLabel } = useTranslation();


  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Start year & month for 3-month vertical scroll
  const [startYear, setStartYear] = useState(() => new Date().getFullYear());
  const [startMonth, setStartMonth] = useState(() => new Date().getMonth());

  const monthNamesJp = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];
  const monthNamesEn = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const getMonthLabel = (y: number, m: number) => {
    return language === 'en' ? `${monthNamesEn[m]} ${y}` : `${y}年 ${monthNamesJp[m]}`;
  };

  const earliestExpiry = getEarliestExpiry(student.id, absences, bookings, student.transferBalance);

  const tickets = getStudentTransferTickets(student.id, absences, bookings);
  const availableTickets = tickets.filter((t) => !t.isBooked && !t.isExpired);
  const nextTicketToUse = availableTickets[0];

  const prev3Months = () => {
    let m = startMonth - 3;
    let y = startYear;
    if (m < 0) {
      m += 12;
      y -= 1;
    }
    setStartMonth(m);
    setStartYear(y);
  };

  const next3Months = () => {
    let m = startMonth + 3;
    let y = startYear;
    if (m >= 12) {
      m -= 12;
      y += 1;
    }
    setStartMonth(m);
    setStartYear(y);
  };

  const setYear = (yr: number) => {
    setStartYear(yr);
  };

  // Generate 3 consecutive months
  const getThreeMonths = () => {
    const list = [];
    for (let i = 0; i < 3; i++) {
      let m = startMonth + i;
      let y = startYear;
      if (m >= 12) {
        m -= 12;
        y += 1;
      }
      list.push({ year: y, month: m });
    }
    return list;
  };

  const threeMonths = getThreeMonths();

  // Build calendar days matrix for specific month
  const getCalendarDays = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDay.getDay() - 1; // Mon=0 ... Sun=6
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDay.getDate();
    const days: { dateStr: string; isCurrentMonth: boolean; dayNum: number; dateObj: Date }[] = [];

    const prevLast = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevLast - i);
      days.push({
        dateStr: toLocalDateString(d),
        isCurrentMonth: false,
        dayNum: d.getDate(),
        dateObj: d
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({
        dateStr: toLocalDateString(d),
        isCurrentMonth: true,
        dayNum: i,
        dateObj: d
      });
    }

    const remaining = 35 - days.length > 0 ? 35 - days.length : 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        dateStr: toLocalDateString(d),
        isCurrentMonth: false,
        dayNum: i,
        dateObj: d
      });
    }

    return days;
  };

  const todayStr = toLocalDateString(new Date());

  const handleConfirmBooking = async () => {
    if (!selectedDate) return;

    if (student.transferBalance <= 0) {
      alert(language === 'en' ? 'Not enough make-up credits.' : '振替残数が足りません。事前に欠席連絡を提出してください。');
      return;
    }

    const accepted = await onBookTransfer({
      studentId: student.id,
      studentName: student.name,
      fromClassId: student.classId,
      targetClassId: student.classId,
      targetDate: selectedDate
    });
    // 保存直前の再チェックで弾かれた場合（満席・二重予約など）は完了表示を出さない
    if (accepted === false) {
      alert(
        language === 'en'
          ? 'This date could not be booked (full, already booked, or not accepting make-ups). Please choose another date.'
          : 'この日は予約できませんでした（満席・予約済み・受付対象外のいずれか）。別の日をお選びください。'
      );
      return;
    }

    const ticketLabel = nextTicketToUse
      ? (language === 'en' ? ` [${nextTicketToUse.absenceDate} credit used]` : `（【${formatAbsenceLabel(nextTicketToUse.absenceDate)}】を使用）`)
      : '';
    const success = language === 'en'
      ? `Make-up booked for ${selectedDate} (${getClassName(student.classId)})!${ticketLabel}`
      : `${selectedDate}（${getClassName(student.classId)}）の振替予約が完了しました！${ticketLabel}`;
    setSuccessMsg(success);
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#1F3C6B] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">{t('booking.modalTitle')}</h2>
              <p className="text-xs text-blue-200">
                {student.name} ({language === 'en' ? 'Credits: ' : 'チケット: '}
                <span className="text-amber-300 font-extrabold">{student.transferBalance} {t('parent.ticketsUnit')}</span>)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white p-1.5 rounded-lg hover:bg-blue-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {successMsg ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-base font-bold text-slate-800">{successMsg}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            
            {/* Top Info Bar */}
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-lg font-bold text-xs bg-blue-100 text-blue-900">
                    {getClassName(student.classId)}
                  </span>
                  <span className="text-slate-600 font-medium">
                    {language === 'en' ? 'Enrolled class only' : '在籍クラス限定'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {nextTicketToUse && (
                    <div className="flex items-center space-x-1 bg-amber-50 border border-amber-300 text-amber-950 px-2.5 py-0.5 rounded-lg font-bold text-xs">
                      <Ticket className="w-3.5 h-3.5 text-amber-700" />
                      <span>
                        {language === 'en' ? 'Using: ' : '使用チケット: '}
                        【{language === 'en' ? `${nextTicketToUse.absenceDate} Missed` : formatAbsenceLabel(nextTicketToUse.absenceDate)}】
                      </span>
                      <span className="text-slate-500 font-medium text-[11px]">
                        ({language === 'en' ? 'Exp: ' : '期限: '}{nextTicketToUse.expiryDate})
                      </span>
                      {nextTicketToUse.isExpiringSoon && (
                        <span className="text-rose-600 font-black ml-1">
                          ({language === 'en' ? `${nextTicketToUse.daysRemaining}d left` : `あと${nextTicketToUse.daysRemaining}日`})
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center space-x-1 bg-blue-100 border border-blue-300 px-2.5 py-0.5 rounded-lg font-bold text-blue-900 text-xs">
                    <Ticket className="w-3.5 h-3.5 text-blue-700" />
                    <span>{language === 'en' ? `Credits: ${student.transferBalance}` : `残数 ${student.transferBalance}枚`}</span>
                  </div>
                </div>
              </div>

              {/* Controls & Fast Year Selector */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                <div className="flex items-center space-x-2 text-xs font-extrabold text-[#1F3C6B]">
                  <span>{getMonthLabel(threeMonths[0].year, threeMonths[0].month)} 〜 {getMonthLabel(threeMonths[2].year, threeMonths[2].month)}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={prev3Months}
                      className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition"
                      title={language === 'en' ? 'Prev 3 Months' : '前3か月'}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={next3Months}
                      className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition"
                      title={language === 'en' ? 'Next 3 Months' : '次3か月'}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs">
                  {[2025, 2026, 2027, 2028].map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setYear(yr)}
                      className={`px-2 py-0.5 rounded font-bold transition text-[11px] ${
                        startYear === yr
                          ? 'bg-[#1F3C6B] text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Symbol Legend */}
              <div className="flex flex-wrap items-center justify-between text-[11px] font-extrabold text-slate-600 pt-1">
                <span className="text-emerald-700">{language === 'en' ? 'Open = Selectable' : '空2 = 選択可能'}</span>
                <span className="text-slate-400">{language === 'en' ? 'Full = No slots' : '満 = 満員'}</span>
                <span className="text-emerald-800">{language === 'en' ? 'Green = Regular' : '緑セル = 通常授業'}</span>
                <span>{language === 'en' ? 'Off = Closed' : '休 = 休校'}</span>
              </div>
            </div>

            {/* Vertical Multi-Month Calendar Container */}
            <div className="divide-y-4 divide-slate-200">
              {threeMonths.map(({ year, month }) => {
                const calendarDays = getCalendarDays(year, month);

                return (
                  <div key={`${year}-${month}`} className="bg-white p-3">
                    
                    {/* Month Bar */}
                    <div className="bg-slate-100 rounded-lg px-3 py-1.5 font-black text-xs text-[#1F3C6B] mb-2 flex items-center justify-between">
                      <span>{getMonthLabel(year, month)}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {language === 'en' ? 'Tap an open slot' : '「空き」表示の枠をタップ'}
                      </span>
                    </div>

                    {/* Weekday Header */}
                    <div className="grid grid-cols-7 bg-slate-50 text-[10px] font-bold text-slate-500 text-center py-1 rounded-t-lg border-x border-t border-slate-200">
                      <div>{getWeekdayName(1, 'short')}</div>
                      <div>{getWeekdayName(2, 'short')}</div>
                      <div>{getWeekdayName(3, 'short')}</div>
                      <div>{getWeekdayName(4, 'short')}</div>
                      <div>{getWeekdayName(5, 'short')}</div>
                      <div className="text-blue-600">{getWeekdayName(6, 'short')}</div>
                      <div className="text-rose-500">{getWeekdayName(0, 'short')}</div>
                    </div>

                    {/* Calendar Days Grid */}
                    <div className="grid grid-cols-7 border-b border-x border-slate-200 divide-x divide-y divide-slate-200 rounded-b-lg overflow-hidden text-xs">
                      {calendarDays.map((day) => {
                        const { dateStr, isCurrentMonth, dayNum, dateObj } = day;
                        const dayOfWeek = dateObj.getDay();
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                        const holidayName = getHolidayName(dateStr);
                        const isHoliday = !!holidayName;

                        const isPast = dateStr < todayStr;
                        const isBeyondExpiry = !!(earliestExpiry && earliestExpiry.expiryDate && dateStr > earliestExpiry.expiryDate);

                        const cap = getClassCapacityForDate(
                          dateStr,
                          student.classId,
                          students,
                          absences,
                          bookings,
                          overrides,
                          weekdayQuotas,
                          specialDays
                        );

                        const isClosedDay = cap.specialDayInfo?.type === 'closed' || (cap.isSpecialDay && cap.specialDayInfo?.allowTransfers === false);
                        const isSpecialDay = cap.isSpecialDay;

                        const isAbsent = absences.some(
                          (a) => a.studentId === student.id && a.date === dateStr && a.status === 'confirmed'
                        );
                        const isRegularDay = student.regularDays.includes(dayOfWeek) && !isHoliday && !isWeekend && !isClosedDay;
                        const isAlreadyBooked = bookings.some(
                          (b) => b.studentId === student.id && b.targetDate === dateStr && b.status === 'booked'
                        );

                        const isSelected = selectedDate === dateStr;

                        const isSelectable =
                          isCurrentMonth &&
                          !isPast &&
                          !isBeyondExpiry &&
                          !isWeekend &&
                          !isClosedDay &&
                          (!isHoliday || (cap.specialDayInfo?.allowTransfers ?? false)) &&
                          !isRegularDay &&
                          !isAbsent &&
                          !isAlreadyBooked &&
                          cap.canAcceptTransfer &&
                          student.transferBalance > 0;

                        return (
                          <button
                            key={dateStr}
                            type="button"
                            disabled={!isSelectable}
                            onClick={() => setSelectedDate(dateStr)}
                            className={`p-1 min-h-[56px] flex flex-col justify-between text-left transition rounded-xs ${
                              isSelected
                                ? 'bg-[#1F3C6B] text-white font-bold ring-2 ring-blue-700 z-10'
                                : !isCurrentMonth || isPast
                                ? 'bg-slate-50/50 text-slate-300 cursor-not-allowed'
                                : isAbsent
                                ? 'bg-rose-100 border border-rose-300 text-rose-950 cursor-not-allowed'
                                : isAlreadyBooked
                                ? 'bg-sky-100 border border-sky-300 text-sky-950 cursor-not-allowed'
                                : isBeyondExpiry
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : isHoliday || isWeekend
                                ? 'bg-amber-50/30 text-slate-400 cursor-not-allowed'
                                : isRegularDay
                                ? 'bg-emerald-50 border border-emerald-300 text-emerald-950 cursor-not-allowed'
                                : cap.canAcceptTransfer
                                ? 'bg-white hover:bg-emerald-50 text-slate-800 font-semibold cursor-pointer border border-slate-200'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className={`text-xs ${isSelected ? 'text-white font-extrabold' : isAbsent ? 'text-rose-950 font-black' : isRegularDay ? 'text-emerald-950 font-bold' : ''}`}>
                                {dayNum}
                              </span>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                              {isAbsent && <span className="text-[10px]">🔴</span>}
                              {isAlreadyBooked && <span className="text-[10px]">⭐️</span>}
                            </div>

                            {/* Symbols & Badges */}
                            <div className="text-[9px] mt-0.5">
                              {isSelected ? (
                                <span className="bg-amber-400 text-slate-950 font-black px-1 py-0.5 rounded text-[9px] whitespace-nowrap">
                                  {language === 'en' ? 'Selected' : '選択中'}
                                </span>
                              ) : !isCurrentMonth || isPast ? null : isAbsent ? (
                                <span className="bg-rose-600 text-white font-black px-1 py-0.5 rounded text-[9px] whitespace-nowrap">
                                  {language === 'en' ? 'Absent' : '欠席'}
                                </span>
                              ) : isAlreadyBooked ? (
                                <span className="bg-sky-600 text-white font-black px-1 py-0.5 rounded text-[9px] whitespace-nowrap">
                                  {language === 'en' ? 'Booked' : '振替'}
                                </span>
                              ) : isBeyondExpiry ? (
                                <span className="text-slate-400 font-semibold whitespace-nowrap">
                                  {language === 'en' ? 'Expired' : '期限外'}
                                </span>
                              ) : isClosedDay ? (
                                <span className="text-rose-600 font-bold">
                                  {cap.specialDayInfo?.title || (language === 'en' ? 'Closed' : '休館')}
                                </span>
                              ) : isSpecialDay && cap.canAcceptTransfer ? (
                                <span className="bg-indigo-600 text-white font-black px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap">
                                  {getSpecialTypeLabel(cap.specialDayInfo?.type || 'special_schedule')} {language === 'en' ? `Open ${cap.remainingTransferSlots}` : `空${cap.remainingTransferSlots}`}
                                </span>
                              ) : isHoliday ? (
                                <span className="text-amber-700 font-bold">{language === 'en' ? 'Hol' : '休'}</span>
                              ) : isWeekend ? (
                                <span className="text-slate-300">{language === 'en' ? 'Off' : '休'}</span>
                              ) : isRegularDay ? (
                                <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-1 py-0.5 rounded text-[9px] whitespace-nowrap">
                                  {language === 'en' ? 'Regular' : '出席'}
                                </span>
                              ) : cap.canAcceptTransfer ? (
                                <span className="bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded text-[9.5px] whitespace-nowrap">
                                  {language === 'en' ? `Open ${cap.remainingTransferSlots}` : `空${cap.remainingTransferSlots}`}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-bold">{language === 'en' ? 'Full' : '満'}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* Footer */}
        {!successMsg && (
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-xs">
            <div>
              {selectedDate ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span>
                    {language === 'en' ? 'Selected date: ' : '希望日: '}
                    <strong className="text-[#1F3C6B] text-sm">{selectedDate}</strong>
                  </span>
                  {nextTicketToUse && (
                    <span className="font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-[11px]">
                      {language === 'en'
                        ? `[Applied: ${nextTicketToUse.absenceDate} credit]`
                        : `【${formatAbsenceLabel(nextTicketToUse.absenceDate)}】を充当`}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-400">
                  {language === 'en' ? 'Please select an open (green) date' : '⭕（緑色）の日付を選択してください'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 sm:shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] whitespace-nowrap px-4 py-2 font-semibold text-slate-600 bg-slate-200/80 rounded-xl hover:bg-slate-300 transition"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={!selectedDate || student.transferBalance <= 0}
                onClick={handleConfirmBooking}
                className="flex-1 sm:flex-none min-h-[44px] px-5 py-2 bg-[#1F3C6B] hover:bg-blue-900 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md transition"
              >
                {t('booking.confirm')}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// フックを常に同じ順で呼ぶため、開いている間だけ中身をマウントする（閉じるたびに入力状態もリセットされる）
export const TransferBookingModal: React.FC<React.PropsWithChildren<TransferBookingModalProps>> = (props) => (props.isOpen ? <TransferBookingModalInner {...props} /> : null);
