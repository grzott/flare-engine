# @flare-engine/tilemap

## 0.3.1

### Patch Changes

- Updated dependencies [1645606]
- Updated dependencies [b617e49]
- Updated dependencies [1645606]
  - @flare-engine/physics@0.3.1
  - @flare-engine/render@0.3.1
  - @flare-engine/assets@0.3.1
  - @flare-engine/math@0.3.1

## 0.3.0

### Minor Changes

- bee807c: tilemap: Tiled GID flip bits + correct LDtk pipeline.

  **Tiled flip bits.** Add `GID_FLIP_MASK` (`0x1fffffff`), `stripGidFlags(gid)`, `decodeGidFlags(gid): TileFlipFlags`. Every GID consumer now masks the high flip bits before resolving: `getTilesetForGid` and `getTileSourceRect`, plus the collider and renderer local-id lookups. Flipped tiles previously resolved to the _last_ tileset and lost their solid flags; they now resolve the correct tileset and keep colliders. `TileCollider.gid` stores the masked (real) global id. Render-time flip _transforms_ remain a documented limitation (post-launch).

  **LDtk pipeline.** `parseLDtk` resolves each tile through its layer's tileset (`__tilesetDefUid` → `firstGid`) instead of assuming the first tileset; `firstGid`s are assigned deterministically by sorting tileset uids ascending. IntGrid layers now populate `solidTiles` (value `> 0` is solid by default) so `extractColliders` returns correct, non-empty colliders for LDtk maps. New `parseLDtk(json, options?)` with `ParseLDtkOptions.intGridSolid` predicate.

  **Parser honesty.** New `TilemapParseError`. `parseTiled` throws actionable errors on infinite, base64/compressed/chunked, external-tileset, and non-orthogonal maps instead of silently producing wrong data; `parseLDtk` throws on non-project input and `externalLevels` projects.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 68d22b2: README truth pass (features + platform tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`) and api-specs links are absolute (resolve on npmjs.com).

  - Snippets corrected to the real API where they had drifted: `animation` imports easings from `@flare-engine/math` (not `@flare-engine/animation`); `particles` uses `Color` objects, `speed`/`speedMax`, `direction`, config `gravityY`, and single-arg `update(dt)` (opacity fades via `start`/`endAlpha`, not `Color.a`); `pathfinding` `findPathJPS(grid, sx, sy, ex, ey)` returning `PathResult | null` with `path`/`cost`/`explored`; `dialogue` `createDialogueGraph`/`createDialogueRunner`/`createTextReveal` signatures + `ActionHandler(key)`; `debug` `StatsTracker` + `FpsWidget.update(stats)` + `TimeControl(clock)`; `errors` zero-arg `createConsoleTransport()`; `localization` real manager options; `scene` `Scene` requires `name`/`world`/`camera`.
  - Placeholders declared with real types; `haptics` marks its `expo-haptics` example `no-check` (uninstalled peer); `deep-links`/`share` import `Linking`/`Share` from `react-native`.

- 358a348: Add `parseLDtkEntities(map)` + `LDtkEntity` — flatten LDtk object layers into spawn-ready `{ id, x, y, width, height, fields }` for the LDtk-entity → ECS spawn convention; `id` is the entity identifier. Authoring-pipeline docs added to api-specs.md; cli flag-drift corrected (`--embed-tilesets` → `--no-embed-tilesets` in README and api-specs).

### Patch Changes

- Updated dependencies [6a10aa9]
- Updated dependencies [d032b4b]
- Updated dependencies [b113ca3]
- Updated dependencies [e271eb2]
- Updated dependencies [d69c329]
- Updated dependencies [3ab5f93]
- Updated dependencies [ff62507]
- Updated dependencies [7c4f7cf]
- Updated dependencies [376969a]
- Updated dependencies [8696136]
- Updated dependencies [84fd0a3]
- Updated dependencies [a920170]
- Updated dependencies [268f246]
- Updated dependencies [a3c2376]
- Updated dependencies [938ef11]
  - @flare-engine/math@0.3.0
  - @flare-engine/physics@0.3.0
  - @flare-engine/assets@0.3.0
  - @flare-engine/render@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies []:
  - @flare-engine/assets@0.2.1
  - @flare-engine/render@0.2.1
  - @flare-engine/math@0.2.1
  - @flare-engine/physics@0.2.1

## 0.2.0

### Minor Changes

- Add `drawInto` (Berek parity).

## 0.1.0

### Minor Changes

- Initial release.
