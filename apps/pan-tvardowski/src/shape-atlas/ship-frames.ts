import type { RectSpec, ShapeSpec, ShipSpec } from '@flare-engine/shapes';
import { hexToArgb } from '../util/hex';
import { HULL_PRESETS } from '../visual-spec/hull-presets';
import { SHIP_DEFS } from '../visual-spec/ships';
import { type FrameBuild, addShapeEntity } from './types';

/** Weapon-rect dimensions keyed by weaponRatio string. */
export const WEAPON_SIZES: Readonly<Record<'1:8' | '1:10' | '1:12', { w: number; h: number }>> = {
  '1:8': { w: 4, h: 32 },
  '1:10': { w: 6, h: 60 },
  '1:12': { w: 8, h: 96 },
};

export function weaponRectSize(ratio: '1:8' | '1:10' | '1:12'): { w: number; h: number } {
  return WEAPON_SIZES[ratio];
}

export function buildWeaponRects(
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
export function coloredHull(
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

export function buildShipFrames(): FrameBuild[] {
  const frames: FrameBuild[] = [];

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
    addShapeEntity(frames, ship.id, [shipSpec]);
  }

  return frames;
}
