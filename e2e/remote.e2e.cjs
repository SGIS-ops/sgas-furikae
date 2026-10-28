// サーバー版の通し確認: ビルドした画面（vite preview）を、モックの GAS（gas/dist/Code.gs）につないで操作する
// 実行: npm run build && npm run build:gas && npx vite preview --port 4174 & node e2e/remote.e2e.cjs
const { chromium } = require('playwright');
const { createRuntime } = require('../gas/mock/gasRuntime.cjs');

const BASE = process.env.E2E_BASE || 'http://localhost:4174/';
const API = 'https://script.google.com/macros/s/TEST/exec';
const SHOTS = process.env.E2E_SHOTS || '';

let failures = 0;
const check = (label, cond, extra = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures++;
};

(async () => {
  const rt = createRuntime();
  rt.props.set('ADMIN_PASSWORD', 'admin-pass-1');
  rt.run('setupWithSampleData');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tokyo' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  let calls = 0;
  await page.route('**/config.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ apiUrl: API }) }));
  await page.route(API, async (r) => {
    calls++;
    const body = JSON.parse(r.request().postData());
    await new Promise((res) => setTimeout(res, 150)); // 通信の遅れを再現
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(rt.post(body)) });
  });
  const text = () => page.locator('body').innerText();
  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  const balance = async () => Number(((await text()).match(/振替可能残数\s*\n?\s*(\d+)/) || [])[1]);
  const stored = () => {
    const raw = rt.sheets.get('_data')._data().map((r) => r[0]).join('');
    return JSON.parse(raw);
  };

  await page.goto(BASE);
  await page.waitForTimeout(500);

  // ---- 保護者 ----
  const t0 = await text();
  check('ログイン画面に他の家庭の名前（デモ用一覧）を出さない', !/Sample/.test(t0) && !t0.includes('ワンタップ'));
  await page.locator('input:visible').nth(0).fill('codmon_sample_ren');
  await page.locator('input:visible').nth(1).fill('wrong-password');
  await page.locator('button[type=submit]').click();
  await page.waitForTimeout(600);
  check('パスワード違いはエラー表示', (await text()).includes('ログインIDかパスワードが正しくありません'));
  await page.locator('input:visible').nth(1).fill('soltilo123');
  await page.locator('button[type=submit]').click();
  await page.waitForTimeout(800);
  const t1 = await text();
  check('サーバー経由でログインできる', t1.includes('振替可能残数'));
  check('兄弟（葵）に切り替えられる', t1.includes('サンプル 葵'));
  check('他の家庭の生徒名は画面に出ない', !/Leo Sample|Emily Sample|Chloe Sample/.test(t1));
  await shot('remote_parent');

  const before = await balance();
  await page.getByRole('button', { name: /手続き・履歴/ }).click();
  await page.locator('#btn-report-absence-trigger').click();
  const d = new Date();
  do d.setDate(d.getDate() + 1);
  while (d.getDay() !== 3 || (d.getMonth() === 10 && d.getDate() === 3));
  const absDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await page.locator('input[type=date]').fill(absDate);
  await page.locator('.fixed form button[type=submit]').click();
  await page.waitForTimeout(2200);
  check('欠席連絡で残数+1（サーバーに保存）', (await balance()) === before + 1, `${before} -> ${await balance()}`);
  check('サーバーの保存データに欠席が記録された', stored().absences.some((a) => a.studentId === 'std_ex1_1' && a.date === absDate));

  await page.locator('#btn-report-absence-trigger').click();
  await page.locator('input[type=date]').fill(absDate);
  await page.locator('.fixed form button[type=submit]').click();
  await page.waitForTimeout(800);
  check('同じ日の二重連絡はサーバーで拒否', (await balance()) === before + 1 && (await text()).includes('受け付けできませんでした'));
  const close = page.locator('.fixed button').filter({ hasText: /キャンセル|閉じる/ });
  if (await close.count()) await close.first().click();

  await page.locator('#btn-book-transfer-trigger').click();
  await page.waitForTimeout(400);
  const cells = page.locator('.fixed button:not([disabled])').filter({ hasText: /空\s*\d|Open/ });
  const cellCount = await cells.count();
  check('振替カレンダーに予約可能な日が出る', cellCount > 0, `${cellCount} days`);
  if (cellCount) {
    await cells.first().click();
    await page.getByRole('button', { name: /振替予約を確定/ }).click();
    await page.waitForTimeout(2200);
    check('振替予約で残数-1（サーバーに保存）', (await balance()) === before, `now ${await balance()}`);
    check('サーバーの保存データに予約が記録された', stored().bookings.filter((b) => b.studentId === 'std_ex1_1' && b.status === 'booked').length >= 2);
  }

  // ---- 管理者 ----
  await page.getByRole('button', { name: /スクール管理者モード|管理者/ }).first().click();
  await page.waitForTimeout(400);
  const t2 = await text();
  check('管理画面はパスワード入力から始まる', t2.includes('スクール管理者ログイン') && !t2.includes('サンプル 蓮'));
  await page.locator('#admin-password').fill('nope');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForTimeout(600);
  check('管理者パスワード違いはエラー', (await text()).includes('ログインIDかパスワードが正しくありません'));
  await page.locator('#admin-password').fill('admin-pass-1');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForTimeout(900);
  const t3 = await text();
  check('管理者は全員分を見られる', t3.includes('在籍生徒数') && /11\s*\n?\s*名/.test(t3));
  await shot('remote_admin');

  // 生徒名簿で残数を +1 → 自動保存
  await page.getByRole('button', { name: /生徒名簿/ }).first().click();
  await page.waitForTimeout(300);
  const leoBefore = stored().students.find((s) => s.id === 'std_ex2_1').transferBalance;
  const row = page.locator('tr').filter({ hasText: 'Leo Sample' });
  await row.locator('button').filter({ hasText: '+' }).first().click();
  await page.waitForTimeout(1800);
  check('管理画面の変更が自動でサーバーに保存される', stored().students.find((s) => s.id === 'std_ex2_1').transferBalance === leoBefore + 1);

  // コドモン貼り付けの一括反映
  const absBefore = stored().absences.length;
  await page.getByRole('button', { name: /日次ロスター/ }).first().click();
  await page.getByRole('button', { name: /デイリー画面まるごと貼付/ }).click();
  await page.getByRole('button', { name: /サンプル読込/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /分析結果を一括反映する/ }).click();
  await page.waitForTimeout(1800);
  check('コドモン取り込みの結果がサーバーに保存される', stored().absences.length > absBefore, `${absBefore} -> ${stored().absences.length}`);
  check('職員用の「欠席履歴」シートも更新される', rt.sheets.get('欠席履歴')._data().length - 1 === stored().absences.filter((a) => a.status === 'confirmed' && a.creditGranted).length);

  // 保護者画面に戻ると管理データは消え、ログインからやり直し
  await page.getByRole('button', { name: /保護者モード/ }).click();
  await page.waitForTimeout(400);
  const t4 = await text();
  check('保護者画面に戻ると管理データは残らない', !/Sample/.test(t4) && t4.includes('ログイン'));

  check('画面のエラーなし', errors.length === 0, errors.join(' | '));
  console.log(`API calls: ${calls}`);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})();
