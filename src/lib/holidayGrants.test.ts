import { describe, expect, it } from 'vitest';
import type { SpecialScheduleDay, Student } from '../types';
import { syncHolidayGrants } from './holidayGrants';

const mk = (id: string, days: number[], bal = 0): Student => ({
  id, name: `サンプル ${id} (${id} Sample)`, classId: 'kin', regularDays: days, transferBalance: bal, parentName: 'p', contactEmail: 'p@example.com',
});
const holiday: SpecialScheduleDay = {
  id: 'h', date: '2026-11-23', type: 'holiday_transfer', title: '勤労感謝の日', badgeText: '祝(要振)', allowTransfers: false, grantsTransfer: true,
}; // 月曜

describe('syncHolidayGrants', () => {
  const students = [mk('mon', [1, 3], 1), mk('tue', [2])];

  it('その曜日の在籍生だけに1枚付与し、再実行しても二重付与しない', () => {
    const r1 = syncHolidayGrants(students, [], [holiday]);
    expect(r1.granted).toBe(1);
    expect(r1.students.map((s) => s.transferBalance)).toEqual([2, 0]);
    expect(r1.absences[0]).toMatchObject({ studentId: 'mon', date: '2026-11-23', expiryDate: '2027-01-31' });
    const r2 = syncHolidayGrants(r1.students, r1.absences, [holiday]);
    expect(r2.granted).toBe(0);
  });

  it('特別日を削除すると自動付与分を取り消す', () => {
    const r1 = syncHolidayGrants(students, [], [holiday]);
    const r2 = syncHolidayGrants(r1.students, r1.absences, []);
    expect(r2.revoked).toBe(1);
    expect(r2.students[0].transferBalance).toBe(1);
    expect(r2.absences[0].status).toBe('cancelled');
  });
});
