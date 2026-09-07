# @flare-engine/physics

Built-in AABB / Circle collision detection — `CollisionWorld` with enter/exit signals, `SpatialIndex` uniform spatial-hash broadphase, `CollisionWorld.raycast` for broadphase-backed ray queries plus a standalone `raycast` for an explicit target list, and `overlapInto` for minimum-translation resolution. Trigger / layer / mask filtering. Solid-tile grid movement: `buildSolidGrid` / `isBlockedAABB` / `moveAndSlideInto` (structural `SolidTile` input, no tilemap dep, half-open AABB-vs-tile, axis-separated slide, zero-alloc). There is no third-party physics dependency: rigid-body response lives in the first-party [`@flare-engine/dynamics`](https://github.com/grzott/flare-engine/tree/main/packages/dynamics), and the planck.js option evaluated in the design docs was never adopted. Measured cost by collider count — with the capture date and run-to-run spread — is published in [benchmarks](https://github.com/grzott/flare-engine/blob/main/docs/references/benchmarks.md). Those rows time a whole physics frame (move every collider, then `step()`), not `step()` in isolation. Colliders wrap at a hard field boundary so density is constant for the whole sample window, and a probe fails the capture if one escapes; read the rows as an order-of-magnitude guide, which is where the `<1000` figure above comes from.

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
world.addCollider(entityA, colliderA, x, y);
world.step();
```

## Resolving a collision

`shapeOverlap` answers *whether* two shapes collide, which leaves you knowing there is a problem and
not how to fix it. `overlapInto` gives the minimum translation vector — the shortest push that
separates them:

```ts
import { AABB, CircleShape, createOverlap, overlapInto } from '@flare-engine/physics';

const mtv = createOverlap(); // reuse across pairs — no per-pair allocation
if (overlapInto(AABB(32, 32), 0, 0, CircleShape(8), 18, 4, mtv) !== null) {
  // mtv.x / mtv.y is a unit axis pointing from a toward b; mtv.depth is how far
  // b must move along it to just stop touching.
}
```

Returns `null` when the shapes are apart, leaving your buffer untouched. Concentric circles have no
meaningful axis, so `(1, 0)` is returned rather than `NaN` from normalising a zero vector.

## Raycasting the world

```ts
import { CollisionWorld } from '@flare-engine/physics';

declare const world: CollisionWorld;

// Nearest hit along +x, limited to colliders on layers 1 and 2.
const hit = world.raycast(0, 0, 1, 0, 500, 0b011);
if (hit !== null) {
  // hit.entity / hit.distance / hit.point / hit.normal
}
```

`CollisionWorld.raycast` walks only the broadphase cells the ray's bounding box touches, and filters
by the `layer` bits colliders already carry (`mask` defaults to every layer). The standalone
`raycast(ox, oy, dx, dy, maxDist, targets)` export remains for casting against an explicit list that
is not in a world.

**The returned hit record is reused between calls** — read it, or copy what you need, before casting
again. That is what keeps a per-frame ray allocation-free; the standalone helper by contrast builds a
fresh hit (plus two nested `Vec2`s) for *every candidate it tests* and discards all but the closest.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginephysics--4kb-aabb).

## License

Apache-2.0
