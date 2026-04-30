import { describe, expect, test } from 'bun:test';
import { SHAPE_CATALOGUE } from '../src/shape-catalogue';
import type { ShipSpec } from '../src/shapes';

const VALID_PRIMITIVE_KINDS = new Set([
  'circle',
  'rect',
  'triangle',
  'ngon',
  'star',
  'ring',
  'polyline',
  'gradient-rect',
]);

describe('shape catalogue', () => {
  test('category counts match design', () => {
    expect(Object.keys(SHAPE_CATALOGUE.enemies)).toHaveLength(14);
    expect(Object.keys(SHAPE_CATALOGUE.minibosses)).toHaveLength(4);
    expect(Object.keys(SHAPE_CATALOGUE.bosses)).toHaveLength(8);
    expect(Object.keys(SHAPE_CATALOGUE.ships)).toHaveLength(3);
    expect(Object.keys(SHAPE_CATALOGUE.weaponPickups)).toHaveLength(4);
    expect(Object.keys(SHAPE_CATALOGUE.upgradePickups)).toHaveLength(6);
  });

  test('every enemy is a ShipSpec with kind=ship', () => {
    for (const [name, spec] of Object.entries(SHAPE_CATALOGUE.enemies)) {
      expect((spec as ShipSpec).kind, name).toBe('ship');
    }
  });

  test('every non-enemy ShipSpec entity has kind=ship', () => {
    const shipSpecCategories = [
      SHAPE_CATALOGUE.minibosses,
      SHAPE_CATALOGUE.bosses,
      SHAPE_CATALOGUE.ships,
    ] as const;
    for (const category of shipSpecCategories) {
      for (const [name, spec] of Object.entries(category)) {
        expect((spec as ShipSpec).kind, name).toBe('ship');
      }
    }
  });

  test('every pickup entity has at least one shape with a valid primitive kind', () => {
    const pickupCategories = [
      SHAPE_CATALOGUE.weaponPickups,
      SHAPE_CATALOGUE.upgradePickups,
    ] as const;
    for (const category of pickupCategories) {
      for (const [name, shapes] of Object.entries(category)) {
        const arr = shapes as readonly { kind: string }[];
        expect(arr.length, name).toBeGreaterThan(0);
        for (const s of arr) {
          expect(VALID_PRIMITIVE_KINDS.has(s.kind), `${name} has kind=${s.kind}`).toBe(true);
        }
      }
    }
  });
});
