import { describe, expect, it } from 'vitest';
import { INITIAL_STUDENTS } from '../data/initialData';
import { extractCleanStudentNameParts, matchClassId, matchClassIdOrNull, parseCodmonDailyScreen } from './codmonParser';

describe('matchClassId', () => {
  it.each([
    ['EX1', 'ex1'], ['ex 2', 'ex2'], ['Kin', 'kin'], ['Kinder', 'kin'], ['Ele1', 'ele1'], ['ELE-2', 'ele2'], ['Extension', 'ex1'],
  ])('%s → %s', (raw, id) => expect(matchClassId(raw)).toBe(id));
  it('生徒名の一部（Akina 等）をクラスと誤認しない', () => {
    expect(matchClassIdOrNull('サンプル 明菜 (Akina Sample)')).toBeNull();
  });
});

describe('extractCleanStudentNameParts', () => {
  it('アレルギー・時刻を除去し「名前 (英語)」に統一', () => {
    expect(extractCleanStudentNameParts('サンプル 蓮 Ren Sample 卵アレルギー 09:30').combinedName).toBe('サンプル 蓮 (Ren Sample)');
  });
  it('英語が先の表記も統一', () => {
    expect(extractCleanStudentNameParts('Ren Sample (サンプル 蓮)').combinedName).toBe('サンプル 蓮 (Ren Sample)');
  });
});

describe('parseCodmonDailyScreen', () => {
  const date = '2026-11-02';
  const text = `【コドモン デイリー画面 ${date} (月) 出欠席一覧】
園児・生徒出欠状況 管理画面
対象日: ${date} (月曜日)

欠席	欠席期間	種別	保護者からの連絡
サンプル 蓮 (Ren Sample)
今日まで
都合欠
体温 37.8℃ 発熱のためお休みします。

名前	アレルギー	出欠状況
サンプル レオ (Leo Sample)
日誌・連絡帳
09:3009:3014:00 (母)
サンプル 翔太 (Shota Sample)
卵アレルギー
14:0017:00 (父)`;

  const r = parseCodmonDailyScreen(text, date, INITIAL_STUDENTS, [], []);

  it('対象日を検出', () => expect(r.detectedDate).toBe(date));
  it('欠席を抽出して名簿と一致させる', () => {
    expect(r.absences.map((a) => [a.studentId, a.status])).toEqual([['std_ex1_1', 'ready']]);
  });
  it('通常出席を抽出', () => {
    expect(r.regulars.map((x) => x.studentId).sort()).toEqual(['std_ele1_1', 'std_ex2_1']);
  });
  it('体温・アレルギーを生徒として拾わない', () => {
    expect(r.newStudents).toHaveLength(0);
  });
  it('既に登録済みの欠席は already_registered', () => {
    const r2 = parseCodmonDailyScreen(text, date, INITIAL_STUDENTS, [
      { id: 'x', studentId: 'std_ex1_1', studentName: '', classId: 'ex1', date, reason: '', reportedAt: '', status: 'confirmed', creditGranted: true },
    ], []);
    expect(r2.absences[0].status).toBe('already_registered');
  });
});

describe('parseCodmonDailyScreen（保護者メッセージカード）', () => {
  const text = `保護者からの連絡
10月28日(水)
未対応
サンプル 陽菜 (Hina Sample)
本日お休みします。発熱のため
10月28日(水)
確認済
サンプル ノア (Noah Sample)
10/21分の振替でお願いします
10月28日(水)
確認済
サンプル 新規 (Arata Sample)
本日欠席します`;
  const r = parseCodmonDailyScreen(text, '2026-10-28', INITIAL_STUDENTS, [], []);

  it('メッセージ日付から対象日を検出', () => expect(r.detectedDate).toBe('2026-10-28'));
  it('欠席連絡を抽出', () => {
    expect(r.absences.map((a) => a.studentName)).toContain('サンプル 陽菜 (Hina Sample)');
  });
  it('振替連絡を抽出', () => {
    expect(r.transfers.map((t) => t.studentId)).toEqual(['std_kin_2']);
  });
  it('名簿にない「名前 (英語)」は新規生徒候補にする', () => {
    expect(r.newStudents.map((s) => s.name)).toEqual(['サンプル 新規 (Arata Sample)']);
  });
});

describe('引き継ぎ書 4.3 のキーワード', () => {
  it.each(['体調不良のため', '家庭の都合でお休み', '私用のため', '風邪をひきました'])('欠席: %s', (msg) => {
    const r = parseCodmonDailyScreen(`10月28日(水)\n未対応\nサンプル 陽菜 (Hina Sample)\n${msg}`, '2026-10-28', INITIAL_STUDENTS, [], []);
    expect(r.absences.map((a) => a.studentId)).toEqual(['std_ex2_2']);
  });
  it.each(['10/21分の振り替えでお願いします', '振替レッスン希望です'])('振替: %s', (msg) => {
    const r = parseCodmonDailyScreen(`10月28日(水)\n未対応\nサンプル 陽菜 (Hina Sample)\n${msg}`, '2026-10-28', INITIAL_STUDENTS, [], []);
    expect(r.transfers.map((t) => t.studentId)).toEqual(['std_ex2_2']);
  });
  it('旧クラス表記 E1 / E2', () => {
    expect(matchClassId('E1')).toBe('ele1');
    expect(matchClassId('E2')).toBe('ele2');
  });
});
