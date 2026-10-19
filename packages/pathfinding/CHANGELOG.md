# @flare-engine/pathfinding

## 0.4.1

### Patch Changes

- @flare-engine/math@0.4.1

## 0.4.0

### Patch Changes

- 911cb69: OSS-B18: grow the open-set heap instead of corrupting it past 4096 entries.

  Both `findPath` and `findPathJPS` allocated the heap at `min(width * height, 4096)` and pushed without a capacity check. A typed-array out-of-range write is silently dropped, so beyond the cap the heap kept incrementing `size`, stored nothing, and read `undefined` in later comparisons — the search lost its ordering guarantee and returned a valid-looking, contiguous, non-optimal path with no error and no NaN. The heap now doubles on demand (amortized O(1), allocation only at growth).

  Also documents that `findPath` and `findPathJPS` disagree about corner cutting — A\* refuses a diagonal whose two shared cardinal neighbours are blocked, JPS permits it — and labels the package "beta — no production consumer yet".

- 84c6268: PF-6: settle the published surface of `physics` and `pathfinding` before the 0.4.0 freeze. Per ADR-0004.

  - `findPathJPS` now does what its header and the API spec already promised: when any tile costs more than 1 it delegates to weighted A\* (`findPath` with `diagonal: true`, forwarding `maxIterations` and `heuristic`). Nothing in JPS read tile costs before, so a weighted grid got a path straight through expensive tiles with the cost reported as if every tile cost 1. Detection is one linear scan of `grid.data` per call.
  - `CollisionWorld.addCollider(entity, collider, x, y)` — additive; the seven-positional `add` is unchanged. The collider's `shape` / `isTrigger` / `layer` / `mask` are copied at add time (re-add to change them), so `createCollider` finally has a consumer and one collider can seed many entities. The README example had hard-coded `false` for `isTrigger` while passing the collider's other fields — copied under a trigger collider it silently produced a solid body — and now uses `addCollider`.
  - `NavMeshPolygon.neighbors` removed. Nothing read it; adjacency comes from `portals[].neighborId`, so every mesh author was filling a dead field.
  - `SpatialEntry<T>` is no longer exported. No public signature produced or accepted it.
  - `SolidGrid.solid` is a `Uint8Array` of `width * height` cells (`row * width + col`, non-zero = solid) instead of a `Set<number>`. `buildSolidGrid` and its `readonly SolidTile[]` input are unchanged. This is a type decision for bulk data; there is no solid-grid benchmark, so the runtime effect is unmeasured.

- Updated dependencies [da81c97]
- Updated dependencies [fb5a0c5]
  - @flare-engine/math@0.4.0

## 0.3.1

### Patch Changes

- @flare-engine/math@0.3.1

## 0.3.0

### Minor Changes

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 68d22b2: README truth pass (features + platform tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`) and api-specs links are absolute (resolve on npmjs.com).

  - Snippets corrected to the real API where they had drifted: `animation` imports easings from `@flare-engine/math` (not `@flare-engine/animation`); `particles` uses `Color` objects, `speed`/`speedMax`, `direction`, config `gravityY`, and single-arg `update(dt)` (opacity fades via `start`/`endAlpha`, not `Color.a`); `pathfinding` `findPathJPS(grid, sx, sy, ex, ey)` returning `PathResult | null` with `path`/`cost`/`explored`; `dialogue` `createDialogueGraph`/`createDialogueRunner`/`createTextReveal` signatures + `ActionHandler(key)`; `debug` `StatsTracker` + `FpsWidget.update(stats)` + `TimeControl(clock)`; `errors` zero-arg `createConsoleTransport()`; `localization` real manager options; `scene` `Scene` requires `name`/`world`/`camera`.
  - Placeholders declared with real types; `haptics` marks its `expo-haptics` example `no-check` (uninstalled peer); `deep-links`/`share` import `Linking`/`Share` from `react-native`.

### Patch Changes

- Updated dependencies [6a10aa9]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [84fd0a3]
  - @flare-engine/math@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - @flare-engine/math@0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
