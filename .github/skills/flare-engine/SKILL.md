---
name: flare-engine
description: Deep knowledge of the @flare-engine/engine convenience package — createGame factory, GameConfig, GameInstance, umbrella re-exports of all lower @flare-engine/* packages. Use when bootstrapping a new Flare game, understanding which subsystems createGame wires together, or extending the integration layer.
---

# `@flare-engine/engine`

Layer 4 (top). Integration package. Convenience factory + the one place in the monorepo where `export *` barrels are allowed.

## Exports

```ts
import {
  createGame,
  type GameConfig,
  type GameInstance,
} from "@flare-engine/engine";
// plus umbrella re-exports: @flare-engine/math, events, core, ecs, render, input,
// physics, audio, assets, scene, animation, particles, tilemap, debug, react.
```

## Usage sketch

```ts
import { createGame } from "@flare-engine/engine";

const game = createGame({
  fixedDt: 1 / 60,
  maxDt: 0.25,
  assetLoader,
});
// game.world, game.camera, game.renderer, game.batch, game.input,
// game.audio, game.assets, game.scenes, game.loop
```

Then mount `<GameView config={{ game }}>` from `@flare-engine/react`.

## `createTier2Wiring` (Phase 11.14)

Structurally-typed bridge from a game's event bus to Tier-2 providers (analytics / leaderboards / achievements). Decoupled from the concrete Tier-2 packages — anything matching the structural interfaces plugs in, including the shipped NoopProviders.

```ts
import { createTier2Wiring } from "@flare-engine/engine";

const teardown = createTier2Wiring({
  events: gameEvents, // any { on(event, handler) => () => void }
  providers: { analytics, leaderboards, achievements },
  rules: [
    {
      kind: "analytics",
      event: "zone-complete",
      map: (zone, score) => ({ event: "zone_complete", props: { zone, score } }),
    },
    {
      kind: "leaderboard",
      event: "zone-complete",
      map: (zone, score) => ({ id: `zone_${zone}_high_score`, score: Number(score) }),
    },
    {
      kind: "achievement",
      event: "zone-complete",
      map: (zone) => (zone === 1 ? "first_shard" : zone === 8 ? "all_shards" : null),
    },
  ],
});

// teardown() removes every listener.
```

`map` returning `null` skips dispatch. `achievement` rules may return a single id or `readonly string[]` for batch unlocks. IAP is **not** wired here — the IAP adapter is subscribed to directly via `EntitlementStore.attachProvider` in `@flare-engine/iap`.

## Rules

- `createGame` is a **pure factory** — every call returns a fresh `GameInstance`. No singletons, no module-scoped caches.
- `@flare-engine/engine` does **not** own the render loop or Skia canvas lifecycle. That's `@flare-engine/react`'s job. Never call `Renderer.begin()` / `end()` from this package.
- Adding a new `@flare-engine/*` package means adding an `export *` line to `src/index.ts` (in dependency order).
- `createTier2Wiring` uses structural interfaces only — it adds no new package deps. Tests must import from `../src/tier2-wiring.js` directly; the barrel pulls `@flare-engine/react` which crashes `bun test` under RN.

Package-specific rules: [.github/instructions/engine.instructions.md](../../instructions/engine.instructions.md). Spec: [docs/design/api-specs.md § @flare-engine/engine](../../../docs/design/api-specs.md).
