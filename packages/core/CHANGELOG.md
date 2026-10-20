# @flare-engine/core

## 0.4.2

### Patch Changes

- @flare-engine/events@0.4.2
- @flare-engine/math@0.4.2

## 0.4.1

### Patch Changes

- @flare-engine/events@0.4.1
- @flare-engine/math@0.4.1

## 0.4.0

### Patch Changes

- fb5a0c5: PF-2b: settle the `core` coroutine contract and the `math` zero-alloc names before the freeze. Per
  ADR-0004.

  A coroutine now ends exactly one of three ways, and `CoroutineHandle` says which: completed,
  `cancelled`, or `failed` (all imply `done`; `cancelled` and `failed` are mutually exclusive).
  `cancel()` and `clear()` both set `cancelled` and close the generator, so a coroutine's `finally`
  blocks run on cancel and on scene teardown — `clear()` is a cancel from every coroutine's point of
  view — instead of leaking whatever they guard. A cancel issued from inside the running body is
  applied, and reports the same `cancelled` state, once the body next suspends. A rejected
  `yield Promise` is thrown into the generator: catch it and the coroutine keeps running, with the
  next yield dispatched as usual; let it propagate and the coroutine ends with the new
  `CoroutineHandle.failed` set and `CoroutineHandle.error` holding what the generator threw. Before,
  a rejection silently flipped `done` and dropped the reason, so asset and network failures inside
  coroutines vanished, and a cancelled coroutine was indistinguishable from a completed one. Failures
  are never re-raised as unhandled rejections; the handle is the channel.

  `Vec2.normalizeOut(dx, dy, speed, out)` is renamed `Vec2.scaleToLengthInto(dx, dy, length, out)` —
  it was the repo's only `…Out` zero-alloc name against nineteen `…Into` siblings, and it scales to
  `length` rather than normalising. `Vec2.turnVelocityToward` becomes `Vec2.turnVelocityTowardInto`
  for the same reason. Neither body changed: a bit-level sweep of 1.22M inputs (denormals, the 1e-6
  guard boundary, overflow magnitudes) shows zero mismatches against the old names, so `atan2`
  consumers see identical angles.

- Updated dependencies [da81c97]
- Updated dependencies [fb5a0c5]
  - @flare-engine/math@0.4.0
  - @flare-engine/events@0.4.0

## 0.3.1

### Patch Changes

- @flare-engine/events@0.3.1
- @flare-engine/math@0.3.1

## 0.3.0

### Minor Changes

- 076651e: input-validation + prototype-safety hardening: hang guards (throw on non-positive frameDuration/maxPolyphony/fixedDt), Object.hasOwn prototype-safe lookups in dialogue graph/runner and localization manager/format, re-entrancy fixes for clock tickSchedules (splice-by-indexOf), coroutine update (undefined guard), and AppLifecycle background idempotency.
- 65358b8: core + particles: loop alpha, pool caps, seeds.

  `GameLoop`: add `get alpha(): number` — post-step accumulator residual fraction `[0, 1)` for physics interpolation; returns exact `0` when no `fixedDt` was configured.

  `Pool<T>`: add optional `capacity` via `PoolOptions` ctor argument; add `tryAcquire(): T | null` which returns `null` at cap (zero allocation) — `acquire()` semantics unchanged (uncapped). Add `live` getter (currently-out-of-pool count). Dev-mode double-release guard (throws when `__DEV__` is true; zero cost in production).

  `ParticleEmitter`: **BREAKING** — second constructor argument changes from `maxParticles?: number` to `opts?: EmitterOptions` (`{ maxParticles?, seed? }`). `maxParticles` is now the enforced pool cap (wired into both `update()` and `burst()` via `tryAcquire`; stops spawning at cap, zero allocation past cap). Add `reseed(seed: number)` to restart the deterministic LCG sequence. Default seed remains `1`.

  `ParticlePool`: add `tryAcquire(): Particle | null`; pool capacity is now enforced via `core.Pool`.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 8696136: README truth pass (foundation + runtime + systems tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`), api-specs links are absolute (resolve on npmjs.com), and private-game references are removed.

  - Snippets corrected to the real API where they had drifted: `SeededRNG.float(min, max)`; `defineComponent(name, () => defaults)`; `postfx` `create*` factories are `(id, uniforms)`; `render` `drawSprite`/`SpriteColor`; `loadCanvasKit(wasmUrl)`; `CollisionPair.entityA/entityB` + `createCollider(shape, opts)`; `events` `EventMap`-satisfying maps; `audio` `AudioContextLike`.
  - `storage`: the migration example now preserves player data across a version bump (was discarding it); the native MMKV adapter is shown as a structural peer (no `react-native-mmkv` dependency claim).
  - `render-web`: presentation uses the real `kit.MakeWebGLCanvasSurface(...)` rather than a placeholder duck-type.

- 268f246: perf-10: stop evaluating an unresolvable global in the per-item hot loops.

  JSC has no inline cache for an unresolvable global identifier, so `typeof __DEV__ !== 'undefined' && __DEV__` costs ~270 ns **per evaluation** wherever `__DEV__` is undeclared. Measured on one machine over 1e6 evaluations: undeclared 272.5 ns, declared-false 0.7 ns, declared-true 1.2 ns, and a `globalThis` property read of an absent property 0.46 ns.

  Two hot sites now read `globalThis.__DEV__` as a property instead:

  `createFrameRenderer` — `fillXforms` evaluated the guard once per sprite per transform pass, nine times over under an outline effect. `render.flush 1000 sprites / 1 atlas` in the undeclared configuration measured 412-450 µs before and 56-88 µs after, which is the same band the declared configuration occupies.

  `Pool.release()` — once per released object, so roughly 300 evaluations a frame in a particle-heavy scene. The `Pool` **constructor** keeps the identifier form deliberately: it runs once per pool, and it is the site a bundler can constant-fold for dead-code elimination.

  React Native always defines `__DEV__`, so **RN apps were never affected and see no change**. This is a win for web/CanvasKit bundles and for any Node or Bun consumer. Runtime toggling of `globalThis.__DEV__` behaves exactly as before, and the guards remain truthiness checks, so no value that enabled a dev check before disables one now. The one behavioural difference: a bundler `define` that substitutes a bare `__DEV__` identifier no longer reaches these two sites — set `globalThis.__DEV__`, which is the contract api-specs already documents for non-RN runtimes.

  No public API, signature, or type changed.

- a3c2376: perf-3: add observability counters for allocation and transform diagnostics.

  `Pool<T>`: add `get created(): number` — cumulative factory calls from `acquire()`/`tryAcquire()` only; `prewarm()` excluded. Delta across a frame asserts zero steady-state allocation.

  `ParticlePool`: add `get created(): number` forwarding the internal `Pool`'s counter (prewarm excluded).

  `SpriteBatch`: add `get allocCount(): number` — cumulative `SpriteDrawCommand` allocations on pool-miss; 0 in steady state after warm-up.

  `Renderer.stats.drawCalls`: document as SpriteBatch flush-run count, NOT raw canvas call count; one flush run fans into 9 `drawAtlas` calls (outline), n `drawImageRect` calls (stretch), or n `drawRect` calls (zone-bg); equal to `stats.batchCount` when `SpriteBatch.flush` is the only writer (`recordDrawCall()`/`recordBatch()` are public and can diverge them).

  `resetXformCounters()` / `getXformCounters()`: `__DEV__`-gated rotated/unrotated branch counters for the `fillXforms` path in `createFrameRenderer`; counts stay 0 when `__DEV__` is falsy; reset is unconditional. They count transform writes, not sprites — an outlined run passes through `fillXforms` 9 times — and are process-global across all `createFrameRenderer` instances.

### Patch Changes

- Updated dependencies [6a10aa9]
- Updated dependencies [6d439f7]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [84fd0a3]
  - @flare-engine/math@0.3.0
  - @flare-engine/events@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - @flare-engine/events@0.2.1
  - @flare-engine/math@0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
