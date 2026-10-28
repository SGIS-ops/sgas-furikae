# SOLTILO GSA アフタースクール 振替・欠席管理システム

保護者の欠席連絡・振替予約と、管理者の日次ロスター・コドモン取り込み・定員管理を行うブラウザ完結型アプリ（React 19 + Vite + Tailwind CSS v4）。
仕様は `CLAUDE_CODE_HANDOVER.md` を参照。

## 起動

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 単体テスト（有効期限・定員・祝日付与・コドモン解析）
npm run build    # 型チェック + 本番ビルド
```

デモ用ログイン: `codmon_sample_ren` / `soltilo123`（兄弟: 蓮・葵）。データはすべて架空のサンプル。

Google スプレッドシート連携を使う場合は `.env.example` を `.env.local` にコピーし、`VITE_OAUTH_CLIENT_ID` を設定する。

## 主なルール

- クラス: EX1 / EX2 / Kin / Ele1 / Ele2（対象年齢は未設定）
- 振替チケット: 欠席1回につき1枚。欠席月を含め3か月目の月末まで有効。予約時は古いものから消費（FIFO）
- 期限切れの未使用チケットは起動時に残数から差し引く
- 残枠 = min(定員20 − 出席予定数, 振替枠2 − 振替予約数)。定員は設定値に関わらず20が上限
- 「祝日休講・要振替」の特別日を登録すると、その曜日の在籍生に振替チケットを自動付与（削除で取り消し）
- Google スプレッドシート: 「生徒マスタ」「欠席履歴」「振替予約」の3シート（列は引き継ぎ書 5.1）。アプリ → シートは全体を書き直し、シート → アプリは生徒マスタのみ読み込む（ID一致で更新、シートにない生徒は削除しない、反映前に確認）
- コドモン貼り付け: 解析結果の欠席・振替は行ごとにチェックを外して反映対象から除外できる
- 保存データは localStorage（キー `soltilo_gsa_*_v3`）。旧 v1/v2 は起動時に削除

## デモ版とサーバー版

- `config.json` の `apiUrl` が空 → デモ版（データはブラウザ内だけ。サンプルデータ）
- `apiUrl` に Apps Script ウェブアプリの URL → サーバー版（スプレッドシートに保存、保護者・管理者ともログイン必須）
- 公開手順は `deploy/SETUP.md`、サーバーのコードは `gas/server.ts`（`npm run build:gas` で `deploy/Code.gs` を生成）
- `npm run build:pages` で GitHub Pages 用の画面を `docs/` に出力
- サーバー版の通し確認: `npm run build && npm run build:gas`、`npx vite preview --port 4174` を起動して `npm run e2e:remote`
