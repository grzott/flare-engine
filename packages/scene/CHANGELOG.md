# @flare-engine/scene

## 0.3.0

### Minor Changes

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 68d22b2: README truth pass (features + platform tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`) and api-specs links are absolute (resolve on npmjs.com).

  - Snippets corrected to the real API where they had drifted: `animation` imports easings from `@flare-engine/math` (not `@flare-engine/animation`); `particles` uses `Color` objects, `speed`/`speedMax`, `direction`, config `gravityY`, and single-arg `update(dt)` (opacity fades via `start`/`endAlpha`, not `Color.a`); `pathfinding` `findPathJPS(grid, sx, sy, ex, ey)` returning `PathResult | null` with `path`/`cost`/`explored`; `dialogue` `createDialogueGraph`/`createDialogueRunner`/`createTextReveal` signatures + `ActionHandler(key)`; `debug` `StatsTracker` + `FpsWidget.update(stats)` + `TimeControl(clock)`; `errors` zero-arg `createConsoleTransport()`; `localization` real manager options; `scene` `Scene` requires `name`/`world`/`camera`.
  - Placeholders declared with real types; `haptics` marks its `expo-haptics` example `no-check` (uninstalled peer); `deep-links`/`share` import `Linking`/`Share` from `react-native`.

### Patch Changes

- c9325ac: scene: fix restart building stale World/Camera2D, fix transition path skipping onPreload await, add dev-mode warning for unknown scene names.

  `go(sameScene)` now destroys and evicts the current instance before calling `_getOrCreate`, so restart always produces a fresh `World` and `Camera2D`. The transition path starts `onPreload` concurrently with the fade-out and holds at end-of-out until the Promise resolves before calling `onInit`/`onEnter` — matching the instant path's existing `await` semantics. Calling `go(unknownName)` emits a `console.warn` listing the unknown name and all registered scene names when `__DEV__` is true.

- Updated dependencies [6a10aa9]
- Updated dependencies [47ad74f]
- Updated dependencies [e271eb2]
- Updated dependencies [3ab5f93]
- Updated dependencies [ff62507]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [84fd0a3]
- Updated dependencies [268f246]
- Updated dependencies [a3c2376]
- Updated dependencies [938ef11]
  - @flare-engine/math@0.3.0
  - @flare-engine/ecs@0.3.0
  - @flare-engine/render@0.3.0

## 0.2.1

### Patch Changes

- Remove phantom `@flare-engine/*` dependencies that were declared in `package.json` but never imported from source (packaging hygiene; no runtime or API change). A new `check:deps` CI guardrail enforces that declared dependencies match actual imports and that the graph stays strictly downward-only.

- Updated dependencies []:
  - @flare-engine/render@0.2.1
  - @flare-engine/ecs@0.2.1
  - @flare-engine/math@0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
