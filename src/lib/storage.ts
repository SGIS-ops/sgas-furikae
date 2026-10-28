import { Student, AbsenceRecord, TransferBooking, DailyClassOverride, ClassId, WeekdayQuotaSettings, SpecialScheduleDay, CodmonSyncLog } from '../types';
import { INITIAL_STUDENTS, INITIAL_ABSENCES, INITIAL_BOOKINGS, INITIAL_WEEKDAY_QUOTAS, INITIAL_SPECIAL_DAYS } from '../data/initialData';
import { DEFAULT_TRANSFER_QUOTA, MAX_TOTAL_CAPACITY_LIMIT } from '../data/constants';
import { calculateExpiryDate } from './expiration';
import { safeStorage } from './safeStorage';

// v3: クラスを EX1/EX2/Kin/Ele1/Ele2 の5クラスに変更（旧 v1/v2 のデータは互換性がないため起動時に削除）
const KEY_VERSION = 'v3';
const LEGACY_VERSIONS = ['v1', 'v2'];
const KEY_NAMES = ['students', 'absences', 'bookings', 'overrides', 'weekday_quotas', 'special_days', 'codmon_sync_logs'];
const key = (name: string, version = KEY_VERSION) => `soltilo_gsa_${name}_${version}`;

const KEYS = {
  STUDENTS: key('students'),
  ABSENCES: key('absences'),
  BOOKINGS: key('bookings'),
  OVERRIDES: key('overrides'),
  WEEKDAY_QUOTAS: key('weekday_quotas'),
  SPECIAL_DAYS: key('special_days'),
  CODMON_SYNC_LOGS: key('codmon_sync_logs')
};

// 旧バージョンのデータ（実名が残っている可能性のあるものを含む）を起動時に削除する
const cleanupLegacyStorage = () => {
  try {
    LEGACY_VERSIONS.forEach((v) => KEY_NAMES.forEach((n) => safeStorage.removeItem(key(n, v))));
  } catch {
    // ignore
  }
};
cleanupLegacyStorage();

export const getStoredStudents = (): Student[] => {
  try {
    const raw = safeStorage.getItem(KEYS.STUDENTS);
    const parsed: Student[] = raw ? JSON.parse(raw) : INITIAL_STUDENTS;
    return parsed.map((s) => {
      const initMatch = INITIAL_STUDENTS.find((init) => init.id === s.id);
      return {
        ...s,
        loginId: s.loginId || initMatch?.loginId || `codmon_${s.id.replace('std_', '')}`,
        password: s.password || initMatch?.password || 'soltilo123',
        isDefaultPassword: s.isDefaultPassword !== false
      };
    });
  } catch {
    return INITIAL_STUDENTS;
  }
};

export const saveStudents = (students: Student[]): void => {
  safeStorage.setItem(KEYS.STUDENTS, JSON.stringify(students));
};

export const getStoredAbsences = (): AbsenceRecord[] => {
  try {
    const raw = safeStorage.getItem(KEYS.ABSENCES);
    const parsed: AbsenceRecord[] = raw ? JSON.parse(raw) : INITIAL_ABSENCES;
    return parsed.map((a) => ({
      ...a,
      expiryDate: a.expiryDate || calculateExpiryDate(a.date)
    }));
  } catch {
    return INITIAL_ABSENCES.map((a) => ({
      ...a,
      expiryDate: a.expiryDate || calculateExpiryDate(a.date)
    }));
  }
};

export const saveAbsences = (absences: AbsenceRecord[]): void => {
  safeStorage.setItem(KEYS.ABSENCES, JSON.stringify(absences));
};

export const getStoredBookings = (): TransferBooking[] => {
  try {
    const raw = safeStorage.getItem(KEYS.BOOKINGS);
    if (!raw) return INITIAL_BOOKINGS;
    return JSON.parse(raw);
  } catch {
    return INITIAL_BOOKINGS;
  }
};

export const saveBookings = (bookings: TransferBooking[]): void => {
  safeStorage.setItem(KEYS.BOOKINGS, JSON.stringify(bookings));
};

export const getStoredOverrides = (): DailyClassOverride[] => {
  try {
    const raw = safeStorage.getItem(KEYS.OVERRIDES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const saveOverrides = (overrides: DailyClassOverride[]): void => {
  safeStorage.setItem(KEYS.OVERRIDES, JSON.stringify(overrides));
};

export const getStoredWeekdayQuotas = (): WeekdayQuotaSettings => {
  try {
    const raw = safeStorage.getItem(KEYS.WEEKDAY_QUOTAS);
    if (!raw) return INITIAL_WEEKDAY_QUOTAS;
    const parsed = JSON.parse(raw);
    // Ensure all classes and weekdays exist
    return {
      ...INITIAL_WEEKDAY_QUOTAS,
      ...parsed
    };
  } catch {
    return INITIAL_WEEKDAY_QUOTAS;
  }
};

export const saveWeekdayQuotas = (quotas: WeekdayQuotaSettings): void => {
  safeStorage.setItem(KEYS.WEEKDAY_QUOTAS, JSON.stringify(quotas));
};

export const getStoredSpecialDays = (): SpecialScheduleDay[] => {
  try {
    const raw = safeStorage.getItem(KEYS.SPECIAL_DAYS);
    if (!raw) return INITIAL_SPECIAL_DAYS;
    return JSON.parse(raw);
  } catch {
    return INITIAL_SPECIAL_DAYS;
  }
};

export const saveSpecialDays = (specialDays: SpecialScheduleDay[]): void => {
  safeStorage.setItem(KEYS.SPECIAL_DAYS, JSON.stringify(specialDays));
};

export const getStoredCodmonSyncLogs = (): CodmonSyncLog[] => {
  try {
    const raw = safeStorage.getItem(KEYS.CODMON_SYNC_LOGS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const saveCodmonSyncLog = (log: CodmonSyncLog): void => {
  try {
    const current = getStoredCodmonSyncLogs();
    const next = [log, ...current].slice(0, 30); // Keep last 30 sync logs
    safeStorage.setItem(KEYS.CODMON_SYNC_LOGS, JSON.stringify(next));
  } catch (err) {
    console.error('Failed to save Codmon sync log:', err);
  }
};

export const getLastCodmonSyncLog = (): CodmonSyncLog | null => {
  const logs = getStoredCodmonSyncLogs();
  return logs.length > 0 ? logs[0] : null;
};

export const resetAllData = (): void => {
  safeStorage.removeItem(KEYS.STUDENTS);
  safeStorage.removeItem(KEYS.ABSENCES);
  safeStorage.removeItem(KEYS.BOOKINGS);
  safeStorage.removeItem(KEYS.OVERRIDES);
  safeStorage.removeItem(KEYS.WEEKDAY_QUOTAS);
  safeStorage.removeItem(KEYS.SPECIAL_DAYS);
  safeStorage.removeItem(KEYS.CODMON_SYNC_LOGS);
  cleanupLegacyStorage();
};

// 定員計算は capacity.ts へ移動（サーバーと共用）。既存の import 互換のため再エクスポート
export { getClassCapacityForDate } from './capacity';
export type { ClassCapacityStatus } from './capacity';
