/**
 * Shape-atlas builder — rasterizes every gameplay-relevant entity from
 * `SHAPE_CATALOGUE` (plus a few runtime-only frames: bullets, particles)
 * onto a single offscreen Skia surface and returns a `SpriteSheet` keyed
 * by frame name.
 *
 * Frame names mirror the catalogue keys, plus:
 *   - `player-bullet` / `enemy-bullet` — colored rects
 *   - `particle-spark` / `particle-smoke` — small dots
 *
 * Built once at boot. Zero per-frame cost — the render system just reads
 * pre-rasterized frames like any other sprite atlas.
 */

import { type SpriteFrame, type SpriteSheet, createSpriteSheet } from '@flare-engine/assets';
import type { SkImage, Skia as SkiaModule } from '@shopify/react-native-skia';
import { SHAPE_CATALOGUE } from './shape-catalogue';
import type { ShapeSpec } from './shapes';
import { drawShape, shapeBoundsRadius } from './shapes-draw';

type Skia = typeof SkiaModule;

const FILL = new Float32Array(4);
function argb(argbInt: number): Float32Array {
  FILL[0] = ((argbInt >>> 16) & 0xff) / 255;
  FILL[1] = ((argbInt >>> 8) & 0xff) / 255;
  FILL[2] = (argbInt & 0xff) / 255;
  FILL[3] = ((argbInt >>> 24) & 0xff) / 255;
  return FILL;
}

export interface ShapeAtlas {
  readonly image: SkImage;
  readonly sheet: SpriteSheet;
  readonly width: number;
  readonly height: number;
}

interface FrameBuild {
  name: string;
  w: number;
  h: number;
  draw: (Skia: Skia, canvas: import('@shopify/react-native-skia').SkCanvas) => void;
}

function buildFrames(): FrameBuild[] {
  const frames: FrameBuild[] = [];

  const addShapeEntity = (name: string, specs: readonly ShapeSpec[]): void => {
    const radius = shapeBoundsRadius(specs);
    const side = Math.ceil(radius * 2);
    frames.push({
      name,
      w: side,
      h: side,
      draw: (Skia, canvas) => {
        const paint = Skia.Paint();
        for (const spec of specs) {
          drawShape(Skia, canvas, paint, spec, side / 2, side / 2, 0);
        }
      },
    });
  };

  for (const category of [
    SHAPE_CATALOGUE.ships,
    SHAPE_CATALOGUE.enemies,
    SHAPE_CATALOGUE.minibosses,
    SHAPE_CATALOGUE.bosses,
    SHAPE_CATALOGUE.weaponPickups,
    SHAPE_CATALOGUE.upgradePickups,
  ]) {
    for (const [id, specs] of Object.entries(category)) {
      addShapeEntity(id, specs as readonly ShapeSpec[]);
    }
  }

  // Runtime-only frames — bullets + particles as flat colored rects/dots.
  frames.push({
    name: 'player-bullet',
    w: 6,
    h: 14,
    draw: (Skia, canvas) => {
      const paint = Skia.Paint();
      paint.setColor(argb(0xffffeecc));
      canvas.drawRect(Skia.XYWHRect(0, 0, 6, 14), paint);
    },
  });
  frames.push({
    name: 'enemy-bullet',
    w: 6,
    h: 10,
    draw: (Skia, canvas) => {
      const paint = Skia.Paint();
      paint.setColor(argb(0xffff5522));
      canvas.drawRect(Skia.XYWHRect(0, 0, 6, 10), paint);
    },
  });
  frames.push({
    name: 'particle-spark',
    w: 4,
    h: 4,
    draw: (Skia, canvas) => {
      const paint = Skia.Paint();
      paint.setColor(argb(0xfff3c262));
      canvas.drawCircle(2, 2, 2, paint);
    },
  });
  frames.push({
    name: 'particle-smoke',
    w: 6,
    h: 6,
    draw: (Skia, canvas) => {
      const paint = Skia.Paint();
      paint.setColor(argb(0x99888888));
      canvas.drawCircle(3, 3, 3, paint);
    },
  });

  // Tile frames for the Zone-3 tilemap background.
  frames.push({
    name: 'tile-water',
    w: 32,
    h: 32,
    draw: (Skia, canvas) => {
      const base = Skia.Paint();
      base.setColor(argb(0xff2f5f7a));
      canvas.drawRect(Skia.XYWHRect(0, 0, 32, 32), base);
      const ripple = Skia.Paint();
      ripple.setColor(argb(0x66d9e4e7));
      canvas.drawRect(Skia.XYWHRect(4, 8, 24, 2), ripple);
      canvas.drawRect(Skia.XYWHRect(8, 20, 20, 2), ripple);
    },
  });
  frames.push({
    name: 'tile-fog',
    w: 32,
    h: 32,
    draw: (Skia, canvas) => {
      const paint = Skia.Paint();
      paint.setColor(argb(0x44e4f0ff));
      canvas.drawRect(Skia.XYWHRect(0, 0, 32, 32), paint);
    },
  });

  return frames;
}

/**
 * Build the shape atlas. Layout is row-packed with up to `maxWidth` px per row.
 */
export function buildShapeAtlas(Skia: Skia, maxWidth = 1024, padding = 1): ShapeAtlas {
  const frames = buildFrames();

  // Row-pack.
  const positions: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  let atlasW = 0;
  for (const f of frames) {
    if (x > 0 && x + f.w > maxWidth) {
      y += rowH + padding;
      x = 0;
      rowH = 0;
    }
    positions.push({ x, y });
    x += f.w + padding;
    if (f.h > rowH) rowH = f.h;
    if (x - padding > atlasW) atlasW = x - padding;
  }
  const atlasH = y + rowH;

  const surface = Skia.Surface.Make(Math.max(atlasW, 1), Math.max(atlasH, 1));
  if (surface === null) {
    throw new Error(`buildShapeAtlas: Skia.Surface.Make returned null (${atlasW}x${atlasH})`);
  }
  const canvas = surface.getCanvas();

  const sheet = createSpriteSheet();
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const p = positions[i];
    if (!f || !p) continue;
    canvas.save();
    canvas.translate(p.x, p.y);
    f.draw(Skia, canvas);
    canvas.restore();
    const frame: SpriteFrame = { name: f.name, x: p.x, y: p.y, w: f.w, h: f.h };
    sheet.frames.push(frame);
    sheet.frameMap.set(f.name, i);
  }

  return {
    image: surface.makeImageSnapshot(),
    sheet,
    width: atlasW,
    height: atlasH,
  };
}
