---
"@flare-engine/shapes": patch
"@flare-engine/assets": patch
"@flare-engine/render-web": patch
---

`ShapeSpec`s can now be baked once into an atlas and drawn as sprites, so N shape-built entities are one `SpriteBatch` run instead of several Skia draws each.

**`@flare-engine/shapes`.** `bakeShapeAtlas(Skia, specs, scale, options?)` draws each distinct spec object once, through `drawShape` and with its own fill, stroke and glow colours, into one image, and returns a `ShapeAtlas`: the `image` and `sheet` a `SpriteBatch` draws, plus `cells`, one `ShapeAtlasCell` per spec. `scale` is the raster scale in atlas pixels per spec unit and must be passed, because the bake cannot see the device scale. Cells are sized from `shapeBoundsBoxInto` and separated by `padding` (default 2 px); `maxWidth` (default 2048) is where rows wrap.

`drawBakedShape(batch, atlas, index, x, y, rot?, scale?, color?, alpha?)` queues one instance with the spec's origin at `(x, y)`, rotated about it and scaled uniformly. `color` is the per-sprite colour multiplier `SpriteBatch.draw` takes. It allocates nothing.

`shapeAtlasNeedsRebake(atlas, scale)` is `true` once `scale` is below 0.75x or above 1.5x of the scale the atlas was baked at. `rebakeShapeAtlas(Skia, atlas, scale)` returns the atlas it was given while `scale` is inside that band, and otherwise bakes the same specs at the new scale; cell indices are unchanged by a re-bake, and cell sizes and anchors stay within one pixel of the old raster scale (each cell is rounded up to whole pixels).

A cell is never rasterized larger than `SHAPE_ATLAS_MAX_CELL` (2048 px) on its longer side. A spec that would need more is baked at a lower scale of its own, reported as `cell.scale`, and still draws at the same size. It does not throw.

Limits: a spec whose parameters animate should stay on `drawShape`, since the bake is a snapshot. A baked instance's stroke and glow widths scale with the instance. `drawBakedShape` rotates the whole cell rigidly, where `drawShape`'s `rot` leaves each part's `ox`/`oy` unrotated. Colours are baked in, so `color` multiplies them and cannot recolour one part.

The bake takes a `ShapeAtlasSkia`, a narrow interface that react-native-skia's `Skia` satisfies. The package now depends on `@flare-engine/assets`.

**`@flare-engine/assets`.** `packAtlasRows(sizes, maxWidth, padding)` exports the row layout `createProceduralAtlas` already used, with its result types `AtlasRowLayout` and `AtlasRowPosition`. `createProceduralAtlas` is unchanged.

**`@flare-engine/render-web`.** `createWebShapeSkia(kit)` returns a `WebShapeSkia`, a CanvasKit-backed `Skia` handle for `bakeShapeAtlas` and `drawShape`. Its surface factory makes CanvasKit's offscreen CPU surface, so the bake needs no WebGL context. It builds paths on CanvasKit's PathBuilder where there is one (0.41 and later) and on the mutable Path of 0.40 otherwise, and frees the paints and paths it created when a surface is disposed.

Nothing changes for existing code.
