import { type SpriteFrame, type SpriteSheet, createSpriteSheet } from './sprite-sheet.js';
import type { SkImageLike } from './texture.js';

/** One entry in a procedural atlas — a named colored rectangle. */
export interface ProceduralFrameSpec {
  /** Frame name (used as the SpriteFrame name for lookup). */
  name: string;
  /** Width in pixels. */
  w: number;
  /** Height in pixels. */
  h: number;
  /** Color as ARGB int (0xAARRGGBB). */
  color: number;
}

/** Options controlling atlas layout. */
export interface ProceduralAtlasOptions {
  /** Max atlas width before wrapping to a new row. Default 1024. */
  maxWidth?: number;
  /** Gap between frames in pixels. Default 0. */
  padding?: number;
}

/** Result of a procedural atlas build. */
export interface ProceduralAtlas {
  /** Backing Skia image with all rects drawn. */
  image: SkImageLike;
  /** SpriteSheet whose frames describe the rect positions. */
  sheet: SpriteSheet;
  /** Total atlas width in pixels. */
  width: number;
  /** Total atlas height in pixels. */
  height: number;
}

/** Opaque Skia color value — a Float32Array of length 4 (r, g, b, a in [0,1]). */
type SkColorLike = Float32Array;

/** Narrow paint interface — only the setter we use. */
export interface SkPaintLike {
  setColor(color: SkColorLike): void;
}

/** Narrow rect interface — a rect value object passed to drawRect. */
export interface SkRectLike {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Narrow canvas interface — only the method we use. */
export interface SkCanvasLike {
  drawRect(rect: SkRectLike, paint: SkPaintLike): void;
}

/** Narrow surface interface — getCanvas + snapshot. */
export interface SkSurfaceLike {
  getCanvas(): SkCanvasLike;
  makeImageSnapshot(): SkImageLike;
}

/**
 * Narrow view of the Skia module — only the factories this helper needs.
 * Declared locally so unit tests can supply a plain mock without pulling
 * in the full `@shopify/react-native-skia` surface.
 */
export interface SkiaAtlasModuleLike {
  Surface: { Make(width: number, height: number): SkSurfaceLike | null };
  Paint(): SkPaintLike;
  XYWHRect(x: number, y: number, w: number, h: number): SkRectLike;
}

/**
 * Build a flat atlas `SkImage` from a list of colored rectangles.
 *
 * Row-packs frames left-to-right until `maxWidth` is exceeded, then wraps
 * to a new row. Returns both the backing image and a `SpriteSheet` whose
 * frames match the packed positions, so consumers can look up frames by
 * name exactly as with a real `parseTexturePacker*` sheet.
 *
 * Useful for:
 * - bootstrapping gameplay before final art lands (replace with one
 *   `parseTexturePackerHash` call once the real atlas arrives),
 * - engine tests / benchmarks that need a valid `SkImage` without
 *   shipping any binary asset.
 *
 * **Canonical placeholder-atlas pattern:** a game can ship a full "shape
 * atlas" that draws every entity (enemies, bosses, ships, pickups) as
 * composed primitives onto an offscreen Skia surface, then wraps the result
 * in a `SpriteSheet`.
 * That pattern (declarative shape spec → Skia draw calls → `SpriteSheet`
 * with one named frame per shape) is the recommended way to build a
 * manifest-swappable placeholder atlas: when final art lands, swap the
 * shape draw-calls for `parseTexturePackerHash(jsonText)` with no other
 * code changes.
 */
export function createProceduralAtlas(
  Skia: SkiaAtlasModuleLike,
  frames: readonly ProceduralFrameSpec[],
  options: ProceduralAtlasOptions = {},
): ProceduralAtlas {
  const maxWidth = options.maxWidth ?? 1024;
  const padding = options.padding ?? 0;

  const positions = layoutRows(frames, maxWidth, padding);
  const surface = Skia.Surface.Make(positions.width, positions.height);
  if (surface === null) {
    throw new Error(`Skia.Surface.Make returned null for ${positions.width}x${positions.height}`);
  }

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  const color: SkColorLike = new Float32Array(4);

  const sheet = createSpriteSheet();

  for (let i = 0; i < frames.length; i++) {
    const spec = frames[i];
    const pos = positions.rects[i];
    if (spec === undefined || pos === undefined) continue;

    writeArgb(color, spec.color);
    paint.setColor(color);
    canvas.drawRect(Skia.XYWHRect(pos.x, pos.y, spec.w, spec.h), paint);

    const frame: SpriteFrame = {
      name: spec.name,
      x: pos.x,
      y: pos.y,
      w: spec.w,
      h: spec.h,
    };
    sheet.frames.push(frame);
    sheet.frameMap.set(spec.name, i);
  }

  return {
    image: surface.makeImageSnapshot(),
    sheet,
    width: positions.width,
    height: positions.height,
  };
}

interface PackedPosition {
  x: number;
  y: number;
}

interface PackedLayout {
  rects: PackedPosition[];
  width: number;
  height: number;
}

function layoutRows(
  frames: readonly ProceduralFrameSpec[],
  maxWidth: number,
  padding: number,
): PackedLayout {
  const rects: PackedPosition[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let atlasWidth = 0;

  for (const spec of frames) {
    if (x > 0 && x + spec.w > maxWidth) {
      y += rowHeight + padding;
      x = 0;
      rowHeight = 0;
    }
    rects.push({ x, y });
    x += spec.w + padding;
    if (spec.h > rowHeight) rowHeight = spec.h;
    if (x - padding > atlasWidth) atlasWidth = x - padding;
  }

  const atlasHeight = y + rowHeight;
  return {
    rects,
    width: atlasWidth > 0 ? atlasWidth : 1,
    height: atlasHeight > 0 ? atlasHeight : 1,
  };
}

function writeArgb(out: SkColorLike, argb: number): void {
  out[0] = ((argb >>> 16) & 0xff) / 255;
  out[1] = ((argb >>> 8) & 0xff) / 255;
  out[2] = (argb & 0xff) / 255;
  out[3] = ((argb >>> 24) & 0xff) / 255;
}
