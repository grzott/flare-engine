# @flare-engine/shapes

Procedural 2D shape primitives for [react-native-skia](https://shopify.github.io/react-native-skia/). 12 named atomic shapes + an SVG path escape hatch — designed for fast 2D game prototyping where you compose entities from primitives instead of importing sprite art.

## Why

Mobile and indie game prototypes don't need sprite sheets to start. Compose ships, enemies, pickups, and UI shapes from primitives, ship a playable build, and replace shapes with art only after the mechanics lock — exactly the workflow Unity Shapes2D and Defold prototyping threads document. [Pan Tvardowski](https://github.com/grzott/Pan-Tvardowski) prototyped its full 29-ship roster shape-first this way before swapping in sprite art, and still drives its procedural shape atlas with this package.

## Install

```sh
bun add @flare-engine/shapes @shopify/react-native-skia
```

`@shopify/react-native-skia` is an **optional, type-only peer** — `src/draw.ts` imports it via `import type` only (for the injected `Skia` / `canvas` / `paint` handles), so it never enters the runtime bundle. Skip it entirely on web/CanvasKit; add it only where you actually render on native Skia.

## Usage

```ts
import { drawShape, type ShapeSpec } from '@flare-engine/shapes';

// Compose any entity from primitives.
const shape: ShapeSpec = { kind: 'circle', r: 24, fill: 0xff8844cc };
drawShape(Skia, canvas, paint, shape, /* x */ 100, /* y */ 200, /* rot */ 0);

// Need a custom shape? Use the SVG escape hatch:
const star: ShapeSpec = {
  kind: 'path',
  d: 'M 128 0 L 168 80 L 256 93 L 192 155 L 207 244 L 128 202 L 49 244 L 64 155 L 0 93 L 88 80 Z',
  boundsR: 256,
  fill: 0xffc9a24a,
};
drawShape(Skia, canvas, paint, star, 0, 0, 0);
```

## Primitives

13 spec kinds covering every common 2D shape. All accept optional `fill` (ARGB int), `stroke`, `strokeWidth`, `ox`/`oy` (local offset), `rot` (radians), and `glow: 'friendly' | 'hazard'`.

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
import type { ShapeSpec } from '@flare-engine/shapes';

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
  { kind: 'ring', r: 9, stroke: 0xffc9a24a, strokeWidth: 2, glow: 'friendly' },
  { kind: 'circle', r: 3, fill: 0xffff2b2b },
];
```

## Bounds

```ts
import { shapeBoundsRadius, singleShapeRadius } from '@flare-engine/shapes';

// For atlas tile sizing — max half-extent across a composition.
const tileRadius = shapeBoundsRadius([playerShip]);

// For glow halo sizing — radius of one primitive.
const glowR = singleShapeRadius({ kind: 'circle', r: 14 });
```

## Adding a new primitive

Three ways, in order of friction:

1. **Use the `path` escape hatch.** SVG `d="..."` strings parse natively via `Skia.Path.MakeFromSVGString`. Same syntax as Figma / Inkscape / `<path>`. Zero engine change.

2. **Author a composition.** Wrap multiple primitives in a `ShapeSpec[]` array. No new code at all.

3. **Add a named primitive.** When (1)/(2) aren't ergonomic enough or you need a perf-optimized branch:

   1. Extend the `ShapeSpec` union in `src/types.ts`
   2. Add a `case 'kind':` branch in `drawShape` (`src/draw.ts`)
   3. Add a bounds branch in `singleShapeRadius` (`src/bounds.ts`)
   4. Add tests in `tests/draw.test.ts` and `tests/bounds.test.ts`

   Tsc enforces exhaustiveness — forgetting any of these fails the build.

## Glow tags

Two visual halos for free, set `glow: 'friendly' | 'hazard'` on any primitive:

| Tag | Color | Use |
|---|---|---|
| `friendly` | safe-green `#6FA66B` at α=0.25, single 3 px ring at `r+4` | Player ships, pickups, safe markers |
| `hazard` | hazard-orange `#E84B2A` at α=0.6, double 0.5 px ring at `r+1` and `r+2` | Enemy bullets, danger cues |

## License

MIT
