# @flare-engine/simulation

Continuous-time dynamics: n-body gravity with Plummer softening, Verlet / leapfrog integration, wave-packet ripple pools, a diffuse/decay scalar field, and Jones-model agent stigmergy.

## Install

```sh
bun add @flare-engine/simulation
```

## Usage

```ts
import { createNBodySystem, leapfrogInto, createRipplePool } from '@flare-engine/simulation';

const nb = createNBodySystem(16);
nb.add(0, 0, 0, 0, 1000);
nb.add(100, 0, 0, 3.16, 1);
nb.step(0.016, 1, 2);

const rp = createRipplePool(32);
rp.emit(0, 0, 0, 20, 100, 30, 2);
const h = rp.heightAt(100, 0, 1);
```

### Scalar field

A coarse pheromone/heat grid backed by two ping-pong `Float32Array`s (zero alloc after construction). Separable 3×3 box-blur diffusion + multiplicative decay + bilinear sample + central-difference gradient.

```ts
import { createScalarField } from '@flare-engine/simulation';

// 'toroidal' (default, wrapping) or 'clamp' (bounded playfield).
const field = createScalarField(800, 600, 4, 'toroidal');
field.deposit(400, 300, 1.0);
field.step(0.4, 0.97, Infinity);       // diffuse + decay (no clamp)
const v = field.sample(390, 300);      // bilinear read
const grad = { x: 0, y: 0 };
field.gradient(390, 300, grad);        // ∇ for obstacle avoidance / chemotaxis
```

### Agent stigmergy

SoA agents (Jones 2010) that sense the scalar field, turn toward the brightest sensor, move, and deposit — the engine's first emergent-AI primitive. Fully deterministic via an injected `SeededRNG`.

```ts
import { SeededRNG } from '@flare-engine/math';
import { createScalarField, createStigmergy, SENSE_DEFAULTS } from '@flare-engine/simulation';

const field = createScalarField(800, 600, 4);
const agents = createStigmergy(field, {
  count: 2000,
  ...SENSE_DEFAULTS,
  stepSize: 2,
  depositAmount: 1,
  chaos: 0.05,
}, new SeededRNG(42));

// Game loop:
field.step(0.4, 0.97, 10);
agents.update();
agents.forEachAgent((x, y) => { /* draw */ });
```

`onSense` / `onMove` hooks let callers inject chemotaxis or repulsion by closing over their own data (nutrient sources, obstacle fields) without coupling the engine to domain logic.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginesimulation).

## License

MIT
