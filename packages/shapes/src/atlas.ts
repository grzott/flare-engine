/**
 * Shape atlas bake — rasterizes `ShapeSpec`s once into one image, so that
 * shape-built entities draw as sprites through a batch instead of paying
 * `drawShape`'s one Skia draw per fill, stroke and glow ring.
 */

import {
  createSpriteSheet,
  packAtlasRows,
  type SkImageLike,
  type SpriteFrame,
  type SpriteSheet,
} from '@flare-engine/assets';
import type { SkCanvas, Skia as SkiaModule, SkPaint } from '@shopify/react-native-skia';
import { type ShapeBoundsBox, shapeBoundsBoxInto } from './bounds.js';
import { drawShape } from './draw.js';
import type { ShapeSpec } from './types.js';

/** Longest side a baked cell may have, in atlas pixels. */
export const SHAPE_ATLAS_MAX_CELL = 2048;

// The re-raster band: a baked atlas is kept while the wanted scale stays
// within these factors of the scale it was baked at.
const BAND_MIN = 0.75;
const BAND_MAX = 1.5;

/** The paint members the bake and `drawShape` call. */
export interface ShapeAtlasPaint {
  setColor(color: Float32Array): void;
  /** 0 = fill, 1 = stroke. */
  setStyle(style: number): void;
  setStrokeWidth(width: number): void;
}

/** The canvas members the bake and `drawShape` call. `rotate` takes degrees. */
export interface ShapeAtlasCanvas {
  save(): unknown;
  restore(): void;
  translate(dx: number, dy: number): void;
  scale(sx: number, sy: number): void;
  rotate(degrees: number, rx: number, ry: number): void;
  clear(color: Float32Array): void;
  drawCircle(cx: number, cy: number, r: number, paint: ShapeAtlasPaint): void;
  drawRect(rect: unknown, paint: ShapeAtlasPaint): void;
  drawPath(path: unknown, paint: ShapeAtlasPaint): void;
}

/** An offscreen surface the bake draws into and snapshots. */
export interface ShapeAtlasSurface {
  getCanvas(): ShapeAtlasCanvas;
  makeImageSnapshot(): SkImageLike;
  /** Called once after the snapshot, when present, to free the surface. */
  dispose?(): void;
}

/**
 * The Skia handle `bakeShapeAtlas` needs: what `drawShape` reads plus an
 * offscreen surface factory. `Skia` from `@shopify/react-native-skia`
 * satisfies it; on web, `createWebShapeSkia(kit)` from
 * `@flare-engine/render-web` builds one over CanvasKit.
 */
export interface ShapeAtlasSkia {
  Surface: { Make(width: number, height: number): ShapeAtlasSurface | null };
  Paint(): ShapeAtlasPaint;
  Path: {
    /**
     * Built on with `moveTo` / `lineTo` / `close` / `addArc` when the handle
     * has no `PathBuilder`: react-native-skia before 2.6, and
     * `createWebShapeSkia`. Not called otherwise.
     */
    Make(): unknown;
    MakeFromSVGString(d: string): unknown;
  };
  /**
   * Used instead of `Path.Make()` whenever present: react-native-skia 2.6 and
   * later, and the only way to build a path from 2.14, whose paths are
   * immutable. `detach()` returns the path that is drawn.
   */
  PathBuilder?: {
    Make(): {
      moveTo(x: number, y: number): unknown;
      lineTo(x: number, y: number): unknown;
      close(): unknown;
      addArc(oval: unknown, startDeg: number, sweepDeg: number): unknown;
      detach(): unknown;
    };
  };
  XYWHRect(x: number, y: number, w: number, h: number): unknown;
}

/** Layout options for `bakeShapeAtlas`. */
export interface ShapeAtlasOptions {
  /** Atlas width at which cells wrap to a new row, in pixels. Default 2048. */
  maxWidth?: number;
  /** Transparent gap between cells, in pixels, against sampling bleed. Default 2. */
  padding?: number;
}

/** One baked spec: where it sits in the atlas and how an instance maps onto it. */
export interface ShapeAtlasCell {
  /** The cell's rectangle in the atlas image, in pixels. */
  readonly frame: SpriteFrame;
  /** The spec's origin inside the cell, as a fraction of its width. */
  readonly anchorX: number;
  /** The spec's origin inside the cell, as a fraction of its height. */
  readonly anchorY: number;
  /** Cell width in the spec's own units: what an instance at scale 1 covers. */
  readonly width: number;
  /** Cell height in the spec's own units. */
  readonly height: number;
  /**
   * Pixels per spec unit this cell was rasterized at. Equal to the atlas
   * scale unless the cell hit `SHAPE_ATLAS_MAX_CELL`, in which case it is lower.
   */
  readonly scale: number;
}

/** A baked shape atlas: the `{ image, sheet }` pair a sprite batch draws, plus a cell per spec. */
export interface ShapeAtlas {
  readonly image: SkImageLike;
  /** One frame per distinct spec, named by its index in `sheet.frames`. */
  readonly sheet: SpriteSheet;
  /** Atlas width in pixels. */
  readonly width: number;
  /** Atlas height in pixels. */
  readonly height: number;
  /** The raster scale passed to the bake. */
  readonly scale: number;
  /** `cells[i]` belongs to `specs[i]`. A spec object that repeats shares one cell. */
  readonly cells: readonly ShapeAtlasCell[];
  /** A copy of the baked spec list. */
  readonly specs: readonly ShapeSpec[];
  readonly maxWidth: number;
  readonly padding: number;
}

/** The one `SpriteBatch` method `drawBakedShape` calls. */
export interface ShapeBatchLike {
  draw(
    image: SkImageLike,
    frame: SpriteFrame,
    dstX: number,
    dstY: number,
    dstW?: number,
    dstH?: number,
    effect?: undefined,
    anchorX?: number,
    anchorY?: number,
    alpha?: number,
    rotation?: number,
    stretch?: boolean,
    blend?: 'normal' | 'additive',
    flipX?: boolean,
    flipY?: boolean,
    color?: number,
  ): void;
}

const BOX: ShapeBoundsBox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
const TRANSPARENT = new Float32Array(4);

/**
 * Rasterize `specs` into one atlas image at `scale` pixels per spec unit.
 *
 * `scale` is explicit because nothing the bake can see knows the device
 * scale: pass the pixels one spec unit covers on screen (pixel density times
 * camera zoom times the usual instance scale).
 *
 * Each distinct spec object is drawn once by `drawShape`, with its own fill,
 * stroke and glow colours, into a cell sized from `shapeBoundsBoxInto`. A cell
 * whose longer side would exceed `SHAPE_ATLAS_MAX_CELL` is rasterized at a
 * lower scale of its own so that side is exactly the cap; it still draws at
 * the same size, only softer.
 *
 * Not for per-frame use: a spec whose parameters animate belongs on
 * `drawShape`. Throws if `scale` is not a positive finite number or the
 * surface cannot be created.
 */
export function bakeShapeAtlas(
  Skia: ShapeAtlasSkia,
  specs: readonly ShapeSpec[],
  scale: number,
  options: ShapeAtlasOptions = {},
): ShapeAtlas {
  if (!(scale > 0) || scale === Infinity) {
    throw new Error(`bakeShapeAtlas: raster scale must be a positive finite number, got ${scale}`);
  }
  const maxWidth = options.maxWidth ?? SHAPE_ATLAS_MAX_CELL;
  const padding = options.padding ?? 2;

  const baked = specs.slice();
  const cells: ShapeAtlasCell[] = [];
  const bySpec = new Map<ShapeSpec, ShapeAtlasCell>();
  // Per distinct spec, parallel to `sheet.frames`: where its origin falls inside its cell.
  const originX: number[] = [];
  const originY: number[] = [];
  const sheet = createSpriteSheet();
  const single: ShapeSpec[] = [];

  for (const spec of baked) {
    let cell = bySpec.get(spec);
    if (cell === undefined) {
      single[0] = spec;
      shapeBoundsBoxInto(single, BOX);
      const boxW = BOX.maxX - BOX.minX;
      const boxH = BOX.maxY - BOX.minY;
      const cellScale = Math.min(scale, SHAPE_ATLAS_MAX_CELL / Math.max(boxW, boxH));
      // The min() guards the cap against float error in the division above.
      const w = Math.min(SHAPE_ATLAS_MAX_CELL, Math.max(1, Math.ceil(boxW * cellScale)));
      const h = Math.min(SHAPE_ATLAS_MAX_CELL, Math.max(1, Math.ceil(boxH * cellScale)));
      const name = String(sheet.frames.length);
      cell = {
        frame: { name, x: 0, y: 0, w, h },
        anchorX: (-BOX.minX * cellScale) / w,
        anchorY: (-BOX.minY * cellScale) / h,
        width: w / cellScale,
        height: h / cellScale,
        scale: cellScale,
      };
      bySpec.set(spec, cell);
      sheet.frameMap.set(name, sheet.frames.length);
      sheet.frames.push(cell.frame);
      originX.push(-BOX.minX * cellScale);
      originY.push(-BOX.minY * cellScale);
    }
    cells.push(cell);
  }

  const layout = packAtlasRows(sheet.frames, maxWidth, padding);
  const surface = Skia.Surface.Make(layout.width, layout.height);
  if (surface === null) {
    throw new Error(
      `bakeShapeAtlas: Skia.Surface.Make returned null for ${layout.width}x${layout.height}`,
    );
  }

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  canvas.clear(TRANSPARENT);
  let i = 0;
  for (const [spec, cell] of bySpec) {
    const pos = layout.rects[i];
    if (pos === undefined) break;
    cell.frame.x = pos.x;
    cell.frame.y = pos.y;
    canvas.save();
    canvas.translate(pos.x + (originX[i] ?? 0), pos.y + (originY[i] ?? 0));
    canvas.scale(cell.scale, cell.scale);
    // `ShapeAtlasSkia` declares exactly the members `drawShape` reads, which is
    // what lets a CanvasKit handle stand in for the react-native-skia one here.
    drawShape(Skia as typeof SkiaModule, canvas as SkCanvas, paint as SkPaint, spec, 0, 0, 0);
    canvas.restore();
    i++;
  }

  const image = surface.makeImageSnapshot();
  surface.dispose?.();

  return {
    image,
    sheet,
    width: layout.width,
    height: layout.height,
    scale,
    cells,
    specs: baked,
    maxWidth,
    padding,
  };
}

/**
 * True when `scale` has left the re-raster band of `atlas`: below 0.75x or
 * above 1.5x of the scale it was baked at. Inside the band the baked pixels
 * are close enough to draw as they are. A `scale` that is not a positive
 * finite number returns false. Allocates nothing; safe to call every frame.
 */
export function shapeAtlasNeedsRebake(atlas: ShapeAtlas, scale: number): boolean {
  if (!(scale > 0) || scale === Infinity) return false;
  return scale < atlas.scale * BAND_MIN || scale > atlas.scale * BAND_MAX;
}

/**
 * Return `atlas` itself while `scale` is inside its re-raster band (see
 * `shapeAtlasNeedsRebake`), allocating nothing; otherwise bake the same specs
 * with the same options at `scale` and return the new atlas. Cell indices
 * carry over exactly, and so do each spec's origin and drawn size
 * (`anchorX * width` is always `-minX`), so instance draws need no change. A
 * cell's `width`/`height` and fractional anchors can differ by the rounding
 * margin of either bake, because each cell is rounded up to whole pixels. The old
 * image is not released: that is the caller's to drop.
 */
export function rebakeShapeAtlas(
  Skia: ShapeAtlasSkia,
  atlas: ShapeAtlas,
  scale: number,
): ShapeAtlas {
  if (!shapeAtlasNeedsRebake(atlas, scale)) return atlas;
  return bakeShapeAtlas(Skia, atlas.specs, scale, {
    maxWidth: atlas.maxWidth,
    padding: atlas.padding,
  });
}

/**
 * Queue one instance of baked spec `index` on `batch`, with the spec's origin
 * at (`x`, `y`). `rot` is radians, clockwise, about that origin; `scale` is
 * uniform and multiplies stroke and glow widths along with everything else.
 * `color` is an optional packed-ARGB multiplier over the baked colours and
 * `alpha` an opacity in [0, 1], both as `SpriteBatch.draw` takes them.
 *
 * The whole cell turns rigidly, including each part's `ox`/`oy` offset, which
 * `drawShape`'s `rot` leaves unrotated. An `index` with no cell draws nothing.
 * Allocates nothing.
 */
export function drawBakedShape(
  batch: ShapeBatchLike,
  atlas: ShapeAtlas,
  index: number,
  x: number,
  y: number,
  rot = 0,
  scale = 1,
  color?: number,
  alpha = 1,
): void {
  const cell = atlas.cells[index];
  if (cell === undefined) return;
  batch.draw(
    atlas.image,
    cell.frame,
    x,
    y,
    cell.width * scale,
    cell.height * scale,
    undefined,
    cell.anchorX,
    cell.anchorY,
    alpha,
    rot,
    false,
    'normal',
    false,
    false,
    color,
  );
}
