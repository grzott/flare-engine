---
name: flare-leaderboards
description: Deep knowledge of the @flare-engine/leaderboards package — typed leaderboard provider interface, submit/fetch, NoopProvider, LeaderboardsContext, useLeaderboards. Use when wiring a leaderboard provider (Game Center / Play Games / custom backend) to a Flare game. Concrete adapters ship in 0.2.0.
---

# `@flare-engine/leaderboards`

Tier-2 stub. Interface-only at 0.1.0.

```ts
import {
  type LeaderboardsProvider,
  createNoopProvider,
  LeaderboardsContext,
  useLeaderboards,
} from "@flare-engine/leaderboards";
```

## Interface

```ts
interface LeaderboardsProvider {
  submit(boardId: string, score: number): Promise<SubmitResult>;
  fetchTop(boardId: string, limit?: number): Promise<Entry[]>;
  fetchAround(
    boardId: string,
    userId: string,
    radius?: number,
  ): Promise<Entry[]>;
}
```

Wire a real adapter by replacing `createNoopProvider()` in `LeaderboardsContext.Provider`. Adapters ship 0.2.0. See [flare-tier2-stubs](../flare-tier2-stubs/SKILL.md).
