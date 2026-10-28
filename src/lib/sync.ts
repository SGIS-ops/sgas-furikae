import type { AppState } from './operations';

// ============================================================
// 管理画面の変更をサーバーへ送るための差分（レコード単位）
// - 画面側: 直前にサーバーと一致していた状態(base)と編集後(next)の差分を作る
// - サーバー側: 最新状態に差分を当てる。base 以降に他の人が同じレコードを変えていたら、そのレコードだけ衝突として残す
// ============================================================

type ListKey = 'students' | 'absences' | 'bookings' | 'overrides' | 'specialDays' | 'codmonSyncLogs';
const LIST_KEYS: ListKey[] = ['students', 'absences', 'bookings', 'overrides', 'specialDays', 'codmonSyncLogs'];

type AnyRecord = Record<string, unknown>;

/** レコードの識別キー（日別定員は日付+クラス） */
export const recordKey = (list: ListKey, r: AnyRecord): string =>
  list === 'overrides' ? `${r.date}|${r.classId}` : String(r.id);

export interface RecordChange {
  key: string;
  /** 変更前（新規は null） */
  base: AnyRecord | null;
  /** 変更後（削除は null） */
  next: AnyRecord | null;
}

export interface ChangeSet {
  lists: Partial<Record<ListKey, RecordChange[]>>;
  weekdayQuotas?: { base: AppState['weekdayQuotas']; next: AppState['weekdayQuotas'] };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const diffState = (base: AppState, next: AppState): ChangeSet => {
  const changes: ChangeSet = { lists: {} };
  for (const list of LIST_KEYS) {
    const before = new Map((base[list] as unknown as AnyRecord[]).map((r) => [recordKey(list, r), r]));
    const after = new Map((next[list] as unknown as AnyRecord[]).map((r) => [recordKey(list, r), r]));
    const out: RecordChange[] = [];
    for (const [key, r] of after) {
      const b = before.get(key) ?? null;
      if (!b || !same(b, r)) out.push({ key, base: b, next: r });
    }
    for (const [key, b] of before) {
      if (!after.has(key)) out.push({ key, base: b, next: null });
    }
    if (out.length) changes.lists[list] = out;
  }
  if (!same(base.weekdayQuotas, next.weekdayQuotas)) {
    changes.weekdayQuotas = { base: base.weekdayQuotas, next: next.weekdayQuotas };
  }
  return changes;
};

export const isEmptyChangeSet = (c: ChangeSet) => Object.keys(c.lists).length === 0 && !c.weekdayQuotas;

export interface ApplyResult {
  state: AppState;
  applied: number;
  conflicts: { list: string; key: string }[];
}

/**
 * 最新状態に差分を当てる。
 * 最新のレコードが base と一致するときだけ反映し、異なれば衝突（他の人の更新を上書きしない）。
 * 新規追加は同じキーが無ければ反映。
 */
export const applyChanges = (current: AppState, changes: ChangeSet): ApplyResult => {
  const state: AppState = { ...current };
  const conflicts: { list: string; key: string }[] = [];
  let applied = 0;

  for (const list of LIST_KEYS) {
    const items = changes.lists[list];
    if (!items) continue;
    const records = [...(state[list] as unknown as AnyRecord[])];
    for (const ch of items) {
      const idx = records.findIndex((r) => recordKey(list, r) === ch.key);
      const cur = idx === -1 ? null : records[idx];
      if (!same(cur, ch.base)) {
        // 既に同じ内容になっている場合（再送など）は衝突にしない
        if (!same(cur, ch.next)) conflicts.push({ list, key: ch.key });
        continue;
      }
      if (ch.next === null) records.splice(idx, 1);
      else if (idx === -1) records.unshift(ch.next);
      else records[idx] = ch.next;
      applied++;
    }
    (state as unknown as Record<string, unknown>)[list] = records;
  }

  if (changes.weekdayQuotas) {
    if (same(state.weekdayQuotas, changes.weekdayQuotas.base)) {
      state.weekdayQuotas = changes.weekdayQuotas.next;
      applied++;
    } else if (!same(state.weekdayQuotas, changes.weekdayQuotas.next)) {
      conflicts.push({ list: 'weekdayQuotas', key: '*' });
    }
  }

  return { state, applied, conflicts };
};
