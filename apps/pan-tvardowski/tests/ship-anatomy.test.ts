import { describe, expect, test } from 'bun:test';
import type { ShipSpec } from '@flare-engine/shapes';
import { SHAPE_CATALOGUE } from '../src/shape-catalogue';

const ENEMY_ENTRIES = Object.entries(SHAPE_CATALOGUE.enemies) as [string, ShipSpec][];

describe('ship anatomy — 3-element rule (folio XIIIa/XIIIb)', () => {
  test('T1 ShipSpec has kind=ship', () => {
    const spec: ShipSpec = {
      kind: 'ship',
      hull: { kind: 'circle', r: 10, fill: 0xff000000 },
      weapons: [{ kind: 'rect', w: 4, h: 8, fill: 0xff000000 }],
      engine: { kind: 'square', size: 20, fill: 0xff000000 },
    };
    expect(spec.kind).toBe('ship');
    expect(spec.hull.kind).toBe('circle');
    expect(spec.engine.kind).toBe('square');
  });

  test('T2 all 14 enemies have kind=ship', () => {
    expect(ENEMY_ENTRIES).toHaveLength(14);
    for (const [name, spec] of ENEMY_ENTRIES) {
      expect(spec.kind, name).toBe('ship');
    }
  });

  test('T3 weapons.length is in [1, 2] for all enemies', () => {
    for (const [name, spec] of ENEMY_ENTRIES) {
      expect(spec.weapons.length, `${name} weapons.length`).toBeGreaterThanOrEqual(1);
      expect(spec.weapons.length, `${name} weapons.length`).toBeLessThanOrEqual(2);
    }
  });

  test('T4 engine is present and kind=square for all enemies', () => {
    for (const [name, spec] of ENEMY_ENTRIES) {
      expect(spec.engine, `${name} engine`).toBeDefined();
      expect(spec.engine.kind, `${name} engine.kind`).toBe('square');
    }
  });

  test('T5 no two enemies share the same hull silhouette (kind+shape params+fill)', () => {
    const seen = new Set<string>();
    for (const [name, spec] of ENEMY_ENTRIES) {
      const h = spec.hull;
      // Build a key that encodes the shape-discriminating parameters so that
      // bies (ngon-6) and wapierz (ngon-8) are distinct even with same fill.
      let shapeParams = '';
      if (h.kind === 'circle' || h.kind === 'ring') shapeParams = String(h.r);
      else if (h.kind === 'ngon') shapeParams = `n${h.n}r${h.r}`;
      else if (h.kind === 'triangle') shapeParams = String(h.size);
      else if (h.kind === 'star') shapeParams = `${h.points}o${h.rOuter}i${h.rInner}`;
      else if (h.kind === 'rect') shapeParams = `${h.w}x${h.h}`;
      const key = `${h.kind}:${shapeParams}:${String(h.fill ?? 'none')}`;
      expect(seen.has(key), `${name} duplicate hull silhouette key=${key}`).toBe(false);
      seen.add(key);
    }
  });

  test('T6 engine.size === 20 for all 14 enemies', () => {
    for (const [name, spec] of ENEMY_ENTRIES) {
      expect(spec.engine.size, `${name} engine.size`).toBe(20);
    }
  });

  test('T7 every weapon has w > 0 and h > 0', () => {
    for (const [name, spec] of ENEMY_ENTRIES) {
      for (let i = 0; i < spec.weapons.length; i++) {
        const w = spec.weapons[i];
        expect(w?.w, `${name} weapon[${i}].w`).toBeGreaterThan(0);
        expect(w?.h, `${name} weapon[${i}].h`).toBeGreaterThan(0);
      }
    }
  });
});
