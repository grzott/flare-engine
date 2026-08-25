# @flare-engine/dialogue

## 0.3.0

### Minor Changes

- 3a6640c: dialogue: dangling id diagnostics + cycle protection.

  Adds `DialogueError` (typed error class with `code`, `nodeId`, `missingId`, `chain` fields) and `DialogueErrorCode` union type exported from the package. An optional `onError` hook on `DialogueRunnerOptions` receives a `DialogueError` when a transition targets a node id that does not exist in the graph; without the hook a `console.warn` is logged naming the graph, missing id, and source node — both paths end the conversation as before.

  The recursive `processNode`/`processBranch`/`processAction` stack is replaced with a single iterative `run()` loop with a 1 000-step budget. A content-author cycle (`A→B→A` branch loop) now throws a typed `DialogueError` with `code: 'cycle'` and the last 12 visited node ids in `chain`, instead of overflowing the call stack with a `RangeError`.

  All pre-existing runner tests remain green; three new tests cover the `onError` hook, the default `console.warn` fallback, and the cycle-throws-`DialogueError` contract.

- 076651e: input-validation + prototype-safety hardening: hang guards (throw on non-positive frameDuration/maxPolyphony/fixedDt), Object.hasOwn prototype-safe lookups in dialogue graph/runner and localization manager/format, re-entrancy fixes for clock tickSchedules (splice-by-indexOf), coroutine update (undefined guard), and AppLifecycle background idempotency.
- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 68d22b2: README truth pass (features + platform tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`) and api-specs links are absolute (resolve on npmjs.com).

  - Snippets corrected to the real API where they had drifted: `animation` imports easings from `@flare-engine/math` (not `@flare-engine/animation`); `particles` uses `Color` objects, `speed`/`speedMax`, `direction`, config `gravityY`, and single-arg `update(dt)` (opacity fades via `start`/`endAlpha`, not `Color.a`); `pathfinding` `findPathJPS(grid, sx, sy, ex, ey)` returning `PathResult | null` with `path`/`cost`/`explored`; `dialogue` `createDialogueGraph`/`createDialogueRunner`/`createTextReveal` signatures + `ActionHandler(key)`; `debug` `StatsTracker` + `FpsWidget.update(stats)` + `TimeControl(clock)`; `errors` zero-arg `createConsoleTransport()`; `localization` real manager options; `scene` `Scene` requires `name`/`world`/`camera`.
  - Placeholders declared with real types; `haptics` marks its `expo-haptics` example `no-check` (uninstalled peer); `deep-links`/`share` import `Linking`/`Share` from `react-native`.

### Patch Changes

- Updated dependencies [6d439f7]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
  - @flare-engine/events@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - @flare-engine/events@0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
