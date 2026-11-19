# @flare-engine/shapes

## 0.4.15

### Patch Changes

- @flare-engine/assets@0.4.15
- @flare-engine/math@0.4.15

## 0.4.14

### Patch Changes

- @flare-engine/assets@0.4.14
- @flare-engine/math@0.4.14

## 0.4.13

### Patch Changes

- 968f114: `ShapeSpec`s can now be baked once into an atlas and drawn as sprites, so N shape-built entities are one `SpriteBatch` run instead of several Skia draws each.

  **`@flare-engine/shapes`.** `bakeShapeAtlas(Skia, specs, scale, options?)` draws each distinct spec object once, through `drawShape` and with its own fill, stroke and glow colours, into one image, and returns a `ShapeAtlas`: the `image` and `sheet` a `SpriteBatch` draws, plus `cells`, one `ShapeAtlasCell` per spec. `scale` is the raster scale in atlas pixels per spec unit and must be passed, because the bake cannot see the device scale. Cells are sized from `shapeBoundsBoxInto` and separated by `padding` (default 2 px); `maxWidth` (default 2048) is where rows wrap.

  `drawBakedShape(batch, atlas, index, x, y, rot?, scale?, color?, alpha?)` queues one instance with the spec's origin at `(x, y)`, rotated about it and scaled uniformly. `color` is the per-sprite colour multiplier `SpriteBatch.draw` takes. It allocates nothing.

  `shapeAtlasNeedsRebake(atlas, scale)` is `true` once `scale` is below 0.75x or above 1.5x of the scale the atlas was baked at. `rebakeShapeAtlas(Skia, atlas, scale)` returns the atlas it was given while `scale` is inside that band, and otherwise bakes the same specs at the new scale; cell indices are unchanged by a re-bake, and so are each spec's origin and drawn size; a cell's `width`/`height` and fractional anchors can differ by the rounding margin of either bake, because each cell is rounded up to whole pixels.

  A cell is never rasterized larger than `SHAPE_ATLAS_MAX_CELL` (2048 px) on its longer side. A spec that would need more is baked at a lower scale of its own, reported as `cell.scale`, and still draws at the same size. It does not throw.

  Limits: a spec whose parameters animate should stay on `drawShape`, since the bake is a snapshot. A baked instance's stroke and glow widths scale with the instance. `drawBakedShape` rotates the whole cell rigidly, where `drawShape`'s `rot` leaves each part's `ox`/`oy` unrotated. Colours are baked in, so `color` multiplies them and cannot recolour one part.

  The bake takes a `ShapeAtlasSkia`, a narrow interface that react-native-skia's `Skia` satisfies. The package now depends on `@flare-engine/assets`.

  **`@flare-engine/assets`.** `packAtlasRows(sizes, maxWidth, padding)` exports the row layout `createProceduralAtlas` already used, with its result types `AtlasRowLayout` and `AtlasRowPosition`. `createProceduralAtlas` is unchanged.

  **`@flare-engine/render-web`.** `createWebShapeSkia(kit)` returns a `WebShapeSkia`, a CanvasKit-backed `Skia` handle for `bakeShapeAtlas` and `drawShape`. Its surface factory makes CanvasKit's offscreen CPU surface, so the bake needs no WebGL context. It builds paths on CanvasKit's PathBuilder where there is one (0.41 and later) and on the mutable Path of 0.40 otherwise, and frees the paints and paths it created when a surface is disposed.

  Nothing changes for existing code.

- Updated dependencies [968f114]
  - @flare-engine/assets@0.4.13
  - @flare-engine/math@0.4.13

## 0.4.12

### Patch Changes

- c0c5f1a: `@flare-engine/math` now exports `argbToFloat4Into(out, argb)`, which unpacks a packed `0xAARRGGBB` colour int into a `Float32Array` as `[r, g, b, a]`, each 0-1, without allocating. Five packages each carried their own copy of the same four lines. They now call this one instead: shapes' `argbTo`, which stays exported and delegates, the frame renderer's `clear`, the web surface's `clear`, `renderShapesToImage`, and `createProceduralAtlas`. Colours come out the same as before. `@flare-engine/shapes`, `@flare-engine/assets` and `@flare-engine/render-web` now depend on `@flare-engine/math`.
- Updated dependencies [c0c5f1a]
- Updated dependencies [ee7781a]
- Updated dependencies [2b3c047]
- Updated dependencies [e0be221]
- Updated dependencies [e3474bc]
- Updated dependencies [636a8eb]
  - @flare-engine/math@0.4.12

## 0.4.11

### Patch Changes

- e69bb2b: Internal refactor: the triangle, ngon, star, arc, trapezoid and path renderers now share one module-private fill-then-stroke helper instead of six copies of the same block. Draw output and exports are unchanged.

## 0.4.10

### Patch Changes

- b9a8785: `shapeBoundsBox(specs)` and the zero-alloc `shapeBoundsBoxInto(specs, out)` return a `ShapeBoundsBox`
  `{ minX, minY, maxX, maxY }` in the composition-local frame: the union of every spec's extents at its
  `ox`/`oy`, each widened by the same `+2` + stroke + glow margin `shapeBoundsRadius` adds. Unrotated
  geometry is exact (a `ship` unions its hull, weapons and engine); a spec with a non-zero `rot` falls
  back to its radial reach, so the box never exceeds the radius on any axis. Empty `specs` give zeros.
- f172545: `BaseSpec.glow` also takes a `GlowSpec` `{ color, width }`: `drawShape` paints one `width` px ring in
  `color` (ARGB) with its inner edge 2.5 px outside the body, so `{ color: friendlyGlowArgb(), width: 3 }`
  paints exactly what `'friendly'` paints. `shapeBoundsRadius` and `shapeBoundsBox` widen by `2.5 + width`
  for the object form; a non-finite or negative `width` paints no ring and adds no reach. `applyGlow(canvas,
paint, cx, cy, r, color, width)` draws the ring directly. `'friendly'` and `'hazard'` are unchanged.
- be02a9c: Renames the file-local alias for the Skia module type that `drawShape` and its helpers take, so the
  emitted declaration file no longer carries a generated dollar-one-suffixed copy of that alias as the
  type of the first parameter. No exported symbol changes.

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

## 0.4.2

## 0.4.1

## 0.4.0

### Patch Changes

- 3ec412a: PF-4: settle the published surface of `shapes` before the 0.4.0 freeze. Per ADR-0004.

  `drawShip`'s engine block now routes through `drawShape` instead of calling `drawRect` directly, so
  `ShipSpec.engine`'s `ox`/`oy`/`rot` are actually applied and its `glow` ring is actually drawn — both
  were silently dropped before, painting the engine on the hull centre regardless of its offset.

  `shapeBoundsRadius` adds a stroke-width margin (`max(2, strokeWidth / 2)`, on top of the existing
  `+2`, only where a stroke is actually painted — always for `ring`/`polyline`, otherwise only when
  `stroke` is set) and the full extent of a `glow` ring (+5.5 friendly, +2.25 hazard). The documented
  contract already promised stroke widths were counted; they weren't, and neither was the glow ring
  `drawShape` paints, so a tile sized from the old value could clip a stroke or lose the glow ring
  entirely. The no-stroke, no-glow case is unchanged.

  `applyFriendlyGlow` / `applyHazardGlow` drop their unused leading `Skia` parameter.

## 0.3.1

## 0.3.0

### Minor Changes

- a33ad4a: shapes: ShipSpec bounds now include weapons and the engine, not just the hull.

  `singleShapeRadius('ship')` and the atlas-tile `boundsR('ship')` returned the hull radius alone, so a wing `RectSpec` mounted at an `ox`/`oy` beyond the hull (or the offset engine `SquareSpec`) was rasterized into a hull-sized atlas tile and clipped by its `drawShape` glow ring. Both now return the max reach across the hull, every weapon (`hypot(ox, oy) + weapon radius`), and the engine, so a wing-weapon ship's atlas tile and glow ring contain the full silhouette.

- ff62507: Peer-dependency floor bump + Skia decoupling across the React-facing packages, plus a new web frame-renderer export. Floors move to `react >=19` and `react-native >=0.79` (Skia 2.x requires RN 0.79, not 0.78) wherever those peers are declared. `@shopify/react-native-skia` moves to `>=2.0.0` where it is still required (`react`, `engine`), is dropped entirely as a peer from `render` and `assets` (both already inject a structural `*Like` Skia module and never import Skia), and becomes an **optional, type-only** peer of `shapes` (used only for the `import type` in `draw.ts`) and an **optional, injected** peer of `postfx` (Skia is passed in at runtime; the floor moves from `>=1.0.0` to `>=2.0.0`). `react-native-gesture-handler` is dropped as a peer from `input`, `react`, and `engine` (no runtime usage). `engine` gains `react-native-safe-area-context >=4.0.0` as a required peer, matching `<GameView>`'s inset resolution.

  `@flare-engine/render-web` additionally ships `createWebFrameRenderer(kit: CanvasKit): FrameRenderer` — the web/CanvasKit analog of `@flare-engine/react`'s `createSkiaFrameRenderer`, a thin composition `createFrameRenderer(createWebSkiaModule(kit))`; presentation (replaying `endFrame()` onto a surface and flushing) stays the consumer's responsibility. Also fixes the `render-web` on-screen post-FX surface so `resize()` correctly rebuilds the WebGL onscreen surface (`postfx-surface.ts`), preventing a stale-size onscreen target after a canvas resize.

- 7c4f7cf: Packaging polish across all shipping manifests. Every package now declares `engines: { "node": ">=20" }`. Each package's `exports["."]` carries per-condition type declarations — ESM consumers (`import`) resolve `./dist/index.d.mts` and CommonJS consumers (`require`) resolve `./dist/index.d.ts`, so the declaration file always matches the resolved module format instead of an ESM import falling back to the CJS-flavored `.d.ts` (the `"."`-level `types` that previously shadowed the ESM condition is removed; the root `types` field is retained for legacy/`node10` resolution). The `@types/react` dev floor moves from `^18` to `^19` across the React-facing packages, matching the installed React 19 runtime. No runtime or public API surface changes.
- 376969a: Build toolchain modernized across all packages, with no runtime or public API changes. Every package is now bundled with `tsdown` (Rolldown-based, replacing the unmaintained `tsup`); dist output (`.js`/`.mjs`/`.d.ts`/`.d.mts` + sourcemaps) is byte-compatible, so `exports` maps and installed shape are unchanged. Lint runs on Biome 2, the TypeScript floor moves to 5.9 (with `erasableSyntaxOnly`, `noUncheckedSideEffectImports`, and `moduleDetection: "force"` added as guards), and Bun ambient types are removed from the shipped-source typecheck. The `@flare-engine/engine` README now documents that the engine is architecture-agnostic and imposes no React Native New Architecture requirement of its own.
- 8696136: README truth pass (foundation + runtime + systems tiers): every `ts`/`tsx` example now typechecks against the workspace (enforced by `bun run check:readme`), api-specs links are absolute (resolve on npmjs.com), and private-game references are removed.

  - Snippets corrected to the real API where they had drifted: `SeededRNG.float(min, max)`; `defineComponent(name, () => defaults)`; `postfx` `create*` factories are `(id, uniforms)`; `render` `drawSprite`/`SpriteColor`; `loadCanvasKit(wasmUrl)`; `CollisionPair.entityA/entityB` + `createCollider(shape, opts)`; `events` `EventMap`-satisfying maps; `audio` `AudioContextLike`.
  - `storage`: the migration example now preserves player data across a version bump (was discarding it); the native MMKV adapter is shown as a structural peer (no `react-native-mmkv` dependency claim).
  - `render-web`: presentation uses the real `kit.MakeWebGLCanvasSurface(...)` rather than a placeholder duck-type.

### Patch Changes

- b113ca3: engine-wide: scrub private-game vocabulary from shipping JSDoc. Doc comments in a11y (`bridge.ts`), assets (`procedural-atlas.ts`), engine (`tier2-wiring.ts`), iap (`catalog.ts`/`entitlements.ts`), shapes (`types.ts`), share (`screenshot-scene.ts`), and ui (`dialogue-panel.tsx`/`main-menu-kit.tsx`/`shop-panel.tsx`) are rewritten project-neutral, so no game name, private repo URL, or internal phase/session numbers reach the published `.d.ts`. Comment-only — no API or behavior change.

## 0.2.1

## 0.2.0

### Minor Changes

- Version bumped as part of the 0.2.0 lockstep release.

## 0.1.0

### Minor Changes

- Initial release.
