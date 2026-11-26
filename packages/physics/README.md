# @flare-engine/physics

Built-in AABB / Circle collision detection — `CollisionWorld` with enter/exit signals, `SpatialIndex` uniform spatial-hash broadphase, `CollisionWorld.raycast` for broadphase-backed ray queries plus a standalone `raycast` for an explicit target list, and `overlapInto` for minimum-translation resolution. Trigger / layer / mask filtering. Solid-tile grid movement: `buildSolidGrid` / `isBlockedAABB` / `moveAndSlideInto` (structural `SolidTile` input, no tilemap dep, half-open AABB-vs-tile, axis-separated slide, zero-alloc), with `isSolidAt` / `setSolidAt` to read or flip one cell at runtime. There is no third-party physics dependency: rigid-body response lives in the first-party [`@flare-engine/dynamics`](https://github.com/grzott/flare-engine/tree/main/packages/dynamics), and the planck.js option evaluated in the design docs was never adopted. Measured cost by collider count — with the capture date and run-to-run spread — is published in [benchmarks](https://github.com/grzott/flare-engine/blob/main/docs/references/benchmarks.md). Those rows time a whole physics frame (move every collider, then `step()`), not `step()` in isolation. Colliders wrap at a hard field boundary so density is constant for the whole sample window, and a probe fails the capture if one escapes; read the rows as an order-of-magnitude guide, which is where the `<1000` figure above comes from.

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

**Touching is not colliding.** Every shape pair is strict: two shapes whose edges exactly meet do not
overlap, in `shapeOverlap` and `overlapInto` alike, so the two always agree. A zero-radius circle
collides only when strictly inside a box, as a zero-size box does.

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
again. That is what keeps a per-frame ray allocation-free; the standalone helper by contrast returns
a fresh hit (plus two nested `Vec2`s) from each call that hits, which the caller may keep.

## Pixel masks

A `MaskShape` is a sprite's solid pixels as a bitmask, for contact that follows the art instead of
its box. It sits beside `Shape`, not in it: `CollisionWorld` does not take one. Keep a box collider
for the broadphase and refine the pairs it reports.

```ts
import {
  createMaskPose,
  createMaskShape,
  maskOverlapsBox,
  maskOverlapsCircle,
  maskOverlapsMask,
  rayVsMask,
} from '@flare-engine/physics';

declare const shipX: number, shipY: number, turn: number;
declare const rock: ReturnType<typeof createMaskShape>;
declare const rockPose: ReturnType<typeof createMaskPose>;

// Built once, at load. `#` is solid.
const ship = createMaskShape(['.#.', '###', '#.#']);

// One pose per entity, reused every frame.
const pose = createMaskPose();
pose.px = 1.5; // the pivot, in mask px: the point that sits on the position
pose.py = 1.5;
pose.unit = 4; // world units per mask px

pose.x = shipX;
pose.y = shipY;
pose.cos = Math.cos(turn);
pose.sin = Math.sin(turn);

maskOverlapsBox(ship, pose, 10, 10, 2, 2); // world box: centre, half extents
maskOverlapsCircle(ship, pose, 10, 10, 3);
maskOverlapsMask(ship, pose, rock, rockPose);
rayVsMask(ship, pose, 0, 0, 1, 0, 500); // distance, 0 if it starts inside, -1 on a miss
```

A mask is `{ x, y, w, h, words }`: bounds in the sprite frame's px (`x` / `y` offset the solid region
from the frame's corner, so a collider need not be centred on its entity) and `Math.ceil(w / 32)`
32-bit words per row, bit `c & 31` of word `c >>> 5` for column `c`. `words` may be a `number[]` or
a `Uint32Array`, so a generated table of that layout is a `MaskShape` as it stands.

What each test promises:

- **Touching is not overlapping**, as everywhere else in this package.
- `maskOverlapsCircle`, `maskOverlapsMask` and `rayVsMask` work in the mask's own frame and are exact
  at any turn, up to floating-point rounding.
- `maskOverlapsBox` takes a box that is axis-aligned in the world. Against a turned mask it tests the
  box's bounding box in the mask's frame: exact at a multiple of a quarter turn, generous by the
  box's corners otherwise. Its `erode` flag tests the mask shrunk by 1 px.
- `maskOverlapsSweptBox` samples `maskOverlapsBox` along a segment, at most half a px apart, so a
  fast box cannot skip a 1 px feature. It takes at most 257 samples; a longer segment is sampled
  more coarsely and can miss.
- `maskStripStop` gives where an axis-aligned beam first meets the mask; a turned pixel counts by its
  bounding box.
- `maskBoundsInto` writes the world box around the posed bounds, for a broadphase query.

None of these allocates. `maskOverlapsMask` walks the pixels of both masks inside the overlap of
their bounds, so use it on pairs a box test already passed.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginephysics).

## License

Apache-2.0
