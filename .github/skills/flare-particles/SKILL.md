---
name: flare-particles
description: Deep knowledge of the @flare-engine/particles package — ParticleEmitter, ParticlePool, pooled emitters, getColor/getColorInto, immediate-mode Skia rendering. Use when adding particle effects (muzzle flash, explosions, thrusters, trails) to a Flare game.
---

# `@flare-engine/particles`

Layer 3. Zero-GC steady state — everything is pre-allocated. Targets 200–500 live particles at 60 fps.

## Exports

```ts
import {
  ParticleEmitter,
  type ParticleEmitterConfig,
  ParticlePool,
} from "@flare-engine/particles";
```

## Usage sketch

```ts
const pool = new ParticlePool(500);
const emitter = new ParticleEmitter(pool, {
  rate: 50,
  lifetime: 0.6,
  speed: [80, 160],
  spread: Math.PI / 6,
  startColor: "#ffcc00",
  endColor: "#ff3300",
  startSize: 6,
  endSize: 0,
  gravity: 200,
});
emitter.emitBurst(40, x, y);
pool.update(dt, 0, 200); // gravity x, gravity y
```

## Rules

- `getColor(p)` returns a **shared buffer**; use `getColorInto(p, out)` if you need to retain the value across frames.
- Rendering is immediate-mode via Skia `PictureRecorder` — this package owns data/lifecycle, not rendering. Consumers wire the draw step.
- Don't allocate new emitters per frame — reuse one per effect.

Spec: [docs/design/api-specs.md § @flare-engine/particles](../../../docs/design/api-specs.md).
