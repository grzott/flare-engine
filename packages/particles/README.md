# @flare-engine/particles

Pre-allocated particle pool + emitter. Zero per-frame GC during gameplay — particles are recycled. Target: 200–500 alive particles at 60 fps. This package owns particle data and lifecycle; rendering happens via the host's immediate-mode Skia layer (PictureRecorder).

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

MIT
