# @flare-engine/tilemap

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.
- Updated dependencies [8814ec2]
  - @flare-engine/assets@0.4.5
  - @flare-engine/math@0.4.5
  - @flare-engine/physics@0.4.5
  - @flare-engine/render@0.4.5

## 0.4.4

### Patch Changes

- @flare-engine/assets@0.4.4
- @flare-engine/math@0.4.4
- @flare-engine/physics@0.4.4
- @flare-engine/render@0.4.4

## 0.4.3

### Patch Changes

- @flare-engine/assets@0.4.3
- @flare-engine/math@0.4.3
- @flare-engine/physics@0.4.3
- @flare-engine/render@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies [785a3b2]
  - @flare-engine/render@0.4.2
  - @flare-engine/assets@0.4.2
  - @flare-engine/math@0.4.2
  - @flare-engine/physics@0.4.2

## 0.4.1

### Patch Changes

- @flare-engine/assets@0.4.1
- @flare-engine/math@0.4.1
- @flare-engine/physics@0.4.1
- @flare-engine/render@0.4.1

## 0.4.0

### Patch Changes

- 63d7dad: HYG13/HYG16-PRE: bound the raycast broadphase walk; select AutoLayer tiles by `__type`. Per ADR-0004.

  `CollisionWorld.raycast` now rejects a non-finite `maxDist` (returns `null`) instead of reaching
  `SpatialIndex`'s cell-range loop with an infinite bound. `SpatialIndex.query`/`insert`/`update` also
  clamp the derived cell range to the packed key's supported extent (±2,097,152 world units), so an
  entity positioned at an infinite coordinate (`setPosition(e, Infinity, y)`) no longer hangs the JS
  thread or grows a broadphase bucket without bound. An unbounded ray must now pass a large finite
  `maxDist` (e.g. the map's diagonal) — "cast until it leaves the world" is not a supported contract
  for a uniform-grid broadphase.

  `parseLDtk` selected an AutoLayer's tiles with `layer.gridTiles ?? layer.autoLayerTiles`, which never
  falls through to `autoLayerTiles` because a real AutoLayer's `gridTiles` is `[]`, not `null`/`undefined`
  — every LDtk AutoLayer (the standard way to author auto-tiled terrain) parsed as an empty, all-zero
  layer with no error. Selection is now keyed on `layer.__type === 'AutoLayer'`, matching the field LDtk
  itself keys on; `gridTiles`/`autoLayerTiles` on the parser's internal `LDtkLayerInstance` type are no
  longer optional, documenting that real LDtk output always carries both arrays. This is accurate
  self-documentation, not a typecheck guardrail: `parseLDtk(json: unknown)` narrows via a bare
  `as LDtkJSON` assertion, so a fixture omitting either field still compiles.

- 88b6907: Exactly-touching shapes never collide; `TileLayer.tiles` is `readonly`. Per ADR-0004.

  `shapeOverlap` tested box-vs-circle with `<=` while box-vs-box and circle-vs-circle used `<`, so a
  circle resting exactly on a box face or corner collided (raising `onEnter`) where two touching boxes
  did not. All three pairs are now strict. `overlapInto` already was, except for a zero-radius circle
  exactly on a box edge, which returned a depth-0 overlap and now returns `null` — so `shapeOverlap`
  and `overlapInto(...) !== null` agree on every input. A zero-radius circle strictly inside a box
  still collides, as a zero-size box does.

  `TileLayer.tiles` gains the `readonly` modifier `SolidGrid.solid` already carries. Assigning a new
  array to `layer.tiles` stops compiling; writing cells (`layer.tiles[i] = gid`) is unchanged.

- 14b532e: PF-1b: settle four small published-surface findings in `tilemap` before the freeze. Per ADR-0004.

  - `TileLayer.tiles` is now `Uint32Array`, not `number[]` (owner-decided). `Uint32Array`, not `Float32Array` — a 24-bit mantissa cannot hold Tiled's flip-bit GIDs (`0x80000000` and up). This is a **type** decision for bulk numeric data, matching the repo's own convention — not a measured perf change: there is no tilemap benchmark, and the SMI-to-double transition this avoids is V8-only, while Hermes (the primary RN target) already stores every `number[]` element boxed. `parseTiled` and `parseLDtk` both build it with `Uint32Array.from`/`new Uint32Array(n)`; `getTileAt`'s `?? 0` stays (unreachable at runtime — the caller's bounds check guarantees an in-range index — but still required by `noUncheckedIndexedAccess`, which types every typed-array read as `number | undefined`).
  - `TileData` — an exported interface nothing in the repo constructed or read — is deleted, along with its barrel export.
  - `getTileSourceRectInto(tileset, gid, out)` is added as the zero-alloc form of `getTileSourceRect`, which now delegates to it. `TilemapRenderer`'s per-tile draw loop switches from its own inlined copy of the same math to the shared `…Into` form via a reusable buffer.
  - `parseTiled` now validates its input the same way `parseLDtk` already does (`typeof json === 'object'`, array/number checks) and throws `TilemapParseError` instead of a raw `TypeError` on garbage input.

  <!-- symbols-ok: noUncheckedIndexedAccess -->
  <!-- reason: a TypeScript compiler flag from tsconfig.base.json, not an exported symbol. It is
       named here because it is the reason getTileAt keeps its `?? 0` after the Uint32Array switch:
       under that flag a typed-array index read is still `number | undefined`. -->

- Updated dependencies [63d7dad]
- Updated dependencies [88b6907]
- Updated dependencies [599cd30]
- Updated dependencies [b5d0a97]
- Updated dependencies [da81c97]
- Updated dependencies [9868562]
- Updated dependencies [fb5a0c5]
- Updated dependencies [2afc6d9]
- Updated dependencies [84c6268]
  - @flare-engine/physics@0.4.0
  - @flare-engine/render@0.4.0
  - @flare-engine/math@0.4.0
  - @flare-engine/assets@0.4.0

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
