# @flare-engine/math

2D math primitives for the Flare engine — `Vec2`, `Rect`, `Circle`, `Transform2D`, `Mat3`, `Color`, 35 easing functions, seeded RNG, intersection tests, angle/steering helpers (`angleDelta`, `rotateTowards`, `Vec2.turnVelocityTowardInto`, `Vec2.scaleToLengthInto`, `Vec2.perp`, `Vec2.crossSV`), weighted random picks (`weightedIndex`, `weightedIndexBy`, `weightedPick`), deterministic hash utils (`hashU32`, `seededIndex`), and timed-window reward math (`cappedBonus`, `advanceWindowedStreak`, `windowExpired`, `remainingInWindow`). Plain-object types with static method namespaces; zero-alloc forms take an `out` parameter to avoid GC pressure in game loops.

## Install

```sh
bun add @flare-engine/math
```

## Usage

```ts
import { vec2, Vec2, Rect, easeOutQuad, SeededRNG } from '@flare-engine/math';

const a = vec2(0, 0);
const b = vec2(10, 0);
const out = vec2(0, 0);
Vec2.lerp(a, b, 0.5, out);

const rng = new SeededRNG(42);
const t = easeOutQuad(rng.float(0, 1));
```

## Curves

Quadratic/cubic Bézier and Catmull-Rom sampling, each with an allocating form and an `…Into` twin
for per-frame use, plus approximate arc length:

```ts
import { bezier3Into, catmullRom, bezier3Length, vec2 } from '@flare-engine/math';

// Sampling a path each frame — reuse one buffer, allocate nothing.
const point = vec2(0, 0);
bezier3Into(0, 0, 20, 60, 80, 60, 100, 0, 0.35, point);

// Catmull-Rom passes *through* p1 and p2, so a path hits its waypoints exactly.
const onPath = catmullRom(0, 0, 10, 5, 20, 5, 30, 0, 0.5);

// Arc length is a chord approximation, so always a slight underestimate.
const length = bezier3Length(0, 0, 20, 60, 80, 60, 100, 0, 32);
```

Control points are loose numbers rather than `Vec2` objects, so coordinates already held in a
`Float32Array` can be sampled without building temporaries first. `t` is clamped to `[0, 1]` rather
than extrapolating.

## Segment intersection

`intersection.ts` answers *whether* shapes intersect; these answer *where* two segments cross:

```ts
import { segmentIntersection, segmentsIntersect, vec2, segmentIntersectionInto } from '@flare-engine/math';

segmentIntersection(5, 0, 5, 10, 0, 5, 10, 5); // → { x: 5, y: 5 }

// Zero-alloc form; `out` is left untouched when the result is null.
const hit = vec2(0, 0);
segmentIntersectionInto(0, 0, 10, 10, 0, 10, 10, 0, hit);
```

**Collinear overlap returns `null`.** Two segments lying on top of each other do intersect — at
infinitely many points — so there is no single point to report. Ask `segmentsIntersect` when the
yes/no answer is what you want; it returns `true` for that case.

## Deterministic saves and replays

`SeededRNG` exposes its whole state as one int32, so a run can be stored and resumed exactly:

```ts
import { SeededRNG } from '@flare-engine/math';

const rng = new SeededRNG(1234);
const savedState = rng.getState(); // JSON-safe — store it beside the save

const restored = new SeededRNG(0);
restored.setState(savedState); // next() now continues the original sequence
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginemath--5kb-gzip).

## License

Apache-2.0
