import { AbsenceRecord, SpecialScheduleDay, Student } from '../types';
import { calculateExpiryDate } from './expiration';
import { getDayOfWeek } from './dateUtils';

export const HOLIDAY_GRANT_REASON = '祝日休講（要振替）';
const grantId = (date: string, studentId: string) => `abs_hol_${date}_${studentId}`;

/**
 * 「祝日休講・要振替」など振替付与ありの特別日について、その曜日の在籍生に振替チケットを1枚ずつ付与する。
 * - 付与は欠席記録（id: abs_hol_日付_生徒ID）として作るため、有効期限・FIFO の扱いは通常の欠席と同じ
 * - 既に同じ日に欠席連絡がある生徒には付与しない（二重付与防止）
 * - 特別日の削除・付与なしへの変更時は、自動付与分を取り消して残数を戻す
 */
export const syncHolidayGrants = (
  students: Student[],
  absences: AbsenceRecord[],
  specialDays: SpecialScheduleDay[]
): { students: Student[]; absences: AbsenceRecord[]; granted: number; revoked: number } => {
  const grantDays = specialDays.filter((d) => d.grantsTransfer);
  const wanted = new Set<string>();
  const newRecords: AbsenceRecord[] = [];

  for (const day of grantDays) {
    const weekday = getDayOfWeek(day.date);
    for (const s of students) {
      if (!s.regularDays.includes(weekday)) continue;
      const id = grantId(day.date, s.id);
      wanted.add(id);
      const exists = absences.some(
        (a) => a.id === id || (a.studentId === s.id && a.date === day.date && a.status === 'confirmed')
      );
      if (exists) continue;
      newRecords.push({
        id,
        studentId: s.id,
        studentName: s.name,
        classId: s.classId,
        date: day.date,
        reason: HOLIDAY_GRANT_REASON,
        reportedAt: new Date().toISOString(),
        status: 'confirmed',
        creditGranted: true,
        expiryDate: calculateExpiryDate(day.date)
      });
    }
  }

  const revokeIds = new Set(
    absences
      .filter((a) => a.id.startsWith('abs_hol_') && a.status === 'confirmed' && !wanted.has(a.id))
      .map((a) => a.id)
  );

  if (newRecords.length === 0 && revokeIds.size === 0) {
    return { students, absences, granted: 0, revoked: 0 };
  }

  const delta = new Map<string, number>();
  newRecords.forEach((r) => delta.set(r.studentId, (delta.get(r.studentId) ?? 0) + 1));
  absences
    .filter((a) => revokeIds.has(a.id) && !a.creditExpired)
    .forEach((a) => delta.set(a.studentId, (delta.get(a.studentId) ?? 0) - 1));

  return {
    students: students.map((s) =>
      delta.has(s.id) ? { ...s, transferBalance: Math.max(0, s.transferBalance + delta.get(s.id)!) } : s
    ),
    absences: [
      ...newRecords,
      ...absences.map((a) => (revokeIds.has(a.id) ? { ...a, status: 'cancelled' as const } : a))
    ],
    granted: newRecords.length,
    revoked: revokeIds.size
  };
};
