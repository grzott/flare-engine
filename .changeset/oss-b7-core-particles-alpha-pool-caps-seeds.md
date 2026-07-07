---
"@flare-engine/core": minor
"@flare-engine/particles": minor
---

core + particles: loop alpha, pool caps, seeds.

`GameLoop`: add `get alpha(): number` — post-step accumulator residual fraction `[0, 1)` for physics interpolation; returns exact `0` when no `fixedDt` was configured.

`Pool<T>`: add optional `capacity` via `PoolOptions` ctor argument; add `tryAcquire(): T | null` which returns `null` at cap (zero allocation) — `acquire()` semantics unchanged (uncapped). Add `live` getter (currently-out-of-pool count). Dev-mode double-release guard (throws when `__DEV__` is true; zero cost in production).

`ParticleEmitter`: **BREAKING** — second constructor argument changes from `maxParticles?: number` to `opts?: EmitterOptions` (`{ maxParticles?, seed? }`). `maxParticles` is now the enforced pool cap (wired into both `update()` and `burst()` via `tryAcquire`; stops spawning at cap, zero allocation past cap). Add `reseed(seed: number)` to restart the deterministic LCG sequence. Default seed remains `1`.

`ParticlePool`: add `tryAcquire(): Particle | null`; pool capacity is now enforced via `core.Pool`.
