import { describe, expect, it } from 'vitest';
import type { AbsenceRecord, Student, TransferBooking, WeekdayQuotaSettings } from '../types';
import { getClassCapacityForDate } from './storage';
import { INITIAL_WEEKDAY_QUOTAS } from '../data/initialData';

const MON = '2026-11-02';
const students = (n: number): Student[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`, name: `サンプル ${i} (Test ${i} Sample)`, classId: 'ele1', regularDays: [1],
    transferBalance: 0, parentName: 'p', contactEmail: 'p@example.com',
  }));
const absent = (studentId: string): AbsenceRecord => ({
  id: `a_${studentId}`, studentId, studentName: '', classId: 'ele1', date: MON, reason: '', reportedAt: '', status: 'confirmed', creditGranted: true,
});
const booked = (id: string): TransferBooking => ({
  id, studentId: `x_${id}`, studentName: '', fromClassId: 'ele1', targetClassId: 'ele1', targetDate: MON, bookedAt: '', status: 'booked',
});
const cap = (st: Student[], ab: AbsenceRecord[] = [], bk: TransferBooking[] = [], quotas: WeekdayQuotaSettings = INITIAL_WEEKDAY_QUOTAS) =>
  getClassCapacityForDate(MON, 'ele1', st, ab, bk, [], quotas, []);

describe('getClassCapacityForDate（定員20名・振替枠2名）', () => {
  it('空きがあれば受入可', () => {
    expect(cap(students(10))).toMatchObject({ remainingTransferSlots: 2, canAcceptTransfer: true });
  });
  it('満員なら受入不可、欠席が出ると空く', () => {
    expect(cap(students(20)).canAcceptTransfer).toBe(false);
    expect(cap(students(20), [absent('s0')])).toMatchObject({ remainingTotalSlots: 1, canAcceptTransfer: true });
  });
  it('欠席が多くても振替は2名まで', () => {
    const r = cap(students(20), [absent('s0'), absent('s1'), absent('s2'), absent('s3')], [booked('1'), booked('2')]);
    expect(r).toMatchObject({ totalPresentCount: 18, remainingTransferSlots: 0, canAcceptTransfer: false });
  });
  it('同じ生徒の欠席の重複登録・在籍していない生徒の欠席は数えない', () => {
    const dup = { ...absent('s0'), id: 'dup' };
    const outsider = { ...absent('zz'), id: 'out' };
    expect(cap(students(20), [absent('s0'), dup, outsider]).absentCount).toBe(1);
  });
  it('定員設定が20を超えても20で打ち止め', () => {
    const quotas = structuredClone(INITIAL_WEEKDAY_QUOTAS);
    quotas.ele1[1].maxTotalCapacity = 30;
    expect(cap(students(20), [], [], quotas)).toMatchObject({ maxTotalCapacity: 20, canAcceptTransfer: false });
  });
  it('非開講の曜日は受入不可', () => {
    const quotas = structuredClone(INITIAL_WEEKDAY_QUOTAS);
    quotas.ele1[1].isOpen = false;
    expect(cap(students(1), [], [], quotas).canAcceptTransfer).toBe(false);
  });
  it('振替不可の特別日は受入不可', () => {
    const r = getClassCapacityForDate(MON, 'ele1', students(1), [], [], [], INITIAL_WEEKDAY_QUOTAS, [
      { id: 'h', date: MON, type: 'holiday_transfer', title: '', badgeText: '', allowTransfers: false, grantsTransfer: true },
    ]);
    expect(r.canAcceptTransfer).toBe(false);
  });
});
