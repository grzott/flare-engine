import { useInsertionEffect, useReducer, useRef } from 'react';

/** One row of a presence list: an item of the data, or a removed one kept until its exit ends. */
export interface PresenceEntry<T> {
  key: string;
  /** The item under this key in the data, or the last one it had once it is removed. */
  item: T;
  /**
   * - `'idle'`: the row was in the data on the hook's first render, so it does not animate in.
   * - `'enter'`: the row arrived later (or `animateInitial` is set), or came back mid-exit.
   * - `'exit'`: the data dropped the row; it stays rendered until `release` runs.
   *
   * No timer moves a row out of `'enter'`: it holds until the row is removed.
   */
  phase: 'enter' | 'idle' | 'exit';
  /** Drops an exiting row. It does nothing while the row is in the data, or once it is gone. */
  release(): void;
}

/** A row and the instance it belongs to: a key that comes back after its release is a new one. */
interface Row<T> {
  readonly instance: object;
  readonly entry: PresenceEntry<T>;
}

interface Committed<T> {
  rows: readonly Row<T>[];
  entries: readonly PresenceEntry<T>[];
  mounted: boolean;
}

/**
 * Tracks `data` by key so that a removed item stays in the returned list, with phase `'exit'` and
 * in the place it had, until its `release` runs. Call `release` when the row's exit hands off or
 * ends. A key that comes back before then keeps its single entry and returns to `'enter'`; one
 * that comes back after is a new entry.
 *
 * An entry object, and the array, keep their identity for as long as nothing in them changes.
 *
 * A render derives its rows from the last committed ones and changes nothing; they are recorded
 * when the render commits, in an insertion effect. A render React discards (an interrupted or
 * suspended transition) therefore leaves no trace: no row it saw arrive or leave outlives it.
 */
export function useFlarePresenceList<T>(
  data: readonly T[],
  keyOf: (t: T) => string,
  o?: { animateInitial?: boolean },
): readonly PresenceEntry<T>[] {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const committed = useRef<Committed<T>>({ rows: [], entries: [], mounted: false });
  const released = useRef<WeakSet<object> | null>(null);
  released.current ??= new WeakSet();
  const gone = released.current;

  const last = committed.current;
  const arriving = !last.mounted && o?.animateInitial !== true ? 'idle' : 'enter';
  const previous = last.rows.filter((row) => !gone.has(row.instance));
  const byKey = new Map<string, Row<T>>();
  for (const row of previous) byKey.set(row.entry.key, row);

  const newRow = (key: string, item: T): Row<T> => {
    const instance = {};
    return {
      instance,
      entry: {
        key,
        item,
        phase: arriving,
        release() {
          // Bound to the instance, not the key: a late release from an instance that is already
          // gone must not drop a newer row under the same key. Only a committed exit is released.
          const row = committed.current.rows.find((r) => r.instance === instance);
          if (row === undefined || row.entry.phase !== 'exit' || gone.has(instance)) return;
          gone.add(instance);
          rerender();
        },
      },
    };
  };

  const merged: Row<T>[] = [];
  const present = new Set<Row<T>>();
  const keys = new Set<string>();
  for (const item of data) {
    const key = keyOf(item);
    // A key the data holds twice keeps one entry, at its first position.
    if (keys.has(key)) continue;
    keys.add(key);
    const kept = byKey.get(key);
    if (kept === undefined) {
      merged.push(newRow(key, item));
      continue;
    }
    present.add(kept);
    const { entry } = kept;
    if (entry.phase === 'exit') {
      merged.push({ instance: kept.instance, entry: { ...entry, item, phase: 'enter' } });
    } else if (entry.item !== item) {
      merged.push({ instance: kept.instance, entry: { ...entry, item } });
    } else {
      merged.push(kept);
    }
  }

  let rows = merged;
  if (previous.some((row) => !present.has(row))) {
    // A removed row stays right after the nearest earlier row that the data still holds, or at
    // the head when there is none.
    const head: Row<T>[] = [];
    const followers = new Map<object, Row<T>[]>();
    let trail = head;
    for (const row of previous) {
      if (present.has(row)) {
        trail = [];
        followers.set(row.instance, trail);
        continue;
      }
      const { entry } = row;
      trail.push(
        entry.phase === 'exit'
          ? row
          : { instance: row.instance, entry: { ...entry, phase: 'exit' } },
      );
    }
    rows = head;
    for (const row of merged) {
      rows.push(row);
      const after = followers.get(row.instance);
      if (after !== undefined) for (const exiting of after) rows.push(exiting);
    }
  }

  let entries = last.entries;
  let same = entries.length === rows.length;
  for (let i = 0; same && i < rows.length; i++) same = entries[i] === rows[i]!.entry;
  if (!same) entries = rows.map((row) => row.entry);

  // An insertion effect runs before every layout effect of the commit, so a row that asks for its
  // release from its own layout effect in this commit already sees this render's rows.
  useInsertionEffect(() => {
    committed.current = { rows, entries, mounted: true };
  });

  return entries;
}
