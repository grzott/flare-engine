/**
 * Regression coverage for buildShapeAtlas iteration.
 *
 * The atlas builder feeds every catalogue value through `shapeBoundsRadius`,
 * which iterates with `for...of`. On Hermes this lowers to
 * `_createForOfIteratorHelperLoose` and throws on non-iterable input —
 * which is exactly what happened when `ships`/`minibosses`/`bosses`
 * (Record<string, ShipSpec>) were passed in unwrapped. This suite mirrors
 * the iteration shape in shape-atlas.ts so any future category-shape
 * mismatch fails here instead of at first-frame on device.
 */

import { describe, expect, test } from 'bun:test';
import { SHAPE_CATALOGUE } from '../src/shape-catalogue';
import type { ShapeSpec, ShipSpec } from '../src/shapes';
import { shapeBoundsRadius } from '../src/shapes-draw';

describe('buildShapeAtlas iteration', () => {
  test('every ShipSpec category yields a finite radius after wrap', () => {
    const shipCategories = [
      SHAPE_CATALOGUE.enemies,
      SHAPE_CATALOGUE.ships,
      SHAPE_CATALOGUE.minibosses,
      SHAPE_CATALOGUE.bosses,
    ] as const;
    for (const category of shipCategories) {
      for (const [id, spec] of Object.entries(category)) {
        const r = shapeBoundsRadius([spec as ShipSpec]);
        expect(Number.isFinite(r), id).toBe(true);
        expect(r, id).toBeGreaterThan(0);
      }
    }
  });

  test('every ShapeSpec[] pickup category yields a finite radius', () => {
    const pickupCategories = [
      SHAPE_CATALOGUE.weaponPickups,
      SHAPE_CATALOGUE.upgradePickups,
    ] as const;
    for (const category of pickupCategories) {
      for (const [id, specs] of Object.entries(category)) {
        const r = shapeBoundsRadius(specs as readonly ShapeSpec[]);
        expect(Number.isFinite(r), id).toBe(true);
        expect(r, id).toBeGreaterThan(0);
      }
    }
  });

  test('ShipSpec values are objects, not arrays — guards the wrap requirement', () => {
    for (const [id, spec] of Object.entries(SHAPE_CATALOGUE.ships)) {
      expect(Array.isArray(spec), id).toBe(false);
      expect((spec as ShipSpec).kind, id).toBe('ship');
    }
    for (const [id, spec] of Object.entries(SHAPE_CATALOGUE.minibosses)) {
      expect(Array.isArray(spec), id).toBe(false);
      expect((spec as ShipSpec).kind, id).toBe('ship');
    }
    for (const [id, spec] of Object.entries(SHAPE_CATALOGUE.bosses)) {
      expect(Array.isArray(spec), id).toBe(false);
      expect((spec as ShipSpec).kind, id).toBe('ship');
    }
  });

  test('pickup values are arrays — guards no-wrap requirement', () => {
    for (const [id, specs] of Object.entries(SHAPE_CATALOGUE.weaponPickups)) {
      expect(Array.isArray(specs), id).toBe(true);
    }
    for (const [id, specs] of Object.entries(SHAPE_CATALOGUE.upgradePickups)) {
      expect(Array.isArray(specs), id).toBe(true);
    }
  });
});
