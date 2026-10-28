import { ClassInfo } from '../types';

// SGAS のクラス表記（EX1/EX2/Kin/Ele1/Ele2）。対象年齢・学年は未確認のため ageRange は空にしている
export const SOLTILO_CLASSES: ClassInfo[] = [
  {
    id: 'ex1',
    name: 'EX1',
    jpName: 'EX1',
    ageRange: '',
    defaultCapacity: 20, // 振替枠を含めた最大定員
    defaultTransferQuota: 2, // 1日あたりの振替受入枠
    scheduleDays: [1, 2, 3, 4, 5],
    color: 'emerald',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badgeText: 'text-emerald-700'
  },
  {
    id: 'ex2',
    name: 'EX2',
    jpName: 'EX2',
    ageRange: '',
    defaultCapacity: 20, // 振替枠を含めた最大定員
    defaultTransferQuota: 2, // 1日あたりの振替受入枠
    scheduleDays: [1, 2, 3, 4, 5],
    color: 'teal',
    badgeBg: 'bg-teal-50 text-teal-700 border-teal-200',
    badgeText: 'text-teal-700'
  },
  {
    id: 'kin',
    name: 'Kin',
    jpName: 'Kin',
    ageRange: '',
    defaultCapacity: 20, // 振替枠を含めた最大定員
    defaultTransferQuota: 2, // 1日あたりの振替受入枠
    scheduleDays: [1, 2, 3, 4, 5],
    color: 'sky',
    badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
    badgeText: 'text-sky-700'
  },
  {
    id: 'ele1',
    name: 'Ele1',
    jpName: 'Ele1',
    ageRange: '',
    defaultCapacity: 20, // 振替枠を含めた最大定員
    defaultTransferQuota: 2, // 1日あたりの振替受入枠
    scheduleDays: [1, 2, 3, 4, 5],
    color: 'indigo',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    badgeText: 'text-indigo-700'
  },
  {
    id: 'ele2',
    name: 'Ele2',
    jpName: 'Ele2',
    ageRange: '',
    defaultCapacity: 20, // 振替枠を含めた最大定員
    defaultTransferQuota: 2, // 1日あたりの振替受入枠
    scheduleDays: [1, 2, 3, 4, 5],
    color: 'violet',
    badgeBg: 'bg-violet-50 text-violet-700 border-violet-200',
    badgeText: 'text-violet-700'
  }
];

export const MAX_TOTAL_CAPACITY_LIMIT = 20; // 振替枠を含めた最大定員上限
export const DEFAULT_TRANSFER_QUOTA = 2; // デフォルト振替枠数

export const ABSENCE_REASONS = [
  '体調不良・風邪',
  '学校行事・園行事',
  '家庭の都合・旅行',
  '怪我・通院',
  'その他'
];
