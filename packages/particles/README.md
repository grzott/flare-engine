# @flare-engine/particles

Pre-allocated particle pool + emitter — particles are recycled rather than reallocated, so a steady-state emitter does not allocate per particle per frame. Target: 200–500 alive particles at 60 fps. This package owns particle data and lifecycle; rendering happens via the host's immediate-mode Skia layer (PictureRecorder).

Measured integrate cost per frame is published in [benchmarks](https://github.com/grzott/flare-engine/blob/main/docs/references/benchmarks.md), with the capture date and run-to-run spread on every row. Allocation is instrumented, not assumed: the draw-path counter suite reads `ParticlePool.created` growth per frame and `bun run check:perf` fails the build if a steady-state emitter calls the factory even once. The exact integers are published in the same document.

## Install

```sh
bun add @flare-engine/particles
```

## Usage

```ts
import { ParticleEmitter } from '@flare-engine/particles';

const emitter = new ParticleEmitter({
  rate: 30, lifetime: 1.2,
  speed: 80, speedMax: 160,
  direction: -Math.PI / 2, spread: Math.PI / 4,
  startColor: { r: 1, g: 1, b: 1, a: 1 }, endColor: { r: 1, g: 1, b: 1, a: 1 },
  startAlpha: 1, endAlpha: 0, // opacity fades via start/endAlpha — Color.a is not read
  startSize: 4, endSize: 0,
  gravityY: 98,
});

// gravity is part of config; update takes only dt
emitter.update(1 / 60);
```

## Emitter shapes

By default every particle spawns at the emitter's `x`/`y`. A `shape` samples a spawn offset
instead — `point` (the default), `circle`, `ring`, `rect`, or `cone`:

```ts
import { ParticleEmitter } from '@flare-engine/particles';

// An explosion: spawn on a ring, travel outward from the centre.
const blast = new ParticleEmitter({
  rate: 0, lifetime: 0.6,
  speed: 120, speedMax: 200,
  direction: 0, spread: 0.15,
  shape: { kind: 'ring', radius: 24, radial: true },
});
blast.x = 160;
blast.y = 120;
blast.burst(48);
```

**Shape controls position; `direction` and `spread` still control velocity.** They compose rather
than compete. A shape with a meaningful outward normal — `circle`, `ring`, `cone` — can hand
velocity over to it with `radial: true`, which is what separates a ring of drifting particles from
an explosion. Without it, a ring spawns on the ring and everything still flies along `direction`.

| Shape | Position | Notes |
| --- | --- | --- |
| `{ kind: 'point' }` | the emitter origin | Default. Draws no random values, so an emitter without a shape produces the identical sequence to one before shapes existed. |
| `{ kind: 'circle', radius, radial? }` | uniform inside the disc | Uniform **by area** — the radial term is `sqrt`-weighted, so particles do not bunch at the centre. |
| `{ kind: 'ring', radius, thickness?, radial? }` | on the ring, `thickness` wide | `thickness` defaults to 0 (a bare ring), spread uniformly across the band. |
| `{ kind: 'rect', width, height }` | uniform in the rect | Centred on the emitter, not anchored at a corner. No outward normal, so `radial` does not apply. |
| `{ kind: 'cone', radius, angle }` | uniform in a wedge of half-angle `angle` | Oriented along `direction`. A wedge of *spawn points* — distinct from `spread`, which fans velocity out of a single point. |

`sampleEmitterShape(shape, rand, out, direction?)` is exported if you want to place something other
than particles. It writes into a caller-owned `ShapeSample` (`createShapeSample()`) and allocates
nothing, so it is safe per-particle in a steady-state loop. Every shape draws a fixed number of
values from `rand`, which is what keeps a seeded emitter replaying exactly.

## Drawing into a sprite batch

`drawParticles` queues every live particle into a batch you own, so particles flush together with
the rest of the scene rather than forcing a second pass:

```ts
import { drawParticles, ParticleEmitter } from '@flare-engine/particles';
import type { ParticleBatchLike, ParticleFrameLike } from '@flare-engine/particles';

declare const emitter: ParticleEmitter;
declare const batch: ParticleBatchLike; // a @flare-engine/render SpriteBatch satisfies this
declare const atlasImage: unknown;
declare const frame: ParticleFrameLike; // e.g. a SpriteFrame from @flare-engine/assets

// each frame, before the batch flushes
drawParticles(emitter.pool, batch, atlasImage, frame);
```

The batch and frame are typed **structurally**, so this package still depends on nothing but
`@flare-engine/core` and `@flare-engine/math` and stays usable with no renderer. A real
`SpriteBatch` satisfies `ParticleBatchLike` — asserted by a runtime test in `@flare-engine/engine`,
not merely assumed.

The loop allocates nothing per particle, and skips any particle whose interpolated size or alpha has
reached zero rather than paying for an invisible draw call.

**Colour is not applied per particle.** The pool interpolates `startR/G/B → endR/G/B`, but a batch
retains an effect *reference* until it flushes, so a single reusable effect object would give every
particle the last one's colour — and one object per particle per frame is exactly the allocation this
package exists to avoid. Alpha *is* applied, because `drawRaw` takes it as a number. If you need
per-particle colour today, write the loop yourself over `pool.particles` and accept the cost.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineparticles--4kb-gzip).

## License

Apache-2.0
