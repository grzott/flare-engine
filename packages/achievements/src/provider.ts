/** Opaque achievement identifier — adapter-defined. */
export type AchievementId = string;

/** Current state of an achievement for the local player. */
export interface AchievementState {
  id: AchievementId;
  unlocked: boolean;
  /** Partial progress in the range [0, 1]. `1` implies `unlocked: true`. */
  progress: number;
  unlockedAt?: number;
}

/**
 * Achievement provider interface. Consumers supply a concrete adapter (Game
 * Center, Google Play Games, Steam, custom backend) at the app boundary.
 * `unlock()` is idempotent by contract — adapters must dedupe.
 */
export interface AchievementsProvider {
  unlock(id: AchievementId, progress?: number): Promise<void>;
  getState(id: AchievementId): Promise<AchievementState>;
  getAll(): Promise<readonly AchievementState[]>;
}

/**
 * Default no-op provider. All queries report `unlocked: false, progress: 0`;
 * unlocks resolve silently.
 */
export const NoopAchievementsProvider: AchievementsProvider = {
  async unlock(): Promise<void> {
    // no-op
  },
  async getState(id: AchievementId): Promise<AchievementState> {
    return { id, unlocked: false, progress: 0 };
  },
  async getAll(): Promise<readonly AchievementState[]> {
    return [];
  },
};
