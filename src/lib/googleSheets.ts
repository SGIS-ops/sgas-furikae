import { Student, AbsenceRecord, TransferBooking, DailyClassOverride } from '../types';
import { SOLTILO_CLASSES } from '../data/constants';
import { getStudentTransferTickets } from './expiration';
import { matchClassIdOrNull, parseDaysOfWeek } from './codmonParser';
import { toLocalDateString } from './dateUtils';

declare global {
  interface ImportMetaEnv {
    readonly VITE_OAUTH_CLIENT_ID?: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (err: unknown) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

// 引き継ぎ書 5.2: スプレッドシートの読み書きのみ
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

/** 引き継ぎ書 5.1 のシート構成 */
export const SHEET_TITLES = {
  students: '生徒マスタ',
  absences: '欠席履歴',
  bookings: '振替予約'
} as const;

// Ensure GSI script is loaded
export const loadGsiScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existingScript = document.getElementById('gsi-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

// Request OAuth Token using Google Identity Services
export const requestAccessToken = async (): Promise<string> => {
  await loadGsiScript();

  // Retrieve client ID from Vite env or fallback
  const clientId = import.meta.env.VITE_OAUTH_CLIENT_ID || '';

  if (!clientId) {
    throw new Error('Google OAuth Client IDが設定されていません。アプリのGoogle Workspace連携（OAuth）を設定してください。');
  }

  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services library failed to load.'));
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(`OAuth Error: ${response.error}`));
        } else if (response.access_token) {
          resolve(response.access_token);
        } else {
          reject(new Error('No access token received.'));
        }
      },
      error_callback: (err) => {
        reject(err);
      }
    });

    client.requestAccessToken({ prompt: 'consent' });
  });
};

// Create a brand new Google Spreadsheet for SOLTILO GSA
export const createSpreadsheet = async (accessToken: string): Promise<{ id: string; url: string }> => {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: `SOLTILO GSA アフタースクール 振替管理表 (${new Date().toLocaleDateString('ja-JP')})`
      },
      sheets: Object.values(SHEET_TITLES).map((title) => ({ properties: { title } }))
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spreadsheet creation failed: ${errorText}`);
  }

  const data = await response.json();
  return {
    id: data.spreadsheetId,
    url: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`
  };
};

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
const className = (classId: string) => SOLTILO_CLASSES.find((c) => c.id === classId)?.name ?? classId;

const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${toLocalDateString(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** ① 生徒マスタ: ID / 氏名 / クラス / 通塾曜日 / チケット残数 / 備考 */
export const buildStudentRows = (students: Student[]): (string | number)[][] => [
  ['ID', '氏名 (名前 (英語))', 'クラス', '通塾曜日', 'チケット残数', '備考'],
  ...students.map((s) => [
    s.id,
    s.name,
    className(s.classId),
    s.regularDays.map((d) => DAY_NAMES[d]).join(','),
    s.transferBalance,
    s.notes ?? ''
  ])
];

/** ② 欠席履歴: 欠席ID / 生徒ID / 生徒名 / クラス / 欠席日 / 理由 / 有効期限 / 振替消化済 */
export const buildAbsenceRows = (
  absences: AbsenceRecord[],
  bookings: TransferBooking[]
): (string | number)[][] => {
  const used = new Set<string>();
  for (const studentId of new Set(absences.map((a) => a.studentId))) {
    getStudentTransferTickets(studentId, absences, bookings)
      .filter((t) => t.isBooked)
      .forEach((t) => used.add(t.absenceId));
  }
  return [
    ['欠席ID', '生徒ID', '生徒名', 'クラス', '欠席日', '理由', '有効期限', '振替消化済'],
    ...absences
      .filter((a) => a.status === 'confirmed' && a.creditGranted)
      .map((a) => [
        a.id,
        a.studentId,
        a.studentName,
        className(a.classId),
        a.date,
        a.reason,
        a.expiryDate ?? '',
        used.has(a.id) ? 'TRUE' : 'FALSE'
      ])
  ];
};

/** ③ 振替予約: 予約ID / 生徒ID / 生徒名 / 振替先日 / 対象クラス / 元の欠席日 / ステータス / 登録日時 */
export const buildBookingRows = (
  absences: AbsenceRecord[],
  bookings: TransferBooking[]
): (string | number)[][] => {
  const originDate = new Map<string, string>();
  for (const studentId of new Set(bookings.map((b) => b.studentId))) {
    getStudentTransferTickets(studentId, absences, bookings).forEach((t) => {
      if (t.linkedBookingId) originDate.set(t.linkedBookingId, t.absenceDate);
    });
  }
  const statusLabel = { booked: 'confirmed', attended: 'attended', cancelled: 'cancelled' } as const;
  return [
    ['予約ID', '生徒ID', '生徒名', '振替先日', '対象クラス', '元の欠席日', 'ステータス', '登録日時'],
    ...bookings.map((b) => [
      b.id,
      b.studentId,
      b.studentName,
      b.targetDate,
      className(b.targetClassId),
      originDate.get(b.id) ?? '',
      statusLabel[b.status],
      formatDateTime(b.bookedAt)
    ])
  ];
};

/** 生徒マスタ1行の読み取り結果 */
export interface SheetStudentRow {
  rowNumber: number;
  id: string;
  name: string;
  classId: Student['classId'] | null;
  regularDays: number[] | null;
  transferBalance: number | null;
  notes: string;
}

/** 生徒マスタの値（見出し行を含む）を読み取る。空行は無視する */
export const parseStudentMasterRows = (values: string[][]): SheetStudentRow[] =>
  values
    .slice(1)
    .map((row, i) => {
      const [id = '', name = '', cls = '', days = '', tickets = '', notes = ''] = row.map((c) => String(c ?? '').trim());
      const n = Number(tickets);
      return {
        rowNumber: i + 2,
        id,
        name,
        classId: cls ? matchClassIdOrNull(cls) : null,
        regularDays: days ? parseDaysOfWeek(days) : null,
        transferBalance: tickets !== '' && Number.isInteger(n) && n >= 0 ? n : null,
        notes
      };
    })
    .filter((r) => r.id || r.name);

export interface SheetMergeResult {
  students: Student[];
  added: number;
  updated: number;
  warnings: string[];
}

/**
 * スプレッドシートの生徒マスタをアプリの名簿に取り込む。
 * - ID が一致する生徒 → 無ければ氏名が完全一致する生徒を更新（部分一致では合わせない）
 * - どちらも無ければ新規追加（ログインIDは codmon_ + ID、初期パスワード soltilo123）
 * - 読めない値（不明なクラス・空欄・負の残数）は更新せず、警告に出す
 * - シートにない生徒は削除しない
 */
export const mergeStudentsFromSheet = (students: Student[], rows: SheetStudentRow[]): SheetMergeResult => {
  const normalize = (v: string) => v.replace(/[\s　]+/g, '');
  const next = [...students];
  const warnings: string[] = [];
  let added = 0;
  let updated = 0;

  for (const row of rows) {
    if (!row.name) {
      warnings.push(`${row.rowNumber}行目: 氏名が空欄のためスキップしました`);
      continue;
    }
    if (row.classId === null) warnings.push(`${row.rowNumber}行目 ${row.name}: クラスを判別できません（既存の値を維持）`);
    if (row.regularDays === null) warnings.push(`${row.rowNumber}行目 ${row.name}: 通塾曜日が空欄です（既存の値を維持）`);
    if (row.transferBalance === null) warnings.push(`${row.rowNumber}行目 ${row.name}: チケット残数が不正です（既存の値を維持）`);

    const byId = row.id ? next.findIndex((s) => s.id === row.id) : -1;
    const idx = byId !== -1 ? byId : next.findIndex((s) => normalize(s.name) === normalize(row.name));

    if (idx !== -1) {
      const cur = next[idx];
      const merged: Student = {
        ...cur,
        name: row.name,
        classId: row.classId ?? cur.classId,
        regularDays: row.regularDays ?? cur.regularDays,
        transferBalance: row.transferBalance ?? cur.transferBalance,
        notes: row.notes || undefined
      };
      const changed =
        merged.name !== cur.name ||
        merged.classId !== cur.classId ||
        merged.regularDays.join(',') !== cur.regularDays.join(',') ||
        merged.transferBalance !== cur.transferBalance ||
        (merged.notes ?? '') !== (cur.notes ?? '');
      if (changed) {
        next[idx] = merged;
        updated++;
      }
      continue;
    }

    if (row.classId === null || row.regularDays === null) {
      warnings.push(`${row.rowNumber}行目 ${row.name}: クラスか通塾曜日が不明なため新規登録しませんでした`);
      continue;
    }
    const id = row.id || `std_sheet_${Date.now()}_${row.rowNumber}`;
    next.push({
      id,
      name: row.name,
      classId: row.classId,
      regularDays: row.regularDays,
      transferBalance: row.transferBalance ?? 0,
      parentName: '',
      contactEmail: '',
      loginId: `codmon_${id.replace(/^std_/, '')}`,
      password: 'soltilo123',
      isDefaultPassword: true,
      notes: row.notes || undefined
    });
    added++;
  }

  return { students: next, added, updated, warnings };
};

const sheetsFetch = async (accessToken: string, url: string, init: RequestInit = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  if (!response.ok) {
    throw new Error(`Google Sheets API エラー (${response.status}): ${await response.text()}`);
  }
  return response.json();
};

/** 3シートが無ければ追加する（旧バージョンで作ったスプレッドシートにも対応） */
const ensureSheets = async (accessToken: string, spreadsheetId: string) => {
  const meta = await sheetsFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`
  );
  const existing = new Set<string>((meta.sheets || []).map((sh: { properties: { title: string } }) => sh.properties.title));
  const missing = Object.values(SHEET_TITLES).filter((t) => !existing.has(t));
  if (missing.length === 0) return;
  await sheetsFetch(accessToken, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) })
  });
};

// Sync all app data to Google Sheet（アプリ → シート。各シートを書き直す）
export const syncDataToGoogleSheet = async (
  accessToken: string,
  spreadsheetId: string,
  data: {
    students: Student[];
    absences: AbsenceRecord[];
    bookings: TransferBooking[];
    overrides: DailyClassOverride[];
  }
): Promise<void> => {
  await ensureSheets(accessToken, spreadsheetId);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values`;
  const sheets: [string, (string | number)[][]][] = [
    [SHEET_TITLES.students, buildStudentRows(data.students)],
    [SHEET_TITLES.absences, buildAbsenceRows(data.absences, data.bookings)],
    [SHEET_TITLES.bookings, buildBookingRows(data.absences, data.bookings)]
  ];

  // 行が減った場合に古い行が残らないよう、先に全体を消してから書き込む
  await sheetsFetch(accessToken, `${base}:batchClear`, {
    method: 'POST',
    body: JSON.stringify({ ranges: sheets.map(([title]) => `'${title}'!A:Z`) })
  });
  await sheetsFetch(accessToken, `${base}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: sheets.map(([title, values]) => ({ range: `'${title}'!A1`, values }))
    })
  });
};

/** シート → アプリ: 生徒マスタを読み込む */
export const readStudentMasterFromSheet = async (
  accessToken: string,
  spreadsheetId: string
): Promise<SheetStudentRow[]> => {
  const range = encodeURIComponent(`'${SHEET_TITLES.students}'!A1:F`);
  const data = await sheetsFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`
  );
  return parseStudentMasterRows((data.values as string[][]) || []);
};
