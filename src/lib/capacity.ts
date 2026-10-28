import { Student, AbsenceRecord, TransferBooking, DailyClassOverride, ClassId, WeekdayQuotaSettings, SpecialScheduleDay } from '../types';
import { DEFAULT_TRANSFER_QUOTA, MAX_TOTAL_CAPACITY_LIMIT } from '../data/constants';
import { getDayOfWeek } from './dateUtils';

// --- Capacity & Roster Helper Calculations ---

export interface ClassCapacityStatus {
  date: string;
  classId: ClassId;
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  regularEnrolledCount: number; // Total enrolled on this day
  absentCount: number; // Regulars who are absent on this day
  regularPresentCount: number; // Regulars attending = enrolled - absent
  transferBookedCount: number; // Transfers booked into this class on this day
  totalPresentCount: number; // regularPresentCount + transferBookedCount
  maxTotalCapacity: number; // e.g. 20
  maxTransferQuota: number; // e.g. 2 (from weekday matrix or override)
  remainingTransferSlots: number; // maxTransferQuota - transferBookedCount
  remainingTotalSlots: number; // maxTotalCapacity - totalPresentCount
  canAcceptTransfer: boolean; // remainingTransferSlots > 0 AND remainingTotalSlots > 0
  isSpecialDay?: boolean;
  specialDayInfo?: SpecialScheduleDay;
}

export const getClassCapacityForDate = (
  dateStr: string,
  classId: ClassId,
  students: Student[],
  absences: AbsenceRecord[],
  bookings: TransferBooking[],
  overrides: DailyClassOverride[],
  weekdayQuotas?: WeekdayQuotaSettings,
  specialDays?: SpecialScheduleDay[]
): ClassCapacityStatus => {
  const dayOfWeek = getDayOfWeek(dateStr);

  // 1. Check special schedule day (e.g. サマースクール, 祝日休講, 祝日開校, 休館)
  const specialDay = specialDays?.find((s) => s.date === dateStr);

  // 2. Check daily override for this specific date and class
  const override = overrides.find((o) => o.date === dateStr && o.classId === classId);

  // 3. Check weekday matrix quota
  const weekdayConfig = weekdayQuotas?.[classId]?.[dayOfWeek];

  // Determine maxTotalCapacity
  let maxTotalCapacity = MAX_TOTAL_CAPACITY_LIMIT;
  if (override?.maxTotalCapacity !== undefined) {
    maxTotalCapacity = override.maxTotalCapacity;
  } else if (weekdayConfig?.maxTotalCapacity !== undefined) {
    maxTotalCapacity = weekdayConfig.maxTotalCapacity;
  }

  // 安全制御: 設定値に関わらず最大定員は20名を超えない
  maxTotalCapacity = Math.max(0, Math.min(maxTotalCapacity, MAX_TOTAL_CAPACITY_LIMIT));

  // Determine maxTransferQuota
  let maxTransferQuota = DEFAULT_TRANSFER_QUOTA;
  if (override?.maxTransferQuota !== undefined) {
    maxTransferQuota = override.maxTransferQuota;
  } else if (specialDay && specialDay.transferQuota !== undefined) {
    maxTransferQuota = specialDay.transferQuota;
  } else if (weekdayConfig?.maxTransferQuota !== undefined) {
    maxTransferQuota = weekdayConfig.maxTransferQuota;
  }

  // Regular enrolled students for this class on this day of week
  const regularEnrolled = students.filter(
    (s) => s.classId === classId && s.regularDays.includes(dayOfWeek)
  );
  const regularEnrolledCount = regularEnrolled.length;

  // その日に在籍している生徒の欠席のみ数える（同じ生徒の重複登録は1名として扱う）
  const regularIds = new Set(regularEnrolled.map((s) => s.id));
  const absentCount = new Set(
    absences
      .filter((a) => a.date === dateStr && a.status === 'confirmed' && regularIds.has(a.studentId))
      .map((a) => a.studentId)
  ).size;

  const regularPresentCount = Math.max(0, regularEnrolledCount - absentCount);

  // Transfers booked into this class on dateStr
  const activeBookings = bookings.filter(
    (b) => b.targetClassId === classId && b.targetDate === dateStr && b.status === 'booked'
  );
  const transferBookedCount = activeBookings.length;

  const totalPresentCount = regularPresentCount + transferBookedCount;

  const remainingTransferSlots = Math.max(0, maxTransferQuota - transferBookedCount);
  const remainingTotalSlots = Math.max(0, maxTotalCapacity - totalPresentCount);

  let canAcceptTransfer = remainingTransferSlots > 0 && remainingTotalSlots > 0;

  // Special day transfer rules
  if (specialDay) {
    if (specialDay.allowTransfers === false) {
      canAcceptTransfer = false;
    }
  } else if (override?.isCancelled) {
    canAcceptTransfer = false;
  } else if (weekdayConfig && !weekdayConfig.isOpen) {
    canAcceptTransfer = false;
  }

  return {
    date: dateStr,
    classId,
    dayOfWeek,
    regularEnrolledCount,
    absentCount,
    regularPresentCount,
    transferBookedCount,
    totalPresentCount,
    maxTotalCapacity,
    maxTransferQuota,
    remainingTransferSlots,
    remainingTotalSlots,
    canAcceptTransfer,
    isSpecialDay: !!specialDay,
    specialDayInfo: specialDay
  };
};
