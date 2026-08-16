# @flare-engine/physics

Built-in AABB / Circle collision detection — `CollisionWorld` with enter/exit signals, `SpatialIndex` brute-force broadphase tuned for <1000 dynamic entities, `raycast` for line-vs-shape queries. Trigger / layer / mask filtering. Solid-tile grid movement: `buildSolidGrid` / `isBlockedAABB` / `moveAndSlideInto` (structural `SolidTile` input, no tilemap dep, half-open AABB-vs-tile, axis-separated slide, zero-alloc). The planck.js Tier-2 integration is deferred until benchmarks justify it. Measured cost by collider count — with the capture date and run-to-run spread — is published in [benchmarks](https://github.com/grzott/flare-engine/blob/main/docs/references/benchmarks.md). Those rows time a whole physics frame (move every collider, then `step()`), not `step()` in isolation, and the colliders drift apart while being measured; read them as an order-of-magnitude guide, which is where the `<1000` figure above comes from.

`@flare-engine/physics` answers *did these overlap*; `@flare-engine/dynamics` answers *where do they end up*. Neither package depends on the other — reach for [`@flare-engine/dynamics`](https://github.com/grzott/flare-engine/tree/main/packages/dynamics) when bodies need to push each other around, not just report contact.

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

Apache-2.0
