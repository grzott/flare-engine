/**
 * Tier resolution: "highest threshold crossed by a running tally."
 *
 * The tally tiers are caller-defined (generic `T`) so the same resolver
 * works for score brackets, XP thresholds, unlock gates, etc.
 */

export interface TierEntry<T> {
  /** Minimum tally value (inclusive) required to reach this tier. */
  readonly at: number;
  /** The tier value associated with this threshold. */
  readonly tier: T;
}

/**
 * Returns the highest tier whose `at` threshold is met or exceeded by `tally`,
 * or `null` when `tally` is below all thresholds.
 *
 * `entries` need not be sorted — the function scans all entries and returns the
 * one with the largest `at` that satisfies `tally >= at`.
 * Ties (identical `at`) are broken by iteration order (last entry wins).
 */
export function resolveTier<T>(entries: readonly TierEntry<T>[], tally: number): T | null {
  let best: T | null = null;
  let bestAt = Number.NEGATIVE_INFINITY;
  for (const e of entries) {
    if (tally >= e.at && e.at >= bestAt) {
      best = e.tier;
      bestAt = e.at;
    }
  }
  return best;
}

/**
 * Returns the index (0-based) of the highest satisfied tier entry,
 * or -1 when `tally` is below all thresholds.
 * Same tie-breaking rules as `resolveTier`.
 */
export function resolveTierIndex<T>(entries: readonly TierEntry<T>[], tally: number): number {
  let bestIdx = -1;
  let bestAt = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e !== undefined && tally >= e.at && e.at >= bestAt) {
      bestIdx = i;
      bestAt = e.at;
    }
  }
  return bestIdx;
}
