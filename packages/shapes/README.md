# @flare-engine/shapes

Procedural 2D shape primitives for [react-native-skia](https://shopify.github.io/react-native-skia/). 12 named atomic shapes + an SVG path escape hatch — designed for fast 2D game prototyping where you compose entities from primitives instead of importing sprite art.

## Why

Mobile and indie game prototypes don't need sprite sheets to start. Compose ships, enemies, pickups, and UI shapes from primitives, ship a playable build, and replace shapes with art only after the mechanics lock — exactly the workflow Unity Shapes2D and Defold prototyping threads document. Shape-first prototyping keeps the iteration loop tight: a project can reach a playable state immediately and swap in sprite art only after mechanics lock.

## Install

```sh
bun add @flare-engine/shapes @shopify/react-native-skia
```

`@shopify/react-native-skia` is an **optional peer** that the package never imports, in its code or in its published types: the `Skia`, `canvas` and `paint` handles are injected and typed structurally (`ShapeDrawSkia`, `ShapeAtlasCanvas`, `ShapeAtlasPaint`), and react-native-skia's `Skia`, `SkCanvas` and `SkPaint` are assignable to them. Skip it entirely on web/CanvasKit; add it only where you actually render on native Skia.

**The web is bake-only.** On web, the `Skia` handle is `createWebShapeSkia(kit)` from `@flare-engine/render-web`, and the only canvas it provides is the offscreen one behind its `Surface.Make`. Bake with `bakeShapeAtlas` and draw the instances every frame with `drawBakedShape` (see [Baking an atlas](#baking-an-atlas)). `drawShape` is not a per-frame path there: the handle's paints and paths are wrappers that only its own surface canvas can draw, not a raw CanvasKit canvas, and the handle frees them only when one of its surfaces is disposed.

## Usage

```ts
import type { Skia as SkiaModule, SkCanvas, SkPaint } from '@shopify/react-native-skia';
import { drawShape, type ShapeSpec } from '@flare-engine/shapes';

// `Skia` from react-native-skia is a value; the handle type is `typeof Skia`.
// `drawShape` itself is typed structurally (`ShapeDrawSkia`, `ShapeAtlasCanvas`,
// `ShapeAtlasPaint`), and these native types are assignable to that.
type Skia = typeof SkiaModule;

function demo(skia: Skia, canvas: SkCanvas, paint: SkPaint): void {
  // Compose any entity from primitives.
  const shape: ShapeSpec = { kind: 'circle', r: 24, fill: 0xff8844cc };
  drawShape(skia, canvas, paint, shape, /* x */ 100, /* y */ 200, /* rot */ 0);

  // Need a custom shape? Use the SVG escape hatch:
  const star: ShapeSpec = {
    kind: 'path',
    d: 'M 128 0 L 168 80 L 256 93 L 192 155 L 207 244 L 128 202 L 49 244 L 64 155 L 0 93 L 88 80 Z',
    boundsR: 256,
    fill: 0xffc9a24a,
  };
  drawShape(skia, canvas, paint, star, 0, 0, 0);
}
```

## Primitives

13 spec kinds covering every common 2D shape. All accept optional `fill` (ARGB int), `stroke`, `strokeWidth`, `ox`/`oy` (local offset), `rot` (radians), and `glow: 'friendly' | 'hazard' | { color, width }`.

| Kind | Fields | Use case |
|---|---|---|
| `circle` | `r` | Bullets, pickups, eyes |
| `rect` | `w`, `h` | Weapons, HUD bars, frames |
| `triangle` | `size` | Ship hulls, arrows, sigils |
| `ngon` | `n`, `r` | Hex/pentagon/octagon hulls |
| `star` | `points`, `rOuter`, `rInner` | Sigils, sparks, pickups |
| `ring` | `r` | Auras, target markers |
| `polyline` | `points: number[]` | Bolts, freehand strokes |
| `gradient-rect` | `w`, `h`, `colorA`, `colorB`, `axis: 0\|1` | HP bars, sky strips |
| `arc` | `r`, `startAngle`, `endAngle`, `sector?` | Half-circle, 1/4-moon, 1/8-moon |
| `annulus` | `rOuter`, `rInner`, `startAngle?`, `endAngle?` | Donut, half-donut, partial rings |
| `trapezoid` | `topW`, `botW`, `h` | Ship cockpits, pedestals |
| `path` | `d`, `boundsR` | **Escape hatch** — any SVG path string |
| `ship` | `hull`, `weapons[]`, `engine` | Composite (3-element rule) |

## Composing entities

```ts
import { friendlyGlowArgb, type ShapeSpec } from '@flare-engine/shapes';

// A ship: hull + 2 weapons + engine, painted back-to-front.
const playerShip: ShapeSpec = {
  kind: 'ship',
  hull: { kind: 'triangle', size: 28, fill: 0xffc9a24a },
  weapons: [
    { kind: 'rect', w: 6, h: 12, fill: 0xffc9a24a, ox: -14, oy: 8 },
    { kind: 'rect', w: 6, h: 12, fill: 0xffc9a24a, ox: 14, oy: 8 },
  ],
  engine: { kind: 'square', size: 20, fill: 0xff806020 },
};

// A pickup: ring + inner glow circle.
const amulet: readonly ShapeSpec[] = [
  { kind: 'ring', r: 9, stroke: 0xffc9a24a, strokeWidth: 2, glow: { color: friendlyGlowArgb(), width: 3 } },
  { kind: 'circle', r: 3, fill: 0xffff2b2b },
];
```

## Bounds

```ts
import {
  shapeBoundsBox,
  shapeBoundsRadius,
  singleShapeRadius,
  type ShapeSpec,
} from '@flare-engine/shapes';

declare const playerShip: ShapeSpec;

// For atlas tile sizing — max half-extent across a composition. Includes each
// shape's ox/oy offset, a stroke-width margin where a stroke is actually
// painted, and the full extent of a glow ring (+5.5 friendly, +2.25 hazard,
// +2.5 + width for a themed ring), so a tile sized from this fully contains
// what `drawShape` paints.
const tileRadius = shapeBoundsRadius([playerShip]);

// For hitboxes — per-axis extents with the same margins, so an asymmetric
// ship gets no dead space where a radius would. `shapeBoundsBoxInto(specs, out)`
// is the zero-alloc form for a caller-owned box.
const hit = shapeBoundsBox([playerShip]);
const hitWidth = hit.maxX - hit.minX;
const hitHeight = hit.maxY - hit.minY;

// For glow halo sizing — radius of one primitive.
const glowR = singleShapeRadius({ kind: 'circle', r: 14 });
```

## Baking an atlas

`drawShape` costs one Skia draw per fill, one per stroke and one or two per glow ring, so a scene of shape-built entities pays several draw calls per entity. `bakeShapeAtlas` rasterizes each spec once into one image; the instances then draw as sprites through `SpriteBatch`, and N of them are one draw call.

```ts
import { SpriteBatch } from '@flare-engine/render';
import {
  bakeShapeAtlas,
  drawBakedShape,
  friendlyGlowArgb,
  rebakeShapeAtlas,
  type ShapeAtlasSkia,
  type ShapeSpec,
} from '@flare-engine/shapes';

// Native: `Skia` from @shopify/react-native-skia.
// Web: `createWebShapeSkia(kit)` from @flare-engine/render-web.
declare const skia: ShapeAtlasSkia;
declare const batch: SpriteBatch;
declare const pixelDensity: number;
declare const zoom: number;

const specs: ShapeSpec[] = [
  { kind: 'circle', r: 10, fill: 0xffc9a24a, glow: { color: friendlyGlowArgb(), width: 3 } },
  { kind: 'star', points: 5, rOuter: 12, rInner: 5, fill: 0xffff2b2b, stroke: 0xff000000 },
];

// Once, outside the frame loop. The third argument is the raster scale:
// atlas pixels per spec unit.
let atlas = bakeShapeAtlas(skia, specs, pixelDensity * zoom);

function frame(): void {
  // Returns the same atlas, allocation-free, until the scale leaves the band.
  atlas = rebakeShapeAtlas(skia, atlas, pixelDensity * zoom);

  // index, x, y, then optional rotation (radians), uniform scale, colour, alpha.
  drawBakedShape(batch, atlas, 0, 120, 80);
  drawBakedShape(batch, atlas, 1, 200, 80, Math.PI / 4, 1.5);
  drawBakedShape(batch, atlas, 1, 260, 80, 0, 1, 0x80ffffff);
}
```

`atlas.image` and `atlas.sheet` are the pair `SpriteBatch` draws, and `atlas.cells[i]` describes the cell baked from `specs[i]`. A spec object listed twice is baked once.

**The raster scale is explicit.** The bake cannot see the device scale, so you pass it: the number of screen pixels one spec unit covers, which is pixel density times camera zoom times the instance scale you mostly draw at. Baking at 1 on a 3× display draws blurry shapes.

**The re-raster rule.** A baked atlas is kept while the scale you want stays between 0.75× and 1.5× of the scale it was baked at; inside that band the baked pixels are drawn as they are. `shapeAtlasNeedsRebake(atlas, scale)` is the test, and `rebakeShapeAtlas` applies it: inside the band it returns the atlas it was given, outside it bakes the same specs at the new scale. Cell indices do not change across a re-bake, and neither do a spec's origin and drawn size, so instance draws need no change. A cell's `width`/`height` and its fractional anchors can differ by the rounding margin of either bake, because each cell is rounded up to whole pixels. The previous image is yours to release.

**The 2048 px cell cap.** No cell is rasterized larger than `SHAPE_ATLAS_MAX_CELL` (2048 px) on its longer side. A spec that would need more is baked at a lower scale of its own, so its longer side is exactly 2048 px; `cell.scale` reports the scale it got. It still draws at the right size, only softer. Nothing throws. The cap is per cell: the atlas wraps rows at `maxWidth` (default 2048) but grows as tall as its rows need, so bake very large or very many specs into more than one atlas.

**Limits.**

- **Animated specs stay on `drawShape`.** The bake is a snapshot. A spec whose parameters change every frame, such as an `arc` used as a cooldown sweep, would re-bake every frame.
- **Stroke and glow scale with the instance.** A baked instance is a sprite: scaling it scales its stroke width and glow ring too, including across the re-raster band.
- **Rotation is rigid.** `drawBakedShape` turns the whole cell about the spec's origin. `drawShape`'s `rot` turns each part about its own centre and leaves `ox`/`oy` unrotated, so a rotated `ship` or offset spec looks different on the two paths.
- **Colours are baked in.** The optional `color` argument multiplies the baked pixels (it is `SpriteBatch`'s per-sprite colour); it cannot recolour one part. Instances drawn with a `color` and instances drawn without one form separate runs.
- **Uniform scale only** on the batched path.

## Adding a new primitive

Three ways, in order of friction:

1. **Use the `path` escape hatch.** SVG `d="..."` strings parse natively via `Skia.Path.MakeFromSVGString`. Same syntax as Figma / Inkscape / `<path>`. Zero engine change.

2. **Author a composition.** Wrap multiple primitives in a `ShapeSpec[]` array. No new code at all.

3. **Add a named primitive.** When (1)/(2) aren't ergonomic enough or you need a perf-optimized branch:

   1. Extend the `ShapeSpec` union in `src/types.ts`
   2. Add a `case 'kind':` branch in `drawShape` (`src/draw.ts`)
   3. Add a bounds branch in `singleShapeRadius` (`src/bounds.ts`)
   4. Add tests in `tests/draw.test.ts` and `tests/bounds.test.ts`

   Tsc catches a missing step 3: `singleShapeRadius` returns `number`, so an unhandled kind fails to
   compile. It does **not** catch a missing step 2 — `drawShape` returns `void` and its switch has no
   `default`, so a new kind without a draw branch compiles and silently draws nothing.

## Glow

Set `glow` on any primitive and `drawShape` paints a ring behind the body. Two named halos come for free, and a `GlowSpec` object paints a ring in your own palette:

| Glow | Color | Use |
|---|---|---|
| `'friendly'` | safe-green `#6FA66B` at α=0.25, single 3 px ring at `r+4` | Player ships, pickups, safe markers |
| `'hazard'` | hazard-orange `#E84B2A` at α=0.6, double 0.5 px ring at `r+1` and `r+2` | Enemy bullets, danger cues |
| `{ color, width }` | one `width` px ring in `color` (ARGB), inner edge 2.5 px outside the body | Any theme |

`{ color: friendlyGlowArgb(), width: 3 }` paints exactly what `'friendly'` paints. The bounds helpers widen by `2.5 + width` for the object form, so an atlas tile or hitbox grows with the ring. A non-finite or negative `width` paints no ring and adds no reach. `applyGlow(canvas, paint, cx, cy, r, color, width)` draws the themed ring directly for custom compositing.

**The `'friendly'` and `'hazard'` strings are deprecated and removed in 0.5.0.** Pass a `GlowSpec` instead: `'friendly'` becomes `{ color: friendlyGlowArgb(), width: 3 }`, which paints the same pixels; `'hazard'` becomes `{ color: hazardGlowArgb(), width: 1 }`, which keeps the colour and the 1 px of stroke but paints one ring instead of two, its inner edge 2.5 px outside the body instead of 0.75 px. `applyHazardGlow` stays exported for drawing the two-ring look yourself.

```ts
import type { GlowSpec, ShapeSpec } from '@flare-engine/shapes';

const brandGlow: GlowSpec = { color: 0x40c9a24a, width: 4 };
const relic: ShapeSpec = { kind: 'star', points: 5, rOuter: 12, rInner: 5, fill: 0xffc9a24a, glow: brandGlow };
```

## License

Apache-2.0
