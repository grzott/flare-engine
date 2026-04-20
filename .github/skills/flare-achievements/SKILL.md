---
name: flare-achievements
description: Deep knowledge of the @flare-engine/achievements package — typed achievement provider interface, unlock/progress, NoopProvider, AchievementsContext, useAchievements. Use when wiring an achievements provider (Game Center / Play Games / Steam / custom backend) to a Flare game. Concrete adapters ship in 0.2.0.
---

# `@flare-engine/achievements`

Tier-2 stub. Interface-only at 0.1.0.

```ts
import {
  type AchievementsProvider,
  createNoopProvider,
  AchievementsContext,
  useAchievements,
} from "@flare-engine/achievements";
```

## Interface

```ts
interface AchievementsProvider {
  unlock(id: string): Promise<UnlockResult>;
  setProgress(id: string, percent: number): Promise<UnlockResult>;
  list(): Promise<Achievement[]>;
}
```

Wire a real adapter by replacing `createNoopProvider()` in `AchievementsContext.Provider`. Adapters ship 0.2.0. See [flare-tier2-stubs](../flare-tier2-stubs/SKILL.md).
