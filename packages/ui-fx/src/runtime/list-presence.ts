import { useReducer, useRef } from 'react';

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

interface Slot<T> {
  entry: PresenceEntry<T>;
  /** The render pass that last found this slot's key in the data. */
  seen: number;
}

interface ListState<T> {
  slots: Slot<T>[];
  byKey: Map<string, Slot<T>>;
  entries: readonly PresenceEntry<T>[];
  pass: number;
}

/**
 * Tracks `data` by key so that a removed item stays in the returned list, with phase `'exit'` and
 * in the place it had, until its `release` runs. Call `release` when the row's exit hands off or
 * ends. A key that comes back before then keeps its single entry and returns to `'enter'`; one
 * that comes back after is a new entry.
 *
 * An entry object, and the array, keep their identity for as long as nothing in them changes.
 */
export function useFlarePresenceList<T>(
  data: readonly T[],
  keyOf: (t: T) => string,
  o?: { animateInitial?: boolean },
): readonly PresenceEntry<T>[] {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const ref = useRef<ListState<T> | null>(null);

  const initial = ref.current === null;
  ref.current ??= { slots: [], byKey: new Map(), entries: [], pass: 0 };
  const state = ref.current;
  const pass = ++state.pass;
  const arriving = initial && o?.animateInitial !== true ? 'idle' : 'enter';

  const previous = state.slots;
  const merged: Slot<T>[] = [];

  for (const item of data) {
    const key = keyOf(item);
    const kept = state.byKey.get(key);
    if (kept !== undefined) {
      // A key the data holds twice keeps one entry, at its first position.
      if (kept.seen === pass) continue;
      kept.seen = pass;
      const { entry } = kept;
      if (entry.phase === 'exit') {
        kept.entry = { key, item, phase: 'enter', release: entry.release };
      } else if (entry.item !== item) {
        kept.entry = { key, item, phase: entry.phase, release: entry.release };
      }
      merged.push(kept);
      continue;
    }
    const slot: Slot<T> = {
      seen: pass,
      entry: {
        key,
        item,
        phase: arriving,
        release() {
          // Bound to the slot, not the key: a late release from an instance that is already
          // gone must not drop a newer row under the same key.
          const current = ref.current;
          if (current === null || slot.entry.phase !== 'exit') return;
          const at = current.slots.indexOf(slot);
          if (at === -1) return;
          current.slots.splice(at, 1);
          current.byKey.delete(key);
          rerender();
        },
      },
    };
    state.byKey.set(key, slot);
    merged.push(slot);
  }

  let slots = merged;
  if (previous.some((slot) => slot.seen !== pass)) {
    // A removed row stays right after the nearest earlier row that the data still holds, or at
    // the head when there is none.
    const head: Slot<T>[] = [];
    const followers = new Map<Slot<T>, Slot<T>[]>();
    let trail = head;
    for (const slot of previous) {
      if (slot.seen === pass) {
        trail = [];
        followers.set(slot, trail);
        continue;
      }
      const { entry } = slot;
      if (entry.phase !== 'exit') slot.entry = { ...entry, phase: 'exit' };
      trail.push(slot);
    }
    slots = head;
    for (const slot of merged) {
      slots.push(slot);
      const after = followers.get(slot);
      if (after !== undefined) for (const exiting of after) slots.push(exiting);
    }
  }
  state.slots = slots;

  const last = state.entries;
  let same = last.length === slots.length;
  for (let i = 0; same && i < slots.length; i++) same = last[i] === slots[i]!.entry;
  if (!same) state.entries = slots.map((slot) => slot.entry);
  return state.entries;
}
