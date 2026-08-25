# @flare-engine/dynamics

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
