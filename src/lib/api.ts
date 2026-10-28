import type { AppState } from './operations';
import type { ChangeSet } from './sync';

// ============================================================
// サーバー（Google Apps Script のウェブアプリ）との通信
// 同じフォルダの config.json に apiUrl があればサーバー版、無ければデモ版（ブラウザ内保存）で動く
// ============================================================

let apiUrl = '';

/** 起動時に1回だけ呼ぶ。config.json が無い・読めない場合はデモ版 */
export const loadConfig = async (): Promise<void> => {
  try {
    const res = await fetch('./config.json', { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    if (typeof json.apiUrl === 'string') apiUrl = json.apiUrl.trim();
  } catch {
    // ファイルとして開いた場合・共有ページではデモ版
  }
};

export const isRemoteMode = () => apiUrl !== '';

/** テスト用: API の URL を差し替える */
export const setApiUrlForTest = (url: string) => {
  apiUrl = url;
};

export class ApiError extends Error {
  code: string;
  params: Record<string, string>;
  constructor(code: string, message: string, params: Record<string, string> = {}) {
    super(message);
    this.code = code;
    this.params = params;
  }
}

interface ApiFailure {
  ok: false;
  code: string;
  message?: string;
  params?: Record<string, string>;
}
type ApiResponse<T> = ({ ok: true } & T) | ApiFailure;

const call = async <T>(action: string, payload: Record<string, unknown> = {}): Promise<T> => {
  let res: Response;
  try {
    // text/plain で送ると CORS の事前確認が不要になる（GAS のウェブアプリはこの形で受け付ける）
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });
  } catch {
    throw new ApiError('network', 'サーバーに接続できませんでした。通信状況を確認してください。');
  }
  let json: ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    throw new ApiError('bad_response', 'サーバーからの応答を読み取れませんでした。');
  }
  if (!json.ok) {
    const failure = json as ApiFailure;
    throw new ApiError(failure.code, failure.message || failure.code, failure.params || {});
  }
  return json as T;
};

export interface ParentSession {
  token: string;
  studentId: string;
  data: AppState;
}

export const api = {
  parentLogin: (loginId: string, password: string) => call<ParentSession>('parentLogin', { loginId, password }),
  parentGetData: (token: string) => call<{ data: AppState }>('parentGetData', { token }),
  parentReportAbsence: (token: string, input: { studentId: string; date: string; reason: string }) =>
    call<{ data: AppState }>('parentReportAbsence', { token, input }),
  parentBookTransfer: (token: string, input: { studentId: string; targetDate: string }) =>
    call<{ data: AppState }>('parentBookTransfer', { token, input }),
  parentCancelBooking: (token: string, bookingId: string) =>
    call<{ data: AppState }>('parentCancelBooking', { token, bookingId }),
  parentCancelAbsence: (token: string, absenceId: string) =>
    call<{ data: AppState }>('parentCancelAbsence', { token, absenceId }),
  parentChangeCredentials: (token: string, input: { studentId: string; newLoginId: string; newPassword: string }) =>
    call<{ data: AppState }>('parentChangeCredentials', { token, input }),

  adminLogin: (password: string) =>
    call<{ token: string; data: AppState; spreadsheetUrl: string }>('adminLogin', { password }),
  adminGetData: (token: string) => call<{ data: AppState; spreadsheetUrl: string }>('adminGetData', { token }),
  adminSync: (token: string, changes: ChangeSet) =>
    call<{ data: AppState; conflicts: { list: string; key: string }[] }>('adminSync', { token, changes }),
  adminImportFromSheet: (token: string) =>
    call<{ data: AppState; added: number; updated: number; warnings: string[] }>('adminImportFromSheet', { token })
};
