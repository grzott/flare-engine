import type { LeaderboardId, LeaderboardsProvider, ScoreEntry } from './provider.js';

/** A competitor row used to pre-populate an in-memory board (see {@link MemoryLeaderboardsOptions.seed}). */
export interface SeedScore {
  playerId: string;
  displayName: string;
  score: number;
  meta?: Record<string, unknown>;
}

/** Options for {@link createMemoryLeaderboards}. */
export interface MemoryLeaderboardsOptions {
  /** Identity all local submissions record under. Defaults to `'local'`. */
  playerId?: string;
  /** Display name paired with `playerId`. Defaults to `'Player'`. */
  displayName?: string;
  /** Per-board competitor rows, pre-populated so queries are meaningful without a backend. */
  seed?: Readonly<Record<LeaderboardId, readonly SeedScore[]>>;
}

/**
 * The in-memory provider IS a {@link LeaderboardsProvider} — its backend-free
 * nature is an implementation detail, not a wider surface. See
 * {@link createMemoryLeaderboards} for the recorded semantics.
 */
export type MemoryLeaderboards = LeaderboardsProvider;

interface InternalEntry {
  playerId: string;
  displayName: string;
  score: number;
  meta?: Record<string, unknown>;
  /** Monotonic insertion order; earlier submissions break score ties in their favour. */
  order: number;
}

/** Sort a board DESCENDING by score (ties by insertion order) and assign sequential 1-based ranks. */
function ranked(entries: readonly InternalEntry[]): ScoreEntry[] {
  return entries
    .slice()
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((e, i) => ({
      playerId: e.playerId,
      displayName: e.displayName,
      score: e.score,
      rank: i + 1,
      meta: e.meta,
    }));
}

/**
 * Create an in-memory {@link LeaderboardsProvider} — a backend-free adapter for
 * local development, tests, and single-player games.
 *
 * Semantics (the adapter-author contract):
 * - The provider interface's `submitScore(id, score, meta?)` carries no
 *   playerId, so every submission records under one local identity:
 *   `opts.playerId` (default `'local'`) / `opts.displayName` (default
 *   `'Player'`).
 * - Boards are per-id in-memory lists. `opts.seed` pre-populates competitor
 *   entries so `getTopN` / `getPlayerRank` are meaningful without a backend.
 * - `submitScore` keeps the local player's BEST (max) score per board: the
 *   first submission inserts an entry; a later HIGHER score replaces both the
 *   score AND the meta; a lower-or-equal score is ignored. Each entry carries a
 *   monotonic insertion counter for stable tie-breaking.
 * - `getTopN(id, n)` ranks the board DESCENDING by score, ties broken by
 *   insertion order (earlier submission ranks higher). Ranks are sequential
 *   1-based with no sharing. `n <= 0` and unknown boards return `[]`.
 * - `getPlayerRank(id)` returns the local player's 1-based rank under the same
 *   ordering, or `null` when the local player has no entry on that board.
 */
export function createMemoryLeaderboards(opts?: MemoryLeaderboardsOptions): MemoryLeaderboards {
  const localId = opts?.playerId ?? 'local';
  const localName = opts?.displayName ?? 'Player';
  const boards = new Map<LeaderboardId, InternalEntry[]>();
  let nextOrder = 0;

  if (opts?.seed !== undefined) {
    for (const [id, rows] of Object.entries(opts.seed)) {
      const board: InternalEntry[] = rows.map((row) => ({
        playerId: row.playerId,
        displayName: row.displayName,
        score: row.score,
        meta: row.meta,
        order: nextOrder++,
      }));
      boards.set(id, board);
    }
  }

  return {
    async submitScore(id, score, meta): Promise<void> {
      let board = boards.get(id);
      if (board === undefined) {
        board = [];
        boards.set(id, board);
      }
      const existing = board.find((e) => e.playerId === localId);
      if (existing === undefined) {
        board.push({
          playerId: localId,
          displayName: localName,
          score,
          meta,
          order: nextOrder++,
        });
      } else if (score > existing.score) {
        existing.score = score;
        existing.meta = meta;
      }
    },

    async getTopN(id, n): Promise<readonly ScoreEntry[]> {
      if (n <= 0) {
        return [];
      }
      const board = boards.get(id);
      if (board === undefined) {
        return [];
      }
      return ranked(board).slice(0, n);
    },

    async getPlayerRank(id): Promise<number | null> {
      const board = boards.get(id);
      if (board === undefined) {
        return null;
      }
      const found = ranked(board).find((e) => e.playerId === localId);
      return found === undefined ? null : found.rank;
    },
  };
}
