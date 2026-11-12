# @flare-engine/physics

## 0.4.12

### Patch Changes

- 61b0297: Ray vs AABB: an axis-parallel ray (`dx === 0` or `dy === 0`) whose origin lies exactly on the box's min or max on that axis made `raycast()` and `rayVsShapeInto` return a hit with `NaN` `distance` and `point`, whichever way the ray pointed. They now return a finite hit when the ray reaches the box and no hit when it points away from it, so a ray running exactly along a box edge hits the box, and `CollisionWorld.raycast` reports that hit. A zero-length direction (`dx === 0 && dy === 0`) now returns no hit for an AABB.
- a652a40: Internal refactor: `CollisionWorld` now decides trigger vs collision, and emits the matching enter or exit signal, in one private helper instead of three copies in `remove` and `step`. No behaviour or API change: a pair where either entity is a trigger still emits `onTriggerEnter` / `onTriggerExit`, any other pair still emits `onCollisionStart` / `onCollisionEnd`, in the same order, and a pair object is still allocated only when a pair starts or ends.
- 80b087b: The standalone `raycast(ox, oy, dx, dy, maxDist, targets)` now runs every target through `rayVsShapeInto`, the same ray math `CollisionWorld.raycast` uses, and the second, allocating copy of that math is removed. It no longer builds a hit record for each target it tests: a call that hits allocates the one hit it returns, and a call that misses allocates none. Results are unchanged — the closest hit wins, the first of equal-distance targets wins, and the returned hit is still a fresh object the caller may keep.
- efe54ad: `SpatialIndex.insert` of an item already in the index now replaces its bounds, the same as `update`. Before, a second `insert` of the same item added a second entry and left the first one behind: `size` counted it, `query` over the old bounds kept returning the item, and `remove` dropped only the newer entry, so the stale one stayed until `clear()`. This affected code calling `SpatialIndex.insert` directly; `CollisionWorld.add` already checked for an existing entity and called `update` instead, so `CollisionWorld` users were not affected.
- a851faa: `CollisionWorld`: re-adding an entity with a different `isTrigger` while one of its pairs was touching gave that pair a mismatched pair of signals. For example, a pair that began with `onTriggerEnter` ended with `onCollisionEnd`, or one that began with `onCollisionStart` ended with `onTriggerExit`, because the end signal was chosen from the flags at the moment the pair ended. A re-add that flips `isTrigger` now ends each active pair whose kind changes during the `add` / `addCollider` call, with the exit signal of its old kind. If the shapes still overlap, the next `step()` starts the pair again with the enter signal of its new kind. A pair whose other side is a trigger stays a trigger pair and gets no signal. Re-adds that keep `isTrigger` are unchanged, and frames without a re-add do no extra work.
- 5139cef: Three new exports for reading and writing one map cell, also re-exported by `@flare-engine/engine`. `setSolidAt(grid, col, row, solid)` in `@flare-engine/physics` marks a `SolidGrid` cell solid or empty and returns `true`; when `col` or `row` is out of range or not an integer it writes nothing and returns `false`. `isSolidAt(grid, col, row)` reads a cell; coordinates that name no cell follow the grid's `outside` rule, so they are solid on an `outside: 'solid'` grid and empty on an `'open'` one. `setTileAt(layer, col, row, gid)` in `@flare-engine/tilemap` writes a raw GID into a `TileLayer` cell that `getTileAt` and the renderer read back, with the same `true` / `false` return. None of them allocates. The `topdown` template's door code and its tests now call these instead of computing the row-major index by hand.
- Updated dependencies [ad28054]
- Updated dependencies [c0c5f1a]
- Updated dependencies [ee7781a]
- Updated dependencies [2b3c047]
- Updated dependencies [e0be221]
- Updated dependencies [e3474bc]
- Updated dependencies [636a8eb]
  - @flare-engine/events@0.4.12
  - @flare-engine/math@0.4.12

## 0.4.11

### Patch Changes

- @flare-engine/events@0.4.11
- @flare-engine/math@0.4.11

## 0.4.10

### Patch Changes

- 10ca079: `buildSolidGrid(width, height, tileSize, tiles, options?)` takes a `SolidGridOptions` with
  `outside?: 'solid' | 'open'` (default `'solid'`), stored on the returned `SolidGrid` as `outside`.
  With `'open'`, `isBlockedAABB` treats cells outside the grid as empty and tests only the in-grid
  cells the box overlaps, so `moveAndSlideInto` lets a body walk off the map edge — for seams between
  adjacent region maps. A grid built without the option is unchanged: leaving the map still blocks.
  The `SolidGridOptions` and `SolidGridOutside` types are exported.
  - @flare-engine/events@0.4.10
  - @flare-engine/math@0.4.10

## 0.4.9

### Patch Changes

- @flare-engine/events@0.4.9
- @flare-engine/math@0.4.9

## 0.4.8

### Patch Changes

- @flare-engine/events@0.4.8
- @flare-engine/math@0.4.8

## 0.4.7

### Patch Changes

- @flare-engine/events@0.4.7
- @flare-engine/math@0.4.7

## 0.4.6

### Patch Changes

- @flare-engine/events@0.4.6
- @flare-engine/math@0.4.6

## 0.4.5

### Patch Changes

- 8814ec2: Public release: every `@flare-engine/*` package is public on npm from this version, published from
  CI with npm provenance. No code changes; npm visibility is retroactive, so earlier versions are
  public too.
- Updated dependencies [8814ec2]
  - @flare-engine/events@0.4.5
  - @flare-engine/math@0.4.5

## 0.4.4

### Patch Changes

- @flare-engine/events@0.4.4
- @flare-engine/math@0.4.4

## 0.4.3

### Patch Changes

- @flare-engine/events@0.4.3
- @flare-engine/math@0.4.3

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

- b5d0a97: OSS-M11 (additive half): minimum-translation vectors and a broadphase-backed world raycast.

  `overlapInto(a, ax, ay, b, bx, by, out)` returns the shortest push separating two overlapping shapes — a unit axis and a penetration depth — with `overlap()` as the allocating twin. `shapeOverlap` previously answered only _whether_ two shapes collide, leaving a detection-only consumer with no way to resolve it. Returns `null` when apart, leaving the buffer untouched; concentric circles get a usable axis instead of `NaN`.

  `CollisionWorld.raycast(ox, oy, dx, dy, maxDist, mask?)` casts against the world's own colliders, walking only the broadphase cells the ray touches and filtering by the `layer` bits colliders already carry. The standalone `raycast(..., targets)` neither saw the world nor used the index, and allocated a hit record per candidate tested; the new method reuses one record, backed by a new zero-alloc `rayVsShapeInto` primitive.

  Also corrects the package README, which still described the broadphase as brute-force — it has been a uniform spatial hash since 0.3.1.

- 84c6268: PF-6: settle the published surface of `physics` and `pathfinding` before the 0.4.0 freeze. Per ADR-0004.

  - `findPathJPS` now does what its header and the API spec already promised: when any tile costs more than 1 it delegates to weighted A\* (`findPath` with `diagonal: true`, forwarding `maxIterations` and `heuristic`). Nothing in JPS read tile costs before, so a weighted grid got a path straight through expensive tiles with the cost reported as if every tile cost 1. Detection is one linear scan of `grid.data` per call.
  - `CollisionWorld.addCollider(entity, collider, x, y)` — additive; the seven-positional `add` is unchanged. The collider's `shape` / `isTrigger` / `layer` / `mask` are copied at add time (re-add to change them), so `createCollider` finally has a consumer and one collider can seed many entities. The README example had hard-coded `false` for `isTrigger` while passing the collider's other fields — copied under a trigger collider it silently produced a solid body — and now uses `addCollider`.
  - `NavMeshPolygon.neighbors` removed. Nothing read it; adjacency comes from `portals[].neighborId`, so every mesh author was filling a dead field.
  - `SpatialEntry<T>` is no longer exported. No public signature produced or accepted it.
  - `SolidGrid.solid` is a `Uint8Array` of `width * height` cells (`row * width + col`, non-zero = solid) instead of a `Set<number>`. `buildSolidGrid` and its `readonly SolidTile[]` input are unchanged. This is a type decision for bulk data; there is no solid-grid benchmark, so the runtime effect is unmeasured.

- Updated dependencies [da81c97]
- Updated dependencies [fb5a0c5]
  - @flare-engine/math@0.4.0
  - @flare-engine/events@0.4.0

## 0.3.1

### Patch Changes

- 1645606: Add `getColliderBoundsInto` (zero-alloc) and `getColliderBounds` (allocating) to `CollisionWorld` for direct AABB readback by entity id.
- b617e49: Replace brute-force linear scan in `SpatialIndex` with a uniform spatial hash: O(1) `remove`/`update` via item-to-slot map, O(cells-touched) `query` via cell buckets, zero-alloc duplicate suppression via monotone stamp counter. Also drops the per-entity 2-element array allocation in `CollisionWorld.step` by iterating `entries.values()`.
  - @flare-engine/events@0.3.1
  - @flare-engine/math@0.3.1

## 0.3.0

### Minor Changes

- d032b4b: physics adds broadphaseSize accessor + fixes the duplicate-broadphase-record leak on re-add (add() now routes to spatial.update when the entity already exists); input accumulates pointer delta across a frame instead of overwriting, matching the per-frame-delta contract.
- d69c329: physics: remove a private-project reference from the `moveAndSlideInto` docstring.

  The `solid-grid.ts` axis-slide docstring named a private sibling game ("byte-identical to Berek"), which shipped into the published `@flare-engine/physics` `dist` `.js`/`.mjs`/`.d.ts`/`.d.mts` and sourcemaps — surfaced by the OSS-F3 tarball audit as the one HEAD leak. The parenthetical is dropped; the behavioral note ("the y-check uses the already-updated x position") is kept. Comment-only, zero behavior change; all physics tests remain green.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 8696136: README truth pass (foundation + runtime + systems tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`), api-specs links are absolute (resolve on npmjs.com), and private-game references are removed.

  - Snippets corrected to the real API where they had drifted: `SeededRNG.float(min, max)`; `defineComponent(name, () => defaults)`; `postfx` `create*` factories are `(id, uniforms)`; `render` `drawSprite`/`SpriteColor`; `loadCanvasKit(wasmUrl)`; `CollisionPair.entityA/entityB` + `createCollider(shape, opts)`; `events` `EventMap`-satisfying maps; `audio` `AudioContextLike`.
  - `storage`: the migration example now preserves player data across a version bump (was discarding it); the native MMKV adapter is shown as a structural peer (no `react-native-mmkv` dependency claim).
  - `render-web`: presentation uses the real `kit.MakeWebGLCanvasSurface(...)` rather than a placeholder duck-type.

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

- Add solid-grid collision (Berek parity).

## 0.1.0

### Minor Changes

- Initial release.
