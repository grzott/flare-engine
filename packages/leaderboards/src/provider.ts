/** Opaque leaderboard identifier — adapter-defined (e.g., "daily_high_score"). */
export type LeaderboardId = string;

/** A single leaderboard row. */
export interface ScoreEntry {
  playerId: string;
  displayName: string;
  score: number;
  rank: number;
  meta?: Record<string, unknown>;
}

/**
 * Leaderboard provider interface. Consumers supply a concrete adapter (Game
 * Center, Google Play Games, Steam, custom backend) at the app boundary.
 * 0.1.0 ships the interface + a no-op default so downstream packages can
 * depend on it without forcing a platform choice.
 */
export interface LeaderboardsProvider {
  submitScore(id: LeaderboardId, score: number, meta?: Record<string, unknown>): Promise<void>;
  getTopN(id: LeaderboardId, n: number): Promise<readonly ScoreEntry[]>;
  getPlayerRank(id: LeaderboardId): Promise<number | null>;
}

/**
 * Default no-op provider. Submissions resolve silently; queries return empty
 * arrays and `null` rank.
 */
export const NoopLeaderboardsProvider: LeaderboardsProvider = {
  async submitScore(): Promise<void> {
    // no-op
  },
  async getTopN(): Promise<readonly ScoreEntry[]> {
    return [];
  },
  async getPlayerRank(): Promise<number | null> {
    return null;
  },
};
