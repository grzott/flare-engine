---
name: flare-debug
description: Deep knowledge of the @flare-engine/debug package — StatsTracker, TimeControl, DebugStats, createFpsWidget, overlays. Use when adding FPS overlays, entity-count display, pause/step/slow-motion, or collision-bound debug rendering to a Flare game.
---

# `@flare-engine/debug`

Layer 3. Tree-shaken in production via `__DEV__` guards.

## Exports

```ts
import {
  type DebugStats,
  StatsTracker,
  TimeControl,
  type FpsWidget,
  type FpsWidgetOptions,
  createFpsWidget,
  // overlay helpers (drawCollisionBounds, drawVelocityVectors, etc.)
} from "@flare-engine/debug";
```

## Usage sketch

```ts
const stats = new StatsTracker();
const fps = createFpsWidget({ precision: 1 });

loop.onUpdate.add((dt) => {
  stats.tick(dt, { entities: world.size, drawCalls: renderer.stats.drawCalls });
  const label = fps.oneLine(stats.snapshot()); // "60 FPS | 16.7ms | e:42 d:8"
});

const time = new TimeControl(loop);
time.pause();
time.step();
time.setScale(0.1);
```

## Rules

- `createFpsWidget` is render-agnostic — it produces strings, you draw them via Skia or RN `<Text>`.
- Wrap debug code in `if (__DEV__) { … }` so it's eliminated by tsup in production builds.
- Entity inspector (tap-to-log) lives here in 0.1.0 partial form; the full panel moves to `@flare-engine/devtools` in 0.2.0.

Spec: [docs/design/api-specs.md § @flare-engine/debug](../../../docs/design/api-specs.md).
