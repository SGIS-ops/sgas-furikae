import { describe, expect, it } from 'vitest';
import type { AbsenceRecord, Student, TransferBooking } from '../types';
import { applyTicketExpirations, calculateExpiryDate, getEarliestExpiry, getStudentTransferTickets } from './expiration';

const abs = (id: string, date: string, extra: Partial<AbsenceRecord> = {}): AbsenceRecord => ({
  id, studentId: 's1', studentName: 'サンプル 蓮 (Ren Sample)', classId: 'ex1', date, reason: '体調不良・風邪',
  reportedAt: `${date}T08:00:00`, status: 'confirmed', creditGranted: true, expiryDate: calculateExpiryDate(date), ...extra,
});
const book = (id: string, bookedOn: string, targetDate: string, status: TransferBooking['status'] = 'booked'): TransferBooking => ({
  id, studentId: 's1', studentName: 'サンプル 蓮 (Ren Sample)', fromClassId: 'ex1', targetClassId: 'ex1',
  targetDate, bookedAt: `${bookedOn}T12:00:00`, status,
});
const student = (balance: number): Student => ({
  id: 's1', name: 'サンプル 蓮 (Ren Sample)', classId: 'ex1', regularDays: [1, 3], transferBalance: balance,
  parentName: 'サンプル 保護者A', contactEmail: 'a@example.com',
});

describe('calculateExpiryDate（起算月を含め3か月目の末日）', () => {
  it.each([
    ['2026-08-05', '2026-10-31'],
    ['2026-08-31', '2026-10-31'],
    ['2026-10-15', '2026-12-31'],
    ['2026-11-30', '2027-01-31'],
    ['2026-12-10', '2027-02-28'],
    ['2027-12-10', '2028-02-29'],
  ])('%s → %s', (d, e) => expect(calculateExpiryDate(d)).toBe(e));
});

describe('getStudentTransferTickets', () => {
  it('期限日当日は有効、14日以内で期限間近', () => {
    const [t] = getStudentTransferTickets('s1', [abs('a', '2026-08-05')], [], '2026-10-31');
    expect(t).toMatchObject({ daysRemaining: 0, isExpired: false, isExpiringSoon: true });
    const [u] = getStudentTransferTickets('s1', [abs('a', '2026-08-05')], [], '2026-11-01');
    expect(u.isExpired).toBe(true);
  });

  it('予約は古いチケットから充当（FIFO）', () => {
    const tickets = getStudentTransferTickets('s1', [abs('new', '2026-10-05'), abs('old', '2026-09-07')], [book('b', '2026-10-10', '2026-10-20')], '2026-10-28');
    expect(tickets.map((t) => [t.absenceId, t.isBooked])).toEqual([['old', true], ['new', false]]);
  });

  it('予約後に期限が過ぎても、予約に使ったチケットは失効扱いにしない（他のチケットへ付け替えない）', () => {
    const tickets = getStudentTransferTickets(
      's1',
      [abs('aug', '2026-08-05'), abs('oct', '2026-10-05')],
      [book('b', '2026-10-20', '2026-10-28', 'attended')],
      '2026-11-02'
    );
    expect(tickets.find((t) => t.absenceId === 'aug')).toMatchObject({ isExpired: true, isBooked: true });
    expect(tickets.find((t) => t.absenceId === 'oct')).toMatchObject({ isBooked: false });
  });

  it('キャンセルした予約はチケットを消費しない', () => {
    const [t] = getStudentTransferTickets('s1', [abs('a', '2026-10-05')], [book('b', '2026-10-10', '2026-10-20', 'cancelled')], '2026-10-28');
    expect(t.isBooked).toBe(false);
  });
});

describe('applyTicketExpirations', () => {
  it('未使用の期限切れチケットを残数から差し引き、二重に差し引かない', () => {
    const absences = [abs('aug', '2026-08-05'), abs('oct', '2026-10-05')];
    const r1 = applyTicketExpirations([student(2)], absences, [], '2026-11-01');
    expect(r1.expiredCount).toBe(1);
    expect(r1.students[0].transferBalance).toBe(1);
    expect(r1.absences.find((a) => a.id === 'aug')?.creditExpired).toBe(true);

    const r2 = applyTicketExpirations(r1.students, r1.absences, [], '2026-11-01');
    expect(r2.expiredCount).toBe(0);
    expect(r2.students[0].transferBalance).toBe(1);
  });

  it('予約に使ったチケットは期限が過ぎても差し引かない', () => {
    const r = applyTicketExpirations([student(0)], [abs('aug', '2026-08-05')], [book('b', '2026-10-20', '2026-10-28')], '2026-11-01');
    expect(r.expiredCount).toBe(0);
  });

  it('期限切れなし・データ不変なら同じ参照を返す', () => {
    const students = [student(1)];
    const absences = [abs('oct', '2026-10-05')];
    const r = applyTicketExpirations(students, absences, [], '2026-10-28');
    expect(r.students).toBe(students);
    expect(r.absences).toBe(absences);
  });
});

describe('getEarliestExpiry', () => {
  it('欠席に紐づかない残数（手動付与）は期限を作らない', () => {
    expect(getEarliestExpiry('s1', [], [], 2, '2026-10-28')).toBeNull();
  });
  it('未予約で最も期限の近いチケット', () => {
    const r = getEarliestExpiry('s1', [abs('a', '2026-10-05'), abs('b', '2026-08-10')], [], 2, '2026-10-28');
    expect(r).toMatchObject({ expiryDate: '2026-10-31', daysRemaining: 3, isExpiringSoon: true });
  });
});
