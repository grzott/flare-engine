---
name: flare-math
description: Deep knowledge of the @flare-engine/math package — Vec2, Rect, Circle, Transform2D, Mat3, Color, easings, seeded RNG, intersection tests. Use when writing vector math, 2D geometry, color math, easing curves, seeded random sequences, or collision-shape intersections in Flare.
---

# `@flare-engine/math`

Layer 0. Zero dependencies. `~5KB` gzip target. All types are plain `{x,y}`-style objects; static namespaces hold the operations — no class instances in hot paths.

## Exports

```ts
import {
  vec2,
  Vec2,
  Rect,
  Circle,
  Transform2D,
  Mat3,
  Color,
  // scalars
  clamp,
  lerp,
  inverseLerp,
  map,
  degToRad,
  radToDeg,
  approxEquals,
  wrap,
  pingPong,
  smoothStep,
  sign,
  // random (seeded)
  SeededRNG,
  randomFloat,
  randomInt,
  randomVec2InRect,
  randomPointInCircle,
  shuffle,
  choose,
  // intersection
  pointInRect,
  pointInCircle,
  rectVsRect,
  rectVsCircle,
  circleVsCircle,
  lineVsRect,
  lineVsCircle,
  rayVsRect,
  // 32 easing functions
  easeInQuad,
  easeOutCubic,
  easeInOutBack /* …and the rest */,
} from "@flare-engine/math";
```

## Zero-alloc rules

- `Vec2.add(a, b)` allocates; `Vec2.add(a, b, out)` writes into `out` — use the `out` form inside loops.
- `Rect`, `Circle`, `Color` follow the same pattern: static functions take optional `out` for per-frame work.
- `Mat3` is backed by `Float32Array` (Skia-compatible) — pre-allocate and reuse.

## Pitfalls

- `Vec2.normalize(zero)` returns zero, not `NaN` — guard if you need a non-zero direction.
- `randomFloat(a, b)` is exclusive of `b`. `randomInt(a, b)` is inclusive of both.
- `wrap` and `pingPong` handle negative inputs correctly — don't reinvent with `%`.

Spec: [docs/design/api-specs.md § @flare-engine/math](../../../docs/design/api-specs.md).
