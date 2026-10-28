import { Student, AbsenceRecord, TransferBooking, ClassId } from '../types';
import { SOLTILO_CLASSES } from '../data/constants';
import { calculateExpiryDate } from './expiration';
import { toLocalDateString } from './dateUtils';

export interface CodmonStudentParsedRow {
  name: string;
  className: string;
  matchedClassId: ClassId;
  regularDaysStr: string;
  regularDays: number[];
  parentName: string;
  contactEmail: string;
  transferBalance: number;
  loginId?: string;
  status: 'new' | 'update' | 'valid' | 'warning';
  warnings: string[];
}

export interface CodmonAbsenceParsedRow {
  date: string; // YYYY-MM-DD
  studentName: string;
  matchedStudentId?: string;
  matchedStudent?: Student;
  reason: string;
  status: 'ready' | 'student_not_found' | 'already_registered' | 'invalid_date';
  message: string;
}

/**
 * Parses raw CSV or TSV (copied from Excel/Notepad/CoDMON) into 2D array
 */
export function parseRawDelimitedText(rawText: string): string[][] {
  const clean = rawText.trim();
  if (!clean) return [];

  const lines = clean.split(/\r\n|\n|\r/);
  const rows: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // Detect TSV vs CSV
    const isTab = line.includes('\t');
    if (isTab) {
      rows.push(line.split('\t').map((c) => c.trim().replace(/^["']|["']$/g, '')));
    } else {
      // Standard CSV parsing with quote awareness
      const row: string[] = [];
      let insideQuote = false;
      let cell = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          row.push(cell.trim().replace(/^["']|["']$/g, ''));
          cell = '';
        } else {
          cell += char;
        }
      }
      row.push(cell.trim().replace(/^["']|["']$/g, ''));
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Intelligent Column Detection for CoDMON Student exports
 */
export function detectStudentHeaders(headerRow: string[]) {
  const lower = headerRow.map((h) => h.toLowerCase().replace(/\s+/g, ''));

  const findIndex = (keywords: string[]) => {
    return lower.findIndex((col) =>
      keywords.some((kw) => col.includes(kw.toLowerCase()))
    );
  };

  return {
    nameIdx: findIndex(['園児名', '児童名', '生徒名', '氏名', '名前', 'student', 'name', 'フルネーム']),
    kanaIdx: findIndex(['ふりがな', 'フリガナ', 'かな', 'kana']),
    classIdx: findIndex(['クラス', '学年', '所属', 'コース', 'class', 'grade']),
    daysIdx: findIndex(['曜日', '受講曜日', '通学曜日', 'グループ', '利用曜日', 'days', 'day']),
    parentIdx: findIndex(['保護者', '保護者氏名', '保護者名', '世帯主', 'parent', 'guardian']),
    emailIdx: findIndex(['メール', 'mail', 'email', '連絡先', '電話', 'tel']),
    balanceIdx: findIndex(['振替残', '残数', 'チケット', 'balance', '残り'])
  };
}

/**
 * クラス表記（EX1/EX2/Kin/Ele1/Ele2 と旧表記）を ClassId に変換する。該当なしは null
 */
export function matchClassIdOrNull(rawText: string): ClassId | null {
  // 生徒名（例: Akina）に部分一致しないよう、英字の前後は単語境界で判定する
  const t = rawText.toLowerCase();
  if (/(?<![a-z])ele(?:mentary)?\s*-?\s*2(?![0-9])|エレメンタリー\s*2/.test(t)) return 'ele2';
  if (/(?<![a-z])ele(?:mentary)?\s*-?\s*1(?![0-9])|エレメンタリー\s*1/.test(t)) return 'ele1';
  if (/(?<![a-z])ex(?:tension)?\s*-?\s*2(?![0-9])|エクステンション\s*2/.test(t)) return 'ex2';
  if (/(?<![a-z])ex(?:tension)?\s*-?\s*1(?![0-9])|(?<![a-z])extension(?![a-z])|エクステンション/.test(t)) return 'ex1';
  if (/(?<![a-z])kin(?:der)?(?![a-z])|キンダー/.test(t)) return 'kin';
  // 旧表記 E1 / E2（引き継ぎ書のクラスID）
  if (/(?<![a-z])e\s*-?\s*2(?![0-9])/.test(t)) return 'ele2';
  if (/(?<![a-z])e\s*-?\s*1(?![0-9])/.test(t)) return 'ele1';
  return null;
}

/**
 * Matches raw class text to SOLTILO ClassId（該当なしは EX1）
 */
export function matchClassId(rawText: string): ClassId {
  return matchClassIdOrNull(rawText) ?? 'ex1';
}

/**
 * Parses Japanese or English days of week into number array [1..5]
 * 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
 */
export function parseDaysOfWeek(raw: string): number[] {
  const clean = raw.toLowerCase();
  const days: number[] = [];

  const map: Record<string, number> = {
    '月': 1, 'mon': 1, 'monday': 1, '1': 1,
    '火': 2, 'tue': 2, 'tuesday': 2, '2': 2,
    '水': 3, 'wed': 3, 'wednesday': 3, '3': 3,
    '木': 4, 'thu': 4, 'thursday': 4, '4': 4,
    '金': 5, 'fri': 5, 'friday': 5, '5': 5,
    '土': 6, 'sat': 6, 'saturday': 6, '6': 6,
    '日': 0, 'sun': 0, 'sunday': 0, '0': 0
  };

  // Check substrings
  if (clean.includes('月') || clean.includes('mon')) days.push(1);
  if (clean.includes('火') || clean.includes('tue')) days.push(2);
  if (clean.includes('水') || clean.includes('wed')) days.push(3);
  if (clean.includes('木') || clean.includes('thu')) days.push(4);
  if (clean.includes('金') || clean.includes('fri')) days.push(5);

  if (days.length === 0) {
    // Try comma/space separation
    const tokens = clean.split(/[,、\s/・+]+/);
    for (const tok of tokens) {
      if (map[tok] !== undefined && !days.includes(map[tok])) {
        days.push(map[tok]);
      }
    }
  }

  // Default if completely empty: Mon & Wed
  return days.length > 0 ? Array.from(new Set(days)).sort() : [1, 3];
}

/**
 * Format day numbers to readable Japanese (e.g., "月・水")
 */
export function formatDayNumbers(days: number[]): string {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  return days.map((d) => dayNames[d] || `${d}`).join('・');
}

/**
 * Parse Student CSV/TSV from CoDMON
 */
export function parseCodmonStudents(rawText: string, existingStudents: Student[]): CodmonStudentParsedRow[] {
  const rows = parseRawDelimitedText(rawText);
  if (rows.length === 0) return [];

  // Determine if first row is header
  let startIndex = 0;
  const header = rows[0];
  const indices = detectStudentHeaders(header);

  // If at least one header matched, skip row 0
  if (indices.nameIdx !== -1 || indices.classIdx !== -1 || indices.daysIdx !== -1) {
    startIndex = 1;
  } else {
    // Default indices if no explicit header
    indices.nameIdx = 0;
    indices.classIdx = 1;
    indices.daysIdx = 2;
    indices.parentIdx = 3;
    indices.emailIdx = 4;
  }

  const results: CodmonStudentParsedRow[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[indices.nameIdx !== -1 ? indices.nameIdx : 0]) continue;

    const rawName = (indices.nameIdx !== -1 ? row[indices.nameIdx] : row[0]) || '';
    if (!rawName.trim()) continue;

    const rawClass = (indices.classIdx !== -1 && row[indices.classIdx] ? row[indices.classIdx] : 'EX1') || 'EX1';
    const rawDays = (indices.daysIdx !== -1 && row[indices.daysIdx] ? row[indices.daysIdx] : '月・水') || '月・水';
    const rawParent = (indices.parentIdx !== -1 && row[indices.parentIdx] ? row[indices.parentIdx] : '') || `${rawName.split(/\s+/)[0] || '保護者'} 様`;
    const rawEmail = (indices.emailIdx !== -1 && row[indices.emailIdx] ? row[indices.emailIdx] : '') || 'parent@example.com';
    const rawBalance = (indices.balanceIdx !== -1 && row[indices.balanceIdx] ? parseInt(row[indices.balanceIdx], 10) : 0);

    const matchedClass = matchClassId(rawClass);
    const parsedDays = parseDaysOfWeek(rawDays);
    const warnings: string[] = [];

    // Check if student exists
    const cleanName = rawName.trim().replace(/\s+/g, ' ');
    const existing = existingStudents.find(
      (s) => s.name.replace(/\s+/g, '').includes(cleanName.replace(/\s+/g, '')) ||
             cleanName.replace(/\s+/g, '').includes(s.name.replace(/\s+/g, ''))
    );

    const status: 'new' | 'update' | 'valid' = existing ? 'update' : 'new';

    results.push({
      name: cleanName,
      className: rawClass,
      matchedClassId: matchedClass,
      regularDaysStr: formatDayNumbers(parsedDays),
      regularDays: parsedDays,
      parentName: rawParent,
      contactEmail: rawEmail,
      transferBalance: isNaN(rawBalance) ? 0 : Math.max(0, rawBalance),
      status,
      warnings
    });
  }

  return results;
}

/**
 * Intelligent Column Detection for CoDMON Absence & Attendance records
 */
export function detectAbsenceHeaders(headerRow: string[]) {
  const lower = headerRow.map((h) => h.toLowerCase().replace(/\s+/g, ''));

  const findIndex = (keywords: string[]) => {
    return lower.findIndex((col) =>
      keywords.some((kw) => col.includes(kw.toLowerCase()))
    );
  };

  return {
    dateIdx: findIndex(['日付', '年月日', '欠席日', '対象日', 'date', '日時']),
    nameIdx: findIndex(['園児名', '児童名', '生徒名', '氏名', '名前', 'student', 'name']),
    reasonIdx: findIndex(['理由', '欠席理由', '事由', '内容', '連絡内容', 'reason', 'memo', '備考'])
  };
}

/**
 * Normalize Date String to YYYY-MM-DD
 */
export function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  const clean = raw.trim();

  // Try YYYY/MM/DD, YYYY-MM-DD, YYYY年MM月DD日
  const match1 = clean.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})[日]?/);
  if (match1) {
    const y = match1[1];
    const m = match1[2].padStart(2, '0');
    const d = match1[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Try MM/DD or MM月DD日 (assume current year)
  const match2 = clean.match(/^(\d{1,2})[-/月](\d{1,2})[日]?/);
  if (match2) {
    const y = new Date().getFullYear();
    const m = match2[1].padStart(2, '0');
    const d = match2[2].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Parse Absence CSV/TSV from CoDMON
 */
export function parseCodmonAbsences(
  rawText: string,
  students: Student[],
  existingAbsences: AbsenceRecord[]
): CodmonAbsenceParsedRow[] {
  const rows = parseRawDelimitedText(rawText);
  if (rows.length === 0) return [];

  let startIndex = 0;
  const header = rows[0];
  const indices = detectAbsenceHeaders(header);

  if (indices.dateIdx !== -1 || indices.nameIdx !== -1) {
    startIndex = 1;
  } else {
    indices.dateIdx = 0;
    indices.nameIdx = 1;
    indices.reasonIdx = 2;
  }

  const results: CodmonAbsenceParsedRow[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawDate = (indices.dateIdx !== -1 ? row[indices.dateIdx] : row[0]) || '';
    const rawName = (indices.nameIdx !== -1 ? row[indices.nameIdx] : row[1]) || '';
    const rawReason = (indices.reasonIdx !== -1 && row[indices.reasonIdx] ? row[indices.reasonIdx] : 'コドモン欠席連絡') || 'コドモン欠席連絡';

    if (!rawDate.trim() && !rawName.trim()) continue;

    const dateStr = normalizeDate(rawDate);
    if (!dateStr) {
      results.push({
        date: rawDate,
        studentName: rawName,
        reason: rawReason,
        status: 'invalid_date',
        message: '日付形式が無効です（例: 2026-08-20 または 8/20）'
      });
      continue;
    }

    const cleanName = rawName.trim().replace(/\s+/g, '');
    const student = students.find(
      (s) => s.name.replace(/\s+/g, '').includes(cleanName) || cleanName.includes(s.name.replace(/\s+/g, ''))
    );

    if (!student) {
      results.push({
        date: dateStr,
        studentName: rawName,
        reason: rawReason,
        status: 'student_not_found',
        message: '該当する生徒がシステム内に見つかりません'
      });
      continue;
    }

    // Check if already registered
    const already = existingAbsences.some(
      (a) => a.studentId === student.id && a.date === dateStr && a.status === 'confirmed'
    );

    if (already) {
      results.push({
        date: dateStr,
        studentName: student.name,
        matchedStudentId: student.id,
        matchedStudent: student,
        reason: rawReason,
        status: 'already_registered',
        message: '既に欠席登録済みです（スキップ）'
      });
      continue;
    }

    results.push({
      date: dateStr,
      studentName: student.name,
      matchedStudentId: student.id,
      matchedStudent: student,
      reason: rawReason,
      status: 'ready',
      message: '取り込み準備完了（振替チケット+1付与）'
    });
  }

  return results;
}

// ==========================================
// DAILY SCREEN SMART FULL-PAGE PARSER
// ==========================================

export interface CodmonDailyAbsenceItem {
  id: string;
  studentId: string;
  studentName: string;
  classId: ClassId;
  date: string;
  reason: string;
  status: 'ready' | 'already_registered' | 'student_not_found';
  message: string;
  action: 'grant_ticket_and_absent';
  isNewStudent?: boolean;
  newStudentData?: Student;
}

export interface CodmonDailyTransferItem {
  id: string;
  studentId: string;
  studentName: string;
  fromClassId: ClassId;
  targetClassId: ClassId;
  date: string;
  targetDate: string;
  note: string;
  status: 'ready' | 'already_booked' | 'student_not_found';
  message: string;
  action: 'book_transfer';
  isNewStudent?: boolean;
  newStudentData?: Student;
}

export interface CodmonDailyRegularItem {
  studentId: string;
  studentName: string;
  classId: ClassId;
  date: string;
  status: 'present';
  timeInfo?: string;
  isNewStudent?: boolean;
  newStudentData?: Student;
}

export interface CodmonDailyUnmatchedItem {
  rawLine: string;
  reason: string;
}

export interface CodmonDailyParsedResult {
  detectedDate: string; // YYYY-MM-DD
  detectedDateLabel: string; // e.g. 2026年8月19日 (水)
  absences: CodmonDailyAbsenceItem[];
  transfers: CodmonDailyTransferItem[];
  regulars: CodmonDailyRegularItem[];
  unmatched: CodmonDailyUnmatchedItem[];
  newStudents: Student[];
  totalParsed: number;
  warnings: string[];
}

/**
 * Checks whether a given raw line is merely UI noise / status / time / allergen info rather than a real student name
 */
export function isNoiseLineOrToken(raw: string): boolean {
  if (!raw) return true;
  const line = raw.trim();
  if (line.length < 2) return true;

  // Pure numbers, times, percentages, degrees, symbols (e.g. 09:3009:3014:00 (母), 36.5℃, No.12)
  if (/^[\d\s:./~()（）度℃%#@\-+=_]+$/.test(line)) return true;
  if (/^\d{1,2}:\d{2}/.test(line)) return true;

  // Clean compact text for exact keyword checks
  const compact = line.replace(/[\s\u3000()（）:：/・,，.。\-+]/g, '');

  const exactNoiseSet = new Set([
    '全員',
    '所在確認の園児',
    '所在確認',
    '所在確認園児',
    '通常の園児',
    '通常の',
    '通常登園',
    '通常受講',
    '通常',
    '園児',
    '児童',
    '生徒',
    '日誌連絡帳',
    '日誌',
    '連絡帳',
    '連絡',
    '出欠状況',
    '出欠',
    '状況',
    '確認済',
    '未確認',
    '未対応',
    '対応中',
    '送信',
    '受信',
    '施設名',
    'クラス選択',
    '名前順',
    '登園',
    '降園',
    'お迎え',
    '延長',
    'バス',
    '徒歩',
    '保護者からの連絡',
    '保護者連絡',
    '保護者',
    'アレルギー情報',
    'アレルギーなし',
    'アレルギーあり',
    'アレルギー',
    '卵アレルギー',
    '乳アレルギー',
    '小麦アレルギー',
    'なし',
    'あり',
    '検温',
    '体温',
    '平熱',
    '発熱',
    '都合欠',
    '病欠',
    '私用',
    '風邪',
    '体調不良',
    'お休み',
    '欠席期間',
    '欠席',
    '振替受講',
    '振替希望',
    '振替',
    'ふりかえ',
    '今日まで',
    '明日まで',
    '今日',
    '明日'
  ]);

  if (exactNoiseSet.has(compact)) return true;

  // Header or instruction lines
  if (
    compact.includes('コドモン') ||
    compact.includes('出欠状況管理画面') ||
    compact.includes('出欠席一覧') ||
    compact.includes('対象日') ||
    compact.includes('連絡帳一覧') ||
    compact.includes('日誌一覧') ||
    compact.includes('未対応件') ||
    compact.includes('確認済件')
  ) {
    return true;
  }

  return false;
}

/** 欠席と判定するキーワード（引き継ぎ書 4.3 + コドモンの欠席種別） */
const ABSENCE_KEYWORDS = /欠席|都合欠|病欠|お休み|休みます|休みします|体調不良|発熱|風邪|家庭の都合|私用/;
/** 振替と判定するキーワード（「8/17分」「➡️」等の表記を含む） */
const TRANSFER_KEYWORDS = /振替|振り替え|ふりかえ|➡️|->|→/;

/** 日本語名と英語名の両方を持つか（コドモンの「名前 (英語)」登録形式） */
function looksLikeStudentName(kanjiName: string, romajiName: string): boolean {
  const jp = kanjiName.replace(/[\s\u3000]/g, '');
  return (
    /^[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff々ー]{2,12}$/.test(jp) &&
    /^[A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*)+$/.test(romajiName.trim())
  );
}

/** 生徒名の行か（ノイズでなく、「名前 (英語)」形式を含む） */
function isNameLine(line: string): boolean {
  if (isNoiseLineOrToken(line)) return false;
  const { kanjiName, romajiName } = extractCleanStudentNameParts(line);
  return looksLikeStudentName(kanjiName, romajiName);
}

/**
 * Clean and normalize names from CoDMON format (e.g. "Ren Sample サンプル 蓮", "サンプル 葵 Aoi Sample 卵アレルギー 09:30")
 * Strips away dates, allergies, numbers, and noise terms, producing strictly "名前 (英語)" format.
 */
export function extractCleanStudentNameParts(rawNameLine: string): {
  kanjiName: string;
  romajiName: string;
  combinedName: string;
} {
  let text = rawNameLine.trim();

  // 1. Remove timestamps like 09:3009:3014:00 (母), 14:0017:00 (父), 09:30~17:00
  text = text.replace(/\d{1,2}:\d{2}(?:\s*~?\s*\d{1,2}:\d{2})*(?:\s*[0-9:]+)?/g, ' ');

  // 2. Remove parent tag suffixes like (母), (父), （母）, （父）, (保護者)
  text = text.replace(/[\(（][母父祖父祖母保護者]+[\)）]/g, ' ');

  // 3. Remove temperatures like 36.5℃, 37.2度
  text = text.replace(/\d+(?:\.\d+)?\s*(?:℃|度)/g, ' ');

  // 4. Remove dates like 2026年8月19日, 8月19日(水), 8/19, 今日まで, 8/23まで
  text = text.replace(/\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/g, ' ');
  text = text.replace(/\d{1,2}\s*月\s*\d{1,2}\s*日(?:\s*[\(（][月火水木金土日][\)）])?/g, ' ');
  text = text.replace(/\d{1,2}\/\d{1,2}(?:\s*まで)?/g, ' ');
  text = text.replace(/(?:今日|明日)\s*まで/g, ' ');

  // 5. Remove UI noise and common status terms
  text = text.replace(/全員|所在確認の園児|所在確認|通常の園児|通常の|通常登園|通常受講|通常/g, ' ');
  text = text.replace(/日誌・連絡帳|日誌|連絡帳|出欠状況|出欠|状況|確認済|未確認|未対応|対応中|送信|受信|施設名|クラス選択|名前順/g, ' ');
  // 「卵アレルギー」のように前に付く原因食品名も一緒に除去する
  text = text.replace(/(?:[\u4e00-\u9faf\u30a0-\u30ffー・]{1,8})?アレルギー[：:\s]*(?:なし|あり|卵|乳|小麦|甲殻類|エビ|カニ|落花生|そば|ナッツ|[^\s()（）]+)?/g, ' ');
  text = text.replace(/アレルギーなし|アレルギーあり|アレルギー/g, ' ');
  text = text.replace(/検温|体温|平熱|発熱|都合欠|病欠|私用|風邪|体調不良|お休み|欠席期間|欠席|振替希望|振替受講|振替|ふりかえ/g, ' ');
  text = text.replace(/登園|降園|お迎え|延長|バス|徒歩/g, ' ');

  // 6. Remove stray numbers, hashes, and symbols
  text = text.replace(/No\.\s*\d+/gi, ' ');
  text = text.replace(/#\d+/g, ' ');
  text = text.replace(/\b\d{2,}\b/g, ' ');
  text = text.replace(/[0-9]+/g, ' ');

  // 7. Strip trailing and leading punctuation
  text = text.replace(/^[、,.\-/_:\s\u3000()（）]+|[、,.\-/_:\s\u3000()（）]+$/g, '').trim();

  if (!text || text.length < 2) {
    return { kanjiName: '', romajiName: '', combinedName: '' };
  }

  // 8. Extract English / Romaji Name (e.g. "Ren Sample" or "Aoi Sample")
  let romaji = '';
  // Check if English name is inside parenthesis: e.g. "サンプル 蓮 (Ren Sample)"
  const parenEnMatch = text.match(/[\(（]([a-zA-Z\s'.-]{2,35})[\)）]/);
  if (parenEnMatch) {
    romaji = parenEnMatch[1].trim();
    text = text.replace(parenEnMatch[0], ' ').trim();
  } else {
    // Check if there are English words
    const topEnMatch = text.match(/([a-zA-Z][a-zA-Z\s'.-]{1,35})/);
    if (topEnMatch) {
      romaji = topEnMatch[1].trim();
      text = text.replace(topEnMatch[0], ' ').trim();
    }
  }

  // 9. Extract Japanese Kanji / Kana Name (e.g. "サンプル 蓮" or "サンプル 葵")
  let kanji = '';
  const parenJpMatch = text.match(/[\(（]([\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff\s]{2,20})[\)）]/);
  if (parenJpMatch) {
    kanji = parenJpMatch[1].replace(/[\s\u3000]+/g, ' ').trim();
    text = text.replace(parenJpMatch[0], ' ').trim();
  }

  const remainingJp = text.match(/([\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff\s]{2,20})/);
  if (remainingJp) {
    const cleanJp = remainingJp[1].replace(/[\s\u3000]+/g, ' ').trim();
    if (!kanji) {
      kanji = cleanJp;
    } else if (cleanJp && !kanji.includes(cleanJp)) {
      kanji = `${kanji} ${cleanJp}`;
    }
  }

  // If Kanji contains noise words remaining, strip them
  if (kanji) {
    kanji = kanji.replace(/全員|所在確認|通常|日誌|連絡帳|アレルギー|出欠|確認済|登園|降園/g, '').trim();
  }

  // 10. Format strictly as "名前（英語）"
  let combinedName = '';
  if (kanji && romaji) {
    combinedName = `${kanji} (${romaji})`;
  } else if (kanji) {
    combinedName = kanji;
  } else if (romaji) {
    combinedName = romaji;
  }

  return {
    kanjiName: kanji,
    romajiName: romaji,
    combinedName
  };
}

/**
 * Intelligent Daily Screen text analyzer:
 * Parses entire page text copied from CoDMON's Daily view (Ctrl+A -> Ctrl+C).
 * Handles huge pastes (100+ students, 50,000+ chars) instantly and accurately.
 * Supports:
 * - Tab-separated table rows (from table clipboard)
 * - Newline-separated sequential cell lists
 * - Parent message / unprocessed message cards (未対応 / 保護者からの連絡)
 * - Attendance & allergy tables
 */
export function parseCodmonDailyScreen(
  rawText: string,
  fallbackDateStr: string,
  students: Student[],
  existingAbsences: AbsenceRecord[],
  existingBookings: TransferBooking[]
): CodmonDailyParsedResult {
  const clean = rawText.trim();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  // 1. Detect target date from anywhere in the text (flexible multi-line support)
  let detectedDate = fallbackDateStr || toLocalDateString(new Date());

  // Try YYYY年 \n MM \n 月 \n DD \n 日 or standard YYYY年MM月DD日
  const multiLineDateMatch = clean.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (multiLineDateMatch) {
    const y = multiLineDateMatch[1];
    const m = multiLineDateMatch[2].padStart(2, '0');
    const d = multiLineDateMatch[3].padStart(2, '0');
    detectedDate = `${y}-${m}-${d}`;
  } else {
    // Try e.g. "8月19日(水)の連絡" or "8月19日"
    const monthDayMatch = clean.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:\s*[\(（][月火水木金土日][\)）])?/);
    if (monthDayMatch) {
      const yearMatch = clean.match(/\b(202[4-9])\b/);
      const y = yearMatch ? yearMatch[1] : (fallbackDateStr ? fallbackDateStr.substring(0, 4) : '2026');
      const m = monthDayMatch[1].padStart(2, '0');
      const d = monthDayMatch[2].padStart(2, '0');
      detectedDate = `${y}-${m}-${d}`;
    } else {
      // Try YYYY/MM/DD or YYYY-MM-DD
      const isoMatch = clean.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (isoMatch) {
        const y = isoMatch[1];
        const m = isoMatch[2].padStart(2, '0');
        const d = isoMatch[3].padStart(2, '0');
        detectedDate = `${y}-${m}-${d}`;
      }
    }
  }

  const dObj = new Date(detectedDate + 'T00:00:00');
  const dWeekday = isNaN(dObj.getTime()) ? 3 : dObj.getDay();
  const detectedDateLabel = `${detectedDate} (${dayNames[dWeekday]}曜)`;

  const absences: CodmonDailyAbsenceItem[] = [];
  const transfers: CodmonDailyTransferItem[] = [];
  const regulars: CodmonDailyRegularItem[] = [];
  const unmatched: CodmonDailyUnmatchedItem[] = [];
  const newStudentsMap = new Map<string, Student>();
  const warnings: string[] = [];

  // Helper to find or synthesize student strictly in "名前（英語）" format
  const resolveStudent = (nameToken: string): { student: Student; isNew: boolean } | null => {
    if (!nameToken) return null;
    if (isNoiseLineOrToken(nameToken)) return null;

    const { kanjiName, romajiName, combinedName } = extractCleanStudentNameParts(nameToken);
    if (!combinedName || combinedName.length < 2) return null;

    const cleanToken = nameToken.replace(/[\s\u3000()（）]+/g, '').toLowerCase();
    const cleanKanji = kanjiName.replace(/[\s\u3000()（）]+/g, '').toLowerCase();
    const cleanRomaji = romajiName.replace(/\s+/g, '').toLowerCase();

    // 1. Search in existing students（完全一致を優先し、その後に部分一致）
    const normalize = (v: string) => v.replace(/[\s\u3000()（）]+/g, '').toLowerCase();
    const exact = students.find((s) => {
      const parts = extractCleanStudentNameParts(s.name);
      return (
        normalize(s.name) === normalize(combinedName) ||
        (cleanKanji.length >= 2 && normalize(parts.kanjiName) === cleanKanji) ||
        (cleanRomaji.length >= 3 && parts.romajiName.replace(/\s+/g, '').toLowerCase() === cleanRomaji)
      );
    });
    if (exact) return { student: exact, isNew: false };

    for (const s of students) {
      const sNameClean = s.name.replace(/[\s\u3000()（）]+/g, '').toLowerCase();
      if (
        (cleanKanji.length >= 2 && sNameClean.includes(cleanKanji)) ||
        (cleanRomaji.length >= 3 && sNameClean.includes(cleanRomaji)) ||
        (cleanToken.length >= 2 && sNameClean.includes(cleanToken)) ||
        (sNameClean.length >= 2 && cleanToken.includes(sNameClean))
      ) {
        return { student: s, isNew: false };
      }
    }

    // 2. Search in newly created students during this parse
    if (newStudentsMap.has(combinedName)) {
      return { student: newStudentsMap.get(combinedName)!, isNew: true };
    }

    // 3. 名簿にない場合、「名前 (英語)」形式（日本語名と英語名の両方がある行）のときだけ新規生徒とみなす。
    //    見出し・保護者メッセージ・アレルギー欄などを誤って生徒登録しないため
    if (!looksLikeStudentName(kanjiName, romajiName)) return null;

    // Synthesize a new student record strictly in "名前 (英語)" format
    const safeKey = (romajiName || kanjiName || 'std').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'std';
    const newId = `std_codmon_${safeKey.toLowerCase()}_${Date.now() % 100000}_${Math.floor(Math.random() * 1000)}`;

    // Guess class based on keywords
    const classId: ClassId = matchClassId(nameToken);

    const synthesized: Student = {
      id: newId,
      name: combinedName, // Clean "名前（英語）"
      classId,
      regularDays: [dWeekday],
      transferBalance: 0,
      parentName: (kanjiName || romajiName) + ' 保護者',
      contactEmail: 'parent@example.com',
      loginId: `codmon_${safeKey.toLowerCase() || 'student'}`,
      password: 'soltilo123',
      isDefaultPassword: true
    };

    newStudentsMap.set(combinedName, synthesized);
    return { student: synthesized, isNew: true };
  };

  const processedAbsenceStudentIds = new Set<string>();
  const processedTransferStudentIds = new Set<string>();
  const processedRegularStudentIds = new Set<string>();

  // Split into raw lines
  const allLines = clean.split(/\r\n|\n|\r/).map((l) => l.trim()).filter((l) => l.length > 0);

  // i 行目の生徒に属する後続行（次の生徒名の行・表の見出し行の手前まで、最大3行）
  const followingLines = (i: number): string[] => {
    const result: string[] = [];
    for (let j = i + 1; j < allLines.length && result.length < 3; j++) {
      const line = allLines[j];
      if (isNameLine(line) || /^名前\t|^欠席\t/.test(line)) break;
      result.push(line);
    }
    return result;
  };

  // =========================================================================
  // PASS 1: TAB-SEPARATED ROWS & DIRECT LINE-LEVEL ABSENCES / TRANSFERS
  // =========================================================================
  for (let i = 0; i < allLines.length; i++) {
    const rawLine = allLines[i];
    if (isNoiseLineOrToken(rawLine)) continue;

    // Check if line contains tab characters (e.g. from table copy)
    const isTabbed = rawLine.includes('\t');
    const cols = isTabbed ? rawLine.split('\t').map((c) => c.trim()).filter((c) => c.length > 0) : [rawLine];

    const ctx = followingLines(i);
    const ctxText = ctx.join(' ');

    // Determine if this row or surrounding context represents an Absence
    const hasAbsenceKeyword = ABSENCE_KEYWORDS.test(rawLine) || ABSENCE_KEYWORDS.test(ctxText) || /まで/.test(ctxText);

    // Determine if this row represents a Transfer
    const hasTransferKeyword = TRANSFER_KEYWORDS.test(rawLine) || TRANSFER_KEYWORDS.test(ctxText);

    // Candidate student token
    const candidateNameToken = isTabbed ? cols[0] : rawLine;
    const resolved = resolveStudent(candidateNameToken);

    if (resolved) {
      const { student, isNew } = resolved;

      // 1. If Transfer
      if (hasTransferKeyword && !processedTransferStudentIds.has(student.id)) {
        processedTransferStudentIds.add(student.id);

        const alreadyBooked = existingBookings.some(
          (b) => b.studentId === student.id && b.targetDate === detectedDate && b.status === 'booked'
        );

        let note = 'コドモン連絡より振替受講';
        const contextStr = `${rawLine} ${ctxText}`;
        const arrowMatch = contextStr.match(/(\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2})\s*(?:➡️|->|→|分)\s*(?:➡️|->|→)?\s*(\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}|本日)/);
        if (arrowMatch) {
          note = arrowMatch[0];
        }

        transfers.push({
          id: `daily_tb_${student.id}_${detectedDate}`,
          studentId: student.id,
          studentName: student.name,
          fromClassId: student.classId,
          targetClassId: student.classId,
          date: detectedDate,
          targetDate: detectedDate,
          note,
          status: alreadyBooked ? 'already_booked' : 'ready',
          message: alreadyBooked
            ? '既にこの日に振替予約が登録されています（スキップ）'
            : isNew
            ? '新規生徒として名簿登録し、振替予約を登録します（振替残数 -1回）'
            : '振替受講として予約登録します（振替残数 -1回）',
          action: 'book_transfer',
          isNewStudent: isNew,
          newStudentData: isNew ? student : undefined
        });
        continue;
      }

      // 2. If Absence
      if (hasAbsenceKeyword && !processedAbsenceStudentIds.has(student.id)) {
        processedAbsenceStudentIds.add(student.id);

        const alreadyAbsence = existingAbsences.some(
          (a) => a.studentId === student.id && a.date === detectedDate && a.status === 'confirmed'
        );

        let reason = 'コドモン欠席連絡 (都合欠)';
        if (rawLine.includes('病欠') || ctxText.includes('病欠')) {
          reason = '体調不良 (病欠)';
        }

        const msgCandidate = isTabbed ? cols[cols.length - 1] : ctx[2] || '';
        if (msgCandidate && msgCandidate.length > 5 && !msgCandidate.includes('日誌') && !msgCandidate.includes('名前')) {
          reason = msgCandidate.slice(0, 45);
        }

        absences.push({
          id: `daily_abs_${student.id}_${detectedDate}`,
          studentId: student.id,
          studentName: student.name,
          classId: student.classId,
          date: detectedDate,
          reason,
          status: alreadyAbsence ? 'already_registered' : 'ready',
          message: alreadyAbsence
            ? '既に欠席登録済みです（スキップ）'
            : isNew
            ? '新規生徒として名簿登録し、欠席登録＆チケット(+1)付与します'
            : '欠席登録し、振替チケット(+1)を自動付与します',
          action: 'grant_ticket_and_absent',
          isNewStudent: isNew,
          newStudentData: isNew ? student : undefined
        });
        continue;
      }

      // 3. If Attendance Table Row (followed by 日誌 or timestamp)
      const hasAttendanceMarker = /日誌|\d{2}:\d{2}/.test(rawLine) || /日誌|\d{2}:\d{2}/.test(ctxText);

      if (hasAttendanceMarker) {
        if (!processedAbsenceStudentIds.has(student.id) && !processedRegularStudentIds.has(student.id)) {
          processedRegularStudentIds.add(student.id);

          const timeLine = isTabbed ? cols.find((c) => /\d{2}:\d{2}/.test(c)) || '' : ctx.find((c) => /\d{2}:\d{2}/.test(c)) || '';

          regulars.push({
            studentId: student.id,
            studentName: student.name,
            classId: student.classId,
            date: detectedDate,
            status: 'present',
            timeInfo: timeLine.slice(0, 30),
            isNewStudent: isNew,
            newStudentData: isNew ? student : undefined
          });
        }
      }
    }
  }

  // =========================================================================
  // PASS 2: MULTI-LINE MESSAGE BLOCKS (保護者からの連絡 / 未対応一覧)
  // =========================================================================
  const messageBlocks = clean.split(/(?=(?<!\d)\d{1,2}月\d{1,2}日|(?:確認済|未対応|対応中))/);

  for (const block of messageBlocks) {
    if (block.length < 8) continue;
    // 日付・対応状況で始まるメッセージカードだけを対象にする（ページ全体を1ブロックとして誤判定しない）
    if (!/^\s*(?:\d{1,2}月\d{1,2}日|確認済|未対応|対応中)/.test(block)) continue;
    const blockLines = block.split(/\r\n|\n|\r/).map((l) => l.trim()).filter((l) => l.length > 0);

    for (const bLine of blockLines) {
      if (isNoiseLineOrToken(bLine)) continue;
      const resolved = resolveStudent(bLine);
      if (!resolved) continue;

      const { student, isNew } = resolved;
      // PASS 1 で出欠表から判定済みの生徒は上書きしない
      if (processedRegularStudentIds.has(student.id)) continue;

      // Check for Transfer in block
      if (
        (TRANSFER_KEYWORDS.test(block) || block.includes('transfer')) &&
        !processedTransferStudentIds.has(student.id)
      ) {
        processedTransferStudentIds.add(student.id);

        const alreadyBooked = existingBookings.some(
          (b) => b.studentId === student.id && b.targetDate === detectedDate && b.status === 'booked'
        );

        let note = 'コドモン連絡より振替受講';
        const arrowMatch = block.match(/(\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2})\s*(?:➡️|->|→|分)\s*(?:➡️|->|→)?\s*(\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}|本日)/);
        if (arrowMatch) {
          note = arrowMatch[0];
        }

        transfers.push({
          id: `daily_tb_${student.id}_${detectedDate}`,
          studentId: student.id,
          studentName: student.name,
          fromClassId: student.classId,
          targetClassId: student.classId,
          date: detectedDate,
          targetDate: detectedDate,
          note,
          status: alreadyBooked ? 'already_booked' : 'ready',
          message: alreadyBooked
            ? '既にこの日に振替予約が登録されています（スキップ）'
            : isNew
            ? '新規生徒として名簿登録し、振替予約を登録します（振替残数 -1回）'
            : '振替受講として予約登録します（振替残数 -1回）',
          action: 'book_transfer',
          isNewStudent: isNew,
          newStudentData: isNew ? student : undefined
        });
        break;
      }

      // Check for Absence in block
      if (
        ABSENCE_KEYWORDS.test(block) &&
        !TRANSFER_KEYWORDS.test(block) &&
        !processedAbsenceStudentIds.has(student.id)
      ) {
        processedAbsenceStudentIds.add(student.id);

        const alreadyAbsence = existingAbsences.some(
          (a) => a.studentId === student.id && a.date === detectedDate && a.status === 'confirmed'
        );

        let reason = 'コドモン保護者連絡 (欠席)';
        const reasonMatch = block.match(/(?:理由|事由|お休み|欠席)[：:\s]*([^\n\r]{3,40})/);
        if (reasonMatch && reasonMatch[1]) {
          reason = reasonMatch[1].trim();
        }

        absences.push({
          id: `daily_abs_${student.id}_${detectedDate}`,
          studentId: student.id,
          studentName: student.name,
          classId: student.classId,
          date: detectedDate,
          reason,
          status: alreadyAbsence ? 'already_registered' : 'ready',
          message: alreadyAbsence
            ? '既に欠席登録済みです（スキップ）'
            : isNew
            ? '新規生徒として名簿登録し、欠席登録＆チケット(+1)付与します'
            : '欠席登録し、振替チケット(+1)を自動付与します',
          action: 'grant_ticket_and_absent',
          isNewStudent: isNew,
          newStudentData: isNew ? student : undefined
        });
        break;
      }
    }
  }

  // =========================================================================
  // PASS 3: ANY REMAINING MATCHED STUDENTS FROM ROSTER PRESENT IN TEXT
  // =========================================================================
  for (const s of students) {
    if (processedAbsenceStudentIds.has(s.id) || processedTransferStudentIds.has(s.id) || processedRegularStudentIds.has(s.id)) {
      continue;
    }

    const { kanjiName, romajiName } = extractCleanStudentNameParts(s.name);
    const cleanKanji = kanjiName.replace(/[\s\u3000()（）]+/g, '');
    const cleanRomaji = romajiName.replace(/\s+/g, '').toLowerCase();

    const isPresentInText =
      (cleanKanji.length >= 2 && clean.includes(cleanKanji)) ||
      (cleanRomaji.length >= 4 && clean.toLowerCase().includes(cleanRomaji));

    if (isPresentInText) {
      processedRegularStudentIds.add(s.id);
      regulars.push({
        studentId: s.id,
        studentName: s.name,
        classId: s.classId,
        date: detectedDate,
        status: 'present',
        timeInfo: '通常出席',
        isNewStudent: false
      });
    }
  }

  const newStudentsList = Array.from(newStudentsMap.values());
  const totalParsed = absences.length + transfers.length + regulars.length;

  if (totalParsed === 0 && clean.length > 0) {
    warnings.push('貼り付けられたテキストから生徒名や出欠・振替データを検出できませんでした。');
  }

  return {
    detectedDate,
    detectedDateLabel,
    absences,
    transfers,
    regulars,
    unmatched,
    newStudents: newStudentsList,
    totalParsed,
    warnings
  };
}

/**
 * Format relative time (e.g., "2分前", "たった今", "2 mins ago")
 */
export function formatRelativeTime(isoString: string | null | undefined, language: 'ja' | 'en' = 'ja'): string {
  if (!isoString) {
    return language === 'ja' ? '未更新' : 'Never';
  }

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) {
    return language === 'ja' ? 'たった今' : 'Just now';
  }
  if (diffMin < 60) {
    return language === 'ja' ? `${diffMin}分前` : `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
  }
  if (diffHours < 24) {
    return language === 'ja' ? `${diffHours}時間前` : `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }
  if (diffDays <= 7) {
    return language === 'ja' ? `${diffDays}日前` : `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  // Format exact date
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${m}/${d} ${hh}:${mm}`;
}

/**
 * Check collision safety level based on last sync timestamp
 */
export function getCollisionSafetyInfo(isoString: string | null | undefined, language: 'ja' | 'en' = 'ja'): {
  level: 'collision_warning' | 'recent' | 'safe' | 'none';
  minutesAgo: number;
  relativeText: string;
  exactTimeText: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  warningMessage?: string;
} {
  if (!isoString) {
    return {
      level: 'none',
      minutesAgo: 9999,
      relativeText: language === 'ja' ? '未更新' : 'Never',
      exactTimeText: '-',
      badgeBg: 'bg-slate-100',
      badgeText: 'text-slate-600',
      badgeBorder: 'border-slate-200'
    };
  }

  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const minutesAgo = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  const relativeText = formatRelativeTime(isoString, language);
  
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const exactTimeText = `${m}/${d} ${hh}:${mm}`;

  if (minutesAgo <= 5) {
    return {
      level: 'collision_warning',
      minutesAgo,
      relativeText,
      exactTimeText,
      badgeBg: 'bg-amber-500 text-white',
      badgeText: 'text-amber-900',
      badgeBorder: 'border-amber-400',
      warningMessage:
        language === 'ja'
          ? `【重複注意】約${relativeText}に別の担当者/端末で更新されています。二重登録にご注意ください。`
          : `[Collision Guard] Updated ${relativeText}. Please check the latest roster to avoid duplicate changes.`
    };
  }

  if (minutesAgo <= 30) {
    return {
      level: 'recent',
      minutesAgo,
      relativeText,
      exactTimeText,
      badgeBg: 'bg-sky-100 text-sky-800',
      badgeText: 'text-sky-900',
      badgeBorder: 'border-sky-300',
      warningMessage:
        language === 'ja'
          ? `前回更新から${relativeText}経過しています。`
          : `Last synced ${relativeText}.`
    };
  }

  return {
    level: 'safe',
    minutesAgo,
    relativeText,
    exactTimeText,
    badgeBg: 'bg-emerald-100 text-emerald-800',
    badgeText: 'text-emerald-900',
    badgeBorder: 'border-emerald-300'
  };
}
