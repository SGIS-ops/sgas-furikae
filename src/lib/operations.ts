import {
  AbsenceRecord,
  ClassId,
  CodmonSyncLog,
  DailyClassOverride,
  SpecialScheduleDay,
  Student,
  TransferBooking,
  WeekdayQuotaSettings
} from '../types';
import { getClassCapacityForDate } from './capacity';
import { getDayOfWeek, getTodayString } from './dateUtils';
import { applyTicketExpirations, calculateExpiryDate } from './expiration';
import { syncHolidayGrants } from './holidayGrants';
import { getHolidayName } from './holidays';

// ============================================================
// 欠席連絡・振替予約などの業務処理（画面とサーバー(GAS)で共用する純粋関数）
// 入力の状態は書き換えず、新しい状態を返す
// ============================================================

export interface AppState {
  students: Student[];
  absences: AbsenceRecord[];
  bookings: TransferBooking[];
  overrides: DailyClassOverride[];
  weekdayQuotas: WeekdayQuotaSettings;
  specialDays: SpecialScheduleDay[];
  codmonSyncLogs: CodmonSyncLog[];
}

export type OperationErrorCode =
  | 'student_not_found'
  | 'duplicate_absence'
  | 'not_class_day'
  | 'no_credits'
  | 'duplicate_booking'
  | 'slot_unavailable'
  | 'not_found'
  | 'login_id_taken'
  | 'invalid_credentials';

export type OperationResult =
  | { ok: true; state: AppState }
  | { ok: false; code: OperationErrorCode; params?: Record<string, string> };

const fail = (code: OperationErrorCode, params?: Record<string, string>): OperationResult => ({ ok: false, code, params });

/** 失敗理由の表示文（日英） */
export const operationErrorMessage = (
  code: OperationErrorCode | string,
  params: Record<string, string> = {},
  language: 'ja' | 'en' = 'ja'
): string => {
  const d = params.date ?? '';
  const m: Record<string, [string, string]> = {
    student_not_found: ['生徒が見つかりません', 'Student not found.'],
    duplicate_absence: [`${d} は既に欠席連絡済みです（振替残数は変わりません）`, `An absence for ${d} is already on record (credits unchanged).`],
    not_class_day: [`${d} は通常の通学日ではないため、欠席連絡は不要です`, `${d} is not a regular class day, so no absence report is needed.`],
    no_credits: ['振替残数が足りません', 'Not enough make-up credits.'],
    duplicate_booking: [`${d} は既に振替予約済みです`, `A make-up is already booked for ${d}.`],
    slot_unavailable: [`${d} は満席または受付対象外のため予約できませんでした`, `${d} is full or not accepting make-ups.`],
    not_found: ['対象の記録が見つかりません', 'Record not found.'],
    login_id_taken: ['このログインIDは既に使われています', 'This login ID is already in use.'],
    invalid_credentials: ['ログインIDかパスワードが正しくありません', 'Invalid login ID or password.'],
    invalid_input: ['入力内容を確認してください（パスワードは6文字以上）', 'Please check your input (password: 6+ characters).'],
    session_expired: ['ログインの有効期限が切れました。もう一度ログインしてください', 'Your session has expired. Please sign in again.'],
    forbidden: ['この操作はできません', 'You are not allowed to do this.'],
    admin_password_not_set: ['管理者パスワードが未設定です（スクリプトプロパティ ADMIN_PASSWORD）', 'Admin password is not set on the server.'],
    server_error: ['サーバーでエラーが発生しました。時間をおいて再度お試しください', 'A server error occurred. Please try again later.'],
    network: ['サーバーに接続できませんでした。通信状況を確認してください', 'Could not reach the server. Check your connection.']
  };
  const pair = m[code];
  if (!pair) return language === 'en' ? 'The operation could not be completed.' : '処理できませんでした';
  return language === 'en' ? pair[1] : pair[0];
};

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

/** 欠席連絡: 通学日のみ受付、同日二重登録不可。受付時に振替チケット+1（期限は欠席月を含め3か月目の月末） */
export const reportAbsence = (
  state: AppState,
  input: { studentId: string; date: string; reason: string }
): OperationResult => {
  const student = state.students.find((s) => s.id === input.studentId);
  if (!student) return fail('student_not_found');

  if (state.absences.some((a) => a.studentId === input.studentId && a.date === input.date && a.status === 'confirmed')) {
    return fail('duplicate_absence', { date: input.date });
  }

  // 通学曜日以外・祝日・休講日は対象外（祝日要振替の日は在籍生全員に別途チケットを付与する）
  const specialDay = state.specialDays.find((s) => s.date === input.date);
  const isClosedDay =
    (!!getHolidayName(input.date) && specialDay?.type !== 'special_open') ||
    specialDay?.type === 'closed' ||
    specialDay?.type === 'holiday_transfer';
  if (!student.regularDays.includes(getDayOfWeek(input.date)) || isClosedDay) {
    return fail('not_class_day', { date: input.date });
  }

  const record: AbsenceRecord = {
    id: newId('abs'),
    studentId: student.id,
    studentName: student.name,
    classId: student.classId,
    date: input.date,
    reason: input.reason,
    reportedAt: new Date().toISOString(),
    status: 'confirmed',
    creditGranted: true,
    expiryDate: calculateExpiryDate(input.date)
  };

  return {
    ok: true,
    state: {
      ...state,
      absences: [record, ...state.absences],
      students: state.students.map((s) => (s.id === student.id ? { ...s, transferBalance: s.transferBalance + 1 } : s))
    }
  };
};

/** 振替予約: 残数・同日二重予約・残枠を確認してから登録し、残数-1 */
export const bookTransfer = (
  state: AppState,
  input: { studentId: string; targetDate: string; targetClassId?: ClassId }
): OperationResult => {
  const student = state.students.find((s) => s.id === input.studentId);
  if (!student) return fail('student_not_found');
  if (student.transferBalance <= 0) return fail('no_credits');
  if (state.bookings.some((b) => b.studentId === student.id && b.targetDate === input.targetDate && b.status === 'booked')) {
    return fail('duplicate_booking', { date: input.targetDate });
  }
  const targetClassId = input.targetClassId ?? student.classId;
  const cap = getClassCapacityForDate(
    input.targetDate,
    targetClassId,
    state.students,
    state.absences,
    state.bookings,
    state.overrides,
    state.weekdayQuotas,
    state.specialDays
  );
  if (!cap.canAcceptTransfer || input.targetDate <= getTodayString()) {
    return fail('slot_unavailable', { date: input.targetDate });
  }

  const booking: TransferBooking = {
    id: newId('tb'),
    studentId: student.id,
    studentName: student.name,
    fromClassId: student.classId,
    targetClassId,
    targetDate: input.targetDate,
    bookedAt: new Date().toISOString(),
    status: 'booked',
    note: '振替予約'
  };

  return {
    ok: true,
    state: {
      ...state,
      bookings: [booking, ...state.bookings],
      students: state.students.map((s) =>
        s.id === student.id ? { ...s, transferBalance: Math.max(0, s.transferBalance - 1) } : s
      )
    }
  };
};

/** 振替予約の取り消し: 残数+1 */
export const cancelBooking = (state: AppState, bookingId: string): OperationResult => {
  const target = state.bookings.find((b) => b.id === bookingId && b.status === 'booked');
  if (!target) return fail('not_found');
  return {
    ok: true,
    state: {
      ...state,
      bookings: state.bookings.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' as const } : b)),
      students: state.students.map((s) =>
        s.id === target.studentId ? { ...s, transferBalance: s.transferBalance + 1 } : s
      )
    }
  };
};

/** 欠席連絡の取り消し: 付与済みのチケット分を残数-1 */
export const cancelAbsence = (state: AppState, absenceId: string): OperationResult => {
  const target = state.absences.find((a) => a.id === absenceId && a.status === 'confirmed');
  if (!target) return fail('not_found');
  return {
    ok: true,
    state: {
      ...state,
      absences: state.absences.map((a) => (a.id === absenceId ? { ...a, status: 'cancelled' as const } : a)),
      students: state.students.map((s) =>
        s.id === target.studentId && target.creditGranted && !target.creditExpired
          ? { ...s, transferBalance: Math.max(0, s.transferBalance - 1) }
          : s
      )
    }
  };
};

/**
 * 起動・読み込み時の定期処理: 祝日要振替のチケット付与漏れを補い、期限切れの未使用チケットを失効させる。
 * 変化がなければ changed: false
 */
export const runMaintenance = (state: AppState, today: string = getTodayString()): { state: AppState; changed: boolean } => {
  const granted = syncHolidayGrants(state.students, state.absences, state.specialDays);
  const expired = applyTicketExpirations(granted.students, granted.absences, state.bookings, today);
  const changed = granted.granted + granted.revoked + expired.expiredCount > 0;
  return changed ? { state: { ...state, students: expired.students, absences: expired.absences }, changed } : { state, changed };
};

/** 兄弟（同じ保護者名）を含む家族の生徒ID。保護者名が空なら本人のみ */
export const familyStudentIds = (students: Student[], studentId: string): string[] => {
  const me = students.find((s) => s.id === studentId);
  if (!me) return [];
  if (!me.parentName?.trim()) return [me.id];
  return students.filter((s) => s.parentName === me.parentName).map((s) => s.id);
};
