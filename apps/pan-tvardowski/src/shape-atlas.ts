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
import { argbTo, drawShape, shapeBoundsRadius } from '@flare-engine/shapes';
import type { RectSpec, ShapeSpec, ShipSpec } from '@flare-engine/shapes';
import type { SkImage, Skia as SkiaModule } from '@shopify/react-native-skia';
import { hexToArgb } from './util/hex';
import { BULLET_DEFS } from './visual-spec/bullets';
import { HULL_PRESETS } from './visual-spec/hull-presets';
import { PARTICLE_DEFS } from './visual-spec/particles';
import { PICKUP_DEFS } from './visual-spec/pickups';
import { SHIP_DEFS } from './visual-spec/ships';
import { TILE_DEFS } from './visual-spec/tiles';

type Skia = typeof SkiaModule;

const ATLAS_COLOR = new Float32Array(4);

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

/** Weapon-rect dimensions keyed by weaponRatio string. */
const WEAPON_SIZES: Readonly<Record<'1:8' | '1:10' | '1:12', { w: number; h: number }>> = {
  '1:8': { w: 4, h: 32 },
  '1:10': { w: 6, h: 60 },
  '1:12': { w: 8, h: 96 },
};

function weaponRectSize(ratio: '1:8' | '1:10' | '1:12'): { w: number; h: number } {
  return WEAPON_SIZES[ratio];
}

function buildWeaponRects(
  count: 1 | 2,
  hooks: {
    readonly one: { x: number; y: number };
    readonly two: readonly [{ x: number; y: number }, { x: number; y: number }];
  },
  w: number,
  h: number,
  fill: number,
): RectSpec[] {
  if (count === 1) {
    return [{ kind: 'rect', w, h, fill, ox: hooks.one.x, oy: hooks.one.y }];
  }
  return [
    { kind: 'rect', w, h, fill, ox: hooks.two[0].x, oy: hooks.two[0].y },
    { kind: 'rect', w, h, fill, ox: hooks.two[1].x, oy: hooks.two[1].y },
  ];
}

/**
 * Return a copy of the hull ShapeSpec with fill (and optional stroke) applied
 * from the ShipDef. The preset carries a neutral placeholder fill.
 */
function coloredHull(
  spec: ShapeSpec,
  fill: number,
  stroke?: number,
  strokeWidth?: number,
): ShapeSpec {
  const base = { ...spec, fill };
  if (stroke !== undefined) (base as Record<string, unknown>).stroke = stroke;
  if (strokeWidth !== undefined) (base as Record<string, unknown>).strokeWidth = strokeWidth;
  return base as ShapeSpec;
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

  // Ship frames — built from SHIP_DEFS + HULL_PRESETS. Frame name = ship id.
  for (const ship of SHIP_DEFS) {
    const preset = HULL_PRESETS[ship.hullPreset];
    const hullShape = preset.shapes[0];
    if (!hullShape) continue;
    const hullArgb = hexToArgb(ship.hullColor);
    const weaponArgb = hexToArgb(ship.weaponColor);
    const engineArgb = hexToArgb(ship.engineColor);
    const { w: wW, h: wH } = weaponRectSize(ship.weaponRatio);
    const weapons: RectSpec[] = buildWeaponRects(
      ship.weaponCount,
      preset.weaponHooks,
      wW,
      wH,
      weaponArgb,
    );
    const strokeArgb = ship.hullStroke !== undefined ? hexToArgb(ship.hullStroke) : undefined;
    const shipSpec: ShipSpec = {
      kind: 'ship',
      hull: coloredHull(hullShape, hullArgb, strokeArgb, ship.hullStrokeWidth),
      weapons,
      engine: { kind: 'square', size: 20, fill: engineArgb },
    };
    addShapeEntity(ship.id, [shipSpec]);
  }

  // Pickup frames — built from PICKUP_DEFS. Frame name = PickupSpecId (has 'pickup-' prefix).
  for (const pickup of PICKUP_DEFS) {
    addShapeEntity(pickup.id as string, pickup.shapes);
  }

  // Bullet frames — data-driven from BULLET_DEFS. Frame name = BulletSpecId.
  // The 'enemy-bullet' entry also emits 'enemy-bullet-b': a stroke variant for
  // the 8 Hz flicker used in play.ts (hazardOrange at alpha 0.6 = 0x99E84B2A).
  for (const def of BULLET_DEFS) {
    const fillArgb = hexToArgb(def.fill);
    const name = String(def.id);

    if (def.kind === 'line') {
      const { width: w, length: h } = def;
      frames.push({
        name,
        w,
        h,
        draw: (Skia, canvas) => {
          const paint = Skia.Paint();
          argbTo(ATLAS_COLOR, fillArgb);
          paint.setColor(ATLAS_COLOR);
          canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
        },
      });
      if (name === 'enemy-bullet') {
        const strokeArgb = 0x99e84b2a;
        frames.push({
          name: 'enemy-bullet-b',
          w,
          h,
          draw: (Skia, canvas) => {
            const paint = Skia.Paint();
            argbTo(ATLAS_COLOR, fillArgb);
            paint.setColor(ATLAS_COLOR);
            canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
            const stroke = Skia.Paint();
            argbTo(ATLAS_COLOR, strokeArgb);
            stroke.setColor(ATLAS_COLOR);
            stroke.setStyle(1); // PaintStyle.Stroke
            stroke.setStrokeWidth(0.5);
            canvas.drawRect(Skia.XYWHRect(0.25, 0.25, w - 0.5, h - 0.5), stroke);
          },
        });
      }
    } else if (def.kind === 'dot') {
      const { r } = def;
      const side = Math.ceil(r * 2);
      frames.push({
        name,
        w: side,
        h: side,
        draw: (Skia, canvas) => {
          const paint = Skia.Paint();
          argbTo(ATLAS_COLOR, fillArgb);
          paint.setColor(ATLAS_COLOR);
          canvas.drawCircle(r, r, r, paint);
        },
      });
    } else if (def.kind === 'laser') {
      // Laser: a tall thin rect; length is capped to 64 px for atlas budget.
      const w = def.width;
      const h = 64;
      frames.push({
        name,
        w,
        h,
        draw: (Skia, canvas) => {
          const paint = Skia.Paint();
          argbTo(ATLAS_COLOR, fillArgb);
          paint.setColor(ATLAS_COLOR);
          canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
        },
      });
    } else if (def.kind === 'dots') {
      // dots cluster: bounding square = (spread + r) * 2.
      const side = Math.ceil((def.spread + def.r) * 2);
      const cx = side / 2;
      const cy = side / 2;
      const { r, spread, count } = def;
      frames.push({
        name,
        w: side,
        h: side,
        draw: (Skia, canvas) => {
          const paint = Skia.Paint();
          argbTo(ATLAS_COLOR, fillArgb);
          paint.setColor(ATLAS_COLOR);
          // Arrange dots evenly on a circle (scheme='circle').
          for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            canvas.drawCircle(
              cx + Math.cos(angle) * spread,
              cy + Math.sin(angle) * spread,
              r,
              paint,
            );
          }
        },
      });
    } else {
      // rocket: treat same as line using width/length.
      const { width: w, length: h } = def as { kind: 'rocket'; width: number; length: number };
      frames.push({
        name,
        w,
        h,
        draw: (Skia, canvas) => {
          const paint = Skia.Paint();
          argbTo(ATLAS_COLOR, fillArgb);
          paint.setColor(ATLAS_COLOR);
          canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
        },
      });
    }
  }
  for (const def of PARTICLE_DEFS) {
    const fillArgb = hexToArgb(def.fill);
    const side = Math.ceil(def.size * 2);
    const r = def.size;
    frames.push({
      name: String(def.id),
      w: side,
      h: side,
      draw: (Skia, canvas) => {
        const paint = Skia.Paint();
        argbTo(ATLAS_COLOR, fillArgb);
        paint.setColor(ATLAS_COLOR);
        canvas.drawCircle(r, r, r, paint);
      },
    });
  }

  // Tile frames for zone shader backgrounds — driven by TILE_DEFS.
  for (const def of TILE_DEFS) {
    const side = def.size;
    const baseArgb = hexToArgb(def.baseFill);
    const accentArgb = def.accent !== undefined ? hexToArgb(def.accent.fill) : 0;
    const hasAccent = def.accent !== undefined;
    frames.push({
      name: String(def.id),
      w: side,
      h: side,
      draw: (Skia, canvas) => {
        const base = Skia.Paint();
        argbTo(ATLAS_COLOR, baseArgb);
        base.setColor(ATLAS_COLOR);
        canvas.drawRect(Skia.XYWHRect(0, 0, side, side), base);
        if (hasAccent) {
          const ripple = Skia.Paint();
          argbTo(ATLAS_COLOR, accentArgb);
          ripple.setColor(ATLAS_COLOR);
          canvas.drawRect(Skia.XYWHRect(4, 8, 24, 2), ripple);
          canvas.drawRect(Skia.XYWHRect(8, 20, 20, 2), ripple);
        }
      },
    });
  }

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
