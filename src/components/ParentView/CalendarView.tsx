import React, { useState } from 'react';
import { Student, AbsenceRecord, TransferBooking, DailyClassOverride, ClassId, WeekdayQuotaSettings, SpecialScheduleDay } from '../../types';
import { SOLTILO_CLASSES } from '../../data/constants';
import { getClassCapacityForDate } from '../../lib/storage';
import { getHolidayName, isMondayHoliday } from '../../lib/holidays';
import { getStudentTransferTickets, formatJapaneseDate, formatAbsenceLabel, calculateExpiryDate } from '../../lib/expiration';
import { useTranslation } from '../../lib/i18n';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Ticket, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { toLocalDateString } from '../../lib/dateUtils';

interface CalendarViewProps {
  student: Student;
  students: Student[];
  absences: AbsenceRecord[];
  bookings: TransferBooking[];
  overrides: DailyClassOverride[];
  weekdayQuotas?: WeekdayQuotaSettings;
  specialDays?: SpecialScheduleDay[];
  onOpenBookingForDate: (dateStr: string, classId: ClassId) => void;
  onOpenAbsenceModal: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  student,
  students,
  absences,
  bookings,
  overrides,
  weekdayQuotas,
  specialDays = [],
  onOpenBookingForDate,
  onOpenAbsenceModal
}) => {
  const { language, t, getClassName, getWeekdayName, getReasonLabel } = useTranslation();

  // Start month/year for 3-month vertical view
  const [startYear, setStartYear] = useState(() => new Date().getFullYear());
  const [startMonth, setStartMonth] = useState(() => new Date().getMonth()); // 0-indexed
  const [activeMonthView, setActiveMonthView] = useState<'all' | number>('all'); // 'all' or 0, 1, 2

  const monthNamesJa = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];
  const monthNamesEn = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const monthNames = language === 'en' ? monthNamesEn : monthNamesJa;

  const currentClass = SOLTILO_CLASSES.find((c) => c.id === student.classId);
  const todayStr = toLocalDateString(new Date());

  // Navigate 3 months backward/forward
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

  const jumpToYear = (yr: number) => {
    setStartYear(yr);
  };

  // Generate 3 consecutive months metadata
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

  // Helper to build calendar grid array for a given year & month
  const getCalendarDays = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDay.getDay() - 1; // Mon=0 ... Sun=6
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDay.getDate();
    const days: { dateStr: string; isCurrentMonth: boolean; dayNum: number; dateObj: Date }[] = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
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

  // Identify absences that need transfer booking
  const studentTickets = getStudentTransferTickets(student.id, absences, bookings);
  const availableTickets = studentTickets.filter((t) => !t.isBooked && !t.isExpired);

  // 予約に未使用・期限内のチケットに対応する欠席だけを「要振替」として表示する
  const availableIds = new Set(availableTickets.map((t) => t.absenceId));
  const unbookedAbsences = absences
    .filter((a) => availableIds.has(a.id))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex flex-col space-y-0">
      
      {/* Top Banner with Stamp Ticket Badge & Operating Info */}
      <div className="bg-[#1E3A8A] text-white p-4 px-5 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center space-x-1.5 bg-amber-400 text-slate-950 font-black px-3 py-1 rounded-xl shadow-xs text-xs">
            <Ticket className="w-4 h-4 text-slate-900" />
            <span>{language === 'en' ? `Make-up credits: ${student.transferBalance}` : `振替チケット: ${student.transferBalance}枚保有`}</span>
          </div>

          {availableTickets.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {availableTickets.map((t) => (
                <span
                  key={t.absenceId}
                  className="bg-blue-900/90 text-amber-300 border border-blue-700/80 px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1"
                >
                  <span>【{language === 'en' ? `${t.absenceDate} absence` : formatAbsenceLabel(t.absenceDate)}】</span>
                </span>
              ))}
            </div>
          )}

          <span className="text-xs text-blue-200 font-medium hidden md:inline">
            {language === 'en' ? 'Open Mon–Fri (closed weekends & holidays) / 3 months shown' : '営業日: 月〜金（土日祝休校）/ 縦スクロール3か月連続表示'}
          </span>
        </div>

        {/* Fast Year Selector */}
        <div className="flex items-center space-x-1 bg-blue-900/80 p-1 rounded-xl text-xs border border-blue-700/60">
          <span className="text-blue-300 font-bold px-1.5 text-[11px]">{language === 'en' ? 'Year:' : '表示年:'}</span>
          {[2025, 2026, 2027, 2028].map((yr) => (
            <button
              key={yr}
              onClick={() => jumpToYear(yr)}
              className={`px-2.5 py-0.5 rounded-lg font-bold transition text-[11px] ${
                startYear === yr
                  ? 'bg-white text-[#1E3A8A] shadow-2xs'
                  : 'text-blue-200 hover:bg-blue-800'
              }`}
            >
              {language === 'en' ? yr : `${yr}年`}
            </button>
          ))}
        </div>
      </div>

      {/* Prominent Alert Banner for Unbooked Absences (e.g. 8/20 要振替) */}
      {unbookedAbsences.length > 0 && (
        <div className="bg-rose-50 border-b border-rose-200 p-4 px-5 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center space-x-2.5 text-xs">
            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="font-extrabold text-rose-900 text-xs sm:text-sm flex items-center gap-2">
                <span>{language === 'en' ? '⚠️ Absences awaiting a make-up booking' : '⚠️ 要振替の欠席日があります'}</span>
                <span className="bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                  {language === 'en' ? `${unbookedAbsences.length} unbooked` : `${unbookedAbsences.length}件 未予約`}
                </span>
              </div>
              <div className="text-slate-700 text-[11px] mt-1 space-y-0.5">
                {unbookedAbsences.map((a) => {
                  const expDate = a.expiryDate || calculateExpiryDate(a.date);
                  return (
                    <div key={a.id} className="flex flex-wrap items-center gap-1.5">
                      <span className="bg-rose-600 text-white font-black px-1.5 py-0.5 rounded text-[10px]">
                        【{language === 'en' ? `${a.date} absence` : formatAbsenceLabel(a.date)}】
                      </span>
                      <span className="text-slate-600">({getReasonLabel(a.reason)})</span>
                      <span className="text-amber-800 font-bold">
                        {language === 'en' ? `➔ Valid until ${expDate}` : `➔ 有効期限: ${formatJapaneseDate(expDate)} まで`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={() => onOpenBookingForDate('', student.classId)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1"
          >
            <span>{language === 'en' ? 'Choose a make-up date' : '振替希望日を選ぶ'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Calendar Navigation Bar & Legend */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/70">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Navigation & Span Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <span>
                  {language === 'en'
                    ? `${monthNames[threeMonths[0].month]} ${threeMonths[0].year} — ${monthNames[threeMonths[2].month]} ${threeMonths[2].year} (3 Months)`
                    : `${threeMonths[0].year}年 ${monthNames[threeMonths[0].month]} 〜 ${threeMonths[2].year}年 ${monthNames[threeMonths[2].month]} (3ヶ月間)`}
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {student.name} ({getClassName(student.classId)}) ・ {language === 'en' ? 'Check open slots up to 12 weeks ahead' : '12週間先まで空き枠を確認可能'}
              </p>
            </div>
          </div>

          {/* 3-Month Period Shift Controls */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              onClick={prev3Months}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition flex items-center gap-1 text-xs font-extrabold shadow-2xs"
              title="Prev 3 Months"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{language === 'en' ? 'Prev 3 Mo' : '前3か月'}</span>
            </button>
            <button
              onClick={next3Months}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition flex items-center gap-1 text-xs font-extrabold shadow-2xs"
              title="Next 3 Months"
            >
              <span>{language === 'en' ? 'Next 3 Mo' : '次3か月'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3-Month Fast Switcher Tabs + Marks Legend */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
          
          {/* Month Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/70 p-1 rounded-2xl border border-slate-300/70">
            <span className="text-[11px] font-extrabold text-slate-600 px-2 hidden sm:inline">
              {language === 'en' ? 'View:' : '月選択:'}
            </span>
            {threeMonths.map(({ year, month }, idx) => (
              <button
                key={`${year}-${month}`}
                onClick={() => setActiveMonthView(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1 ${
                  activeMonthView === idx
                    ? 'bg-[#1E3A8A] text-white shadow-xs'
                    : 'bg-white/80 hover:bg-white text-slate-700'
                }`}
              >
                <span>{monthNames[month]}</span>
                {idx === 0 && <span className="text-[10px] opacity-80">({language === 'en' ? 'Now' : '今月'})</span>}
              </button>
            ))}

            <button
              onClick={() => setActiveMonthView('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1 ${
                activeMonthView === 'all'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white/80 hover:bg-white text-slate-700'
              }`}
            >
              <span>{language === 'en' ? '📑 All 3 Months' : '📑 3ヶ月まとめて一覧'}</span>
            </button>
          </div>

          {/* Clean Marks & Symbols Legend */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] font-bold text-slate-700">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-lg shadow-2xs whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{t('calendar.legendRegular')}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-950 border border-rose-300 rounded-lg shadow-2xs whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <span>{t('calendar.legendAbsent')}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-950 border border-sky-300 rounded-lg shadow-2xs whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-sky-600" />
              <span>{t('calendar.legendTransfer')}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 text-white font-black rounded-lg shadow-2xs whitespace-nowrap">
              <span>{language === 'en' ? 'Open = Bookable' : '空1 = 予約可能'}</span>
            </span>
          </div>

        </div>

      </div>

      {/* Calendar Months Display Area */}
      <div className="divide-y-4 divide-slate-200 bg-slate-100">
        {(activeMonthView === 'all' ? threeMonths : [threeMonths[activeMonthView]]).map(({ year, month }) => {
          const daysGrid = getCalendarDays(year, month);

          return (
            <div key={`${year}-${month}`} className="bg-white">
              
              {/* Month Header Divider */}
              <div className="bg-slate-100/90 border-y border-slate-200 px-5 py-2.5 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
                <span className="text-sm font-black text-[#1E3A8A] flex items-center gap-2">
                  <span className="bg-[#1E3A8A] text-white px-2.5 py-0.5 rounded-lg text-xs">
                    {year}
                  </span>
                  <span>{monthNames[month]} {language === 'en' ? 'Schedule' : 'スケジュール'}</span>
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {new Date(year, month + 1, 0).getDate()} {language === 'en' ? 'days' : '日間'}
                </span>
              </div>

              {/* Weekdays Header */}
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-500 text-center py-1.5">
                <div>{getWeekdayName(1)}</div>
                <div>{getWeekdayName(2)}</div>
                <div>{getWeekdayName(3)}</div>
                <div>{getWeekdayName(4)}</div>
                <div>{getWeekdayName(5)}</div>
                <div className="text-blue-600">{getWeekdayName(6)}</div>
                <div className="text-rose-500">{getWeekdayName(0)}</div>
              </div>

              {/* Calendar Grid Days */}
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
                {daysGrid.map((day) => {
                  const { dateStr, isCurrentMonth, dayNum, dateObj } = day;
                  const dayOfWeek = dateObj.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const holidayName = getHolidayName(dateStr);
                  const isHoliday = !!holidayName;

                  const isToday = dateStr === todayStr;

                  const isStudentRegularDay = student.regularDays.includes(dayOfWeek);
                  const specialDay = specialDays.find((s) => s.date === dateStr);

                  // Special day overrides holiday/regular behavior
                  const isSpecialHolidayTransfer = specialDay?.type === 'holiday_transfer';
                  const isSummerOrSeasonal = specialDay?.type === 'summer_school' || specialDay?.type === 'winter_school' || specialDay?.type === 'spring_school';
                  const isSpecialOpen = specialDay?.type === 'special_open';
                  const isClosedDay = specialDay?.type === 'closed';

                  const isRegularDay = (isStudentRegularDay && !isHoliday && !isWeekend && !isSpecialHolidayTransfer && !isClosedDay) || (isStudentRegularDay && isSpecialOpen);

                  // Absence check
                  const isAbsent = absences.some(
                    (a) => a.studentId === student.id && a.date === dateStr && a.status === 'confirmed'
                  );
                  const isCancelledAbsence = absences.some(
                    (a) => a.studentId === student.id && a.date === dateStr && a.status === 'cancelled'
                  );

                  // Transfer booking check
                  const myBooking = bookings.find(
                    (b) => b.studentId === student.id && b.targetDate === dateStr && b.status === 'booked'
                  );
                  const isCancelledBooking = bookings.some(
                    (b) => b.studentId === student.id && b.targetDate === dateStr && b.status === 'cancelled'
                  );

                  // Capacity check
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

                  const isPast = dateStr < todayStr;
                  const canBook =
                    isCurrentMonth &&
                    !isWeekend &&
                    !isPast &&
                    !isRegularDay &&
                    !isAbsent &&
                    !myBooking &&
                    !isClosedDay &&
                    !(isSpecialHolidayTransfer && !specialDay?.allowTransfers) &&
                    cap.canAcceptTransfer &&
                    student.transferBalance > 0;

                  return (
                    <div
                      key={dateStr}
                      className={`p-1 sm:p-1.5 min-h-[62px] sm:min-h-[74px] flex flex-col justify-between transition-colors rounded-xs ${
                        !isCurrentMonth
                          ? 'bg-slate-50/30 text-slate-300'
                          : isAbsent
                          ? 'bg-rose-50 border-2 border-rose-400 text-rose-950 shadow-xs'
                          : myBooking
                          ? 'bg-sky-50 border-2 border-sky-400 text-sky-950 shadow-xs'
                          : isToday
                          ? 'bg-blue-50/60 ring-2 ring-blue-600 ring-inset'
                          : isSpecialHolidayTransfer && isStudentRegularDay
                          ? 'bg-amber-50/90 border border-amber-400 text-amber-950 shadow-2xs'
                          : isSummerOrSeasonal
                          ? 'bg-orange-50/60 border border-orange-200 text-orange-950'
                          : isClosedDay
                          ? 'bg-slate-100 text-slate-400'
                          : isHoliday
                          ? 'bg-amber-50/30 text-amber-900'
                          : isWeekend
                          ? 'bg-slate-50/30 text-slate-400'
                          : isRegularDay
                          ? 'bg-emerald-50/80 border border-emerald-300/80 text-emerald-950 shadow-2xs'
                          : isCancelledAbsence || isCancelledBooking
                          ? 'bg-slate-100/80 border border-dashed border-slate-300 text-slate-500'
                          : 'hover:bg-slate-50/70 text-slate-800'
                      }`}
                    >
                      {/* Top Day Number Row */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-black ${
                            isToday
                              ? 'text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded-full'
                              : !isCurrentMonth
                              ? 'text-slate-300'
                              : isAbsent
                              ? 'text-rose-950 font-black'
                              : myBooking
                              ? 'text-sky-950 font-black'
                              : isSpecialHolidayTransfer && isStudentRegularDay
                              ? 'text-amber-900 font-black'
                              : isSummerOrSeasonal
                              ? 'text-orange-900 font-black'
                              : isHoliday
                              ? 'text-amber-700'
                              : isWeekend
                              ? 'text-slate-400'
                              : isRegularDay
                              ? 'text-emerald-950 font-black'
                              : 'text-slate-800'
                          }`}
                        >
                          {dayNum}
                        </span>

                        {/* Symbol Stamp */}
                        {isCurrentMonth && (
                          <div className="shrink-0 leading-none">
                            {specialDay?.type === 'summer_school' ? (
                              <span className="text-[10px]" title={language === 'en' ? 'Summer School' : 'サマースクール'}>
                                ☀️
                              </span>
                            ) : specialDay?.type === 'winter_school' ? (
                              <span className="text-[10px]" title={language === 'en' ? 'Winter School' : 'ウィンタースクール'}>
                                ❄️
                              </span>
                            ) : isSpecialHolidayTransfer && isStudentRegularDay ? (
                              <span className="text-[10px]" title={language === 'en' ? 'Holiday closure (credit granted)' : '祝日休講（チケット付与）'}>
                                🎟️
                              </span>
                            ) : isHoliday ? (
                              <span className="text-[10px]" title={holidayName || ''}>
                                🎌
                              </span>
                            ) : isWeekend ? null : isAbsent ? (
                              <span className="text-[10px] text-rose-600 font-black" title={language === 'en' ? 'Absent (make-up needed)' : '欠席（要振替）'}>
                                🔴
                              </span>
                            ) : myBooking ? (
                              <span className="text-[10px] text-sky-600 font-black" title={language === 'en' ? 'Make-up booked' : '振替受講確定'}>
                                ⭐️
                              </span>
                            ) : isRegularDay ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                            ) : null}
                          </div>
                        )}
                      </div>

                      {/* Status Text & Action Button (Strictly Single-Line & Mobile Optimized) */}
                      {isCurrentMonth && (
                        <div className="mt-0.5">
                          {isClosedDay ? (
                            <div className="text-[9px] text-slate-400 text-center font-bold">
                              {language === 'en' ? 'Off' : '休館'}
                            </div>
                          ) : isSpecialHolidayTransfer && isStudentRegularDay ? (
                            <div
                              className="text-[9px] sm:text-[10px] bg-amber-500 text-slate-950 font-black py-0.5 px-0.5 rounded text-center shadow-2xs whitespace-nowrap leading-tight"
                              title={language === 'en' ? 'Holiday Make-up Credit' : '祝日休講（要振替チケット付与）'}
                            >
                              {language === 'en' ? 'Hol' : '祝(要振)'}
                            </div>
                          ) : isHoliday && !isSpecialOpen && !isSummerOrSeasonal ? (
                            <div className="text-[9px] text-amber-800 font-bold truncate text-center">
                              {language === 'en' ? 'Off' : '休'}
                            </div>
                          ) : isWeekend ? (
                            <div className="text-[9px] text-slate-300 text-center">
                              {language === 'en' ? 'Off' : '休'}
                            </div>
                          ) : isAbsent ? (
                            <div className="text-[9px] sm:text-[10px] bg-rose-600 text-white font-black py-0.5 px-0.5 rounded text-center shadow-2xs whitespace-nowrap leading-tight">
                              {language === 'en' ? 'Absent' : '欠席'}
                            </div>
                          ) : myBooking ? (
                            <div className="text-[9px] sm:text-[10px] bg-sky-600 text-white font-black py-0.5 px-0.5 rounded text-center shadow-2xs whitespace-nowrap leading-tight">
                              {language === 'en' ? 'Make-up' : '振替'}
                            </div>
                          ) : isRegularDay ? (
                            <div className="text-[9px] sm:text-[10px] bg-emerald-100/90 text-emerald-900 border border-emerald-300 font-black py-0.5 px-0.5 rounded text-center whitespace-nowrap leading-tight shadow-2xs">
                              {language === 'en' ? 'Regular' : '出席'}
                            </div>
                          ) : isCancelledAbsence || isCancelledBooking ? (
                            <div className="text-[9px] bg-slate-200 text-slate-600 font-bold py-0.5 rounded text-center whitespace-nowrap">
                              {language === 'en' ? 'Cancel' : '取消'}
                            </div>
                          ) : canBook ? (
                            <button
                              onClick={() => onOpenBookingForDate(dateStr, student.classId)}
                              className={`w-full text-white text-[9px] sm:text-[10px] font-black py-0.5 px-0.5 rounded transition shadow-2xs flex items-center justify-center whitespace-nowrap leading-tight active:scale-95 ${
                                isSummerOrSeasonal
                                  ? 'bg-orange-500 hover:bg-orange-600'
                                  : 'bg-emerald-600 hover:bg-emerald-700'
                              }`}
                              title={language === 'en' ? 'Book make-up slot' : '振替予約する'}
                            >
                              {specialDay?.badgeText ? `${specialDay.badgeText} ` : ''}
                              {language === 'en' ? `Open ${cap.remainingTransferSlots}` : `空${cap.remainingTransferSlots}`}
                            </button>
                          ) : !isPast && cap.canAcceptTransfer ? (
                            <div className="text-[9px] text-emerald-700 font-bold text-center whitespace-nowrap">
                              {specialDay?.badgeText ? `${specialDay.badgeText} ` : ''}
                              {language === 'en' ? `Open ${cap.remainingTransferSlots}` : `空${cap.remainingTransferSlots}`}
                            </div>
                          ) : isSummerOrSeasonal ? (
                            <div className="text-[9px] text-orange-700 font-black text-center whitespace-nowrap">
                              {specialDay.badgeText}
                            </div>
                          ) : !isPast ? (
                            <div className="text-[9px] text-slate-300 text-center font-bold">
                              {language === 'en' ? 'Full' : '満'}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
