import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { safeStorage } from './safeStorage';

export type Language = 'ja' | 'en';

export interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, defaultText?: string) => string;
  getClassName: (classId: string) => string;
  getWeekdayName: (day: number, format?: 'short' | 'long') => string;
  getReasonLabel: (reason: string) => string;
  getSpecialTypeLabel: (type: string) => string;
}

const STORAGE_KEY = 'soltilo_app_lang';

export const DICTIONARY: Record<Language, Record<string, string>> = {
  ja: {
    // Header
    'header.title': 'SOLTILO GSA',
    'header.subtitle': 'Afterschool',
    'header.badge': '振替管理システム',
    'header.description': '欠席連絡・振替予約・振替残数リアルタイム管理',
    'header.parentMode': '保護者モード',
    'header.adminMode': 'スクール管理者モード',
    'header.sheetsSync': 'Sheets同期',
    'header.sheetsOpen': 'Sheetsを開く',
    'header.sheetsSettings': 'Sheets設定',
    'header.language': '言語',

    // Parent Login / Selector
    'login.title': '保護者・生徒ログイン',
    'login.subtitle': 'お子様の認証コード（または保護者PIN）を入力してログインしてください',
    'login.studentCode': '生徒認証コード (例: ST-001)',
    'login.pin': '保護者PIN (4桁)',
    'login.submit': 'ログイン',
    'login.demoNotice': '※デモ用コード: ST-001 / ST-002 / ST-003（PIN初期値: 1234）',
    'login.quickSelect': 'または以下から選択してクイックログイン:',
    'login.failed': '認証コードまたはPINが一致しません。',
    'login.logout': 'ログアウト',
    'login.idLabel': 'ログインID（コドモンID）',
    'login.pwLabel': 'パスワード',
    'booking.modalTitle': '振替レッスンの予約',
    'booking.confirm': 'この日で振替予約を確定する',
    'admin.totalStudents': '在籍生徒数',
    'admin.todayAbsences': '本日の欠席',
    'admin.todayTransfers': '本日の振替受入',
    'admin.sheetsConnected': 'スプレッドシート連携',
    'admin.tabs.roster': '日次ロスター',
    'admin.tabs.students': '生徒名簿',
    'admin.tabs.settings': '定員・特別日程',
    'admin.tabs.codmon': 'コドモン連携',
    'admin.tabs.sheets': 'スプレッドシート',

    // Parent Dashboard
    'parent.welcome': 'ようこそ',
    'parent.switchStudent': '生徒を切替',
    'parent.changePin': 'PIN・コード変更',
    'parent.btnReportAbsence': '欠席連絡をする',
    'parent.btnBookTransfer': '振替を予約する',
    'parent.remainingTickets': '振替可能残数',
    'parent.reportedAbsences': '登録済み欠席',
    'parent.bookedTransfers': '予約済み振替',
    'parent.ticketsUnit': '回分',
    'parent.timesUnit': '回',
    'parent.earliestExpiry': '直近の有効期限',
    'parent.noExpiringTickets': '失効予定チケットなし',
    'parent.daysLeft': '日後',
    'parent.expiredNotice': '有効期限（60日）が過ぎたチケットは利用できなくなります。',
    'parent.regularDays': '通塾曜日',
    'parent.grade': '学年・対象',
    'parent.class': '所属クラス',

    // Calendar
    'calendar.title': '受講・振替カレンダー (12週間)',
    'calendar.legendRegular': '通常受講',
    'calendar.legendAbsent': '欠席申請済',
    'calendar.legendTransfer': '振替受講日',
    'calendar.legendAvailable': '振替空きあり',
    'calendar.legendFull': '満席',
    'calendar.legendSpecial': '特別日程',
    'calendar.legendClosed': '休校・休館',
    'calendar.today': '今日',
    'calendar.thisWeek': '今週',
    'calendar.week': '週',
    'calendar.month': '月',
    'calendar.statusClosed': '休',
    'calendar.statusHoliday': '祝',
    'calendar.statusRegular': '通常',
    'calendar.statusAbsent': '欠席',
    'calendar.statusTransfer': '振替',
    'calendar.statusAvailable': '空',
    'calendar.statusFull': '満席',
    'calendar.statusExpired': '期限外',
    'calendar.slots': '枠',
    'calendar.clickToBook': 'クリックして振替予約',
    'calendar.clickToAbsence': 'クリックして欠席連絡',

    // Absence Modal
    'absence.modalTitle': '欠席連絡の申請',
    'absence.targetDate': '欠席する受講日',
    'absence.reason': '欠席理由',
    'absence.selectReason': '理由を選択してください',
    'absence.note': '備考・連絡事項（任意）',
    'absence.submit': '欠席連絡を確定する',
    'absence.cancel': 'キャンセル',
    'absence.ruleNotice': '【振替規定】欠席日の翌日から起算して60日間、他の曜日の空き枠へ振替が可能です。',
    'absence.alreadyReported': 'この日はすでに欠席連絡済みです。',
    'absence.notRegularDay': '選択された日は通常通塾曜日ではありません。',
    'absence.success': '欠席連絡を受け付けました。振替チケットが1回分付与されました。',

    // Transfer Modal
    'transfer.modalTitle': '振替レッスンの予約',
    'transfer.step1': '1. 振替元チケットを選択',
    'transfer.step2': '2. 振替希望日を選択（今後3ヶ月）',
    'transfer.step3': '3. 予約内容の確認',
    'transfer.noTickets': '利用可能な振替チケットがありません。',
    'transfer.selectTicket': '使用する欠席チケットを選択してください',
    'transfer.expiryDate': '有効期限',
    'transfer.selectedDate': '選択中の振替日',
    'transfer.availableSlots': '残り枠数',
    'transfer.confirmBooking': 'この日程で振替予約を確定する',
    'transfer.back': '戻る',
    'transfer.cancel': '閉じる',
    'transfer.bookingSuccess': '振替予約が完了しました！',
    'transfer.cancelBooking': '予約取消',
    'transfer.confirmCancel': 'この振替予約を取り消しますか？',

    // Admin Dashboard Tabs
    'admin.tabRoster': '1. 日次出席名簿',
    'admin.tabStudents': '2. 生徒・振替残数',
    'admin.tabSettings': '3. 曜日枠＆特別日程',
    'admin.tabCodmon': '4. コドモン連携',
    'admin.tabSheets': '5. Sheets連携',

    // Admin Roster
    'roster.title': '日次出席名簿・受講状況',
    'roster.dateSelect': '対象日を選択',
    'roster.totalPresent': '受講予定',
    'roster.regulars': 'レギュラー通塾',
    'roster.absences': '欠席',
    'roster.transfersIn': '振替受講生',
    'roster.transfersOut': '振替振出',
    'roster.remainingQuota': '当日振替残枠',
    'roster.adjustQuota': '当日枠・定員を調整',
    'roster.classQuota': '当日定員',
    'roster.transferQuota': '振替受入れ枠',
    'roster.studentName': '生徒名',
    'roster.status': '受講種別',
    'roster.contact': '保護者連絡先',
    'roster.actions': '操作',
    'roster.noStudents': 'このクラスの受講予定生徒はいません。',

    // Admin Students Management
    'students.title': '生徒一覧・振替残数管理',
    'students.addStudent': '新規生徒登録',
    'students.searchPlaceholder': '名前・コードで検索...',
    'students.filterClass': 'クラス絞込',
    'students.filterAll': 'すべてのクラス',
    'students.colName': '生徒名 / コード',
    'students.colClass': 'クラス / 対象',
    'students.colRegularDays': '通塾曜日',
    'students.colTransferBalance': '振替残数',
    'students.colActions': '操作 / 残数調整',
    'students.addTicket': '+1回 付与',
    'students.subTicket': '-1回 消化',
    'students.editStudent': '編集',
    'students.deleteStudent': '削除',

    // Admin Quota & Schedule Settings
    'settings.title': '曜日別定員・振替枠＆特別日程設定',
    'settings.subtitle': '曜日ごとの基本受入枠・特別日程（サマースクール/祝日）・個別オーバーライドを設定します',
    'settings.weekdayMatrix': '1. クラス×曜日別 基本定員・振替枠マスタ',
    'settings.specialSchedule': '2. 特別日程・シーズン講習・祝日振替設定',
    'settings.overrides': '3. 日別ピンポイント枠設定（オーバーライド）',
    'settings.save': '設定を保存する',
    'settings.savedSuccess': '設定を保存しました',
    'settings.singleMode': '単日指定（1日のみ）',
    'settings.rangeMode': '期間指定（サマー・冬期・連休等の一括登録）',
    'settings.startDate': '開始日',
    'settings.endDate': '終了日',
    'settings.targetWeekdays': '対象曜日',
    'settings.weekdaysOnly': '平日のみ (月〜金)',
    'settings.allDays': '全曜日 (土日含む)',
    'settings.batchCount': '一括登録対象',
    'settings.quickRanges': '期間クイック設定',
    'settings.presetThisWeek': '今週 (月〜金)',
    'settings.presetNextWeek': '来週 (月〜金)',
    'settings.presetSummer': 'サマー講習 (8月平日)',
    'settings.presetWinter': '冬期スクール (年末年始)',
    'settings.presetGW': 'GW連休 (5月上旬)',

    // Common
    'common.save': '保存',
    'common.cancel': 'キャンセル',
    'common.close': '閉じる',
    'common.delete': '削除',
    'common.edit': '編集',
    'common.confirm': '確認',
    'common.loading': '読み込み中...',
    'common.all': 'すべて',
    'common.person': '名',
    'common.slotsUnit': '枠',
    'common.date': '日付',
    'common.class': 'クラス',
    'common.status': '状態',
    'common.note': '備考',

    // CoDMON Daily Smart Paste
    'daily.smartPaste': 'コドモン デイリー画面 全選択ペースト',
    'daily.smartPasteBtn': 'デイリー画面まるごと貼付',
    'daily.smartPasteSubtitle': 'コドモン画面を全選択(Ctrl+A)して貼り付けるだけで、欠席・振替・出席を自動分析して反映します',
    'daily.lastUpdated': '最終更新',
    'daily.collisionWarning': '重複注意',
    'daily.applyAll': '分析結果を一括反映する',
    'daily.loadSample': 'サンプルデイリー読込',
    'daily.pastePlaceholder': 'コドモンで「Ctrl+A (全選択)」→「Ctrl+C (コピー)」したテキストをここに貼り付けてください (Ctrl+V)',
    'daily.history': '同期・更新ログ'
  },
  en: {
    // Header
    'header.title': 'SOLTILO GSA',
    'header.subtitle': 'Afterschool',
    'header.badge': 'Transfer Portal',
    'header.description': 'Absence Reporting, Make-up Lesson Booking & Credit Management',
    'header.parentMode': 'Parent View',
    'header.adminMode': 'Admin Portal',
    'header.sheetsSync': 'Sync Sheets',
    'header.sheetsOpen': 'Open Sheets',
    'header.sheetsSettings': 'Sheets Config',
    'header.language': 'Language',

    // Parent Login / Selector
    'login.title': 'Student / Parent Login',
    'login.subtitle': 'Enter student code (or parent PIN) to sign in',
    'login.studentCode': 'Student Code (e.g. ST-001)',
    'login.pin': 'Parent PIN (4 digits)',
    'login.submit': 'Sign In',
    'login.demoNotice': '※ Demo Codes: ST-001 / ST-002 / ST-003 (Default PIN: 1234)',
    'login.quickSelect': 'Or choose below for instant quick sign-in:',
    'login.failed': 'Invalid Student Code or PIN.',
    'login.logout': 'Sign Out',
    'login.idLabel': 'Login ID (CoDMON ID)',
    'login.pwLabel': 'Password',
    'booking.modalTitle': 'Book a Make-up Lesson',
    'booking.confirm': 'Confirm Booking for This Date',
    'admin.totalStudents': 'Enrolled Students',
    'admin.todayAbsences': "Today's Absences",
    'admin.todayTransfers': "Today's Make-ups",
    'admin.sheetsConnected': 'Google Sheets',
    'admin.tabs.roster': 'Daily Roster',
    'admin.tabs.students': 'Students',
    'admin.tabs.settings': 'Capacity & Schedule',
    'admin.tabs.codmon': 'CoDMON',
    'admin.tabs.sheets': 'Sheets',

    // Parent Dashboard
    'parent.welcome': 'Welcome',
    'parent.switchStudent': 'Switch Child',
    'parent.changePin': 'Change PIN / Code',
    'parent.btnReportAbsence': 'Report Absence',
    'parent.btnBookTransfer': 'Book Make-up',
    'parent.remainingTickets': 'Transfer Credits',
    'parent.reportedAbsences': 'Reported Absences',
    'parent.bookedTransfers': 'Booked Make-ups',
    'parent.ticketsUnit': 'credits',
    'parent.timesUnit': 'times',
    'parent.earliestExpiry': 'Next Expiry Date',
    'parent.noExpiringTickets': 'No credits expiring soon',
    'parent.daysLeft': 'days left',
    'parent.expiredNotice': 'Credits expire 60 days after the original absence date.',
    'parent.regularDays': 'Regular Days',
    'parent.grade': 'Target Age / Grade',
    'parent.class': 'Enrolled Class',

    // Calendar
    'calendar.title': 'Lesson & Make-up Schedule (12 Weeks)',
    'calendar.legendRegular': 'Regular Lesson',
    'calendar.legendAbsent': 'Reported Absent',
    'calendar.legendTransfer': 'Make-up Lesson',
    'calendar.legendAvailable': 'Open Slot',
    'calendar.legendFull': 'Class Full',
    'calendar.legendSpecial': 'Special Schedule',
    'calendar.legendClosed': 'School Closed',
    'calendar.today': 'Today',
    'calendar.thisWeek': 'This Week',
    'calendar.week': 'Wk',
    'calendar.month': 'Mo',
    'calendar.statusClosed': 'Closed',
    'calendar.statusHoliday': 'Holiday',
    'calendar.statusRegular': 'Regular',
    'calendar.statusAbsent': 'Absent',
    'calendar.statusTransfer': 'Make-up',
    'calendar.statusAvailable': 'Open',
    'calendar.statusFull': 'Full',
    'calendar.statusExpired': 'Expired',
    'calendar.slots': 'slots',
    'calendar.clickToBook': 'Click to book make-up',
    'calendar.clickToAbsence': 'Click to report absence',

    // Absence Modal
    'absence.modalTitle': 'Report an Absence',
    'absence.targetDate': 'Absence Date',
    'absence.reason': 'Reason for Absence',
    'absence.selectReason': 'Select reason',
    'absence.note': 'Notes / Additional details (Optional)',
    'absence.submit': 'Confirm Absence',
    'absence.cancel': 'Cancel',
    'absence.ruleNotice': '【Policy】A make-up credit will be issued, valid for 60 days from the day after the missed lesson.',
    'absence.alreadyReported': 'Absence has already been reported for this date.',
    'absence.notRegularDay': 'Selected date is not a regular enrolled day.',
    'absence.success': 'Absence recorded! 1 make-up credit has been granted.',

    // Transfer Modal
    'transfer.modalTitle': 'Book a Make-up Lesson',
    'transfer.step1': '1. Select Available Credit',
    'transfer.step2': '2. Select Target Date (Next 3 Months)',
    'transfer.step3': '3. Confirm Reservation',
    'transfer.noTickets': 'No make-up credits available.',
    'transfer.selectTicket': 'Select which absence credit to redeem',
    'transfer.expiryDate': 'Valid until',
    'transfer.selectedDate': 'Selected Date',
    'transfer.availableSlots': 'Open Slots',
    'transfer.confirmBooking': 'Confirm Make-up Booking',
    'transfer.back': 'Back',
    'transfer.cancel': 'Close',
    'transfer.bookingSuccess': 'Make-up lesson booked successfully!',
    'transfer.cancelBooking': 'Cancel Booking',
    'transfer.confirmCancel': 'Are you sure you want to cancel this booking?',

    // Admin Dashboard Tabs
    'admin.tabRoster': '1. Daily Roster',
    'admin.tabStudents': '2. Students & Credits',
    'admin.tabSettings': '3. Quotas & Schedule',
    'admin.tabCodmon': '4. CoDMON Sync',
    'admin.tabSheets': '5. Google Sheets',

    // Admin Roster
    'roster.title': 'Daily Class Roster & Capacity',
    'roster.dateSelect': 'Select Date',
    'roster.totalPresent': 'Total Expected',
    'roster.regulars': 'Regular Enrolled',
    'roster.absences': 'Absences',
    'roster.transfersIn': 'Make-up Students',
    'roster.transfersOut': 'Transferred Out',
    'roster.remainingQuota': 'Open Make-up Slots',
    'roster.adjustQuota': 'Adjust Capacity / Quotas',
    'roster.classQuota': 'Daily Capacity',
    'roster.transferQuota': 'Make-up Slot Limit',
    'roster.studentName': 'Student Name',
    'roster.status': 'Attendance Type',
    'roster.contact': 'Guardian Contact',
    'roster.actions': 'Actions',
    'roster.noStudents': 'No students scheduled for this class.',

    // Admin Students Management
    'students.title': 'Student Directory & Credit Management',
    'students.addStudent': 'Add Student',
    'students.searchPlaceholder': 'Search by name or code...',
    'students.filterClass': 'Filter Class',
    'students.filterAll': 'All Classes',
    'students.colName': 'Student / Code',
    'students.colClass': 'Class / Target',
    'students.colRegularDays': 'Regular Days',
    'students.colTransferBalance': 'Credit Balance',
    'students.colActions': 'Actions / Adjust Balance',
    'students.addTicket': '+1 Credit',
    'students.subTicket': '-1 Credit',
    'students.editStudent': 'Edit',
    'students.deleteStudent': 'Delete',

    // Admin Quota & Schedule Settings
    'settings.title': 'Weekday Quotas & Special Schedules',
    'settings.subtitle': 'Configure default weekday slots, seasonal programs (Summer/Winter), and daily overrides',
    'settings.weekdayMatrix': '1. Default Weekday Quotas & Capacity Matrix',
    'settings.specialSchedule': '2. Special Schedules, Camps & Holidays',
    'settings.overrides': '3. Daily Pinpoint Overrides',
    'settings.save': 'Save Configuration',
    'settings.savedSuccess': 'Settings saved successfully',
    'settings.singleMode': 'Single Date (1 day)',
    'settings.rangeMode': 'Date Range (Batch Summer/Winter Camps & Breaks)',
    'settings.startDate': 'Start Date',
    'settings.endDate': 'End Date',
    'settings.targetWeekdays': 'Applicable Weekdays',
    'settings.weekdaysOnly': 'Weekdays Only (Mon-Fri)',
    'settings.allDays': 'All Days (Incl. Weekends)',
    'settings.batchCount': 'Dates in Range',
    'settings.quickRanges': 'Quick Presets',
    'settings.presetThisWeek': 'This Week (Mon-Fri)',
    'settings.presetNextWeek': 'Next Week (Mon-Fri)',
    'settings.presetSummer': 'Summer Camp (August)',
    'settings.presetWinter': 'Winter School (Dec-Jan)',
    'settings.presetGW': 'Golden Week (Early May)',

    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.confirm': 'Confirm',
    'common.loading': 'Loading...',
    'common.all': 'All',
    'common.person': 'students',
    'common.slotsUnit': 'slots',
    'common.date': 'Date',
    'common.class': 'Class',
    'common.status': 'Status',
    'common.note': 'Note',

    // CoDMON Daily Smart Paste
    'daily.smartPaste': 'CoDMON Daily Screen Smart Paste',
    'daily.smartPasteBtn': 'CoDMON Daily Smart Paste',
    'daily.smartPasteSubtitle': 'Select all (Ctrl+A) on CoDMON daily view and paste to automatically parse absences, make-ups, and attendance',
    'daily.lastUpdated': 'Last Synced',
    'daily.collisionWarning': 'Collision Guard',
    'daily.applyAll': 'Apply All Analyzed Records',
    'daily.loadSample': 'Load Sample Daily Text',
    'daily.pastePlaceholder': 'Paste entire copied text from CoDMON (Ctrl+A -> Ctrl+C -> Ctrl+V here)',
    'daily.history': 'Sync Logs'
  }
};

const CLASS_NAMES: Record<string, { ja: string; en: string }> = {
  ex1: { ja: 'EX1', en: 'EX1' },
  ex2: { ja: 'EX2', en: 'EX2' },
  kin: { ja: 'Kin', en: 'Kin' },
  ele1: { ja: 'Ele1', en: 'Ele1' },
  ele2: { ja: 'Ele2', en: 'Ele2' }
};

const WEEKDAYS: Record<Language, { short: string[]; long: string[] }> = {
  ja: {
    short: ['日', '月', '火', '水', '木', '金', '土'],
    long: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']
  },
  en: {
    short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    long: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  }
};

const REASONS: Record<string, { ja: string; en: string }> = {
  '体調不良・風邪': { ja: '体調不良・風邪', en: 'Illness / Cold / Fever' },
  '学校行事・園行事': { ja: '学校行事・園行事', en: 'School / Kindergarten Event' },
  '家庭の都合・旅行': { ja: '家庭の都合・旅行', en: 'Family Schedule / Trip' },
  '怪我・通院': { ja: '怪我・通院', en: 'Injury / Clinic Visit' },
  'その他': { ja: 'その他', en: 'Other Reason' },
  '祝日休講（要振替）': { ja: '祝日休講（要振替）', en: 'Holiday closure (make-up)' },
  'コドモン欠席連絡': { ja: 'コドモン欠席連絡', en: 'CoDMON absence' },
  'コドモン欠席連絡 (都合欠)': { ja: 'コドモン欠席連絡 (都合欠)', en: 'CoDMON absence (personal)' },
  '体調不良 (病欠)': { ja: '体調不良 (病欠)', en: 'Sick leave' }
};

const SPECIAL_TYPES: Record<string, { ja: string; en: string }> = {
  holiday_transfer: { ja: '祝日休講（要振替）', en: 'Holiday (Make-up req)' },
  summer_school: { ja: 'サマースクール', en: 'Summer Camp' },
  winter_school: { ja: 'ウィンタースクール', en: 'Winter School' },
  spring_school: { ja: 'スプリングスクール', en: 'Spring Camp' },
  special_open: { ja: '祝日特別開校', en: 'Special Open' },
  closed: { ja: '施設休館日', en: 'Facility Closed' },
  event: { ja: 'イベント・大会', en: 'Special Event' }
};

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = safeStorage.getItem(STORAGE_KEY);
    return saved === 'en' || saved === 'ja' ? saved : 'ja';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    safeStorage.setItem(STORAGE_KEY, lang);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ja' ? 'en' : 'ja');
  };

  const t = (key: string, defaultText?: string): string => {
    const dict = DICTIONARY[language];
    if (dict && dict[key]) {
      return dict[key];
    }
    return defaultText || key;
  };

  const getClassName = (classId: string): string => {
    const info = CLASS_NAMES[classId];
    if (info) {
      return info[language];
    }
    return classId;
  };

  const getWeekdayName = (day: number, format: 'short' | 'long' = 'short'): string => {
    const safeDay = ((day % 7) + 7) % 7;
    return WEEKDAYS[language][format][safeDay] || '';
  };

  const getReasonLabel = (reason: string): string => {
    const r = REASONS[reason];
    if (r) return r[language];
    return reason;
  };

  const getSpecialTypeLabel = (type: string): string => {
    const st = SPECIAL_TYPES[type];
    if (st) return st[language];
    return type;
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        getClassName,
        getWeekdayName,
        getReasonLabel,
        getSpecialTypeLabel
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
