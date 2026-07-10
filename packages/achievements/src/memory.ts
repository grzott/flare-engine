import type { AchievementId, AchievementState, AchievementsProvider } from './provider.js';

/**
 * Structural async key/value store the storage-backed provider persists into.
 * Matches the `get`/`set` subset of `@flare-engine/storage`'s `StorageAdapter`
 * so a real adapter can be injected without depending on the storage package.
 */
export interface AchievementsStore {
  /** Read a value. Resolves to `null` if the key is not present. */
  get(key: string): Promise<string | null>;
  /** Write a value. */
  set(key: string, value: string): Promise<void>;
}

/** Options common to the in-memory and storage-backed providers. */
export interface MemoryAchievementsOptions {
  /** Clock used to stamp `unlockedAt` on latch. Defaults to `() => Date.now()`. */
  now?: () => number;
}

/** Options for the storage-backed provider. */
export interface StorageAchievementsOptions extends MemoryAchievementsOptions {
  /** Persistence key passed to the injected store. Defaults to `'flare.achievements'`. */
  key?: string;
}

const DEFAULT_KEY = 'flare.achievements';

/** Coerce raw progress to `[0, 1]`; a non-finite value (NaN/Infinity) becomes `0`. */
function normalizeProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Default state for an untracked id — no `unlockedAt`. */
function defaultState(id: AchievementId): AchievementState {
  return { id, unlocked: false, progress: 0 };
}

/**
 * Pure state transition shared by both providers. Given the current state, an
 * optional progress arg and a clock, returns the next state:
 *
 * - `progress` omitted means a FULL unlock (target progress `1`).
 * - Progress is clamped to `[0, 1]`; non-finite input is treated as `0`.
 * - Progress is MONOTONIC — it never decreases below the stored value; a lower
 *   requested progress is ignored.
 * - Unlock LATCHES: reaching progress `1` sets `unlocked: true` and stamps
 *   `unlockedAt` once (via `now`). An already-unlocked state keeps its original
 *   `unlockedAt`, so re-unlocking is a no-op.
 */
function mergeAchievement(
  current: AchievementState,
  progress: number | undefined,
  now: () => number,
): AchievementState {
  const requested = progress === undefined ? 1 : normalizeProgress(progress);
  const nextProgress = requested > current.progress ? requested : current.progress;
  if (!current.unlocked && nextProgress < 1) {
    return { id: current.id, unlocked: false, progress: nextProgress };
  }
  const unlockedAt = current.unlockedAt ?? now();
  return { id: current.id, unlocked: true, progress: 1, unlockedAt };
}

/**
 * In-memory `AchievementsProvider`. Progress is monotonic and unlocks latch with
 * a single `unlockedAt` stamp; see {@link mergeAchievement} for exact semantics.
 * State is not persisted — it lives for the lifetime of the returned provider.
 */
export function createMemoryAchievements(opts?: MemoryAchievementsOptions): AchievementsProvider {
  const now = opts?.now ?? (() => Date.now());
  const states = new Map<AchievementId, AchievementState>();
  return {
    async unlock(id: AchievementId, progress?: number): Promise<void> {
      states.set(id, mergeAchievement(states.get(id) ?? defaultState(id), progress, now));
    },
    async getState(id: AchievementId): Promise<AchievementState> {
      return states.get(id) ?? defaultState(id);
    },
    async getAll(): Promise<readonly AchievementState[]> {
      return [...states.values()];
    },
  };
}

/**
 * Storage-backed `AchievementsProvider`. Shares the monotonic/latch semantics of
 * {@link createMemoryAchievements} and persists into the injected
 * {@link AchievementsStore}.
 *
 * State hydrates lazily from `store.get(key)` on the first call (a JSON array of
 * `AchievementState`; a parse error hydrates empty) and is written back via
 * `store.set` after every mutation. All mutations are serialized through a single
 * chained tail promise so a read-modify-write can never interleave and lose an
 * update under concurrent unlocks.
 */
export function createStorageAchievements(
  store: AchievementsStore,
  opts?: StorageAchievementsOptions,
): AchievementsProvider {
  const now = opts?.now ?? (() => Date.now());
  const key = opts?.key ?? DEFAULT_KEY;
  const states = new Map<AchievementId, AchievementState>();
  let hydration: Promise<void> | undefined;
  let tail: Promise<void> = Promise.resolve();

  function hydrate(): Promise<void> {
    if (hydration === undefined) {
      hydration = store.get(key).then((raw) => {
        if (raw === null) return;
        try {
          const parsed = JSON.parse(raw) as AchievementState[];
          for (const state of parsed) states.set(state.id, state);
        } catch {
          // Corrupt payload — hydrate empty.
        }
      });
    }
    return hydration;
  }

  function persist(): Promise<void> {
    return store.set(key, JSON.stringify([...states.values()]));
  }

  return {
    unlock(id: AchievementId, progress?: number): Promise<void> {
      const run = tail.then(async () => {
        await hydrate();
        states.set(id, mergeAchievement(states.get(id) ?? defaultState(id), progress, now));
        await persist();
      });
      // Swallow on the tail so one failed write cannot break serialization for
      // later mutations; the caller still observes the error via `run`.
      tail = run.catch(() => {});
      return run;
    },
    async getState(id: AchievementId): Promise<AchievementState> {
      await hydrate();
      return states.get(id) ?? defaultState(id);
    },
    async getAll(): Promise<readonly AchievementState[]> {
      await hydrate();
      return [...states.values()];
    },
  };
}
