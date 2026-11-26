# @flare-engine/audio

## 0.4.19

### Patch Changes

- 7662231: Announces the 0.5.0 changes that had not been announced yet ([ADR-0012](https://github.com/grzott/flare-engine/blob/main/docs/design/adr-0012-0-5-0-breaking-set.md), rows 5-11). Nothing changes behaviour in this release. The one addition is `createStatsTracker()`.

  - **math:** `springIn`, `springOut` and `springInOut` are `@deprecated` and are removed in 0.5.0. Use `easeInBack`, `easeOutBack` and `easeInOutBack`, which return the same values. (`springInOut` and `easeInOutBack` round differently only where the result is subnormal.)
  - **debug:** new `createStatsTracker()`, which returns a `StatsTrackerHandle`. It has the same members as the `StatsTracker` class (`stats`, `updateFromClock`, `setEntityCount`, `setDrawCalls`, `reset`) and allocates nothing after creation. The `StatsTracker` class is `@deprecated` and is removed in 0.5.0. To migrate, replace `new StatsTracker()` with `createStatsTracker()`, and change any `StatsTracker` type annotation to `StatsTrackerHandle`.
  - **ui:** in 0.5.0, `FocusManagerOptions.refocusOnUnregister` defaults to `false`: when the focused node unregisters, focus clears to `null`. Pass `refocusOnUnregister: true` to keep re-homing to the first node in tab order.
  - **shapes:** the `glow: 'friendly'` and `glow: 'hazard'` strings are deprecated and are removed in 0.5.0. Pass a `GlowSpec` instead.
    - `'friendly'` becomes `{ color: friendlyGlowArgb(), width: 3 }`, which paints the same pixels.
    - `'hazard'` becomes `{ color: hazardGlowArgb(), width: 1 }`. It keeps the colour and the 1 px of stroke, but it is one ring instead of two, and its inner edge sits 2.5 px outside the shape's radius instead of 0.75 px.
    - `applyHazardGlow` stays exported, for drawing the two-ring look yourself.
    - The strings are deprecated in the `glow` JSDoc and the README, not with a `@deprecated` tag: TypeScript cannot attach one to a single member of a string union.
  - **particles:** in 0.5.0, the `color` option of `drawParticles` defaults to `true`. Pass `color: false` to keep drawing without colour.
  - **audio:** in 0.5.0, `AudioContextLike.createBufferSource` returns `AudioBufferSourceNodeLike | PromiseLike<AudioBufferSourceNodeLike>`, so the asynchronous `react-native-audio-api` web context type-checks. A context that returns a node at once still satisfies the new type. Code that calls `createBufferSource()` itself has to await the result, or narrow it.
  - **react, engine:** in 0.5.0, the `react-native-reanimated` peer floor rises from `>=4.0.0` to `>=4.1.0`. Reanimated 4.0.x supports only worklets 0.4.x, but both packages already require worklets `>=0.7.0`, and 4.1.x is the first Reanimated line that supports it. Expo SDK 58 pins Reanimated 4.7.1.

  `SceneManager.pop()` keeps destroying the popped scene by default; ADR-0012 declines that flip (#179).

## 0.4.18

## 0.4.17

## 0.4.16

## 0.4.15

## 0.4.14

## 0.4.13

## 0.4.12

### Patch Changes

- 7ae22a5: `Music.stop()` and `Music.play()` called during a crossfade now stop the fading-out track immediately; before, it stayed audible until its scheduled stop, up to the crossfade `duration`. A second `crossfadeTo` while a fade is still running stops the older fading-out track at once and fades out the current one.

## 0.4.11

### Patch Changes

- 90e0e7c: `Music.play` and `Music.crossfadeTo` now share one internal track-start helper; no behaviour or API
  change.

## 0.4.10

### Patch Changes

- 756f4c1: `PlaySFXOptions` gains an optional `delay` in seconds. When it is a finite number above 0,
  `SFXPool.play` passes `ctx.currentTime + delay` to the source's `start`, so a cue scheduled ahead
  lands on the audio clock instead of the next frame; the voice counts toward polyphony from `play`
  and the handle's `stop()` cancels a not-yet-started source. A missing, non-positive or non-finite
  delay calls `start()` with no argument, as before.
- dec518b: Fix `SFXPool` and `Music` registering the end-of-playback callback as `onended` while
  `react-native-audio-api` exposes it as `onEnded`, so the library never called it: finished voices
  were never released (`activeCount` over-reported, per-voice gains stayed connected, and at
  `maxPolyphony` every `play()` cut off a possibly still-playing sound) and `Music.playing` stayed set
  after a non-looping track ended. Both now register through whichever accessor the node exposes.
  `AudioBufferSourceNodeLike` gains an optional `onEnded` member; `onended` is unchanged.
- 27952f7: Adds procedural SFX synthesis: `renderSynth(sound, sampleRate, out)` renders a `SynthSound` (sine,
  square, saw or seeded noise, an ADSR `envelope`, a linear sweep from `frequency` to `endFrequency`)
  as mono PCM into a caller-owned `Float32Array` without allocating; `synthSampleCount` sizes that
  array and `fillPCMBuffer` copies it into every channel of a `PCMBufferLike`. `AudioContextLike`
  gains an optional `createBuffer?` returning one. Nothing existing changes.

## 0.4.9

## 0.4.8

## 0.4.7

## 0.4.6

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.

## 0.4.4

## 0.4.3

### Patch Changes

- aa21b75: FREEZE-FIX-3: `react-native-audio-api` is now an optional peer of `@flare-engine/audio` and
  `@flare-engine/engine`. Per ADR-0010.

  Neither package imports it: `AudioManager` types the audio context structurally and the app passes
  one in. As a required peer, npm and bun installed it into every app that depends on
  `@flare-engine/engine`, all three starter templates included, and Expo autolinked and compiled it
  whether or not the app played a sound. On Windows that native build cannot complete with the stock
  Android toolchain (its object paths run past the 260-character limit), so a fresh scaffold could not
  build for Android there.

  If your app plays audio on native and relied on that automatic install, add the package yourself
  (`bun add react-native-audio-api`). Until you do, bundling fails with "Unable to resolve module
  react-native-audio-api". Apps that never used it drop an unused native module. No exported name,
  signature or type changes.

## 0.4.2

## 0.4.1

## 0.4.0

## 0.3.1

## 0.3.0

### Minor Changes

- 076651e: input-validation + prototype-safety hardening: hang guards (throw on non-positive frameDuration/maxPolyphony/fixedDt), Object.hasOwn prototype-safe lookups in dialogue graph/runner and localization manager/format, re-entrancy fixes for clock tickSchedules (splice-by-indexOf), coroutine update (undefined guard), and AppLifecycle background idempotency.
- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 8696136: README truth pass (foundation + runtime + systems tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`), api-specs links are absolute (resolve on npmjs.com), and private-game references are removed.

  - Snippets corrected to the real API where they had drifted: `SeededRNG.float(min, max)`; `defineComponent(name, () => defaults)`; `postfx` `create*` factories are `(id, uniforms)`; `render` `drawSprite`/`SpriteColor`; `loadCanvasKit(wasmUrl)`; `CollisionPair.entityA/entityB` + `createCollider(shape, opts)`; `events` `EventMap`-satisfying maps; `audio` `AudioContextLike`.
  - `storage`: the migration example now preserves player data across a version bump (was discarding it); the native MMKV adapter is shown as a structural peer (no `react-native-mmkv` dependency claim).
  - `render-web`: presentation uses the real `kit.MakeWebGLCanvasSurface(...)` rather than a placeholder duck-type.

### Patch Changes

- b3f4f08: audio: implement the `rate` play option and drop the false auto-suspend claim. `SFXPool.play`'s `rate` now applies when the injected source node exposes a `playbackRate` param (Web-Audio shape) and is a no-op when it doesn't — previously the option was declared but never read. The `AudioBufferSourceNodeLike` interface gains an optional `playbackRate` and a writable `onended` (removing the internal readonly casts in both `sfx-pool.ts` and `music.ts`). README and api-specs no longer claim automatic background/foreground suspend — none was ever wired; both now document the manual `AppState`/`visibilitychange` → `suspend()`/`resume()` recipe. The README usage example is corrected to the real `AudioManager`/`SFXPool`/`createChannels` API.

## 0.2.1

### Patch Changes

- Remove phantom `@flare-engine/*` dependencies that were declared in `package.json` but never imported from source (packaging hygiene; no runtime or API change). A new `check:deps` CI guardrail enforces that declared dependencies match actual imports and that the graph stays strictly downward-only.

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
