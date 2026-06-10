# @flare-engine/particles

Pre-allocated particle pool + emitter. Zero per-frame GC during gameplay — particles are recycled. Target: 200–500 alive particles at 60 fps. This package owns particle data and lifecycle; rendering happens via the host's immediate-mode Skia layer (PictureRecorder).

## Install

```sh
bun add @flare-engine/particles
```

## Usage

```ts
import { ParticleEmitter, ParticlePool } from '@flare-engine/particles';

const pool = new ParticlePool(500);
const emitter = new ParticleEmitter({
  rate: 30, lifetime: 1.2, speed: [80, 160], spread: Math.PI / 4,
  startColor: 0xff_ff_ff_ff, endColor: 0x00_ff_ff_ff,
  startSize: 4, endSize: 0,
}, pool);

emitter.update(dt, gravityX, gravityY);
```

See [API spec](../../docs/design/api-specs.md#flare-engineparticles--4kb-gzip).

## License

MIT
