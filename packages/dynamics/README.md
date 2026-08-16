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

## Limits (v1)

- **Resting bodies do not go perfectly still.** A box settling on a floor reaches a stable
  *position* — in the package's own test scenario, position moves less than 0.1 units over 600
  further steps — but `velocity` keeps a small, bounded oscillation (roughly 2.6 units/s in that same
  scenario) at the penetration-slop equilibrium. This is inherent to a Baumgarte-biased
  sequential-impulse solver run without sleeping, not a bug, and not something a bigger iteration
  count or a tuning tweak resolves. Sleeping and resting-velocity damping are deliberately out of
  scope for v1 (tracked as future work). If your use case needs pixel-exact stillness, clamp small
  resting velocities at your own layer once a body's position has stabilized.
- **Boxes only.** No circle or polygon shapes.
- **No joints, no sleeping, no CCD (continuous collision detection).** Fast-moving thin bodies can
  tunnel through each other within a single step.
- **No ECS coupling.** `World`/`Body` are plain data; wire them into an ECS yourself if you use one.
- **Broadphase is brute-force** (all-pairs AABB reject) — fine at small body counts, not a spatial
  partition. There is no broadphase beyond that pass.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginedynamics).

## License

Apache-2.0
