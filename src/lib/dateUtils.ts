// ローカル日付 "YYYY-MM-DD" を扱うユーティリティ
// toISOString() は UTC になり、日本時間の 0:00〜9:00 は前日の日付になるため使わない

export const toLocalDateString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getTodayString = (): string => toLocalDateString(new Date());

export const addDaysToDateString = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toLocalDateString(new Date(y, m - 1, d + days));
};

export const getDayOfWeek = (dateStr: string): number => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

/** 2つの日付の差（b - a、日数） */
export const diffDays = (a: string, b: string): number => {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
};
