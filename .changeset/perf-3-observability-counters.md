---
"@flare-engine/core": minor
"@flare-engine/particles": minor
"@flare-engine/render": minor
---

perf-3: add observability counters for allocation and transform diagnostics.

`Pool<T>`: add `get created(): number` — cumulative factory calls from `acquire()`/`tryAcquire()` only; `prewarm()` excluded. Delta across a frame asserts zero steady-state allocation.

`ParticlePool`: add `get created(): number` forwarding the internal `Pool`'s counter (prewarm excluded).

`SpriteBatch`: add `get allocCount(): number` — cumulative `SpriteDrawCommand` allocations on pool-miss; 0 in steady state after warm-up.

`Renderer.stats.drawCalls`: document as SpriteBatch flush-run count, NOT raw canvas call count; one flush run fans into 9 `drawAtlas` calls (outline), n `drawImageRect` calls (stretch), or n `drawRect` calls (zone-bg); equal to `stats.batchCount` when `SpriteBatch.flush` is the only writer (`recordDrawCall()`/`recordBatch()` are public and can diverge them).

`resetXformCounters()` / `getXformCounters()`: `__DEV__`-gated rotated/unrotated branch counters for the `fillXforms` path in `createFrameRenderer`; counts stay 0 when `__DEV__` is falsy; reset is unconditional. They count transform writes, not sprites — an outlined run passes through `fillXforms` 9 times — and are process-global across all `createFrameRenderer` instances.
