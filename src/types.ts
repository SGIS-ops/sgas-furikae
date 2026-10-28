export type ClassId = 'ex1' | 'ex2' | 'kin' | 'ele1' | 'ele2';

export interface ClassInfo {
  id: ClassId;
  name: string;
  jpName: string;
  ageRange: string;
  defaultCapacity: number; // Max total capacity including transfers (Default 20)
  defaultTransferQuota: number; // Max transfer slots per day (Default 2)
  scheduleDays: number[]; // 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri
  color: string;
  badgeBg: string;
  badgeText: string;
}

export interface Student {
  id: string;
  name: string; // e.g., "サンプル 蓮 (Ren Sample)"
  classId: ClassId;
  regularDays: number[]; // e.g. [1, 3] for Mon & Wed
  transferBalance: number; // 振替残数 (e.g. 2)
  parentName: string;
  contactEmail: string;
  loginId?: string;
  password?: string;
  isDefaultPassword?: boolean;
  notes?: string; // 備考（送迎バス利用など。スプレッドシートの生徒マスタと同期）
}

export interface AbsenceRecord {
  id: string;
  studentId: string;
  studentName: string;
  classId: ClassId;
  date: string; // YYYY-MM-DD
  reason: string; // e.g., 体調不良, 学校行事, 私用
  reportedAt: string; // ISO date string
  status: 'confirmed' | 'cancelled';
  creditGranted: boolean; // whether transfer credit was added
  expiryDate?: string; // 振替有効期限 (YYYY-MM-DD)
  creditExpired?: boolean; // 未使用のまま期限切れになり、振替残数から差し引き済み
}

export interface TransferBooking {
  id: string;
  studentId: string;
  studentName: string;
  fromClassId: ClassId;
  targetClassId: ClassId;
  absenceRecordId?: string; // linked absence
  targetDate: string; // YYYY-MM-DD
  bookedAt: string; // ISO date string
  status: 'booked' | 'attended' | 'cancelled';
  note?: string;
  expiryDate?: string; // 有効期限
}

export interface DailyClassOverride {
  date: string; // YYYY-MM-DD
  classId: ClassId;
  maxTotalCapacity: number; // default 20
  maxTransferQuota: number; // default 2
  isCancelled?: boolean; // event or holiday
}

// 曜日別・クラス別の基本定員＆振替枠マスタ
export interface WeekdayClassQuota {
  maxTransferQuota: number; // 振替枠数 (e.g. 2)
  maxTotalCapacity: number; // 最大定員 (e.g. 20)
  isOpen: boolean; // 開講有無
}

export type WeekdayQuotaSettings = Record<ClassId, Record<number, WeekdayClassQuota>>;

// 祝日要振替日・サマースクール・ウィンタースクールなどの特別日程設定
export type SpecialDayType =
  | 'holiday_transfer' // 祝日休講（要振替）- 自動で振替チケット対象
  | 'summer_school'    // サマースクール - 季節特別レッスン
  | 'winter_school'    // ウィンタースクール
  | 'spring_school'    // スプリングスクール
  | 'special_open'     // 祝日特別開校（祝日だが通常レッスン実施）
  | 'closed'           // 完全休館（お盆休み・年末年始）
  | 'event';           // イベント・大会

export interface SpecialScheduleDay {
  id: string;
  date: string; // YYYY-MM-DD
  type: SpecialDayType;
  title: string; // e.g. "山の日(振替対象)", "サマースクールDay1"
  badgeText: string; // e.g. "祝(要振)", "サマー", "冬期", "通常開校", "休館"
  allowTransfers: boolean; // 振替受講の受付可否
  transferQuota?: number; // この日の特別振替枠数 (未指定なら基本枠)
  grantsTransfer: boolean; // 該当曜日の在籍生に振替チケットを付与するか
  note?: string;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  lastSyncedAt: string | null;
  autoSync: boolean;
}

export interface CodmonSyncLog {
  id: string;
  timestamp: string; // ISO date string
  updatedBy: string; // e.g. "管理者 (Admin)"
  targetDate: string; // YYYY-MM-DD
  absencesCount: number;
  transfersCount: number;
  attendanceCount: number;
  summary: string;
  itemsSummary?: string[];
}

export type ViewMode = 'parent' | 'admin';
