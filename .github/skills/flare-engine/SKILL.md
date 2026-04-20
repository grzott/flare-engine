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

## Rules

- `createGame` is a **pure factory** — every call returns a fresh `GameInstance`. No singletons, no module-scoped caches.
- `@flare-engine/engine` does **not** own the render loop or Skia canvas lifecycle. That's `@flare-engine/react`'s job. Never call `Renderer.begin()` / `end()` from this package.
- Adding a new `@flare-engine/*` package means adding an `export *` line to `src/index.ts` (in dependency order).

Package-specific rules: [.github/instructions/engine.instructions.md](../../instructions/engine.instructions.md). Spec: [docs/design/api-specs.md § @flare-engine/engine](../../../docs/design/api-specs.md).
