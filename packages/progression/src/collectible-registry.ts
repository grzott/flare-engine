/**
 * Collectible-unlock registry: immutable unlock-set + partition + capstone.
 *
 * The registry is generic over a string id type.
 * All operations return new registry instances — no mutation.
 */

export interface CollectibleRegistry<K extends string> {
  /** The complete set of collectible ids (excluding the capstone). */
  readonly all: ReadonlySet<K>;
  /** The capstone id, or null when no capstone is defined. */
  readonly capstoneId: K | null;
  /** Currently unlocked ids (a subset of `all`, plus capstone when triggered). */
  readonly unlocked: ReadonlySet<K>;
  /** True when every collectible in `all` is unlocked. */
  readonly isComplete: boolean;
  /**
   * True when the capstone is in `unlocked`. Always false when `capstoneId`
   * is null.
   */
  readonly isCapstone: boolean;
  /**
   * Returns a new registry with `id` added to `unlocked`. Idempotent.
   * Automatically adds the capstone when `isComplete` transitions to true
   * and a capstone is defined.
   * Throws on unknown ids (not in `all` and not the capstoneId).
   */
  unlock(id: K): CollectibleRegistry<K>;
  /**
   * Partition the unlocked set into `{ have, missing }`.
   * `have` = ids in `all` that are in `unlocked` (capstone excluded).
   * `missing` = ids in `all` not yet unlocked.
   */
  partition(): { have: readonly K[]; missing: readonly K[] };
  /**
   * Returns all ids in `all` in insertion order.
   */
  list(): readonly K[];
}

function makeRegistry<K extends string>(
  all: ReadonlySet<K>,
  capstoneId: K | null,
  unlocked: ReadonlySet<K>,
): CollectibleRegistry<K> {
  const isComplete = [...all].every((id) => unlocked.has(id));
  const isCapstone = capstoneId !== null && unlocked.has(capstoneId);

  function unlock(id: K): CollectibleRegistry<K> {
    if (!all.has(id) && id !== capstoneId) {
      throw new Error(`CollectibleRegistry: unknown id "${String(id)}"`);
    }
    if (unlocked.has(id)) return reg;
    const next = new Set<K>(unlocked);
    next.add(id);
    // Auto-unlock capstone on completion.
    if (capstoneId !== null && !next.has(capstoneId)) {
      const allComplete = [...all].every((k) => next.has(k));
      if (allComplete) next.add(capstoneId);
    }
    return makeRegistry(all, capstoneId, next);
  }

  function partition(): { have: readonly K[]; missing: readonly K[] } {
    const have: K[] = [];
    const missing: K[] = [];
    for (const id of all) {
      if (unlocked.has(id)) have.push(id);
      else missing.push(id);
    }
    return { have, missing };
  }

  function list(): readonly K[] {
    return [...all];
  }

  const reg: CollectibleRegistry<K> = {
    all,
    capstoneId,
    unlocked,
    isComplete,
    isCapstone,
    unlock,
    partition,
    list,
  };
  return reg;
}

/**
 * Creates a `CollectibleRegistry` from `ids` (the collectible set) and an
 * optional `capstoneId`.
 *
 * Duplicate ids in `ids` throw. `capstoneId` may equal one of the ids in `ids`
 * (it is tracked as a separate gate — the capstone fires only on full completion,
 * not by direct unlock through `ids` membership alone).
 *
 * The capstone MUST be distinct from all ids in `ids` — if not, the capstone
 * unlock auto-fires on full completion regardless of whether the capstone id
 * was directly unlocked via the `ids` set, which would be semantically ambiguous.
 */
export function createCollectibleRegistry<K extends string>(
  ids: readonly K[],
  capstoneId?: K,
): CollectibleRegistry<K> {
  const all = new Set<K>();
  for (const id of ids) {
    if (all.has(id)) {
      throw new Error(`createCollectibleRegistry: duplicate id "${String(id)}"`);
    }
    all.add(id);
  }
  return makeRegistry<K>(all, capstoneId ?? null, new Set<K>());
}
