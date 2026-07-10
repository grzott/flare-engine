/**
 * Pity-aware weighted drop roller.
 *
 * `rollInto` is zero-alloc on the hot path: the `weightAt` accessor and the
 * `dryPrev` scratch buffer are allocated once inside the factory closure and
 * reused across calls. The `out` parameter receives the result in-place;
 * aliasing `out.pity` against the input `pity` is safe because the function
 * reads all input pity fields into `dryPrev` before writing any output pity
 * fields.
 */

import { weightedIndexBy } from '@flare-engine/math';

export interface DropEntry<K extends string> {
  readonly item: K;
  readonly weight: number;
}

/**
 * Per-item dry-roll counters feeding the pity guarantees.
 * Keys are the item ids whose pity is being tracked.
 */
export type DropPity<K extends string> = Record<K, number>;

export interface DropRollOut<K extends string> {
  item: K | 'none';
  pity: DropPity<K>;
}

/**
 * A `DropTable` is a factory that closes over a weight accessor to avoid
 * per-call allocations. Create once; reuse across frames.
 */
export interface DropTable<K extends string> {
  readonly entries: readonly DropEntry<K>[];
  /**
   * Zero-alloc weighted drop. Writes result into `out`.
   *
   * Algorithm:
   * 1. Check pity thresholds (first matching pity item fires unconditionally).
   * 2. If no pity fires and `rollChance01 >= chancePerRoll`, result = 'none'.
   * 3. Otherwise pick from the weighted table filtered by `isAllowed`.
   *    An all-gated pool (every entry filtered out) fizzles to 'none'.
   *
   * `out.pity` counters reset for the dropped item, advance by 1 for all others.
   * Aliasing `out.pity` against the input `pity` is safe.
   */
  rollInto(
    rollTable01: number,
    rollChance01: number,
    chancePerRoll: number,
    pity: DropPity<K>,
    thresholds: Partial<Record<K, number>>,
    isAllowed: (item: K) => boolean,
    out: DropRollOut<K>,
  ): void;
}

/**
 * Creates a `DropTable` from `entries`.
 * The `weightAt` accessor and scratch buffer are allocated once inside this
 * factory (not per-roll).
 */
export function createDropTable<K extends string>(entries: readonly DropEntry<K>[]): DropTable<K> {
  // Closed-over filter state — set before each weightedIndexBy call.
  // `var` so the binding is function-scoped and hoisted; reassigned each call.
  var currentIsAllowed: (item: K) => boolean = () => true;

  const weightAt = (entry: DropEntry<K>): number =>
    currentIsAllowed(entry.item) ? entry.weight : 0;

  // Pre-allocated scratch buffer: stores dry counts read from `pity` before
  // any writes, enabling safe aliasing of out.pity === pity.
  const dryPrev = new Float32Array(entries.length);

  function rollInto(
    rollTable01: number,
    rollChance01: number,
    chancePerRoll: number,
    pity: DropPity<K>,
    thresholds: Partial<Record<K, number>>,
    isAllowed: (item: K) => boolean,
    out: DropRollOut<K>,
  ): void {
    let picked: K | 'none' = 'none';

    // Read all pity inputs into scratch before writing any output (aliasing guard).
    for (let i = 0; i < entries.length; i++) {
      dryPrev[i] = pity[(entries[i] as DropEntry<K>).item] ?? 0;
    }

    // Pity check — first item whose dry count + 1 meets or exceeds threshold.
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i] as DropEntry<K>;
      const threshold = thresholds[e.item];
      if (threshold !== undefined && isAllowed(e.item) && (dryPrev[i] as number) + 1 >= threshold) {
        picked = e.item;
        break;
      }
    }

    // Chance gate + weighted pick.
    if (picked === 'none') {
      if (rollChance01 < chancePerRoll) {
        currentIsAllowed = isAllowed;
        // Compute allowed total to detect an all-gated pool (fizzles to 'none').
        let allowedTotal = 0;
        for (let i = 0; i < entries.length; i++) {
          allowedTotal += weightAt(entries[i] as DropEntry<K>);
        }
        if (allowedTotal > 0) {
          const idx = weightedIndexBy(entries, weightAt, rollTable01);
          const entry = entries[idx];
          if (entry !== undefined) picked = entry.item;
        }
      }
    }

    // Write output — pity counters.
    out.item = picked;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i] as DropEntry<K>;
      (out.pity as Record<string, number>)[e.item] =
        picked === e.item ? 0 : (dryPrev[i] as number) + 1;
    }
  }

  return { entries, rollInto };
}

/**
 * Allocating convenience wrapper. Creates a fresh pity object and returns both.
 * Use `table.rollInto` on the hot path; this is for tests and cold-path setup.
 */
export function rollDrop<K extends string>(
  table: DropTable<K>,
  rollTable01: number,
  rollChance01: number,
  chancePerRoll: number,
  pity: DropPity<K>,
  thresholds: Partial<Record<K, number>>,
  isAllowed?: (item: K) => boolean,
): DropRollOut<K> {
  const out: DropRollOut<K> = { item: 'none', pity: { ...pity } };
  table.rollInto(
    rollTable01,
    rollChance01,
    chancePerRoll,
    pity,
    thresholds,
    isAllowed ?? (() => true),
    out,
  );
  return out;
}
