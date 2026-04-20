---
name: flare-physics
description: Deep knowledge of the @flare-engine/physics package — CollisionWorld, AABB and Circle shapes, Collider, SpatialIndex, raycast. Use when adding collision detection, trigger zones, raycasting, or spatial broadphase queries in Flare. Built-in AABB tier only; planck.js tier deferred.
---

# `@flare-engine/physics`

Layer 2. Depends on `@flare-engine/math` and `@flare-engine/events`. Built-in AABB / Circle tier only — planck.js Tier 2 is deferred.

## Exports

```ts
import {
  CollisionWorld,
  type CollisionPair,
  AABB,
  CircleShape,
  shapeBounds,
  shapeBoundsInto,
  createCollider,
  type Collider,
  raycast,
  type RaycastHit,
  type RaycastTarget,
  SpatialIndex,
  type SpatialEntry,
} from "@flare-engine/physics";
```

## Collision signals

Attach listeners **before the first `step()`** or enter events are lost:

```ts
world.onCollisionStart.add((pair) => {
  /* ... */
});
world.onCollisionEnd.add((pair) => {
  /* ... */
});
world.onTriggerEnter.add((pair) => {
  /* ... */
});
world.onTriggerExit.add((pair) => {
  /* ... */
});
world.step();
```

Pairs are tracked across frames by `"minId:maxId"` string keys — do not rebuild the internal pair `Set`.

## Limits

- `SpatialIndex` is brute-force, tuned for `<1000` dynamic entities. Above that, write a grid/quadtree sibling module.
- `queryBuf` is reused across calls — drain or copy before the next query.
- `raycast()` does no internal broadphase — the caller pre-filters candidates into `RaycastTarget[]`.

Package-specific rules: [.github/instructions/physics.instructions.md](../../instructions/physics.instructions.md). Spec: [docs/design/api-specs.md § @flare-engine/physics](../../../docs/design/api-specs.md).
