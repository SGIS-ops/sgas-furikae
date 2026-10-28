import { AbsenceRecord, Student, TransferBooking } from '../types';
import { diffDays, getTodayString, toLocalDateString } from './dateUtils';

/** 期限間近アラートを出す残り日数 */
export const EXPIRY_ALERT_DAYS = 14;

/**
 * 振替有効期限の計算ルール:
 * 欠席日の「翌々月末まで（最大3ヶ月間）」
 * 例: 8月17日欠席 -> 10月31日まで有効
 */
export const calculateExpiryDate = (absenceDateStr: string, monthsToAdd: number = 2): string => {
  try {
    const [yStr, mStr] = absenceDateStr.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10) - 1; // 0-indexed

    // 翌々月の末日を取得 (month + 1 + monthsToAdd の0日目)
    const targetLastDay = new Date(year, month + 1 + monthsToAdd, 0);
    
    const y = targetLastDay.getFullYear();
    const m = String(targetLastDay.getMonth() + 1).padStart(2, '0');
    const d = String(targetLastDay.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    // フォールバック: 90日後
    const d = new Date(absenceDateStr);
    d.setDate(d.getDate() + 90);
    return toLocalDateString(d);
  }
};

/**
 * 日付表示のフォーマット (例: 2026年10月31日)
 */
export const formatJapaneseDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[0], 10)}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
  }
  return dateStr;
};

/**
 * 欠席分ラベルのフォーマット (例: 8/17欠席分, 2026/8/17欠席分)
 */
export const formatAbsenceLabel = (dateStr: string, includeYear: boolean = false): string => {
  if (!dateStr) return '欠席分';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (includeYear) {
      return `${parts[0]}年${month}月${day}日 欠席分`;
    }
    return `${month}/${day} 欠席分`;
  }
  return `${dateStr} 欠席分`;
};

/**
 * 有効期限までの残り日数を取得（期限日当日 = 0、過ぎていれば負）
 */
export const getDaysRemaining = (expiryDateStr: string, today: string = getTodayString()): number => {
  if (!expiryDateStr) return 0;
  return diffDays(today, expiryDateStr);
};

/**
 * 生徒の未消化の振替チケット（欠席記録）と各有効期限を算出
 */
export interface TransferTicketInfo {
  absenceId: string;
  absenceDate: string;
  reason: string;
  expiryDate: string;
  daysRemaining: number;
  isExpired: boolean;
  isExpiringSoon: boolean; // 14日以内
  isBooked: boolean;
  linkedBookingDate?: string;
  linkedBookingId?: string;
}

export const getStudentTransferTickets = (
  studentId: string,
  absences: AbsenceRecord[],
  bookings: TransferBooking[],
  today: string = getTodayString()
): TransferTicketInfo[] => {
  const studentAbsences = absences
    .filter((a) => a.studentId === studentId && a.status === 'confirmed' && a.creditGranted && !a.creditExpired)
    .sort((a, b) => a.date.localeCompare(b.date)); // 古い順

  // キャンセル以外の予約（予約中・出席済み）は、予約した時点でチケットを1枚消費している
  const consumingBookings = bookings
    .filter((b) => b.studentId === studentId && b.status !== 'cancelled')
    .sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));

  // FIFO: 予約した時点で有効だったチケットのうち、最も古いものに充当する
  const allocation = new Map<string, TransferBooking>();
  for (const booking of consumingBookings) {
    const bookedOn = toLocalDateString(new Date(booking.bookedAt));
    const ticket = studentAbsences.find((abs) => {
      const expiry = abs.expiryDate || calculateExpiryDate(abs.date);
      return !allocation.has(abs.id) && expiry >= bookedOn;
    });
    // 該当なし = 管理者が手動で付与した残数で予約した分
    if (ticket) allocation.set(ticket.id, booking);
  }

  return studentAbsences.map((abs) => {
    const expiryDate = abs.expiryDate || calculateExpiryDate(abs.date);
    const daysRemaining = getDaysRemaining(expiryDate, today);
    const isExpired = daysRemaining < 0;
    const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= EXPIRY_ALERT_DAYS;
    const linked = allocation.get(abs.id);

    return {
      absenceId: abs.id,
      absenceDate: abs.date,
      reason: abs.reason,
      expiryDate,
      daysRemaining,
      isExpired,
      isExpiringSoon,
      isBooked: !!linked,
      linkedBookingDate: linked?.targetDate,
      linkedBookingId: linked?.id
    };
  });
};

/**
 * 未使用のまま期限切れになったチケットを失効させ、振替残数から差し引く。
 * 失効させた欠席記録には creditExpired を付け、二重に差し引かないようにする。
 */
export const applyTicketExpirations = (
  students: Student[],
  absences: AbsenceRecord[],
  bookings: TransferBooking[],
  today: string = getTodayString()
): { students: Student[]; absences: AbsenceRecord[]; expiredCount: number } => {
  const expiredIds = new Set<string>();
  const deductions = new Map<string, number>();

  for (const student of students) {
    const expired = getStudentTransferTickets(student.id, absences, bookings, today).filter(
      (t) => t.isExpired && !t.isBooked
    );
    if (expired.length === 0) continue;
    expired.forEach((t) => expiredIds.add(t.absenceId));
    deductions.set(student.id, expired.length);
  }

  if (expiredIds.size === 0) return { students, absences, expiredCount: 0 };

  return {
    students: students.map((s) =>
      deductions.has(s.id) ? { ...s, transferBalance: Math.max(0, s.transferBalance - deductions.get(s.id)!) } : s
    ),
    absences: absences.map((a) => (expiredIds.has(a.id) ? { ...a, creditExpired: true } : a)),
    expiredCount: expiredIds.size
  };
};

/**
 * 生徒の直近の振替有効期限（未消化分の中で最も期限が近いもの）を取得
 */
export const getEarliestExpiry = (
  studentId: string,
  absences: AbsenceRecord[],
  bookings: TransferBooking[],
  currentBalance: number,
  today: string = getTodayString()
): { expiryDate: string; daysRemaining: number; isExpiringSoon: boolean } | null => {
  if (currentBalance <= 0) return null;

  const tickets = getStudentTransferTickets(studentId, absences, bookings, today);
  const unbookedTickets = tickets.filter((t) => !t.isBooked && !t.isExpired);

  // 欠席に紐づかない残数（管理者の手動付与など）には期限がないため、表示しない
  if (unbookedTickets.length === 0) return null;

  // 最も期限が近いもの
  const earliest = unbookedTickets[0];
  return {
    expiryDate: earliest.expiryDate,
    daysRemaining: earliest.daysRemaining,
    isExpiringSoon: earliest.isExpiringSoon
  };
};
