# @flare-engine/leaderboards

Typed `LeaderboardsProvider` interface + `NoopLeaderboardsProvider` + React context, plus `createMemoryLeaderboards` — a backend-free in-memory provider for tests, local dev, and single-player games. Concrete platform adapters (Game Center, Google Play Games, Steam) are post-launch; wire your own at the app boundary until then.

## Install

```sh
bun add @flare-engine/leaderboards
```

## Usage

```tsx
import {
  LeaderboardsContext,
  useLeaderboards,
  NoopLeaderboardsProvider,
} from '@flare-engine/leaderboards';

export function App() {
  return (
    <LeaderboardsContext.Provider value={NoopLeaderboardsProvider}>
      {/* ... */}
    </LeaderboardsContext.Provider>
  );
}
```

`useLeaderboards()` returns the active provider. The `LeaderboardsProvider` surface is `submitScore(id, score, meta?)`, `getTopN(id, n)`, and `getPlayerRank(id)` — all async. Swapping `NoopLeaderboardsProvider` for another provider requires no consumer changes.

## Local provider — `createMemoryLeaderboards`

An in-memory `LeaderboardsProvider` with documented semantics, for tests and dev:

```ts
import { createMemoryLeaderboards } from '@flare-engine/leaderboards';

const boards = createMemoryLeaderboards({
  playerId: 'p1',
  displayName: 'You',
  seed: {
    daily: [
      { playerId: 'a', displayName: 'Ada', score: 300 },
      { playerId: 'b', displayName: 'Bo', score: 100 },
    ],
  },
});

await boards.submitScore('daily', 250);
await boards.getTopN('daily', 10); // [Ada 300 #1, You 250 #2, Bo 100 #3]
await boards.getPlayerRank('daily'); // 2
```

- Every `submitScore` records under one local identity (`playerId` default `'local'` / `displayName` default `'Player'`) — the interface carries no player id.
- `seed` pre-populates competitor rows per board so queries are meaningful without a backend.
- Best-score wins: a strictly higher submission replaces the local player's score and meta; a lower-or-equal one is ignored.
- Ranking is descending by score, ties broken by insertion order (earlier ranks higher), with sequential 1-based ranks. `getTopN` returns up to `n` rows (`n <= 0` or an unknown board → `[]`); `getPlayerRank` returns the local rank or `null` when the local player has no entry.
- The board grows unbounded (no eviction) — it's for tests and local dev, not production storage.

## Env-gated fallback

In CI or dev builds without platform credentials, select `NoopLeaderboardsProvider` (or `createMemoryLeaderboards`) behind your own env flag so nothing touches a native SDK until real credentials are present.
