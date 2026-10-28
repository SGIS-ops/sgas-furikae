// GAS に貼り付ける Code.gs を作る: server.ts と共用ロジックを1ファイルにまとめ、GAS が呼べるトップレベル関数を追加する
import { build } from 'esbuild';
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

const result = await build({
  entryPoints: ['gas/server.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'SGAS',
  target: 'es2019',
  charset: 'utf8',
  write: false,
  legalComments: 'none',
  // サーバーでは使わない画面用の設定値（Google OAuth のクライアントID）を空にする
  define: { 'import.meta.env': '{}' }
});

const header = `/** @OnlyCurrentDoc */
// SOLTILO GSA 振替・欠席管理 サーバー（自動生成ファイル。直接編集しないこと）
// 生成元: gas/server.ts（npm run build:gas）  生成日時: ${new Date().toISOString()}
`;
const entry = `
// ---- GAS から呼ばれる関数 ----
function doGet(e) { return SGAS.doGet(e); }
function doPost(e) { return SGAS.doPost(e); }
/** テスト開始時に1回実行: 架空のサンプルデータで初期化 */
function setupWithSampleData() { Logger.log(SGAS.setupWithSampleData()); }
/** 本番開始時に1回実行: 空の名簿で初期化（既存データは消える） */
function setupEmpty() { Logger.log(SGAS.setupEmpty()); }
`;
mkdirSync('gas/dist', { recursive: true });
writeFileSync('gas/dist/Code.gs', header + result.outputFiles[0].text + entry);
copyFileSync('gas/appsscript.json', 'gas/dist/appsscript.json');
mkdirSync('deploy', { recursive: true });
copyFileSync('gas/dist/Code.gs', 'deploy/Code.gs');
console.log('gas/dist/Code.gs', (result.outputFiles[0].text.length / 1024).toFixed(1), 'KB');
