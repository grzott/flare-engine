# @flare-engine/dynamics

2D rigid-body dynamics over oriented boxes (OBBs): separating-axis + reference/incident face
clipping builds 1-2 point contact manifolds, and a sequential-impulse solver resolves them with
Coulomb friction, restitution, and Baumgarte de-penetration. `@flare-engine/physics` answers *did
these overlap*; `@flare-engine/dynamics` answers *where do they end up*. Neither package depends on
the other — pick per scene, or use both side by side (`physics` for triggers/overlap queries,
`dynamics` for bodies that actually push each other around).

## Install

```sh
bun add @flare-engine/dynamics
```

## Usage

```ts
import { addBody, createBody, createWorld, step } from '@flare-engine/dynamics';

const world = createWorld({ gravity: { x: 0, y: 1800 } });

// Static floor: invMass 0, never moves.
addBody(
  world,
  createBody({ position: { x: 0, y: 100 }, half: { x: 500, y: 10 }, static: true }),
);

const box = addBody(
  world,
  createBody({ position: { x: 0, y: -50 }, half: { x: 10, y: 10 } }),
);

// Fixed-timestep loop.
step(world, 1 / 60);
console.log(box.position.y, box.velocity.y);
```

`Body.position` and `Body.velocity` are mutable plain-object fields — `createBody` allocates them
once, and `step()` writes into them in place every tick. That is a deliberate API contract, not an
oversight: it matches the engine's zero-alloc house style and lets a consumer read or override
either field directly between steps (e.g. clamping a resting velocity — see Limits below) without
going through an accessor.

`step()` allocates nothing in steady state — every per-step structure (contact manifolds, contact
points, broadphase scratch buffers) lives in a pool owned by the `World` and is reused across calls,
growing only when body count grows.

## Record and replay

Semi-implicit Euler with friction and restitution is not time-reversible, so a fall you want to
scrub, reverse or replay at another speed is **baked once** into a `Timeline` and read back by
sampling. `record` takes a writer callback instead of a body array, so the timeline never has to know
what it is recording; with an `until` predicate it bakes in one call, without one it records a single
frame, which suits a time-budgeted loop that calls it once per tick.
`stepUntil(world, dt, { budgetMs: 6, done: isSettled })` is that loop: it steps until `done()` returns
true, `maxSteps` is reached or the budget is spent (always at least once), and reports
`{ steps, complete }`; `stepUntilInto` is the zero-alloc form.

```ts
import { createTimeline, createWorld, step } from '@flare-engine/dynamics';

const world = createWorld(); // add a floor and some boxes as above
const dt = 1 / 60;
const timeline = createTimeline(world.bodies.length, dt); // stride 3: x, y, angle
timeline.record(
  (buf, base) => {
    step(world, dt);
    for (let i = 0; i < world.bodies.length; i++) {
      const b = world.bodies[i]!;
      buf[base + i * 3] = b.position.x;
      buf[base + i * 3 + 1] = b.position.y;
      buf[base + i * 3 + 2] = b.angle;
    }
  },
  () => world.bodies.every((b) => Math.abs(b.velocity.y) < 1), // your own settle rule
);

const out = new Float32Array(timeline.elementCount * 3);
timeline.sampleInto(0.5, out); // body i at out[i * 3 ..], lerped between frames
```

Storage is `Float32Array` on purpose — playback precision at half the bytes of f64 — and angles are
kept exactly as written: `Body.angle` is cumulative and never wrapped, so a plain lerp is correct
across multi-turn spins where a shortest-path lerp would unravel them. `sampleInto` allocates
nothing; the one scratch buffer above serves the whole replay.

## Sleeping

Sleeping is off by default (see Limits). `createWorld({ sleep })` opts in: a dynamic body whose
speed stays under `linearThreshold` (px/s) and whose angular speed stays under `angularThreshold`
(rad/s) for `steps` consecutive steps has its velocities set to exactly 0 and is skipped by
integration and by pair tests against other sleeping or static bodies. It wakes when an awake body
that moved on the previous step touches it, when you write its `velocity`, `angularVelocity`,
`position` or `angle`, or when you call `wakeBody`. `isSleeping(world, body)` reads one body (an
`indexOf` over `world.bodies`); `isAtRest(world)` is true once every dynamic body sleeps, which makes
it the stop rule for a `stepUntil` bake:

```ts
import {
  addBody,
  createBody,
  createWorld,
  isAtRest,
  isSleeping,
  stepUntil,
  wakeBody,
} from '@flare-engine/dynamics';

const world = createWorld({
  gravity: { x: 0, y: 1800 },
  sleep: { linearThreshold: 14, angularThreshold: 1.5, steps: 30 },
});
addBody(
  world,
  createBody({ position: { x: 0, y: 100 }, half: { x: 500, y: 10 }, static: true }),
);
const box = addBody(world, createBody({ position: { x: 0, y: 0 }, half: { x: 5, y: 5 } }));

const result = stepUntil(world, 1 / 120, {
  budgetMs: 8,
  maxSteps: 600,
  done: () => isAtRest(world),
});
if (result.complete) console.log(isSleeping(world, box), box.velocity.y); // true 0

wakeBody(world, box); // e.g. after removing the floor from world.bodies
```

Thresholds must clear the resting jitter described under Limits, which depends on body size and
`dt`: in the package's own tests (half-5 boxes, `dt = 1/120`) a resting box peaks at about 5.8 px/s
and 1.12 rad/s (the angular peak scales with 1 / half-width), so 14 / 1.5 sleeps it in 91 steps,
while 0.6 rad/s never sees 30 quiet steps in a row. Measure your own scene before pinning values.

What sleeping does not do:

- **No islands.** A woken body wakes the sleepers it touches on the *next* step, so a landed box
  wakes a stack one level per step, and a sleeper touched only by a body that is itself settling
  (under the thresholds, counting down) stays asleep.
- **A sleeper does not follow a moved static body.** Moving the floor under a sleeping box leaves
  the box where it is; call `wakeBody` after moving or removing a support.
- **Removing a body from `world.bodies` wakes the bodies that shift down a slot** and nothing else.
  A sleeper whose support was removed without shifting it stays asleep in mid-air until `wakeBody`.
  Inserting a body before a sleeper likewise wakes it (it re-sleeps after `steps` quiet steps).
- **A world that never went through `createWorld`** (a spread copy or `structuredClone` handed to
  `step`) is adopted with sleeping off; `isSleeping` and `isAtRest` are then false for any dynamic
  body.

## Limits (v1)

- **Resting bodies do not go perfectly still unless you opt into sleeping.** A box settling on a
  floor reaches a stable *position* — in the package's own test scenario, position moves less than
  0.1 units over 600 further steps — but `velocity` keeps a small, bounded oscillation (roughly 2.6
  units/s in that same scenario) at the penetration-slop equilibrium. This is inherent to a
  Baumgarte-biased sequential-impulse solver, not a bug, and not something a bigger iteration count
  or a tuning tweak resolves. `createWorld({ sleep })` (above) zeroes the velocity of bodies that
  stay under your thresholds; resting-velocity damping stays out of scope.
- **Boxes only.** No circle or polygon shapes.
- **No joints, no CCD (continuous collision detection).** Fast-moving thin bodies can tunnel
  through each other within a single step.
- **No ECS coupling.** `World`/`Body` are plain data; wire them into an ECS yourself if you use one.
- **Broadphase is brute-force** (all-pairs AABB reject) — fine at small body counts, not a spatial
  partition. There is no broadphase beyond that pass.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginedynamics--8kb-gzip).

## License

Apache-2.0
