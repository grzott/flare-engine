# @flare-engine/physics

Built-in AABB / Circle collision detection — `CollisionWorld` with enter/exit signals, `SpatialIndex` brute-force broadphase tuned for <1000 dynamic entities, `raycast` for line-vs-shape queries. Trigger / layer / mask filtering. Solid-tile grid movement: `buildSolidGrid` / `isBlockedAABB` / `moveAndSlideInto` (structural `SolidTile` input, no tilemap dep, half-open AABB-vs-tile, axis-separated slide, zero-alloc). The planck.js Tier-2 integration is deferred until benchmarks justify it.

## Install

```sh
bun add @flare-engine/physics
```

## Usage

```ts
import { CollisionWorld, AABB, createCollider } from '@flare-engine/physics';

declare const entityA: number;
declare const x: number, y: number;

const world = new CollisionWorld();
world.onCollisionStart.add((pair) => console.log(pair.entityA, pair.entityB));

const colliderA = createCollider(AABB(32, 32), { layer: 1, mask: 2 });
world.add(entityA, colliderA.shape, x, y, false, colliderA.layer, colliderA.mask);
world.step();
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginephysics--4kb-aabb).

## License

MIT
