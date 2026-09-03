---
"@flare-engine/particles": patch
---

OSS-M8b: `drawParticles(pool, batch, image, frame, options?)` — queue every live particle into a caller-owned sprite batch.

The batch and frame are typed structurally, so `@flare-engine/particles` still depends on nothing but `core` and `math` and remains usable with no renderer; a real `SpriteBatch` satisfies `ParticleBatchLike`, asserted by a runtime test rather than assumed. The loop allocates nothing per particle and skips particles whose interpolated size or alpha has reached zero.

Alpha and rotation are applied per particle. Colour is not: a batch retains the effect reference until flush, so a reusable effect object would give every particle the last one's colour, and a per-particle object is the allocation this package exists to avoid.
