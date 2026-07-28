# @flare-engine/particles

Pre-allocated particle pool + emitter — particles are recycled rather than reallocated, so a steady-state emitter does not allocate per particle per frame. Target: 200–500 alive particles at 60 fps. This package owns particle data and lifecycle; rendering happens via the host's immediate-mode Skia layer (PictureRecorder).

Measured integrate cost per frame is published in [benchmarks](https://github.com/grzott/flare-engine/blob/main/docs/references/benchmarks.md), with the capture date and run-to-run spread on every row. Allocation counts are not yet instrumented, so treat the recycling above as a structural property of the pool rather than a measured zero-GC guarantee.

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

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineparticles--4kb-gzip).

## License

Apache-2.0
