# @flare-engine/debug

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

  - @flare-engine/core@0.4.19

## 0.4.18

### Patch Changes

- @flare-engine/core@0.4.18

## 0.4.17

### Patch Changes

- @flare-engine/core@0.4.17

## 0.4.16

### Patch Changes

- @flare-engine/core@0.4.16

## 0.4.15

### Patch Changes

- @flare-engine/core@0.4.15

## 0.4.14

### Patch Changes

- @flare-engine/core@0.4.14

## 0.4.13

### Patch Changes

- @flare-engine/core@0.4.13

## 0.4.12

### Patch Changes

- Updated dependencies [e30c4fa]
- Updated dependencies [78d7f8e]
- Updated dependencies [d61c2a8]
- Updated dependencies [c4fdd87]
  - @flare-engine/core@0.4.12

## 0.4.11

### Patch Changes

- 49210ba: `DebugOverlay` takes an optional `DebugOverlayOptions`; with
  `new DebugOverlay({ reuseCommands: true })`, `drawRect` / `drawCircle` / `drawLine` reuse pooled
  command objects instead of creating one per call, and those objects change after `clear()`, so copy
  a command to keep it past the frame. Without the option nothing changes: every call creates a fresh
  object. `createFrameBudget` keeps a running fps sum, re-summed each time the ring wraps, instead of
  re-summing the whole ring on every `recordFrame`. After a non-finite `dt`, `getAvgFps()` therefore
  reads 0 until the first wrap after that sample leaves the ring (under two ring lengths in all,
  previously one). A finite `dt` above 2^24 s (about 194 days) can leave a slightly inexact reading
  for the same span, and an absurd one (1e15 s in testing) a wrong one. The boot trace and the perf
  recorder now share one internal clock helper, which is not exported.
  - @flare-engine/core@0.4.11

## 0.4.10

### Patch Changes

- be02a9c: Exports `FrameBudgetOpts` and `PerfRecorderOpts`, the option types `createFrameBudget` and
  `createPerfRecorder` take, so a consumer can name them. Nothing else changes.
  - @flare-engine/core@0.4.10

## 0.4.9

### Patch Changes

- @flare-engine/core@0.4.9

## 0.4.8

### Patch Changes

- @flare-engine/core@0.4.8

## 0.4.7

### Patch Changes

- @flare-engine/core@0.4.7

## 0.4.6

### Patch Changes

- @flare-engine/core@0.4.6

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.
- Updated dependencies [8814ec2]
  - @flare-engine/core@0.4.5

## 0.4.4

### Patch Changes

- @flare-engine/core@0.4.4

## 0.4.3

### Patch Changes

- @flare-engine/core@0.4.3

## 0.4.2

### Patch Changes

- @flare-engine/core@0.4.2

## 0.4.1

### Patch Changes

- @flare-engine/core@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [fb5a0c5]
  - @flare-engine/core@0.4.0

## 0.3.1

### Patch Changes

- @flare-engine/core@0.3.1

## 0.3.0

### Minor Changes

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 68d22b2: README truth pass (features + platform tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`) and api-specs links are absolute (resolve on npmjs.com).

  - Snippets corrected to the real API where they had drifted: `animation` imports easings from `@flare-engine/math` (not `@flare-engine/animation`); `particles` uses `Color` objects, `speed`/`speedMax`, `direction`, config `gravityY`, and single-arg `update(dt)` (opacity fades via `start`/`endAlpha`, not `Color.a`); `pathfinding` `findPathJPS(grid, sx, sy, ex, ey)` returning `PathResult | null` with `path`/`cost`/`explored`; `dialogue` `createDialogueGraph`/`createDialogueRunner`/`createTextReveal` signatures + `ActionHandler(key)`; `debug` `StatsTracker` + `FpsWidget.update(stats)` + `TimeControl(clock)`; `errors` zero-arg `createConsoleTransport()`; `localization` real manager options; `scene` `Scene` requires `name`/`world`/`camera`.
  - Placeholders declared with real types; `haptics` marks its `expo-haptics` example `no-check` (uninstalled peer); `deep-links`/`share` import `Linking`/`Share` from `react-native`.

### Patch Changes

- Updated dependencies [076651e]
- Updated dependencies [65358b8]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [268f246]
- Updated dependencies [a3c2376]
  - @flare-engine/core@0.3.0

## 0.2.1

### Patch Changes

- Remove phantom `@flare-engine/*` dependencies that were declared in `package.json` but never imported from source (packaging hygiene; no runtime or API change). A new `check:deps` CI guardrail enforces that declared dependencies match actual imports and that the graph stays strictly downward-only.

- Updated dependencies []:
  - @flare-engine/core@0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
