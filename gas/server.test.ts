import { beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { diffState } from '../src/lib/sync';
import type { AppState } from '../src/lib/operations';
import { getHolidayName } from '../src/lib/holidays';

// gas/dist/Code.gs（npm run build:gas の生成物）をモック環境で実行して検証する
const require = createRequire(import.meta.url);
const { createRuntime } = require('./mock/gasRuntime.cjs');

type Runtime = ReturnType<typeof createRuntime>;
let rt: Runtime;

// 祝日（サンプルでは祝日休講に設定される）を避けて、指定曜日の日付を返す
const nextWeekday = (wd: number, from = 1) => {
  const d = new Date();
  d.setDate(d.getDate() + from);
  const fmt = () => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  while (d.getDay() !== wd || getHolidayName(fmt())) d.setDate(d.getDate() + 1);
  return fmt();
};

const loginRen = () => rt.post({ action: 'parentLogin', loginId: 'codmon_sample_ren', password: 'soltilo123' });
const loginAdmin = () => rt.post({ action: 'adminLogin', password: 'admin-pass-1' });

beforeEach(() => {
  rt = createRuntime();
  rt.props.set('ADMIN_PASSWORD', 'admin-pass-1');
  rt.run('setupWithSampleData');
});

describe('保存', () => {
  it('_data シート（非表示）に JSON、職員用の3シートを書き出す', () => {
    expect(rt.sheets.get('_data').hidden).toBe(true);
    expect(rt.sheets.get('生徒マスタ')._data()[0][0]).toBe('ID');
    expect(rt.sheets.get('欠席履歴')._data().length).toBeGreaterThan(1);
    expect(rt.sheets.get('振替予約')._data().length).toBeGreaterThan(1);
  });
  it('生徒マスタにパスワード関連の列を出さない', () => {
    expect(rt.sheets.get('生徒マスタ')._data()[0]).toEqual(['ID', '氏名 (名前 (英語))', 'クラス', '通塾曜日', 'チケット残数', '備考']);
  });
});

describe('保護者ログインと情報の絞り込み', () => {
  it('ID/PW でログインでき、兄弟2名の情報だけを実名で受け取る', () => {
    const r = loginRen();
    expect(r.ok).toBe(true);
    const named = r.data.students.filter((s: { name: string }) => s.name);
    expect(named.map((s: { id: string }) => s.id).sort()).toEqual(['std_ex1_1', 'std_kin_1']);
    // 他の家庭は匿名（名前・保護者・メールなし）
    const others = r.data.students.filter((s: { name: string }) => !s.name);
    expect(others.length).toBeGreaterThan(0);
    expect(others.every((s: { parentName: string; contactEmail: string; id: string }) => !s.parentName && !s.contactEmail && /^x\d+$/.test(s.id))).toBe(true);
    expect(JSON.stringify(r.data)).not.toMatch(/Leo Sample|Sample Parent C|password/);
  });
  it('パスワード違い・存在しないIDは拒否', () => {
    expect(rt.post({ action: 'parentLogin', loginId: 'codmon_sample_ren', password: 'x' }).code).toBe('invalid_credentials');
    expect(rt.post({ action: 'parentLogin', loginId: 'nobody', password: 'soltilo123' }).code).toBe('invalid_credentials');
  });
  it('パスワード変更後は初期パスワードでログインできない', () => {
    const r = loginRen();
    const c = rt.post({ action: 'parentChangeCredentials', token: r.token, input: { studentId: 'std_ex1_1', newLoginId: 'ren-family', newPassword: 'newpass99' } });
    expect(c.ok).toBe(true);
    expect(rt.post({ action: 'parentLogin', loginId: 'ren-family', password: 'soltilo123' }).code).toBe('invalid_credentials');
    expect(rt.post({ action: 'parentLogin', loginId: 'ren-family', password: 'newpass99' }).ok).toBe(true);
    // 保存データに平文パスワードが残らない
    expect(rt.sheets.get('_data')._data().join('')).not.toContain('newpass99');
  });
  it('他の生徒が使っているログインIDには変更できない', () => {
    const r = loginRen();
    const c = rt.post({ action: 'parentChangeCredentials', token: r.token, input: { studentId: 'std_ex1_1', newLoginId: 'codmon_sample_leo', newPassword: 'newpass99' } });
    expect(c.code).toBe('login_id_taken');
  });
});

describe('保護者の操作', () => {
  it('欠席連絡で残数+1、同じ日の二重連絡は拒否', () => {
    const r = loginRen();
    const before = r.data.students.find((s: { id: string }) => s.id === 'std_ex1_1').transferBalance;
    const date = nextWeekday(3, 2);
    const a = rt.post({ action: 'parentReportAbsence', token: r.token, input: { studentId: 'std_ex1_1', date, reason: '体調不良・風邪' } });
    expect(a.ok).toBe(true);
    expect(a.data.students.find((s: { id: string }) => s.id === 'std_ex1_1').transferBalance).toBe(before + 1);
    const dup = rt.post({ action: 'parentReportAbsence', token: r.token, input: { studentId: 'std_ex1_1', date, reason: '体調不良・風邪' } });
    expect(dup.code).toBe('duplicate_absence');
  });
  it('他の家庭の生徒は操作できない', () => {
    const r = loginRen();
    const a = rt.post({ action: 'parentReportAbsence', token: r.token, input: { studentId: 'std_ex2_1', date: nextWeekday(1), reason: '' } });
    expect(a.code).toBe('forbidden');
  });
  it('振替予約で残数-1、取り消しで戻る', () => {
    const r = loginRen();
    const date = nextWeekday(2, 2); // 蓮は月・水の通学。火曜に振替
    const b = rt.post({ action: 'parentBookTransfer', token: r.token, input: { studentId: 'std_ex1_1', targetDate: date } });
    expect(b.ok).toBe(true);
    const booking = b.data.bookings.find((x: { targetDate: string; status: string }) => x.targetDate === date && x.status === 'booked');
    const c = rt.post({ action: 'parentCancelBooking', token: r.token, bookingId: booking.id });
    expect(c.ok).toBe(true);
    const ren = (d: AppState) => d.students.find((s) => s.id === 'std_ex1_1')!.transferBalance;
    expect(ren(c.data)).toBe(ren(b.data) + 1);
  });
  it('振替枠（2名）が埋まった日は予約できない', () => {
    const date = nextWeekday(2, 2);
    const admin = loginAdmin();
    // 同じ EX1 クラスの別の生徒2名に振替枠を使わせる
    const base: AppState = admin.data;
    const extra = ['a', 'b'].map((k) => ({
      id: `tb_fill_${k}`, studentId: `std_fill_${k}`, studentName: '', fromClassId: 'ex1', targetClassId: 'ex1',
      targetDate: date, bookedAt: new Date().toISOString(), status: 'booked'
    }));
    const next = { ...base, bookings: [...extra, ...base.bookings] } as AppState;
    expect(rt.post({ action: 'adminSync', token: admin.token, changes: diffState(base, next) }).ok).toBe(true);
    const r = loginRen();
    expect(rt.post({ action: 'parentBookTransfer', token: r.token, input: { studentId: 'std_ex1_1', targetDate: date } }).code).toBe('slot_unavailable');
  });
  it('今日以降の欠席は取り消せる（残数-1）、過去の欠席は取り消せない', () => {
    const r = loginRen();
    const date = nextWeekday(3, 2);
    const a = rt.post({ action: 'parentReportAbsence', token: r.token, input: { studentId: 'std_ex1_1', date, reason: '' } });
    const rec = a.data.absences.find((x: { date: string; studentId: string }) => x.date === date && x.studentId === 'std_ex1_1');
    const c = rt.post({ action: 'parentCancelAbsence', token: r.token, absenceId: rec.id });
    expect(c.ok).toBe(true);
    const past = r.data.absences.find((x: { studentId: string; date: string }) => x.studentId === 'std_ex1_1' && x.date < date && !x.id.startsWith('abs_hol'));
    expect(rt.post({ action: 'parentCancelAbsence', token: r.token, absenceId: past.id }).code).toBe('forbidden');
  });
  it('ログインなし・期限切れのトークンは拒否', () => {
    expect(rt.post({ action: 'parentGetData', token: 'bogus' }).code).toBe('session_expired');
  });
});

describe('管理者', () => {
  it('パスワードでログインし全員分を受け取る（パスワード情報は含まない）', () => {
    const a = loginAdmin();
    expect(a.ok).toBe(true);
    expect(a.data.students.length).toBe(11);
    expect(JSON.stringify(a.data)).not.toMatch(/password/);
    expect(rt.post({ action: 'adminLogin', password: 'wrong' }).code).toBe('invalid_credentials');
  });
  it('管理者パスワード未設定ならログイン不可', () => {
    rt.props.delete('ADMIN_PASSWORD');
    expect(rt.post({ action: 'adminLogin', password: '' }).code).toBe('admin_password_not_set');
  });
  it('保護者トークンでは管理者の操作はできない', () => {
    const r = loginRen();
    expect(rt.post({ action: 'adminGetData', token: r.token }).code).toBe('session_expired');
  });
  it('差分保存: 他の人が同じ生徒を先に更新していたら、その生徒だけ衝突として残す', () => {
    const a = loginAdmin();
    const base: AppState = a.data;
    // 保護者が先に欠席連絡（蓮の残数が変わる）
    const r = loginRen();
    rt.post({ action: 'parentReportAbsence', token: r.token, input: { studentId: 'std_ex1_1', date: nextWeekday(3, 2), reason: '' } });
    // 管理者は古い画面のまま、蓮の備考とレオのクラスを変更
    const next: AppState = {
      ...base,
      students: base.students.map((s) =>
        s.id === 'std_ex1_1' ? { ...s, notes: '送迎バス' } : s.id === 'std_ex2_1' ? { ...s, classId: 'kin' } : s
      )
    };
    const res = rt.post({ action: 'adminSync', token: a.token, changes: diffState(base, next) });
    expect(res.conflicts).toEqual([{ list: 'students', key: 'std_ex1_1' }]);
    expect(res.data.students.find((s: { id: string }) => s.id === 'std_ex2_1').classId).toBe('kin');
  });
  it('管理者が編集してもパスワードは保持される', () => {
    const r = loginRen();
    rt.post({ action: 'parentChangeCredentials', token: r.token, input: { studentId: 'std_ex1_1', newLoginId: 'ren-family', newPassword: 'newpass99' } });
    const a = loginAdmin();
    const next: AppState = { ...a.data, students: a.data.students.map((s: { id: string }) => (s.id === 'std_ex1_1' ? { ...s, notes: 'メモ' } : s)) };
    rt.post({ action: 'adminSync', token: a.token, changes: diffState(a.data, next) });
    expect(rt.post({ action: 'parentLogin', loginId: 'ren-family', password: 'newpass99' }).ok).toBe(true);
  });
  it('「名簿取込」シートの入力を取り込み、取り込み後は空にする（他の保存で消えない）', () => {
    const sheet = rt.sheets.get('名簿取込');
    sheet._set([sheet._data()[0], ['', 'サンプル 新 (Arata Sample)', 'Ele2', '火,木', 0, ''], ['std_ex1_1', 'サンプル 蓮 (Ren Sample)', 'EX1', '月,水', 2, '送迎バス']]);
    // 取り込み前に別の保存が走っても入力は残る
    const r = loginRen();
    rt.post({ action: 'parentReportAbsence', token: r.token, input: { studentId: 'std_ex1_1', date: nextWeekday(3, 2), reason: '' } });
    expect(sheet._data().length).toBe(3);
    const a = loginAdmin();
    const imp = rt.post({ action: 'adminImportFromSheet', token: a.token });
    expect(imp).toMatchObject({ ok: true, added: 1, updated: 1 });
    expect(imp.data.students.find((s: { id: string }) => s.id === 'std_ex1_1').notes).toBe('送迎バス');
    expect(sheet._data().length).toBe(1);
  });
});

describe('大きなデータ', () => {
  it('5万文字を超える保存データは複数セルに分割して読み書きできる', () => {
    const a = loginAdmin();
    const many = Array.from({ length: 400 }, (_, i) => ({
      id: `std_bulk_${i}`, name: `サンプル 生徒${i} (Student${i} Sample)`, classId: 'ele1', regularDays: [1, 3], transferBalance: 0,
      parentName: `サンプル 保護者${i}`, contactEmail: `p${i}@example.com`
    }));
    const next = { ...a.data, students: [...a.data.students, ...many] } as AppState;
    expect(rt.post({ action: 'adminSync', token: a.token, changes: diffState(a.data, next) }).ok).toBe(true);
    expect(rt.sheets.get('_data')._data().length).toBeGreaterThan(1);
    expect(rt.post({ action: 'adminGetData', token: a.token }).data.students.length).toBe(411);
  });
});
