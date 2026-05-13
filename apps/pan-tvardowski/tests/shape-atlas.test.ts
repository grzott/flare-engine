/**
 * Regression coverage for buildShapeAtlas iteration.
 *
 * The atlas builder feeds every entity through `shapeBoundsRadius`, which
 * iterates with `for...of`. This suite mirrors the iteration shape in
 * shape-atlas.ts so any future category-shape mismatch fails here instead
 * of at first-frame on device.
 *
 * Data sources: SHIP_DEFS + HULL_PRESETS (for ships) + PICKUP_DEFS (for pickups).
 */

import { describe, expect, test } from 'bun:test';
import type { RectSpec, ShapeSpec, ShipSpec } from '@flare-engine/shapes';
import { shapeBoundsRadius } from '@flare-engine/shapes';
import { hexToArgb } from '../src/util/hex';
import { HULL_PRESETS } from '../src/visual-spec/hull-presets';
import { PICKUP_DEFS } from '../src/visual-spec/pickups';
import { SHIP_DEFS } from '../src/visual-spec/ships';

const WEAPON_SIZES = {
  '1:8': { w: 4, h: 32 },
  '1:10': { w: 6, h: 60 },
  '1:12': { w: 8, h: 96 },
} as const;

describe('buildShapeAtlas iteration', () => {
  test('every ShipDef yields a finite radius when assembled as ShipSpec', () => {
    for (const ship of SHIP_DEFS) {
      const preset = HULL_PRESETS[ship.hullPreset];
      const hullShape = preset.shapes[0];
      if (!hullShape) continue;
      const hullArgb = hexToArgb(ship.hullColor);
      const weaponArgb = hexToArgb(ship.weaponColor);
      const engineArgb = hexToArgb(ship.engineColor);
      const { w: wW, h: wH } = WEAPON_SIZES[ship.weaponRatio];
      const weapons: RectSpec[] = [{ kind: 'rect', w: wW, h: wH, fill: weaponArgb }];
      const shipSpec: ShipSpec = {
        kind: 'ship',
        hull: { ...hullShape, fill: hullArgb } as ShapeSpec,
        weapons,
        engine: { kind: 'square', size: 20, fill: engineArgb },
      };
      const r = shapeBoundsRadius([shipSpec]);
      expect(Number.isFinite(r), ship.id).toBe(true);
      expect(r, ship.id).toBeGreaterThan(0);
    }
  });

  test('every PickupDef shapes[] yields a finite radius', () => {
    for (const pickup of PICKUP_DEFS) {
      const r = shapeBoundsRadius(pickup.shapes as readonly ShapeSpec[]);
      expect(Number.isFinite(r), String(pickup.id)).toBe(true);
      expect(r, String(pickup.id)).toBeGreaterThan(0);
    }
  });

  test('hull preset shapes are objects not arrays — guards the wrap requirement', () => {
    for (const ship of SHIP_DEFS) {
      const preset = HULL_PRESETS[ship.hullPreset];
      expect(Array.isArray(preset), ship.id).toBe(false);
      expect(preset.shapes.length, ship.id).toBeGreaterThan(0);
    }
  });

  test('pickup shapes are arrays — guards no-wrap requirement', () => {
    for (const pickup of PICKUP_DEFS) {
      expect(Array.isArray(pickup.shapes), String(pickup.id)).toBe(true);
    }
  });
});
