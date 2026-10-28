# SOLTILO GSA アフタースクール振替・欠席管理システム

> **【2026-10-28 決定】クラスは EX1 / EX2 / Kin / Ele1 / Ele2 の5クラス（ClassId: `ex1` / `ex2` / `kin` / `ele1` / `ele2`）。**
> 本書の「4クラス（Extension / Kinder / E1 / E2）」の記述は旧仕様。対象年齢・学年は未確認のため設定していない。
> 旧表記（Extension / Kinder / E1 / E2）は取り込み時に別名として読み替える（`matchClassIdOrNull`）。

## Claude Code 開発引き継ぎ書 & プロンプト仕様書 (Complete Handover Document)

本ドキュメントは、**「SOLTILO GSA アフタースクール振替・欠席管理システム」** を **Claude Code** 上で再現・新規構築・拡張するための完全な設計書・実装仕様書・キックオフプロンプトです。

そのまま Claude Code のコンテキストとして読み込ませるか、指示プロンプトとして渡すことで、同一の高品質なシステムを一貫して実装できます。

---

## 1. プロジェクト概要 & 背景

- **サービス名称**: SOLTILO GSA アフタースクール振替管理システム (SOLTILO GSA Transfer Management)
- **対象施設**: インターナショナルスクール / サッカースクール等の英語アフタースクール
- **目的**: 
  - 保護者がスマホ・PCからいつでも簡単に「欠席連絡」と「振替受講予約」を完結できる
  - 園・スクール管理システム「コドモン (CoDMON)」の出欠画面コピー＆ペーストから一瞬で欠席・振替を取り込む
  - クラス別・曜日別の定員管理（通常定員 20名、振替受入枠 2名など）を自動計算し、二重予約や定員オーバーを防止
  - 日英完全バイリンガル対応（日本語・英語切り替え）
  - Googleスプレッドシートへのリアルタイム一括同期
- **動作形態**: サーバー不要で即座に動作するクライアント完結型SPA（LocalStorage永続化）＋ 将来的なバックエンド拡張も可能な疎結合設計。

---

## 2. 推奨技術スタック & ライブラリ

| 区分 | 技術 | バージョン/選定理由 |
| :--- | :--- | :--- |
| **言語** | TypeScript | `~5.8.0` 型安全性の担保 |
| **UIフレームワーク** | React | `^19.0.0` (Hooks, Context, Functional Components) |
| **ビルドツール** | Vite | `^6.2.0` 超高速HMR・ビルド |
| **CSS・スタイリング** | Tailwind CSS | `@tailwindcss/vite` (v4系) モダンユーティリティファースト |
| **アイコン** | Lucide React | `lucide-react` (視認性の高いUIアイコン群) |
| **データ永続化** | LocalStorage (ブラウザ) | バージョニングキー対応 (`_v2`)、旧データパージ機構付き |
| **外部連携** | Google Sheets API v4 | Google Identity Services (GSI) によるOAuth認証・同期 |

---

## 3. クラス構成 & ドメインモデル

### 3.1 クラスマスタ (`SOLTILO_CLASSES`)
スクールでは以下の4クラスを運用：
1. **Extension** (`extension`): 2〜3歳児（テーマカラー: Emerald）
2. **Kinder** (`kinder`): 4〜5歳児（テーマカラー: Sky）
3. **Elementary E1** (`e1`): 小学1〜3年生（テーマカラー: Indigo）
4. **Elementary E2** (`e2`): 小学4〜6年生（テーマカラー: Violet）

- **標準開講曜日**: 月〜金（1〜5）
- **標準定員上限**: 20名（振替枠含む）
- **標準振替受入枠**: 1日2名

---

## 4. データ型定義 (`src/types.ts`)

```typescript
export type ClassId = 'extension' | 'kinder' | 'e1' | 'e2';

export interface ClassInfo {
  id: ClassId;
  name: string;
  jpName: string;
  ageRange: string;
  defaultCapacity: number;     // 振替枠を含めた最大定員 (デフォルト: 20)
  defaultTransferQuota: number; // 1日あたりの振替受入枠 (デフォルト: 2)
  scheduleDays: number[];      // 1=月, 2=火, 3=水, 4=木, 5=金
  color: string;
  badgeBg: string;
  badgeText: string;
}

export interface Student {
  id: string;
  name: string;              // 形式: "名前 (英語)" 例: "サンプル 蓮 (Ren Sample)"
  classId: ClassId;
  regularDays: number[];      // 通学曜日 例: [1, 3] (月・水)
  transferBalance: number;   // 有効な振替残数 (チケット枚数)
  parentName: string;
  contactEmail: string;
  loginId?: string;          // 保護者ログインID (例: codmon_sample_ren)
  password?: string;         // 保護者パスワード (初期値: soltilo123)
  isDefaultPassword?: boolean;
}

export interface AbsenceRecord {
  id: string;
  studentId: string;
  studentName: string;
  classId: ClassId;
  date: string;              // YYYY-MM-DD
  reason: string;            // 体調不良・風邪、学校行事、私用 等
  reportedAt: string;        // ISO 8601
  status: 'confirmed' | 'cancelled';
  creditGranted: boolean;    // 振替チケット付与済みフラグ
  expiryDate?: string;       // 振替有効期限 (YYYY-MM-DD)
}

export interface TransferBooking {
  id: string;
  studentId: string;
  studentName: string;
  fromClassId: ClassId;
  targetClassId: ClassId;
  absenceRecordId?: string;  // 紐付く欠席記録ID
  targetDate: string;        // YYYY-MM-DD
  bookedAt: string;          // ISO 8601
  status: 'booked' | 'attended' | 'cancelled';
  note?: string;
  expiryDate?: string;
}

// 曜日別・クラス別定員設定
export interface WeekdayClassQuota {
  maxTransferQuota: number;  // 振替枠 (例: 2)
  maxTotalCapacity: number;  // 最大定員 (例: 20)
  isOpen: boolean;           // 開講ステータス
}

export type WeekdayQuotaSettings = Record<ClassId, Record<number, WeekdayClassQuota>>;

// 祝日要振替・サマースクール特別日程
export type SpecialDayType =
  | 'holiday_transfer' // 祝日休講（月曜祝日等、在籍生に自動で振替付与）
  | 'summer_school'    // サマースクール（特別枠受入）
  | 'winter_school'    // ウィンタースクール
  | 'spring_school'    // スプリングスクール
  | 'special_open'     // 祝日特別開校（通常レッスン実施）
  | 'closed'           // お盆・年末年始休館
  | 'event';           // イベント・大会

export interface SpecialScheduleDay {
  id: string;
  date: string;              // YYYY-MM-DD
  type: SpecialDayType;
  title: string;             // 例: "山の日(要振替付与)", "サマースクールDay1"
  badgeText: string;         // 例: "祝(要振)", "サマー", "休館"
  allowTransfers: boolean;   // 振替予約を受付可能か
  transferQuota?: number;    // 特別振替枠数
  grantsTransfer: boolean;   // 該当日在籍生に振替チケットを自動付与するか
  note?: string;
}

// 日別オーバーライド (特定日の定員を手動変更した場合)
export interface DailyClassOverride {
  date: string;
  classId: ClassId;
  maxTotalCapacity: number;
  maxTransferQuota: number;
  isCancelled?: boolean;
}

// コドモン同期ログ
export interface CodmonSyncLog {
  id: string;
  timestamp: string;
  updatedBy: string;
  targetDate: string;
  absencesCount: number;
  transfersCount: number;
  attendanceCount: number;
  summary: string;
  itemsSummary?: string[];
}
```

---

## 5. コア・ビジネスロジック詳細仕様

### 5.1 振替有効期限計算ルール (`src/lib/expiration.ts`)
- **計算式**: **「欠席日の起算月を含め、翌々月末まで（最大3ヶ月間）」**
  - 例1: `2026-08-05` 欠席 → 有効期限は `2026-10-31`
  - 例2: `2026-08-31` 欠席 → 有効期限は `2026-10-31`
  - 例3: `2026-12-10` 欠席 → 翌年 `2027-02-28`
- **消化順序**: FIFO（最も期限が近い古い欠席チケットから順に消費）
- **期限アラート**: 残り日数が **14日以内** の場合、保護者画面でオレンジ色のアラートバッジ（`期限間近: あとX日`）を表示。

### 5.2 定員・空き枠計算ルール
特定日 `date`、クラス `classId` における振替受入可能枠は以下の通り計算：
```
通常在籍生数 = regularDaysにその曜日が含まれる生徒数
当日欠席数 = その日のAbsenceRecordで確定している生徒数
当日振替予約数 = その日のTransferBookingで予約確定している生徒数
当日出席見込み数 = (通常在籍生数 - 当日欠席数) + 当日振替予約数

定員残枠 = 最大定員 (20名) - 当日出席見込み数
振替残枠 = 設定振替枠 (2名) - 当日振替予約数

最終受入可能数 = max(0, min(定員残枠, 振替残枠))
```
- ※ 祝日や完全休館日は `0`。サマースクール等で `transferQuota` が個別設定されている場合はそちらを優先。

### 5.3 コドモン・スマートフルスクリーンパース (`src/lib/codmonParser.ts`)
管理者運用の最重要機能。コドモンの「出欠状況管理画面」で `Ctrl+A` → `Ctrl+C` されたテキスト（5万文字超、表崩れ、改行混在）から高精度に抽出する。

1. **ノイズ除去フィルタ**:
   - 時刻パターン (`09:3014:00 (母)`, `14:00~17:00`)
   - 体温・検温 (`36.5℃`, `37.1度`)
   - アレルギー情報 (`アレルギーなし`, `卵アレルギー`)
   - 画面共通語 (`全員`, `所在確認の園児`, `通常の園児`, `出欠状況`, `日誌・連絡帳`, `名前順`, `未対応`)
   - 数字・記号・ハッシュ
2. **生徒名正規化 (`extractCleanStudentNameParts`)**:
   - 日本語（漢字/ひらがな/カタカナ）と英語表記（アルファベット）を分離抽出し、**`名前 (英語)`** 形式に厳密統一。
   - 例: `サンプル 蓮 Ren Sample 卵アレルギー 09:30` → `サンプル 蓮 (Ren Sample)`
3. **出欠・振替の自動検出**:
   - **欠席 (Absence)**: `都合欠`, `病欠`, `欠席`, `お休み`, `今日まで` などのキーワード → 欠席レコード作成 & 振替チケット `+1` 付与。
   - **振替 (Transfer)**: `振替`, `ふりかえ`, `➡️`, `->`, `8/17分` などのキーワード → 振替予約レコード作成 & チケット `-1`。
   - **通常出席 (Regular)**: 上記以外で名簿に合致する生徒。
4. **競合防止ガード (Collision Guard)**:
   - 最終同期から5分以内の場合、別の担当者による二重取り込みを防ぐため「【重複注意】約X分前に更新されています」と警告バッジを表示。

### 5.4 Googleスプレッドシート連携仕様 (`src/lib/googleSheets.ts`)
- Google Identity Services (`https://accounts.google.com/gsi/client`) によるクライアント完結型OAuth。
- ボタン1つで以下の3シートを持つ新規スプレッドシートを作成・更新可能：
  1. **生徒一覧・振替残数**: 生徒ID、氏名、在籍クラス、通学曜日、振替残数、保護者氏名、連絡先
  2. **欠席連絡一覧**: 欠席ID、生徒名、クラス、欠席日、欠席理由、受付日時、ステータス、振替付与状況
  3. **振替予約一覧**: 予約ID、生徒名、元クラス、振替先クラス、振替希望日、予約申込日時、ステータス、備考
- データ更新時のバックグラウンド自動同期オプション対応。

---

## 6. ディレクトリ & ファイル構成

```
src/
├── types.ts                      # 全体の型定義
├── main.tsx                      # エントリーポイント
├── App.tsx                       # グローバルステート管理、ルーティング、モーダル管理
├── index.css                     # Tailwind CSS v4 ディレクティブ
├── data/
│   ├── constants.ts              # クラス定数、欠席理由リスト、定員上限定数
│   └── initialData.ts            # 初期サンプルデータ（ダミー生徒名・予約・スケジュール）
├── lib/
│   ├── storage.ts                # LocalStorageラッパー（v2キー、マイグレーション、初期化）
│   ├── codmonParser.ts           # コドモン画面テキストの超インテリジェントパーサー
│   ├── expiration.ts             # 振替有効期限計算（3ヶ月ルール、14日警告）
│   ├── holidays.ts               # 日本の祝日データ（2025-2026年）、月曜祝日判定
│   ├── googleSheets.ts           # Google Sheets API v4 連携（GSIクライアント）
│   └── i18n.tsx                  # 日英バイリンガル辞書 & useTranslationフック
└── components/
    ├── Header.tsx                # ナビゲーションバー、モード切替、言語切替、同期状態
    ├── ShieldLogo.tsx            # SOLTILO GSA ロゴアイコン
    ├── GoogleSheetsModal.tsx     # スプレッドシート連携設定モーダル
    ├── ParentView/               # --- 保護者画面 ---
    │   ├── ParentDashboard.tsx   # 保護者ダッシュボードメイン
    │   ├── ParentLogin.tsx       # 保護者ログイン画面（ID・PW認証）
    │   ├── StudentSelector.tsx   # 兄弟・生徒切替ドロップダウン
    │   ├── CalendarView.tsx      # 振替可能枠つき月間カレンダー
    │   ├── AbsenceReportModal.tsx # 欠席連絡登録モーダル
    │   ├── TransferBookingModal.tsx # 振替予約確定モーダル
    │   └── ChangeCredentialsModal.tsx # パスワード変更モーダル
    └── AdminView/                # --- 管理者画面 ---
        ├── AdminDashboard.tsx    # 管理者タブ切り替え（ロスター/コドモン/定員/名簿）
        ├── DailyRoster.tsx       # 当日出欠・在籍・振替一覧（印刷対応）
        ├── CodmonDailySmartPasteModal.tsx # コドモン全画面貼り付けスマートパースモーダル
        ├── CodmonIntegrationPanel.tsx     # CSV取り込み＆手動同期履歴パネル
        ├── QuotaAndScheduleSettings.tsx   # 曜日別基本枠・特別日（祝日/サマー）設定
        ├── QuotaSettingsModal.tsx         # 日別定員オーバーライドモーダル
        └── StudentManagement.tsx          # 生徒名簿一覧、検索、残数手動編集、新規追加
```

---

## 7. Claude Code へのキックオフ指示プロンプト (Copy & Paste)

以下のプロンプトをそのまま Claude Code に送信することで、プロジェクトの構築を開始できます。

```markdown
以下の要件定義に従い、「SOLTILO GSA アフタースクール振替・欠席管理システム」を新規構築してください。

### 1. 技術スタック
- React 19 (TypeScript) + Vite
- Tailwind CSS (ユーティリティクラス)
- Lucide React (アイコン)
- LocalStorage 永続化（キー接頭辞: soltilo_gsa_*_v2）

### 2. コア要件
1. **保護者画面 (ParentView)**
   - ログインID / パスワード認証 (初期値: `codmon_sample_ren` / `soltilo123`)
   - 兄弟切り替え (StudentSelector)
   - 振替残数表示 & 有効期限アラート（欠席日の起算月を含め翌々月末まで。残り14日以内は警告色表示）
   - 欠席連絡（即座に振替残数+1、有効期限自動セット）
   - 振替予約カレンダー（クラスごとの残枠数バッジ、受入可能日のみ選択可、残数-1）

2. **管理者画面 (AdminView)**
   - **日次ロスター (DailyRoster)**: クラス別の通常在籍、欠席、振替受入をリアルタイム一覧表示
   - **コドモンスマートペースト (Codmon Smart Paste)**: コドモンの出欠管理画面テキスト（Ctrl+Aコピー）を貼り付けるだけで、ノイズ（アレルギー、体温、時刻）を除去し、生徒名（名前 (英語) 形式）と欠席・振替を自動抽出して一括反映
   - **定員・スケジュール設定 (QuotaAndScheduleSettings)**: 曜日別・クラス別定員（基本20名・振替2名）、月曜祝日要振替付与、サマースクール等特別日程の登録
   - **生徒名簿管理 (StudentManagement)**: 生徒の検索、新規追加、在籍クラス変更、振替残数の手動修正

3. **外部連携・共通機能**
   - **Googleスプレッドシート連携**: Google Identity Services によるOAuth認証で3シート（生徒名簿・欠席一覧・振替予約一覧）を即時作成・同期
   - **日英バイリンガル (i18n)**: ヘッダーで「日本語 / English」をワンタップ切り替え
   - **プライバシー保護**: 生徒名はすべて「サンプル 蓮 (Ren Sample)」のようなダミーサンプル名を採用し、安全に公開・共有できる状態にすること。

まずは型定義 `src/types.ts`、定数 `src/data/constants.ts`、初期サンプルデータ `src/data/initialData.ts`、およびパーサー/有効期限ロジック `src/lib/` から順に作成してください。
```

---

## 8. 重要留意点 & 開発のヒント

1. **生徒名の表記揺れ対策**:
   コドモンからコピーしたテキストには「サンプル 蓮 Ren Sample」や「Ren Sample (サンプル 蓮)」「サンプル 蓮」など多様なパターンが存在します。パーサー内の `extractCleanStudentNameParts` で漢字とアルファベットを正規表現でスマートに抽出し、既存生徒の照合時にはスペースや括弧を削除した文字列でファジーマッチング（部分一致判定）を行う設計になっています。
2. **キャッシュパージ機構**:
   ブラウザのLocalStorageに過去の実名データや古いスキーマが残っていると不整合が起きるため、`src/lib/storage.ts` の `cleanupLegacyStorage()` により古い `_v1` プレフィックスのキーを起動時に自動消去する設計を維持してください。
3. **Google OAuthのクライアントID**:
   Google Sheets API を有効化する際は、Google Cloud Console で OAuth 2.0 クライアントID（ウェブアプリケーション）を発行し、`.env` に `VITE_OAUTH_CLIENT_ID` として設定します。設定がない場合でもアプリ自体の振替・名簿・パーサー機能は100%ローカルで動作します。
