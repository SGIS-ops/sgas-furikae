// Japanese National Holidays List & Helper Utilities

export interface HolidayInfo {
  date: string; // YYYY-MM-DD
  name: string;
}

// 出典: 内閣府「国民の祝日について」。年度更新時に翌年分を追加すること
export const JAPANESE_HOLIDAYS: Record<string, string> = {
  // 2025
  '2025-01-01': '元日',
  '2025-01-13': '成人の日',
  '2025-02-11': '建国記念の日',
  '2025-02-23': '天皇誕生日',
  '2025-02-24': '振替休日',
  '2025-03-20': '春分の日',
  '2025-04-29': '昭和の日',
  '2025-05-03': '憲法記念日',
  '2025-05-04': 'みどりの日',
  '2025-05-05': 'こどもの日',
  '2025-05-06': '振替休日',
  '2025-07-21': '海の日',
  '2025-08-11': '山の日',
  '2025-09-15': '敬老の日',
  '2025-09-23': '秋分の日',
  '2025-10-13': 'スポーツの日',
  '2025-11-03': '文化の日',
  '2025-11-23': '勤労感謝の日',
  '2025-11-24': '振替休日',

  // 2026
  '2026-01-01': '元日',
  '2026-01-12': '成人の日',
  '2026-02-11': '建国記念の日',
  '2026-02-23': '天皇誕生日',
  '2026-03-20': '春分の日',
  '2026-04-29': '昭和の日',
  '2026-05-03': '憲法記念日',
  '2026-05-04': 'みどりの日',
  '2026-05-05': 'こどもの日',
  '2026-05-06': '振替休日',
  '2026-07-20': '海の日',
  '2026-08-11': '山の日',
  '2026-09-21': '敬老の日',
  '2026-09-22': '国民の祝日',
  '2026-09-23': '秋分の日',
  '2026-10-12': 'スポーツの日',
  '2026-11-03': '文化の日',
  '2026-11-23': '勤労感謝の日',

  // 2027
  '2027-01-01': '元日',
  '2027-01-11': '成人の日',
  '2027-02-11': '建国記念の日',
  '2027-02-23': '天皇誕生日',
  '2027-03-21': '春分の日',
  '2027-03-22': '振替休日',
  '2027-04-29': '昭和の日',
  '2027-05-03': '憲法記念日',
  '2027-05-04': 'みどりの日',
  '2027-05-05': 'こどもの日',
  '2027-07-19': '海の日',
  '2027-08-11': '山の日',
  '2027-09-20': '敬老の日',
  '2027-09-23': '秋分の日',
  '2027-10-11': 'スポーツの日',
  '2027-11-03': '文化の日',
  '2027-11-23': '勤労感謝の日'
};

/**
 * Checks if a date string (YYYY-MM-DD) is a Japanese National Holiday.
 */
export function getHolidayName(dateStr: string): string | null {
  return JAPANESE_HOLIDAYS[dateStr] || null;
}

/**
 * Calculates transfer expiration date based on origin absence date (振替元).
 * Rule: Valid for 3 months from origin month (起算月を含め3か月後の月末日まで).
 * e.g., Absence on 2026-08-01 or 2026-08-30 -> Expiration is 2026-10-31 (10月末日)
 */
export function getTransferExpiryDate(absenceDateStr: string): {
  expiryDateStr: string;
  label: string;
  year: number;
  month: number;
  day: number;
} {
  const parts = absenceDateStr.split('-');
  const origYear = parseInt(parts[0], 10) || new Date().getFullYear();
  const origMonth = parseInt(parts[1], 10) || (new Date().getMonth() + 1);

  // Month M + 2 (3 months total: M, M+1, M+2)
  let expiryMonth = origMonth + 2;
  let expiryYear = origYear;

  if (expiryMonth > 12) {
    expiryMonth -= 12;
    expiryYear += 1;
  }

  // Get last day of expiry month
  const lastDay = new Date(expiryYear, expiryMonth, 0).getDate();
  const paddedMonth = String(expiryMonth).padStart(2, '0');
  const paddedDay = String(lastDay).padStart(2, '0');

  return {
    expiryDateStr: `${expiryYear}-${paddedMonth}-${paddedDay}`,
    label: `${expiryYear}年${expiryMonth}月末日`,
    year: expiryYear,
    month: expiryMonth,
    day: lastDay
  };
}

/**
 * Checks if a date is a Monday Holiday that qualifies for automatic transfer credit.
 * Rule: Monday (dayOfWeek === 1) & National Holiday.
 */
export function isMondayHoliday(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  if (d.getDay() !== 1) return false; // Must be Monday
  return !!getHolidayName(dateStr);
}
