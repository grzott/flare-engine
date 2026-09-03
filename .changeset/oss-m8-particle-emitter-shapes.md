---
"@flare-engine/particles": patch
---

OSS-M8 (first half): emitter shapes.

`EmitterConfig.shape` places newly emitted particles with a tagged union — `point` (default), `circle`, `ring`, `rect`, `cone`. Shapes sample **position** only, so `direction` and `spread` continue to govern velocity and the two compose; a shape with an outward normal can hand velocity over with `radial: true`, which is the difference between a ring of drifting particles and an explosion.

`sampleEmitterShape(shape, rand, out, direction?)` is exported for placing non-particles. It writes into a caller-owned `ShapeSample` and allocates nothing, so it is safe per-particle in a steady-state loop.

Fully backward compatible: `point` draws no random values and shape sampling precedes the velocity draws, so an emitter without a `shape` produces the identical sequence to one from before this change — asserted by test, not assumed.
