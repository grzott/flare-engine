import { describe, expect, test } from 'bun:test';
import { SHAPE_CATALOGUE } from '../src/shape-catalogue';

const VALID_KINDS = new Set([
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
    expect(Object.keys(SHAPE_CATALOGUE.enemies)).toHaveLength(12);
    expect(Object.keys(SHAPE_CATALOGUE.minibosses)).toHaveLength(4);
    expect(Object.keys(SHAPE_CATALOGUE.bosses)).toHaveLength(8);
    expect(Object.keys(SHAPE_CATALOGUE.ships)).toHaveLength(3);
    expect(Object.keys(SHAPE_CATALOGUE.weaponPickups)).toHaveLength(4);
    expect(Object.keys(SHAPE_CATALOGUE.upgradePickups)).toHaveLength(6);
  });

  test('every entity has at least one shape with a valid kind', () => {
    for (const category of Object.values(SHAPE_CATALOGUE)) {
      for (const [name, shapes] of Object.entries(category)) {
        expect(shapes.length, name).toBeGreaterThan(0);
        for (const s of shapes) {
          expect(VALID_KINDS.has(s.kind), `${name} has kind=${s.kind}`).toBe(true);
        }
      }
    }
  });
});
