/**
 * Shape-atlas builder — rasterizes every gameplay-relevant entity from
 * `SHIP_DEFS` + `HULL_PRESETS` + `PICKUP_DEFS` (plus runtime-only frames:
 * bullets, particles, tiles) onto a single offscreen Skia surface and returns
 * a `SpriteSheet` keyed by frame name.
 *
 * Frame names:
 *   - Ships: entity id (e.g. 'kogut-zloty', 'smok-krzemionkowski')
 *   - Pickups: PickupSpecId (e.g. 'pickup-iskry', 'pickup-czarna-ksiega')
 *   - Bullets: BulletSpecId (e.g. 'piorun-bullet', 'enemy-bullet'); the
 *     'enemy-bullet' entry also emits 'enemy-bullet-b' (stroke flicker variant)
 *   - Runtime: 'particle-spark/smoke', tiles
 *
 * Built once at boot. Zero per-frame cost — the render system just reads
 * pre-rasterized frames like any other sprite atlas.
 */

import { type SpriteFrame, type SpriteSheet, createSpriteSheet } from '@flare-engine/assets';
import type { SkImage, Skia as SkiaModule } from '@shopify/react-native-skia';
import { buildBulletFrames } from './shape-atlas/bullet-frames';
import { buildParticleFrames } from './shape-atlas/particle-frames';
import { buildPickupFrames } from './shape-atlas/pickup-frames';
import { buildShipFrames } from './shape-atlas/ship-frames';
import { buildTileFrames } from './shape-atlas/tile-frames';

type Skia = typeof SkiaModule;

export interface ShapeAtlas {
  readonly image: SkImage;
  readonly sheet: SpriteSheet;
  readonly width: number;
  readonly height: number;
}

/**
 * Build the shape atlas. Layout is row-packed with up to `maxWidth` px per row.
 */
export function buildShapeAtlas(Skia: Skia, maxWidth = 1024, padding = 1): ShapeAtlas {
  const frames = [
    ...buildShipFrames(),
    ...buildPickupFrames(),
    ...buildBulletFrames(),
    ...buildParticleFrames(),
    ...buildTileFrames(),
  ];

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
