# @flare-engine/dynamics

## 0.4.12

### Patch Changes

- Updated dependencies [c0c5f1a]
- Updated dependencies [ee7781a]
- Updated dependencies [2b3c047]
- Updated dependencies [e0be221]
- Updated dependencies [e3474bc]
- Updated dependencies [636a8eb]
  - @flare-engine/math@0.4.12

## 0.4.11

### Patch Changes

- @flare-engine/math@0.4.11

## 0.4.10

### Patch Changes

- 266593b: `createTimeline(elementCount, dt, opts?)` records a fixed-step simulation once into a pre-allocated
  `Float32Array` and replays it by sampling. `opts.stride` (default 3: dx, dy, angle) sets the floats
  per element per frame and `opts.maxFrames` (default 900) the cap; the buffer is sized at creation.
  `record(writer, until?)` writes frames until `until()` returns true or the buffer is full, exactly one
  frame when `until` is omitted, and never calls the writer once full or when `elementCount` is 0; the
  writer gets `(buf, frameBase)` with element `i` at `frameBase + i * stride`. `sampleInto(progress,
out)` clamps `progress` to `[0, 1]` (NaN reads as 0), lerps the two bracketing frames into `out`
  without allocating, writes zeros before the first frame and copies a lone frame; values are stored as
  written, so cumulative angles lerp forward across multi-turn spins. `frameCount` and `duration`
  (`(frameCount - 1) * dt`, 0 below two frames) are read-only getters. A non-integer or negative
  `elementCount`, a non-finite or non-positive `dt`, or a `stride` / `maxFrames` below 1 throws a
  `RangeError` naming the argument. `Timeline`, `TimelineOptions` and `TimelineWriter` are exported.
- bd5e641: `createWorld({ sleep: { linearThreshold, angularThreshold, steps } })` opts into per-body sleeping
  (off when absent, so existing worlds are unchanged): a dynamic body under both thresholds for
  `steps` consecutive steps has its velocities set to exactly 0 and is skipped by integration and by
  pair tests against other sleeping or static bodies, until an awake body that moved on the previous
  step touches it, its `velocity`, `angularVelocity`, `position` or `angle` is written, or
  `wakeBody(world, body)` is called; a world not created by `createWorld` steps with sleeping off.
  `isSleeping(world, body)` reads one body and `isAtRest(world)` is true once every dynamic body
  sleeps. A negative or non-finite threshold, or a `steps` that is not an integer >= 1, throws a
  `RangeError`. `SleepOptions` is exported.
- 2d2663a: `stepUntil(world, dt, opts)` repeats `step(world, dt)` and, after each step, stops when `opts.done()`
  returns true (`complete: true`), when `steps >= opts.maxSteps`, or when `now() - start >= opts.budgetMs`
  (both `complete: false`), checked in that order; it always takes at least one step, so a zero budget
  still makes progress. `opts.now` defaults to `performance.now` (falling back to `Date.now`) and can
  be injected for deterministic tests. `stepUntilInto(world, dt, opts, out)` is the zero-alloc form that
  writes `out` and returns it. A non-finite or non-positive `dt`, a negative or non-finite `budgetMs`,
  or a `maxSteps` that is not an integer >= 1 throws a `RangeError` naming the argument.
  `StepUntilOptions` and `StepUntilResult` are exported.
  - @flare-engine/math@0.4.10

## 0.4.9

### Patch Changes

- @flare-engine/math@0.4.9

## 0.4.8

### Patch Changes

- @flare-engine/math@0.4.8

## 0.4.7

### Patch Changes

- @flare-engine/math@0.4.7

## 0.4.6

### Patch Changes

- @flare-engine/math@0.4.6

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.
- Updated dependencies [8814ec2]
  - @flare-engine/math@0.4.5

## 0.4.4

### Patch Changes

- @flare-engine/math@0.4.4

## 0.4.3

### Patch Changes

- @flare-engine/math@0.4.3

## 0.4.2

### Patch Changes

- @flare-engine/math@0.4.2

## 0.4.1

### Patch Changes

- @flare-engine/math@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [da81c97]
- Updated dependencies [fb5a0c5]
  - @flare-engine/math@0.4.0

## 0.3.1

### Patch Changes

- 8701b58: Export `BodyOptions`, `WorldOptions` and `isStatic` from the package barrel.

  All three were already declared and emitted into `dist/index.d.mts`, but were
  absent from the barrel's export list, so a TypeScript consumer could not write
  `import type { BodyOptions } from '@flare-engine/dynamics'` and had no supported
  way to test staticness — `static` is a `createBody` input, not a `Body` field, so
  the only alternatives were `Parameters<typeof createBody>[0]` and an open-coded
  `invMass === 0`.

  The package's own row spec required exactly this surface (types `Body`,
  `BodyOptions`, `World`, `WorldOptions`; values `createBody`, `isStatic`,
  `createWorld`, `addBody`, `step`); the shipped 0.3.0 barrel carried six of the
  nine names. Found by the first external consumer, `grzott-portfolio`, while
  swapping its hand-rolled solver for this package.

  Additive only — no existing export changes.

  - @flare-engine/math@0.3.1

## 0.3.0

### Minor Changes

- d5286bc: New package `@flare-engine/dynamics`: 2D rigid bodies over oriented boxes — SAT plus reference/
  incident face clipping for 1-2 point contact manifolds, and a sequential-impulse solver with
  Coulomb friction, restitution, and Baumgarte de-penetration. Bodies are plain objects with mutable
  `position` / `velocity`; all per-step structures are pooled per world, so `step()` allocates
  nothing in steady state. Complements `@flare-engine/physics`, which stays collision detection only.

  `@flare-engine/engine` re-exports the six-name `dynamics` barrel (`createWorld`, `addBody`,
  `createBody`, `step`, plus `Body`/`World` aliased as `DynamicsBody`/`DynamicsWorld` to avoid
  colliding with the `ecs` `World` class already in the umbrella).

### Patch Changes

- Updated dependencies [6a10aa9]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [84fd0a3]
  - @flare-engine/math@0.3.0
