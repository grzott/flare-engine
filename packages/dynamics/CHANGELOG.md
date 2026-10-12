# @flare-engine/dynamics

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
