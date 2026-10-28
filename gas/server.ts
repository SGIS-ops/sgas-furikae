// ============================================================
// SOLTILO GSA 振替・欠席管理 サーバー（Google Apps Script ウェブアプリ）
// - データはこのスクリプトを入れたスプレッドシートの「_data」シートに JSON で保存
// - 職員が読む「生徒マスタ」「欠席履歴」「振替予約」シートを保存のたびに書き直す
// - 保護者はログインした家庭の情報だけを受け取る（他の家庭は匿名化した件数情報のみ）
// - 管理者パスワードはスクリプトプロパティ ADMIN_PASSWORD に設定する（コードに書かない）
// このファイルは esbuild で1つの Code.gs にまとめる（npm run build:gas）
// ============================================================
import type { AbsenceRecord, Student, TransferBooking } from '../src/types';
import {
  AppState,
  bookTransfer,
  cancelAbsence,
  cancelBooking,
  familyStudentIds,
  OperationResult,
  operationErrorMessage,
  reportAbsence,
  runMaintenance
} from '../src/lib/operations';
import { applyChanges, ChangeSet } from '../src/lib/sync';
import {
  buildAbsenceRows,
  buildBookingRows,
  buildStudentRows,
  mergeStudentsFromSheet,
  parseStudentMasterRows,
  SHEET_TITLES
} from '../src/lib/googleSheets';
import {
  INITIAL_ABSENCES,
  INITIAL_BOOKINGS,
  INITIAL_SPECIAL_DAYS,
  INITIAL_STUDENTS,
  INITIAL_WEEKDAY_QUOTAS
} from '../src/data/initialData';
import { addDaysToDateString, getTodayString } from '../src/lib/dateUtils';

const DATA_SHEET = '_data';
/** 職員が名簿を入力する取込用シート（アプリは書き換えない。取り込み後は見出し以外を空にする） */
const IMPORT_SHEET = '名簿取込';
const CHUNK = 40000; // 1セル5万文字の上限より小さく分割
const SESSION_SECONDS = 6 * 60 * 60;
const DEFAULT_PASSWORD = 'soltilo123';

/** サーバーに保存する生徒（パスワードはハッシュのみ） */
type StoredStudent = Student & { passwordHash?: string };
type StoredState = AppState & { students: StoredStudent[] };

interface Session {
  role: 'parent' | 'admin';
  studentIds: string[];
}

// ---------- 保存 ----------

const ss = () => SpreadsheetApp.getActiveSpreadsheet();

const getOrCreateSheet = (name: string) => ss().getSheetByName(name) || ss().insertSheet(name);

const emptyState = (): StoredState => ({
  students: [],
  absences: [],
  bookings: [],
  overrides: [],
  weekdayQuotas: INITIAL_WEEKDAY_QUOTAS,
  specialDays: [],
  codmonSyncLogs: []
});

export const loadState = (): StoredState => {
  const sheet = ss().getSheetByName(DATA_SHEET);
  if (!sheet || sheet.getLastRow() === 0) return emptyState();
  const values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  const json = values.map((r) => String(r[0] ?? '')).join('');
  if (!json) return emptyState();
  return { ...emptyState(), ...JSON.parse(json) };
};

export const saveState = (state: StoredState) => {
  const sheet = getOrCreateSheet(DATA_SHEET);
  const json = JSON.stringify(state);
  const chunks: string[][] = [];
  for (let i = 0; i < json.length; i += CHUNK) chunks.push([json.slice(i, i + CHUNK)]);
  sheet.clearContents();
  if (chunks.length) sheet.getRange(1, 1, chunks.length, 1).setValues(chunks);
  sheet.hideSheet();
  writeReadableSheets(state);
};

/** 職員向けの見やすいシート（アプリ → シートの一方向。編集はアプリまたは「生徒マスタ」読み込みで） */
const writeReadableSheets = (state: StoredState) => {
  const students = state.students.map(stripSecrets);
  const write = (name: string, rows: (string | number)[][]) => {
    const sheet = getOrCreateSheet(name);
    sheet.clearContents();
    if (rows.length) sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    sheet.setFrozenRows(1);
  };
  write(SHEET_TITLES.students, buildStudentRows(students));
  write(SHEET_TITLES.absences, buildAbsenceRows(state.absences, state.bookings));
  write(SHEET_TITLES.bookings, buildBookingRows(state.absences, state.bookings));
};

/** 読み込み時に期限切れ・祝日付与の処理をして、変化があれば保存 */
const loadMaintained = (): StoredState => {
  const state = loadState();
  const result = runMaintenance(state);
  if (result.changed) saveState(result.state as StoredState);
  return result.state as StoredState;
};

const withLock = <T>(fn: () => T): T => {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
};

// ---------- 認証 ----------

const props = () => PropertiesService.getScriptProperties();

const getSalt = () => {
  let salt = props().getProperty('PASSWORD_SALT');
  if (!salt) {
    salt = Utilities.getUuid();
    props().setProperty('PASSWORD_SALT', salt);
  }
  return salt;
};

export const hashPassword = (password: string) =>
  Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, getSalt() + password, Utilities.Charset.UTF_8)
    .map((b) => ((b + 256) % 256).toString(16).padStart(2, '0'))
    .join('');

const stripSecrets = (s: StoredStudent): Student => {
  const { passwordHash: _h, password: _p, ...rest } = s;
  return rest;
};

const newSession = (session: Session) => {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(`session_${token}`, JSON.stringify(session), SESSION_SECONDS);
  return token;
};

const getSession = (token: unknown): Session | null => {
  if (typeof token !== 'string' || !token) return null;
  const raw = CacheService.getScriptCache().get(`session_${token}`);
  return raw ? (JSON.parse(raw) as Session) : null;
};

/** パスワード照合。未設定（ハッシュも平文もない）の生徒は初期パスワードで照合する */
const passwordMatches = (s: StoredStudent, password: string) => {
  if (s.passwordHash) return s.passwordHash === hashPassword(password);
  return (s.password || DEFAULT_PASSWORD) === password;
};

// ---------- 保護者向けのデータ絞り込み ----------

/**
 * 家族の生徒は全情報、それ以外は空き枠計算に必要な最小限（クラス・曜日・日付）だけを匿名IDで返す。
 * 他家庭の欠席・振替は昨日以降のもののみ。
 */
export const filterForFamily = (state: StoredState, familyIds: string[]): AppState => {
  const family = new Set(familyIds);
  const anon = new Map<string, string>();
  const anonId = (id: string) => {
    if (!anon.has(id)) anon.set(id, `x${anon.size + 1}`);
    return anon.get(id)!;
  };
  const since = addDaysToDateString(getTodayString(), -1);

  const students: Student[] = state.students.map((s) =>
    family.has(s.id)
      ? stripSecrets(s)
      : {
          id: anonId(s.id),
          name: '',
          classId: s.classId,
          regularDays: s.regularDays,
          transferBalance: 0,
          parentName: '',
          contactEmail: ''
        }
  );
  const absences: AbsenceRecord[] = state.absences
    .filter((a) => family.has(a.studentId) || a.date >= since)
    .map((a) =>
      family.has(a.studentId)
        ? a
        : {
            id: anonId(a.id),
            studentId: anonId(a.studentId),
            studentName: '',
            classId: a.classId,
            date: a.date,
            reason: '',
            reportedAt: '',
            status: a.status,
            creditGranted: a.creditGranted
          }
    );
  const bookings: TransferBooking[] = state.bookings
    .filter((b) => family.has(b.studentId) || b.targetDate >= since)
    .map((b) =>
      family.has(b.studentId)
        ? b
        : {
            id: anonId(b.id),
            studentId: anonId(b.studentId),
            studentName: '',
            fromClassId: b.fromClassId,
            targetClassId: b.targetClassId,
            targetDate: b.targetDate,
            bookedAt: '',
            status: b.status
          }
    );
  return {
    students,
    absences,
    bookings,
    overrides: state.overrides,
    weekdayQuotas: state.weekdayQuotas,
    specialDays: state.specialDays,
    codmonSyncLogs: []
  };
};

const forAdmin = (state: StoredState): AppState => ({ ...state, students: state.students.map(stripSecrets) });

// ---------- API ----------

type Req = Record<string, unknown> & { action?: string };
type Res = Record<string, unknown>;

const err = (code: string, params: Record<string, string> = {}): Res => ({
  ok: false,
  code,
  params,
  message: operationErrorMessage(code, params)
});

const requireParent = (req: Req): Session | null => {
  const s = getSession(req.token);
  return s && s.role === 'parent' ? s : null;
};
const requireAdmin = (req: Req): Session | null => {
  const s = getSession(req.token);
  return s && s.role === 'admin' ? s : null;
};

/** 保護者の操作: 自分の家族の生徒に対するものだけ許可し、結果を保存して家族分を返す */
const parentMutation = (
  req: Req,
  studentId: string | null,
  op: (state: StoredState) => OperationResult
): Res => {
  const session = requireParent(req);
  if (!session) return err('session_expired');
  if (studentId !== null && !session.studentIds.includes(studentId)) return err('forbidden');
  return withLock(() => {
    const state = loadMaintained();
    const result = op(state);
    if (!result.ok) {
      const failure = result as Extract<OperationResult, { ok: false }>;
      return err(failure.code, failure.params);
    }
    saveState(result.state as StoredState);
    return { ok: true, data: filterForFamily(result.state as StoredState, session.studentIds) };
  });
};

export const handle = (req: Req): Res => {
  switch (req.action) {
    case 'parentLogin': {
      const loginId = String(req.loginId ?? '').trim().toLowerCase();
      const password = String(req.password ?? '');
      const state = loadMaintained();
      const student = state.students.find((s) => (s.loginId || '').toLowerCase() === loginId);
      if (!student || !passwordMatches(student, password)) return err('invalid_credentials');
      const ids = familyStudentIds(state.students, student.id);
      const token = newSession({ role: 'parent', studentIds: ids });
      return { ok: true, token, studentId: student.id, data: filterForFamily(state, ids) };
    }
    case 'parentGetData': {
      const session = requireParent(req);
      if (!session) return err('session_expired');
      return { ok: true, data: filterForFamily(loadMaintained(), session.studentIds) };
    }
    case 'parentReportAbsence': {
      const input = (req.input || {}) as { studentId: string; date: string; reason: string };
      return parentMutation(req, input.studentId, (state) => reportAbsence(state, input));
    }
    case 'parentBookTransfer': {
      const input = (req.input || {}) as { studentId: string; targetDate: string };
      return parentMutation(req, input.studentId, (state) =>
        bookTransfer(state, { studentId: input.studentId, targetDate: input.targetDate })
      );
    }
    case 'parentCancelBooking': {
      const bookingId = String(req.bookingId ?? '');
      const session = requireParent(req);
      if (!session) return err('session_expired');
      const owner = loadState().bookings.find((b) => b.id === bookingId)?.studentId ?? '';
      return parentMutation(req, owner, (state) => cancelBooking(state, bookingId));
    }
    case 'parentCancelAbsence': {
      const absenceId = String(req.absenceId ?? '');
      const session = requireParent(req);
      if (!session) return err('session_expired');
      const target = loadState().absences.find((a) => a.id === absenceId);
      // 保護者が取り消せるのは今日以降の欠席のみ（過去分は管理者が対応）
      if (target && target.date < getTodayString()) return err('forbidden');
      return parentMutation(req, target?.studentId ?? '', (state) => cancelAbsence(state, absenceId));
    }
    case 'parentChangeCredentials': {
      const input = (req.input || {}) as { studentId: string; newLoginId: string; newPassword: string };
      const newLoginId = String(input.newLoginId ?? '').trim();
      const newPassword = String(input.newPassword ?? '');
      if (!newLoginId || newPassword.length < 6) return err('invalid_input');
      return parentMutation(req, input.studentId, (state) => {
        if (state.students.some((s) => s.id !== input.studentId && (s.loginId || '').toLowerCase() === newLoginId.toLowerCase())) {
          return { ok: false, code: 'login_id_taken' };
        }
        return {
          ok: true,
          state: {
            ...state,
            students: state.students.map((s) =>
              s.id === input.studentId
                ? { ...s, loginId: newLoginId, passwordHash: hashPassword(newPassword), password: undefined, isDefaultPassword: false }
                : s
            )
          }
        };
      });
    }

    case 'adminLogin': {
      const expected = props().getProperty('ADMIN_PASSWORD');
      if (!expected) return err('admin_password_not_set');
      if (String(req.password ?? '') !== expected) return err('invalid_credentials');
      const token = newSession({ role: 'admin', studentIds: [] });
      return { ok: true, token, data: forAdmin(loadMaintained()), spreadsheetUrl: ss().getUrl() };
    }
    case 'adminGetData': {
      if (!requireAdmin(req)) return err('session_expired');
      return { ok: true, data: forAdmin(loadMaintained()), spreadsheetUrl: ss().getUrl() };
    }
    case 'adminSync': {
      if (!requireAdmin(req)) return err('session_expired');
      const changes = req.changes as ChangeSet;
      return withLock(() => {
        const current = loadState();
        // 画面にはパスワードを渡していないため、差分の生徒レコードにも無い。保存済みのものを引き継ぐ
        const secrets = new Map(current.students.map((s: StoredStudent) => [s.id, { passwordHash: s.passwordHash, password: s.password }]));
        const result = applyChanges(forAdmin(current), changes);
        const students: StoredStudent[] = result.state.students.map((s) => ({ ...s, ...(secrets.get(s.id) || {}) }));
        const next: StoredState = { ...result.state, students };
        if (result.applied > 0) saveState(next);
        return { ok: true, data: forAdmin(next), conflicts: result.conflicts };
      });
    }
    case 'adminImportFromSheet': {
      if (!requireAdmin(req)) return err('session_expired');
      return withLock(() => {
        const state = loadState();
        const sheet = ss().getSheetByName(IMPORT_SHEET);
        const values = sheet ? (sheet.getDataRange().getValues() as string[][]) : [];
        const merged = mergeStudentsFromSheet(forAdmin(state).students, parseStudentMasterRows(values));
        const secrets = new Map(state.students.map((s: StoredStudent) => [s.id, { passwordHash: s.passwordHash, password: s.password }]));
        const next: StoredState = {
          ...state,
          students: merged.students.map((s) => ({ ...s, ...(secrets.get(s.id) || {}) }))
        };
        if (merged.added + merged.updated > 0) saveState(next);
        // 同じ行を二度取り込んで残数などを巻き戻さないよう、見出し以外を空にする
        if (sheet && values.length > 1) {
          sheet.clearContents();
          sheet.getRange(1, 1, 1, values[0].length).setValues([values[0]]);
        }
        return { ok: true, data: forAdmin(next), added: merged.added, updated: merged.updated, warnings: merged.warnings };
      });
    }
    default:
      return err('unknown_action');
  }
};

// ---------- GAS のエントリーポイント ----------

const json = (body: Res) => ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);

export const doPost = (e: GoogleAppsScript.Events.DoPost) => {
  try {
    const req = JSON.parse(e.postData.contents) as Req;
    return json(handle(req));
  } catch (error) {
    console.error(error);
    return json(err('server_error'));
  }
};

export const doGet = () => json({ ok: true, service: 'sgas-furikae', time: new Date().toISOString() });

const ensureImportSheet = () => {
  if (ss().getSheetByName(IMPORT_SHEET)) return;
  const sheet = ss().insertSheet(IMPORT_SHEET);
  sheet.getRange(1, 1, 1, 6).setValues([['ID（既存の生徒を更新する場合のみ）', '氏名 (名前 (英語))', 'クラス', '通塾曜日', 'チケット残数', '備考']]);
  sheet.setFrozenRows(1);
};

/** 初回のみ実行: サンプルデータ（架空の生徒）で始める。テスト用 */
export const setupWithSampleData = () =>
  withLock(() => {
    getSalt();
    ensureImportSheet();
    const sample = runMaintenance({
      students: INITIAL_STUDENTS.map(({ password: _p, ...s }) => s),
      absences: INITIAL_ABSENCES,
      bookings: INITIAL_BOOKINGS,
      overrides: [],
      weekdayQuotas: INITIAL_WEEKDAY_QUOTAS,
      specialDays: INITIAL_SPECIAL_DAYS,
      codmonSyncLogs: []
    }).state;
    saveState(sample as StoredState);
    return 'サンプルデータで初期化しました';
  });

/** 本番開始時に実行: 空の名簿で始める（既存データは消える） */
export const setupEmpty = () =>
  withLock(() => {
    getSalt();
    ensureImportSheet();
    saveState(emptyState());
    return '空の状態で初期化しました';
  });
