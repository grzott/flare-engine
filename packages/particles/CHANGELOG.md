# @flare-engine/particles

## 0.4.3

### Patch Changes

- @flare-engine/core@0.4.3
- @flare-engine/math@0.4.3

## 0.4.2

### Patch Changes

- @flare-engine/core@0.4.2
- @flare-engine/math@0.4.2

## 0.4.1

### Patch Changes

- @flare-engine/core@0.4.1
- @flare-engine/math@0.4.1

## 0.4.0

### Patch Changes

- 2740004: OSS-M8 (first half): emitter shapes.

  `EmitterConfig.shape` places newly emitted particles with a tagged union — `point` (default), `circle`, `ring`, `rect`, `cone`. Shapes sample **position** only, so `direction` and `spread` continue to govern velocity and the two compose; a shape with an outward normal can hand velocity over with `radial: true`, which is the difference between a ring of drifting particles and an explosion.

  `sampleEmitterShape(shape, rand, out, direction?)` is exported for placing non-particles. It writes into a caller-owned `ShapeSample` and allocates nothing, so it is safe per-particle in a steady-state loop.

  Fully backward compatible: `point` draws no random values and shape sampling precedes the velocity draws, so an emitter without a `shape` produces the identical sequence to one from before this change — asserted by test, not assumed.

- ddd8116: OSS-M8b: `drawParticles(pool, batch, image, frame, options?)` — queue every live particle into a caller-owned sprite batch.

  The batch and frame are typed structurally, so `@flare-engine/particles` still depends on nothing but `core` and `math` and remains usable with no renderer; a real `SpriteBatch` satisfies `ParticleBatchLike`, asserted by a runtime test rather than assumed. The loop allocates nothing per particle and skips particles whose interpolated size or alpha has reached zero.

  Alpha and rotation are applied per particle. Colour is not: a batch retains the effect reference until flush, so a reusable effect object would give every particle the last one's colour, and a per-particle object is the allocation this package exists to avoid.

- Updated dependencies [da81c97]
- Updated dependencies [fb5a0c5]
  - @flare-engine/math@0.4.0
  - @flare-engine/core@0.4.0

## 0.3.1

### Patch Changes

- @flare-engine/core@0.3.1
- @flare-engine/math@0.3.1

## 0.3.0

### Minor Changes

- 65358b8: core + particles: loop alpha, pool caps, seeds.

  `GameLoop`: add `get alpha(): number` — post-step accumulator residual fraction `[0, 1)` for physics interpolation; returns exact `0` when no `fixedDt` was configured.

  `Pool<T>`: add optional `capacity` via `PoolOptions` ctor argument; add `tryAcquire(): T | null` which returns `null` at cap (zero allocation) — `acquire()` semantics unchanged (uncapped). Add `live` getter (currently-out-of-pool count). Dev-mode double-release guard (throws when `__DEV__` is true; zero cost in production).

  `ParticleEmitter`: **BREAKING** — second constructor argument changes from `maxParticles?: number` to `opts?: EmitterOptions` (`{ maxParticles?, seed? }`). `maxParticles` is now the enforced pool cap (wired into both `update()` and `burst()` via `tryAcquire`; stops spawning at cap, zero allocation past cap). Add `reseed(seed: number)` to restart the deterministic LCG sequence. Default seed remains `1`.

  `ParticlePool`: add `tryAcquire(): Particle | null`; pool capacity is now enforced via `core.Pool`.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 68d22b2: README truth pass (features + platform tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`) and api-specs links are absolute (resolve on npmjs.com).

  - Snippets corrected to the real API where they had drifted: `animation` imports easings from `@flare-engine/math` (not `@flare-engine/animation`); `particles` uses `Color` objects, `speed`/`speedMax`, `direction`, config `gravityY`, and single-arg `update(dt)` (opacity fades via `start`/`endAlpha`, not `Color.a`); `pathfinding` `findPathJPS(grid, sx, sy, ex, ey)` returning `PathResult | null` with `path`/`cost`/`explored`; `dialogue` `createDialogueGraph`/`createDialogueRunner`/`createTextReveal` signatures + `ActionHandler(key)`; `debug` `StatsTracker` + `FpsWidget.update(stats)` + `TimeControl(clock)`; `errors` zero-arg `createConsoleTransport()`; `localization` real manager options; `scene` `Scene` requires `name`/`world`/`camera`.
  - Placeholders declared with real types; `haptics` marks its `expo-haptics` example `no-check` (uninstalled peer); `deep-links`/`share` import `Linking`/`Share` from `react-native`.

- a3c2376: perf-3: add observability counters for allocation and transform diagnostics.

  `Pool<T>`: add `get created(): number` — cumulative factory calls from `acquire()`/`tryAcquire()` only; `prewarm()` excluded. Delta across a frame asserts zero steady-state allocation.

  `ParticlePool`: add `get created(): number` forwarding the internal `Pool`'s counter (prewarm excluded).

  `SpriteBatch`: add `get allocCount(): number` — cumulative `SpriteDrawCommand` allocations on pool-miss; 0 in steady state after warm-up.

  `Renderer.stats.drawCalls`: document as SpriteBatch flush-run count, NOT raw canvas call count; one flush run fans into 9 `drawAtlas` calls (outline), n `drawImageRect` calls (stretch), or n `drawRect` calls (zone-bg); equal to `stats.batchCount` when `SpriteBatch.flush` is the only writer (`recordDrawCall()`/`recordBatch()` are public and can diverge them).

  `resetXformCounters()` / `getXformCounters()`: `__DEV__`-gated rotated/unrotated branch counters for the `fillXforms` path in `createFrameRenderer`; counts stay 0 when `__DEV__` is falsy; reset is unconditional. They count transform writes, not sprites — an outlined run passes through `fillXforms` 9 times — and are process-global across all `createFrameRenderer` instances.

### Patch Changes

- Updated dependencies [6a10aa9]
- Updated dependencies [076651e]
- Updated dependencies [65358b8]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [84fd0a3]
- Updated dependencies [268f246]
- Updated dependencies [a3c2376]
  - @flare-engine/math@0.3.0
  - @flare-engine/core@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - @flare-engine/core@0.2.1
  - @flare-engine/math@0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
