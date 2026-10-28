import { Student, AbsenceRecord, TransferBooking, WeekdayQuotaSettings, SpecialScheduleDay, ClassId } from '../types';
import { calculateExpiryDate } from '../lib/expiration';
import { getHolidayName } from '../lib/holidays';
import { addDaysToDateString, getDayOfWeek, getTodayString, toLocalDateString } from '../lib/dateUtils';
import { DEFAULT_TRANSFER_QUOTA, MAX_TOTAL_CAPACITY_LIMIT, SOLTILO_CLASSES } from './constants';

// ============================================================
// 公開用サンプルデータ
// 実在の児童・保護者の情報は含めない。氏名はすべて「サンプル ◯◯ (◯◯ Sample)」。
// 日付は起動日からの相対で作り、いつ開いても欠席・振替・期限アラートを確認できるようにする。
// ============================================================

type StudentSeed = [id: string, jaGiven: string, enGiven: string, classId: ClassId, regularDays: number[], balance: number, parentKey: string];

const STUDENT_SEEDS: StudentSeed[] = [
  // 兄弟: 蓮・葵（同じ保護者。codmon_sample_ren でログインすると切り替えられる）
  ['std_ex1_1', '蓮', 'Ren', 'ex1', [1, 3], 2, 'A'],
  ['std_kin_1', '葵', 'Aoi', 'kin', [1, 3, 5], 0, 'A'],
  ['std_ex1_2', 'エミリ', 'Emily', 'ex1', [2, 4], 1, 'B'],
  ['std_ex2_1', 'レオ', 'Leo', 'ex2', [1, 2, 4], 3, 'C'],
  ['std_ex2_2', '陽菜', 'Hina', 'ex2', [3, 5], 1, 'D'],
  ['std_kin_2', 'ノア', 'Noah', 'kin', [1, 3, 5], 2, 'E'],
  ['std_ele1_1', '翔太', 'Shota', 'ele1', [1, 3, 5], 1, 'F'],
  ['std_ele1_2', 'クロエ', 'Chloe', 'ele1', [2, 4], 2, 'G'],
  ['std_ele1_3', '結衣', 'Yui', 'ele1', [1, 2, 4], 0, 'H'],
  ['std_ele2_1', 'オリバー', 'Oliver', 'ele2', [1, 3, 5], 2, 'I'],
  ['std_ele2_2', '陸', 'Riku', 'ele2', [2, 4], 1, 'J']
];

export const INITIAL_STUDENTS: Student[] = STUDENT_SEEDS.map(([id, jaGiven, enGiven, classId, regularDays, balance, parentKey]) => ({
  id,
  name: `サンプル ${jaGiven} (${enGiven} Sample)`,
  classId,
  regularDays,
  transferBalance: balance,
  parentName: `サンプル 保護者${parentKey} (Sample Parent ${parentKey})`,
  contactEmail: `sample.parent.${parentKey.toLowerCase()}@example.com`,
  loginId: `codmon_sample_${enGiven.toLowerCase()}`,
  password: 'soltilo123',
  isDefaultPassword: true
}));

const studentById = (id: string) => INITIAL_STUDENTS.find((s) => s.id === id)!;

/** 今日より前で、指定した曜日のいずれかに当たる日（祝日を除く）。skip 件目を返す */
const recentPastDay = (days: number[], skip = 0): string => {
  let d = getTodayString();
  let found = -1;
  for (let i = 0; i < 60; i++) {
    d = addDaysToDateString(d, -1);
    if (days.includes(getDayOfWeek(d)) && !getHolidayName(d)) {
      found++;
      if (found === skip) return d;
    }
  }
  return d;
};

/** minOffset 日後以降で、指定した曜日のいずれかに当たる直近の日（祝日を除く） */
const nextFutureDay = (days: number[], minOffset = 1): string => {
  let d = addDaysToDateString(getTodayString(), minOffset - 1);
  for (let i = 0; i < 60; i++) {
    d = addDaysToDateString(d, 1);
    if (days.includes(getDayOfWeek(d)) && !getHolidayName(d)) return d;
  }
  return d;
};

const WEEKDAYS = [1, 2, 3, 4, 5];
const notRegular = (s: Student) => WEEKDAYS.filter((d) => !s.regularDays.includes(d));

const absence = (id: string, studentId: string, date: string, reason: string): AbsenceRecord => {
  const s = studentById(studentId);
  return {
    id,
    studentId,
    studentName: s.name,
    classId: s.classId,
    date,
    reason,
    reportedAt: new Date(`${date}T08:00:00`).toISOString(),
    status: 'confirmed',
    creditGranted: true,
    expiryDate: calculateExpiryDate(date)
  };
};

// 期限間近のサンプル: 2か月前の月の通学日に2回欠席 → どちらも今月末が期限。
// 古い1枚は振替予約に充当済み、もう1枚が「期限間近」として表示される
const now = new Date();
const regularDaysTwoMonthsAgo = (days: number[]): string[] => {
  const result: string[] = [];
  for (let day = 1; day <= 28; day++) {
    const d = toLocalDateString(new Date(now.getFullYear(), now.getMonth() - 2, day));
    if (days.includes(getDayOfWeek(d)) && !getHolidayName(d)) result.push(d);
  }
  return result;
};
const [renOld1, renOld2] = regularDaysTwoMonthsAgo(studentById('std_ex1_1').regularDays);

export const INITIAL_ABSENCES: AbsenceRecord[] = [
  absence('abs_1', 'std_ex1_1', recentPastDay(studentById('std_ex1_1').regularDays), '体調不良・風邪'),
  absence('abs_2', 'std_ex1_1', renOld1, '家庭の都合・旅行'),
  absence('abs_5', 'std_ex1_1', renOld2, '体調不良・風邪'),
  absence('abs_3', 'std_ex2_1', recentPastDay(studentById('std_ex2_1').regularDays, 1), '学校行事・園行事'),
  absence('abs_4', 'std_ele1_2', nextFutureDay(studentById('std_ele1_2').regularDays, 2), '家庭の都合・旅行')
];

const booking = (id: string, studentId: string, targetDate: string): TransferBooking => {
  const s = studentById(studentId);
  return {
    id,
    studentId,
    studentName: s.name,
    fromClassId: s.classId,
    targetClassId: s.classId,
    targetDate,
    bookedAt: new Date().toISOString(),
    status: 'booked',
    note: '振替予約済'
  };
};

export const INITIAL_BOOKINGS: TransferBooking[] = [
  booking('tb_1', 'std_ex1_1', nextFutureDay(notRegular(studentById('std_ex1_1')), 3)),
  booking('tb_2', 'std_ex2_1', nextFutureDay(notRegular(studentById('std_ex2_1')), 2))
];

export const INITIAL_WEEKDAY_QUOTAS: WeekdayQuotaSettings = Object.fromEntries(
  SOLTILO_CLASSES.map((c) => [
    c.id,
    Object.fromEntries(
      WEEKDAYS.map((d) => [d, { maxTransferQuota: DEFAULT_TRANSFER_QUOTA, maxTotalCapacity: MAX_TOTAL_CAPACITY_LIMIT, isOpen: true }])
    )
  ])
) as WeekdayQuotaSettings;

/** 明日以降で平日に当たる祝日（最大 count 件） */
const upcomingWeekdayHolidays = (count: number): { date: string; name: string }[] => {
  const result: { date: string; name: string }[] = [];
  let d = getTodayString();
  for (let i = 0; i < 400 && result.length < count; i++) {
    d = addDaysToDateString(d, 1);
    const name = getHolidayName(d);
    if (name && WEEKDAYS.includes(getDayOfWeek(d))) result.push({ date: d, name });
  }
  return result;
};

export const INITIAL_SPECIAL_DAYS: SpecialScheduleDay[] = [
  ...upcomingWeekdayHolidays(2).map(
    (h, i): SpecialScheduleDay => ({
      id: `sp_holiday_${i + 1}`,
      date: h.date,
      type: 'holiday_transfer',
      title: `${h.name}（祝日休講・要振替）`,
      badgeText: '祝(要振)',
      allowTransfers: false,
      grantsTransfer: true,
      note: 'サンプル: 当日在籍生に振替チケットを付与'
    })
  ),
  {
    id: 'sp_closed_sample',
    date: nextFutureDay(WEEKDAYS, 21),
    type: 'closed',
    title: '休館日（サンプル）',
    badgeText: '休館',
    allowTransfers: false,
    grantsTransfer: false,
    note: 'サンプルの特別日程です'
  }
];
