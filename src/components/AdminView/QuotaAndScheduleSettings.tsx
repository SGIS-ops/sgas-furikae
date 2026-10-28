import React, { useState } from 'react';
import {
  ClassId,
  WeekdayQuotaSettings,
  WeekdayClassQuota,
  SpecialScheduleDay,
  SpecialDayType,
  DailyClassOverride
} from '../../types';
import { SOLTILO_CLASSES, DEFAULT_TRANSFER_QUOTA, MAX_TOTAL_CAPACITY_LIMIT } from '../../data/constants';
import {
  Calendar,
  Sliders,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Sun,
  Snowflake,
  AlertTriangle,
  Clock,
  Save,
  Check,
  ChevronRight,
  Info,
  ShieldCheck,
  Flame
} from 'lucide-react';
import { toLocalDateString } from '../../lib/dateUtils';
import { useTranslation } from '../../lib/i18n';

interface QuotaAndScheduleSettingsProps {
  weekdayQuotas: WeekdayQuotaSettings;
  specialDays: SpecialScheduleDay[];
  overrides: DailyClassOverride[];
  onSaveWeekdayQuotas: (quotas: WeekdayQuotaSettings) => void;
  onSaveSpecialDays: (specialDays: SpecialScheduleDay[]) => void;
  onSaveOverride: (override: DailyClassOverride) => void;
  onDeleteOverride?: (date: string, classId: ClassId) => void;
}

const WEEKDAY_NAMES = [
  { day: 1, label: '月曜日', short: '月', enLabel: 'Monday' },
  { day: 2, label: '火曜日', short: '火', enLabel: 'Tuesday' },
  { day: 3, label: '水曜日', short: '水', enLabel: 'Wednesday' },
  { day: 4, label: '木曜日', short: '木', enLabel: 'Thursday' },
  { day: 5, label: '金曜日', short: '金', enLabel: 'Friday' }
];

export const QuotaAndScheduleSettings: React.FC<QuotaAndScheduleSettingsProps> = ({
  weekdayQuotas,
  specialDays,
  overrides,
  onSaveWeekdayQuotas,
  onSaveSpecialDays,
  onSaveOverride,
  onDeleteOverride
}) => {
  const { language } = useTranslation();
  // Local state for editing weekday quotas
  const [localQuotas, setLocalQuotas] = useState<WeekdayQuotaSettings>(weekdayQuotas);
  const [isQuotasDirty, setIsQuotasDirty] = useState(false);

  // Active section card: 'weekday' | 'special' | 'override'
  const [activeCard, setActiveCard] = useState<'weekday' | 'special' | 'override'>('weekday');

  // Form state for adding special day
  const [isAddingSpecialDay, setIsAddingSpecialDay] = useState(false);
  const [dateSelectionMode, setDateSelectionMode] = useState<'single' | 'range'>('single');
  const [specialDate, setSpecialDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return toLocalDateString(d);
  });
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toLocalDateString(d);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return toLocalDateString(d);
  });
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri by default
  const [specialType, setSpecialType] = useState<SpecialDayType>('holiday_transfer');
  const [specialTitle, setSpecialTitle] = useState('祝日休講（振替対象日）');
  const [specialBadge, setSpecialBadge] = useState('祝(要振)');
  const [allowTransfers, setAllowTransfers] = useState(false);
  const [specialQuota, setSpecialQuota] = useState(2);
  const [grantsTransfer, setGrantsTransfer] = useState(true);
  const [specialNote, setSpecialNote] = useState('年間規定回数調整のため、該当日在籍生に振替チケット自動付与');

  const [notification, setNotification] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  // Preset handler for special day type
  const handleTypeSelect = (type: SpecialDayType) => {
    setSpecialType(type);
    switch (type) {
      case 'holiday_transfer':
        setSpecialTitle('祝日休講（要振替）');
        setSpecialBadge('祝(要振)');
        setAllowTransfers(false);
        setGrantsTransfer(true);
        setSpecialNote('スクール都合の休講のため、通常受講生に振替チケットを1枚自動付与');
        break;
      case 'summer_school':
        setSpecialTitle('サマースクール 2026');
        setSpecialBadge('サマー');
        setAllowTransfers(true);
        setSpecialQuota(4);
        setGrantsTransfer(false);
        setSpecialNote('夏季特別短期レッスン（通常生徒も振替チケットで受講可能・定員拡大）');
        break;
      case 'winter_school':
        setSpecialTitle('ウィンタースクール 2026');
        setSpecialBadge('冬期');
        setAllowTransfers(true);
        setSpecialQuota(4);
        setGrantsTransfer(false);
        setSpecialNote('冬季特別短期レッスン（通常生徒も振替チケットで受講可能）');
        break;
      case 'spring_school':
        setSpecialTitle('スプリングスクール 2026');
        setSpecialBadge('春期');
        setAllowTransfers(true);
        setSpecialQuota(4);
        setGrantsTransfer(false);
        setSpecialNote('春季特別短期レッスン（振替受講可能）');
        break;
      case 'special_open':
        setSpecialTitle('祝日特別開校日');
        setSpecialBadge('通常開校');
        setAllowTransfers(true);
        setSpecialQuota(2);
        setGrantsTransfer(false);
        setSpecialNote('祝日ですが通常通りスクールを開校します');
        break;
      case 'closed':
        setSpecialTitle('施設休館日（お盆・年末年始等）');
        setSpecialBadge('休館');
        setAllowTransfers(false);
        setGrantsTransfer(false);
        setSpecialNote('施設メンテナンス・休館のためレッスン・振替受入共になし');
        break;
      case 'event':
        setSpecialTitle('校内サッカー大会・イベント');
        setSpecialBadge('イベント');
        setAllowTransfers(false);
        setGrantsTransfer(true);
        setSpecialNote('特別イベント実施日');
        break;
    }
  };

  const handleQuotaChange = (
    classId: ClassId,
    day: number,
    field: keyof WeekdayClassQuota,
    value: number | boolean
  ) => {
    setLocalQuotas((prev) => {
      const currentClassQuotas = prev[classId] || {};
      const currentDayQuota = currentClassQuotas[day] || {
        maxTransferQuota: DEFAULT_TRANSFER_QUOTA,
        maxTotalCapacity: MAX_TOTAL_CAPACITY_LIMIT,
        isOpen: true
      };

      return {
        ...prev,
        [classId]: {
          ...currentClassQuotas,
          [day]: {
            ...currentDayQuota,
            [field]: value
          }
        }
      };
    });
    setIsQuotasDirty(true);
  };

  const handleSaveQuotas = () => {
    onSaveWeekdayQuotas(localQuotas);
    setIsQuotasDirty(false);
    showNotification('success', language === 'en' ? 'Weekday capacity & make-up slot settings saved!' : '曜日ごとの基本定員＆振替枠マスタを保存しました！');
  };

  const handleResetToDefault = () => {
    if (confirm(language === 'en' ? 'Reset base slots for all weekdays and classes to defaults (2 make-up slots / capacity 20)?' : 'すべての曜日・クラスの基本枠を初期設定（振替枠2名 / 定員20名）にリセットしますか？')) {
      const resetObj = Object.fromEntries(
        SOLTILO_CLASSES.map((c) => [
          c.id,
          Object.fromEntries(
            [1, 2, 3, 4, 5].map((d) => [d, { maxTransferQuota: DEFAULT_TRANSFER_QUOTA, maxTotalCapacity: MAX_TOTAL_CAPACITY_LIMIT, isOpen: true }])
          )
        ])
      ) as WeekdayQuotaSettings;
      setLocalQuotas(resetObj);
      onSaveWeekdayQuotas(resetObj);
      setIsQuotasDirty(false);
      showNotification('info', language === 'en' ? 'Base settings reset to defaults' : '基本設定を初期値にリセットしました');
    }
  };

  // Helper to compute dates within range
  const getDatesInRange = (startStr: string, endStr: string, weekdays: number[]): string[] => {
    if (!startStr || !endStr) return [];
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    if (start > end) return [];

    const dates: string[] = [];
    const current = new Date(start);
    let count = 0;
    while (current <= end && count < 120) {
      const day = current.getDay();
      if (weekdays.includes(day)) {
        dates.push(toLocalDateString(current));
      }
      current.setDate(current.getDate() + 1);
      count++;
    }
    return dates;
  };

  const previewRangeDates = dateSelectionMode === 'range' 
    ? getDatesInRange(startDate, endDate, selectedWeekdays)
    : [specialDate];

  const handleToggleWeekday = (day: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSetQuickRange = (preset: 'this_week' | 'next_week' | 'summer' | 'winter' | 'golden_week') => {
    const now = new Date();
    if (preset === 'this_week') {
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      const diff = monday.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      monday.setDate(diff);
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      setStartDate(toLocalDateString(monday));
      setEndDate(toLocalDateString(friday));
      setSelectedWeekdays([1, 2, 3, 4, 5]);
    } else if (preset === 'next_week') {
      const dayOfWeek = now.getDay();
      const nextMon = new Date(now);
      const diff = nextMon.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) + 7;
      nextMon.setDate(diff);
      const nextFri = new Date(nextMon);
      nextFri.setDate(nextMon.getDate() + 4);
      setStartDate(toLocalDateString(nextMon));
      setEndDate(toLocalDateString(nextFri));
      setSelectedWeekdays([1, 2, 3, 4, 5]);
    } else if (preset === 'summer') {
      const year = now.getFullYear();
      setStartDate(`${year}-08-03`);
      setEndDate(`${year}-08-28`);
      setSelectedWeekdays([1, 2, 3, 4, 5]);
      handleTypeSelect('summer_school');
    } else if (preset === 'winter') {
      const year = now.getFullYear();
      setStartDate(`${year}-12-25`);
      setEndDate(`${year + 1}-01-08`);
      setSelectedWeekdays([1, 2, 3, 4, 5]);
      handleTypeSelect('winter_school');
    } else if (preset === 'golden_week') {
      const year = now.getFullYear();
      setStartDate(`${year}-04-29`);
      setEndDate(`${year}-05-06`);
      setSelectedWeekdays([1, 2, 3, 4, 5]);
      handleTypeSelect('holiday_transfer');
    }
  };

  const handleAddSpecialDay = (e: React.FormEvent) => {
    e.preventDefault();

    let targetDates: string[] = [];
    if (dateSelectionMode === 'single') {
      if (!specialDate) return;
      targetDates = [specialDate];
    } else {
      if (!startDate || !endDate) return;
      targetDates = getDatesInRange(startDate, endDate, selectedWeekdays);
      if (targetDates.length === 0) {
        alert(language === 'en' ? 'No matching weekdays in the selected period. Please check the start date, end date, and weekday selection.' : '指定した期間内に該当する曜日がありません。開始日・終了日・曜日選択をご確認ください。');
        return;
      }
    }

    const timestamp = Date.now();
    const newItems: SpecialScheduleDay[] = targetDates.map((d, index) => ({
      id: `sp_${timestamp}_${index}`,
      date: d,
      type: specialType,
      title: specialTitle,
      badgeText: specialBadge,
      allowTransfers,
      transferQuota: allowTransfers ? Number(specialQuota) : 0,
      grantsTransfer,
      note: specialNote
    }));

    // Filter out existing for target dates and replace
    const targetSet = new Set(targetDates);
    const updated = specialDays.filter((s) => !targetSet.has(s.date));
    updated.push(...newItems);
    updated.sort((a, b) => a.date.localeCompare(b.date));

    onSaveSpecialDays(updated);
    setIsAddingSpecialDay(false);
    if (targetDates.length === 1) {
      showNotification('success', language === 'en' ? `Registered "${targetDates[0]} (${specialTitle})" as a special schedule!` : `「${targetDates[0]} (${specialTitle})」を特別日程に登録しました！`);
    } else {
      showNotification(
        'success',
        language === 'en' ? `Bulk-registered "${specialTitle}" for ${targetDates.length} days in the period!` : `「${specialTitle}」を期間内の計 ${targetDates.length}日間に一括登録しました！`
      );
    }
  };

  // Filter state for list
  const [listFilterType, setListFilterType] = useState<'all' | SpecialDayType>('all');
  const [listSearchQuery, setListSearchQuery] = useState('');

  const filteredSpecialDays = specialDays.filter((sp) => {
    if (listFilterType !== 'all' && sp.type !== listFilterType) return false;
    if (listSearchQuery.trim()) {
      const q = listSearchQuery.toLowerCase();
      return (
        sp.date.includes(q) ||
        sp.title.toLowerCase().includes(q) ||
        sp.badgeText.toLowerCase().includes(q) ||
        (sp.note && sp.note.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleClearAllSpecialDays = () => {
    if (confirm(language === 'en' ? `Delete all ${specialDays.length} registered special schedule days?` : `登録されているすべての特別日程（${specialDays.length}件）を一括削除しますか？`)) {
      onSaveSpecialDays([]);
      showNotification('info', language === 'en' ? 'All special schedule days deleted' : 'すべての特別日程を削除しました');
    }
  };

  const handleDeleteSpecialDay = (id: string, date: string) => {
    if (confirm(language === 'en' ? `Remove the special schedule for ${date}?` : `特別日程「${date}」の設定を解除しますか？`)) {
      const updated = specialDays.filter((s) => s.id !== id);
      onSaveSpecialDays(updated);
      showNotification('info', language === 'en' ? `Special schedule for ${date} removed` : `特別日程「${date}」を解除しました`);
    }
  };

  const getSpecialBadgeStyle = (type: SpecialDayType) => {
    switch (type) {
      case 'holiday_transfer':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'summer_school':
        return 'bg-orange-500 text-white font-black shadow-2xs';
      case 'winter_school':
        return 'bg-cyan-600 text-white font-black shadow-2xs';
      case 'spring_school':
        return 'bg-pink-500 text-white font-black shadow-2xs';
      case 'special_open':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'closed':
        return 'bg-slate-200 text-slate-700 border-slate-300';
      case 'event':
        return 'bg-purple-100 text-purple-900 border-purple-300';
    }
  };

  return (
    <div className="space-y-6">

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between shadow-xs transition-all ${
            notification.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-indigo-700 text-white'
          }`}
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="text-xs sm:text-sm font-bold">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Top 3 Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Card 1: Weekday Quota Matrix */}
        <button
          type="button"
          onClick={() => setActiveCard('weekday')}
          className={`text-left p-5 rounded-2xl border transition flex flex-col justify-between ${
            activeCard === 'weekday'
              ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500 shadow-sm'
              : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                <Sliders className="w-5 h-5" />
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                activeCard === 'weekday' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {activeCard === 'weekday' ? (language === 'en' ? 'Editing' : '編集中') : (language === 'en' ? 'Base settings' : '基本設定')}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">{language === 'en' ? 'Weekday Capacity & Open Slots' : '曜日別 基本定員・空き枠'}</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {language === 'en' ? 'Set the base maximum make-up slots per weekday and class (e.g. 2 open on Mon, 3 open on Fri).' : '「月曜は空2名」「金曜は空3名」など、曜日×クラスごとの基本最大受入枠を設定します。'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600">
            <span>{activeCard === 'weekday' ? (language === 'en' ? 'Showing base settings' : 'マスタ設定を表示中') : (language === 'en' ? 'Configure base settings' : 'マスタを設定する')}</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${activeCard === 'weekday' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {/* Card 2: Special Schedule Calendar */}
        <button
          type="button"
          onClick={() => setActiveCard('special')}
          className={`text-left p-5 rounded-2xl border transition flex flex-col justify-between ${
            activeCard === 'special'
              ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500 shadow-sm'
              : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Sun className="w-5 h-5" />
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                activeCard === 'special' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {language === 'en' ? `${specialDays.length} registered` : `${specialDays.length}件 登録中`}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">{language === 'en' ? 'Special Schedules & Seasonal School' : '特別日程・季節スクール'}</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {language === 'en' ? 'Register holiday closures (make-up required, ticket granted), Summer/Winter School, and facility-closed days.' : '「祝日休講（要振替・チケット付与）」「サマー／冬期スクール」「休館日」を登録します。'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-700">
            <span>{activeCard === 'special' ? (language === 'en' ? 'Showing special schedules' : '特別日程を表示中') : (language === 'en' ? 'Set special schedules' : '特別日程を設定する')}</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${activeCard === 'special' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {/* Card 3: Date Overrides */}
        <button
          type="button"
          onClick={() => setActiveCard('override')}
          className={`text-left p-5 rounded-2xl border transition flex flex-col justify-between ${
            activeCard === 'override'
              ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500 shadow-sm'
              : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                <Calendar className="w-5 h-5" />
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                activeCard === 'override' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {language === 'en' ? `${overrides.length} registered` : `${overrides.length}件 登録中`}
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">{language === 'en' ? 'Date-Specific Slot Changes' : '特定日の臨時増枠・制限'}</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {language === 'en' ? 'One-off adjustments such as "5 open slots on this date only" or "no make-ups on this day".' : '「〇月〇日だけ特別に空5名にする」「この日だけ受入停止」といった個別の日程調整です。'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
            <span>{activeCard === 'override' ? (language === 'en' ? 'Showing date overrides' : '個別設定を表示中') : (language === 'en' ? 'Review temporary slots' : '臨時枠を確認する')}</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${activeCard === 'override' ? 'rotate-90' : ''}`} />
          </div>
        </button>

      </div>

      {/* DETAIL CONTENT PANELS */}

      {/* 1. WEEKDAY QUOTA MATRIX PANEL */}
      {activeCard === 'weekday' && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>{language === 'en' ? 'Base Make-up Slots by Weekday × Class' : '曜日 × クラス別 基本振替枠（空き枠数）マスタ設定'}</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'en' ? 'Set the base number of make-up slots (open slots) and maximum class capacity for each weekday.' : '各曜日の基本の「振替受入可能人数（空き枠）」と「クラス最大定員」を設定します。'}
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                {language === 'en' ? 'Reset to defaults' : '初期値に戻す'}
              </button>

              <button
                type="button"
                onClick={handleSaveQuotas}
                disabled={!isQuotasDirty}
                className={`px-4 py-2 text-xs font-black rounded-xl shadow-xs transition flex items-center gap-1.5 ${
                  isQuotasDirty
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white animate-pulse'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{language === 'en' ? 'Save settings' : '設定を保存する'}</span>
              </button>
            </div>
          </div>

          {/* Master Table Grid */}
          <div className="space-y-4">
            {SOLTILO_CLASSES.map((cls) => (
              <div key={cls.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
                    <span className="text-xs font-black text-slate-900">{cls.jpName}</span>
                    {cls.ageRange && <span className="text-[11px] text-slate-500">（{cls.ageRange}）</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {WEEKDAY_NAMES.map(({ day, label, short, enLabel }) => {
                    const quota = localQuotas[cls.id]?.[day] || {
                      maxTransferQuota: DEFAULT_TRANSFER_QUOTA,
                      maxTotalCapacity: MAX_TOTAL_CAPACITY_LIMIT,
                      isOpen: true
                    };

                    return (
                      <div
                        key={day}
                        className={`p-3 rounded-xl border transition ${
                          quota.isOpen
                            ? 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs'
                            : 'bg-slate-100 border-dashed border-slate-300 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black text-slate-800">{language === 'en' ? enLabel : label}</span>
                          <label className="text-[10px] font-bold flex items-center gap-1 text-slate-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={quota.isOpen}
                              onChange={(e) =>
                                handleQuotaChange(cls.id, day, 'isOpen', e.target.checked)
                              }
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>{language === 'en' ? 'Open' : '開講'}</span>
                          </label>
                        </div>

                        {quota.isOpen ? (
                          <div className="space-y-2">
                            <div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-slate-600">{language === 'en' ? 'Make-up slots:' : '振替受入枠:'}</span>
                                <span className="font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                  {language === 'en' ? `${quota.maxTransferQuota} open` : `空${quota.maxTransferQuota}名`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                {[0, 1, 2, 3, 4, 5].map((num) => (
                                  <button
                                    key={num}
                                    type="button"
                                    onClick={() =>
                                      handleQuotaChange(cls.id, day, 'maxTransferQuota', num)
                                    }
                                    className={`flex-1 py-0.5 text-[10px] font-bold rounded transition ${
                                      quota.maxTransferQuota === num
                                        ? 'bg-emerald-600 text-white font-black shadow-2xs'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {num}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                              <span>{language === 'en' ? 'Max capacity:' : '総定員上限:'}</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={5}
                                  max={30}
                                  value={quota.maxTotalCapacity}
                                  onChange={(e) =>
                                    handleQuotaChange(
                                      cls.id,
                                      day,
                                      'maxTotalCapacity',
                                      Number(e.target.value) || 20
                                    )
                                  }
                                  className="w-12 px-1 py-0.5 text-center text-xs font-bold border border-slate-200 rounded bg-slate-50"
                                />
                                <span>{language === 'en' ? '' : '名'}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-3 text-xs font-bold text-slate-400">
                            {language === 'en' ? 'Closed (no make-ups)' : '休講（受入不可）'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {isQuotasDirty && (
            <div className="sticky bottom-3 bg-indigo-900 text-white p-3.5 rounded-xl flex items-center justify-between shadow-lg">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-300" />
                <span>{language === 'en' ? 'Weekday base slots have changed. Please press Save.' : '曜日ごとの基本枠が変更されています。保存ボタンを押してください。'}</span>
              </span>
              <button
                onClick={handleSaveQuotas}
                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-lg transition flex items-center gap-1 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{language === 'en' ? 'Save' : '保存する'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. SPECIAL SCHEDULE DAYS PANEL */}
      {activeCard === 'special' && (
        <div className="bg-white rounded-2xl border border-amber-200 p-5 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-600" />
                <span>{language === 'en' ? 'Special Schedules, Holiday Make-ups & Summer School' : '特別日程・祝日要振替・サマースクール管理'}</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'en' ? 'Set holiday closures (ticket granted), Summer/Winter School, special open days, and facility-closed days.' : '祝日休講（チケット付与）や、サマー/冬期スクール、特別開校日、休館日を設定します。'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddingSpecialDay(!isAddingSpecialDay)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'en' ? 'Add special schedule' : '特別日程を追加'}</span>
            </button>
          </div>

          {/* Add Special Day Form Drawer */}
          {isAddingSpecialDay && (
            <form
              onSubmit={handleAddSpecialDay}
              className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs"
            >
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/80">
                <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>{language === 'en' ? 'Register New Special Schedule' : '新規特別日程の登録'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingSpecialDay(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  {language === 'en' ? 'Cancel' : 'キャンセル'}
                </button>
              </div>

              {/* Type Presets Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language === 'en' ? 'Schedule type (choose a preset)' : '日程種別（プリセット選択）'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { type: 'holiday_transfer', label: '祝日休講（要振替）', enLabel: 'Holiday closure (make-up required)', icon: AlertTriangle, color: 'text-amber-700' },
                    { type: 'summer_school', label: 'サマースクール', enLabel: 'Summer School', icon: Sun, color: 'text-orange-600' },
                    { type: 'winter_school', label: 'ウィンタースクール', enLabel: 'Winter School', icon: Snowflake, color: 'text-cyan-600' },
                    { type: 'special_open', label: '祝日特別開校', enLabel: 'Special holiday opening', icon: CheckCircle2, color: 'text-emerald-600' },
                    { type: 'closed', label: '完全休館日', enLabel: 'Facility closed', icon: Clock, color: 'text-slate-600' },
                    { type: 'event', label: 'イベント・大会', enLabel: 'Event / tournament', icon: Flame, color: 'text-purple-600' }
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = specialType === item.type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => handleTypeSelect(item.type as SpecialDayType)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold transition flex items-center gap-2 ${
                          isSelected
                            ? 'bg-white border-amber-600 ring-2 ring-amber-500 shadow-2xs'
                            : 'bg-white/70 hover:bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${item.color}`} />
                        <span>{language === 'en' ? item.enLabel : item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Selection Mode Selector */}
              <div className="bg-amber-100/70 p-1.5 rounded-xl flex gap-1 border border-amber-300/60">
                <button
                  type="button"
                  onClick={() => setDateSelectionMode('single')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    dateSelectionMode === 'single'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-amber-900 hover:bg-amber-200/60'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Single day' : '単日指定（1日のみ）'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDateSelectionMode('range')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    dateSelectionMode === 'range'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-amber-900 hover:bg-amber-200/60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Date range (bulk register Summer/Winter/holiday periods)' : '期間指定（サマー・冬期・連休等の一括登録）'}</span>
                </button>
              </div>

              {/* Date Inputs depending on mode */}
              {dateSelectionMode === 'single' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{language === 'en' ? 'Date' : '対象日付'}</label>
                    <input
                      type="date"
                      required
                      value={specialDate}
                      onChange={(e) => setSpecialDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{language === 'en' ? 'Display title' : '表示タイトル'}</label>
                    <input
                      type="text"
                      required
                      value={specialTitle}
                      onChange={(e) => setSpecialTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500"
                      placeholder={language === 'en' ? 'e.g. Mountain Day (make-up required)' : '例: 山の日（要振替）'}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{language === 'en' ? 'Calendar badge text' : 'カレンダーバッジ文字'}</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={specialBadge}
                      onChange={(e) => setSpecialBadge(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500"
                      placeholder={language === 'en' ? 'e.g. Hol, Summer' : '例: 祝(要振), サマー'}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-white p-3.5 sm:p-4 rounded-xl border border-amber-200 shadow-2xs">
                  {/* Quick presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-extrabold text-slate-500 mr-1">{language === 'en' ? 'Quick ranges:' : '期間クイック設定:'}</span>
                    <button
                      type="button"
                      onClick={() => handleSetQuickRange('this_week')}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-bold rounded-lg transition"
                    >
                      {language === 'en' ? 'This week (Mon–Fri)' : '今週 (月〜金)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetQuickRange('next_week')}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-bold rounded-lg transition"
                    >
                      {language === 'en' ? 'Next week (Mon–Fri)' : '来週 (月〜金)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetQuickRange('summer')}
                      className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 text-[11px] font-bold rounded-lg transition"
                    >
                      {language === 'en' ? 'Summer (Aug weekdays)' : 'サマー講習 (8月平日)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetQuickRange('winter')}
                      className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-200 text-[11px] font-bold rounded-lg transition"
                    >
                      {language === 'en' ? 'Winter School (New Year period)' : '冬期スクール (年末年始)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetQuickRange('golden_week')}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-bold rounded-lg transition"
                    >
                      {language === 'en' ? 'Golden Week (early May)' : 'GW連休 (5月上旬)'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{language === 'en' ? 'Start date' : '開始日 (Start)'}</label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{language === 'en' ? 'End date' : '終了日 (End)'}</label>
                      <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{language === 'en' ? 'Display title' : '表示タイトル'}</label>
                      <input
                        type="text"
                        required
                        value={specialTitle}
                        onChange={(e) => setSpecialTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500"
                        placeholder={language === 'en' ? 'e.g. Summer School 2026' : '例: サマースクール 2026'}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">{language === 'en' ? 'Calendar badge text' : 'カレンダーバッジ文字'}</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={specialBadge}
                        onChange={(e) => setSpecialBadge(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500"
                        placeholder={language === 'en' ? 'e.g. Summer' : '例: サマー'}
                      />
                    </div>
                  </div>

                  {/* Day of Week Filter */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">{language === 'en' ? 'Weekdays:' : '対象曜日:'}</span>
                      <div className="flex items-center gap-1">
                        {[
                          { day: 1, label: '月', enLabel: 'M' },
                          { day: 2, label: '火', enLabel: 'Tu' },
                          { day: 3, label: '水', enLabel: 'W' },
                          { day: 4, label: '木', enLabel: 'Th' },
                          { day: 5, label: '金', enLabel: 'F' },
                          { day: 6, label: '土', enLabel: 'Sa', weekend: true },
                          { day: 0, label: '日', enLabel: 'Su', weekend: true }
                        ].map((w) => {
                          const isChecked = selectedWeekdays.includes(w.day);
                          return (
                            <button
                              key={w.day}
                              type="button"
                              onClick={() => handleToggleWeekday(w.day)}
                              className={`w-7 h-7 rounded-lg text-xs font-black transition border ${
                                isChecked
                                  ? w.weekend
                                    ? 'bg-rose-500 text-white border-rose-600'
                                    : 'bg-amber-600 text-white border-amber-700'
                                  : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {language === 'en' ? w.enLabel : w.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedWeekdays([1, 2, 3, 4, 5])}
                        className="text-[11px] font-bold text-amber-800 hover:underline px-2 py-0.5"
                      >
                        {language === 'en' ? 'Weekdays only (Mon–Fri)' : '平日のみ (月〜金)'}
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedWeekdays([0, 1, 2, 3, 4, 5, 6])}
                        className="text-[11px] font-bold text-amber-800 hover:underline px-2 py-0.5"
                      >
                        {language === 'en' ? 'All days (incl. Sat/Sun)' : '全曜日 (土日含む)'}
                      </button>
                    </div>
                  </div>

                  {/* Range Preview Box */}
                  <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>{language === 'en' ? `Bulk registration: ${previewRangeDates.length} days total` : `一括登録対象: 計 ${previewRangeDates.length} 日間`}</span>
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {startDate} 〜 {endDate}
                      </span>
                    </div>

                    {previewRangeDates.length === 0 ? (
                      <span className="text-rose-600 font-bold">
                        {language === 'en' ? '* No dates match the selected period and weekdays.' : '※選択された期間・曜日に合致する日付がありません。'}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pt-1">
                        {previewRangeDates.map((d) => {
                          const dateObj = new Date(d);
                          const dayNum = dateObj.getDay();
                          const dayLabel = (language === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['日', '月', '火', '水', '木', '金', '土'])[dayNum];
                          return (
                            <span
                              key={d}
                              className="px-2 py-0.5 bg-white border border-amber-300 rounded text-[10px] font-bold text-slate-700"
                            >
                              {d.slice(5)} ({dayLabel})
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{language === 'en' ? 'Auto-grant make-up ticket:' : '振替チケット自動付与:'}</span>
                    <label className="flex items-center gap-1 cursor-pointer text-xs font-bold text-amber-800">
                      <input
                        type="checkbox"
                        checked={grantsTransfer}
                        onChange={(e) => setGrantsTransfer(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>{language === 'en' ? 'Grant ticket (+1)' : 'チケット付与する (+1枚)'}</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {language === 'en' ? '* When checked, students who normally attend on this weekday automatically receive a make-up ticket.' : '※チェックを入れると、この曜日が通常出席日の生徒に「要振替チケット」が自動付与されます。'}
                  </p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{language === 'en' ? 'Accept make-ups (bookings):' : '振替受入（予約受付）:'}</span>
                    <label className="flex items-center gap-1 cursor-pointer text-xs font-bold text-emerald-800">
                      <input
                        type="checkbox"
                        checked={allowTransfers}
                        onChange={(e) => setAllowTransfers(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{language === 'en' ? 'Make-ups allowed' : '振替受入可能'}</span>
                    </label>
                  </div>
                  {allowTransfers && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <span className="text-slate-600">{language === 'en' ? 'Special make-up slots:' : '特別振替枠数:'}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={specialQuota}
                          onChange={(e) => setSpecialQuota(Number(e.target.value))}
                          className="w-12 px-1 py-0.5 text-center text-xs font-bold border border-slate-200 rounded"
                        />
                        <span>{language === 'en' ? '' : '名'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{language === 'en' ? 'Description / notes' : '説明・注意事項メモ'}</label>
                <input
                  type="text"
                  value={specialNote}
                  onChange={(e) => setSpecialNote(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500"
                  placeholder={language === 'en' ? 'Notes for parents/guardians and staff' : '保護者やスタッフ向けのメモ'}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingSpecialDay(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  {language === 'en' ? 'Close' : '閉じる'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Register special schedule' : '特別日程を登録する'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Special Days List */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h5 className="text-xs font-black text-slate-700">
                {language === 'en'
                  ? `Registered special schedules (${specialDays.length}${filteredSpecialDays.length !== specialDays.length ? ` / filtered: ${filteredSpecialDays.length}` : ''})`
                  : `登録済みの特別日程一覧（${specialDays.length}件${filteredSpecialDays.length !== specialDays.length ? ` / 絞込: ${filteredSpecialDays.length}件` : ''}）`}
              </h5>

              {specialDays.length > 0 && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={language === 'en' ? 'Search by date or title...' : '日付やタイトルで検索...'}
                    value={listSearchQuery}
                    onChange={(e) => setListSearchQuery(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-amber-500 w-44"
                  />
                  <button
                    type="button"
                    onClick={handleClearAllSpecialDays}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded transition"
                  >
                    {language === 'en' ? 'Delete all' : '全削除'}
                  </button>
                </div>
              )}
            </div>

            {/* Filter Type Pills */}
            {specialDays.length > 0 && (
              <div className="flex flex-wrap gap-1 pb-1">
                {[
                  { id: 'all', label: 'すべて', enLabel: 'All' },
                  { id: 'holiday_transfer', label: '祝日要振替', enLabel: 'Holiday make-up' },
                  { id: 'summer_school', label: 'サマースクール', enLabel: 'Summer School' },
                  { id: 'winter_school', label: 'ウィンター', enLabel: 'Winter' },
                  { id: 'spring_school', label: 'スプリング', enLabel: 'Spring' },
                  { id: 'special_open', label: '特別開校', enLabel: 'Special open' },
                  { id: 'closed', label: '休館日', enLabel: 'Facility closed' },
                  { id: 'event', label: 'イベント', enLabel: 'Event' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setListFilterType(tab.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      listFilterType === tab.id
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {language === 'en' ? tab.enLabel : tab.label}
                  </button>
                ))}
              </div>
            )}

            {specialDays.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                {language === 'en' ? 'No special schedules registered. Use "+ Add special schedule" to add one.' : '現在登録されている特別日程はありません。「＋特別日程を追加」から登録してください。'}
              </div>
            ) : filteredSpecialDays.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs font-bold">
                {language === 'en' ? 'No special schedules match the filter' : '条件に一致する特別日程がありません'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredSpecialDays.map((sp) => (
                  <div
                    key={sp.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-amber-300 transition shadow-2xs flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900">{sp.date}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSpecialBadgeStyle(
                              sp.type
                            )}`}
                          >
                            {sp.badgeText}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSpecialDay(sp.id, sp.date)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition"
                          title={language === 'en' ? 'Delete' : '削除'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <h6 className="text-xs font-extrabold text-slate-800">{sp.title}</h6>
                      {sp.note && (
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{sp.note}</p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <div className="flex items-center gap-2">
                        {sp.grantsTransfer ? (
                          <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                            {language === 'en' ? 'Ticket granted' : 'チケット付与対象'}
                          </span>
                        ) : (
                          <span className="text-slate-400">{language === 'en' ? 'No ticket' : '付与なし'}</span>
                        )}
                        {sp.allowTransfers ? (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {language === 'en' ? `Make-ups allowed (${sp.transferQuota || 2} open)` : `振替受入可 (空${sp.transferQuota || 2})`}
                          </span>
                        ) : (
                          <span className="text-slate-400">{language === 'en' ? 'No make-ups' : '振替受入なし'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. OVERRIDES PANEL */}
      {activeCard === 'override' && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>{language === 'en' ? 'Date-Specific Slot Changes' : '特定日の臨時増枠・制限一覧'}</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'en' ? 'Temporary capacity changes set individually from the daily attendance roster calendar.' : '日次出席名簿のカレンダー等から個別に設定された臨時定員変更です。'}
              </p>
            </div>
          </div>

          {overrides.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
              {language === 'en' ? 'No temporary slot changes. You can add extra slots for a specific date from "Capacity settings" in "1. Daily Roster & Slots".' : '特定日の一時的な枠変更はありません。「1. 日次出席名簿・枠確認」の「定員設定」から特定日の臨時増枠が行えます。'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
              {overrides.map((ov, idx) => (
                <div key={idx} className="p-3.5 flex items-center justify-between bg-white hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-900">{ov.date}</span>
                    <span className="text-xs font-bold text-slate-700">{ov.classId}</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {language === 'en' ? `Make-up slots: ${ov.maxTransferQuota} open / Capacity: ${ov.maxTotalCapacity}` : `振替枠: 空${ov.maxTransferQuota}名 / 定員: ${ov.maxTotalCapacity}名`}
                    </span>
                    {ov.isCancelled && (
                      <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {language === 'en' ? 'Closed' : '休講設定'}
                      </span>
                    )}
                  </div>

                  {onDeleteOverride && (
                    <button
                      onClick={() => onDeleteOverride(ov.date, ov.classId)}
                      className="text-slate-400 hover:text-rose-600 text-xs font-bold px-2 py-1 rounded transition"
                    >
                      {language === 'en' ? 'Remove' : '解除'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
