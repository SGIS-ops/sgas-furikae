import { describe, expect, it } from 'vitest';
import type { AbsenceRecord, Student, TransferBooking } from '../types';
import { buildAbsenceRows, buildBookingRows, buildStudentRows, mergeStudentsFromSheet, parseStudentMasterRows } from './googleSheets';

const ren: Student = {
  id: 'std_001', name: 'サンプル 蓮 (Ren Sample)', classId: 'ele1', regularDays: [1, 3, 5], transferBalance: 2,
  parentName: 'サンプル 保護者', contactEmail: 'p@example.com', notes: '送迎バス利用',
};
const abs: AbsenceRecord = {
  id: 'abs_001', studentId: 'std_001', studentName: ren.name, classId: 'ele1', date: '2026-10-05', reason: '発熱のため',
  reportedAt: '2026-10-05T08:00:00', status: 'confirmed', creditGranted: true, expiryDate: '2026-12-31',
};
const bk: TransferBooking = {
  id: 'trf_001', studentId: 'std_001', studentName: ren.name, fromClassId: 'ele1', targetClassId: 'ele1',
  targetDate: '2026-10-13', bookedAt: '2026-10-06T10:00:00', status: 'booked',
};

describe('シート書き出し（引き継ぎ書 5.1 の列構成）', () => {
  it('生徒マスタ', () => {
    expect(buildStudentRows([ren])).toEqual([
      ['ID', '氏名 (名前 (英語))', 'クラス', '通塾曜日', 'チケット残数', '備考'],
      ['std_001', 'サンプル 蓮 (Ren Sample)', 'Ele1', '月,水,金', 2, '送迎バス利用'],
    ]);
  });
  it('欠席履歴: 予約に使われたチケットは振替消化済 TRUE', () => {
    expect(buildAbsenceRows([abs], [bk])[1]).toEqual(['abs_001', 'std_001', ren.name, 'Ele1', '2026-10-05', '発熱のため', '2026-12-31', 'TRUE']);
    expect(buildAbsenceRows([abs], [])[1][7]).toBe('FALSE');
  });
  it('振替予約: 元の欠席日とステータス', () => {
    const row = buildBookingRows([abs], [bk])[1];
    expect(row.slice(0, 7)).toEqual(['trf_001', 'std_001', ren.name, '2026-10-13', 'Ele1', '2026-10-05', 'confirmed']);
  });
});

describe('シート読み込み → 名簿へ反映', () => {
  const header = ['ID', '氏名', 'クラス', '通塾曜日', 'チケット残数', '備考'];

  it('ID一致で更新（クラス E1 表記・曜日・残数・備考）', () => {
    const rows = parseStudentMasterRows([header, ['std_001', 'サンプル 蓮 (Ren Sample)', 'E2', '火,木', '5', '']]);
    const r = mergeStudentsFromSheet([ren], rows);
    expect(r).toMatchObject({ added: 0, updated: 1, warnings: [] });
    expect(r.students[0]).toMatchObject({ classId: 'ele2', regularDays: [2, 4], transferBalance: 5, notes: undefined, parentName: 'サンプル 保護者' });
  });

  it('新規行は追加（初期パスワード soltilo123）、変更なしは更新数0', () => {
    const rows = parseStudentMasterRows([
      header,
      ['std_001', 'サンプル 蓮 (Ren Sample)', 'Ele1', '月,水,金', '2', '送迎バス利用'],
      ['', 'サンプル 葵 (Aoi Sample)', 'Kin', '月・水', '0', ''],
    ]);
    const r = mergeStudentsFromSheet([ren], rows);
    expect(r).toMatchObject({ added: 1, updated: 0 });
    expect(r.students[1]).toMatchObject({ name: 'サンプル 葵 (Aoi Sample)', classId: 'kin', regularDays: [1, 3], password: 'soltilo123' });
  });

  it('不正な値は既存を維持し警告、部分一致の名前では合わせない', () => {
    const rows = parseStudentMasterRows([header, ['std_001', 'サンプル 蓮 (Ren Sample)', '???', '', '-1', '']]);
    const r = mergeStudentsFromSheet([ren], rows);
    expect(r.students[0]).toMatchObject({ classId: 'ele1', regularDays: [1, 3, 5], transferBalance: 2 });
    expect(r.warnings).toHaveLength(3);
    const partial = mergeStudentsFromSheet([ren], parseStudentMasterRows([header, ['', 'サンプル 蓮', 'Ele1', '月', '0', '']]));
    expect(partial.added).toBe(1);
  });

  it('空行は無視、クラス不明の新規行は登録しない', () => {
    const r = mergeStudentsFromSheet([], parseStudentMasterRows([header, ['', '', '', '', '', ''], ['', 'サンプル 陸 (Riku Sample)', '', '月', '0', '']]));
    expect(r.added).toBe(0);
    expect(r.warnings.some((w) => w.includes('新規登録しませんでした'))).toBe(true);
  });
});
