import { describe, expect, test } from 'bun:test';
import type { ShipSpec } from '@flare-engine/shapes';
import { SHAPE_CATALOGUE } from '../src/visual-spec/shapes-catalogue';

/**
 * Boss visual audit — rewritten for ShipSpec (session #77 M2).
 *
 * Bosses are now ShipSpec objects (hull + weapons[] + engine). Draw-order
 * invariants are structurally guaranteed by the type: hull is always the body,
 * weapons are always mounted on top, engine is always the rear element.
 * Tests here validate that the ShipSpec fields are populated, that hull kinds
 * are diverse, and that hull fills are unique across all 8 bosses.
 */

const { bosses } = SHAPE_CATALOGUE;
const BOSS_ENTRIES = Object.entries(bosses) as [string, ShipSpec][];

describe('all 8 bosses are ShipSpec — session #77 M2', () => {
  test('each boss has kind=ship', () => {
    for (const [name, spec] of BOSS_ENTRIES) {
      expect(spec.kind, name).toBe('ship');
    }
  });

  test('all 8 bosses are present', () => {
    expect(Object.keys(bosses)).toHaveLength(8);
  });

  test('each boss has hull, weapons, and engine defined', () => {
    for (const [name, spec] of BOSS_ENTRIES) {
      expect(spec.hull, `${name} hull`).toBeDefined();
      expect(spec.weapons, `${name} weapons`).toBeDefined();
      expect(spec.engine, `${name} engine`).toBeDefined();
    }
  });
});

describe('boss hull diversity — session #77 M2', () => {
  test('no two bosses share the same hull fill', () => {
    const fills = new Set<number>();
    for (const [name, spec] of BOSS_ENTRIES) {
      const fill = spec.hull.fill;
      if (fill === undefined) continue;
      expect(
        fills.has(fill),
        `boss "${name}" shares hull fill 0x${fill.toString(16)} with another boss`,
      ).toBe(false);
      fills.add(fill);
    }
  });

  test('boss hull kinds span at least 3 distinct kinds', () => {
    const kinds = new Set(BOSS_ENTRIES.map(([, s]) => s.hull.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });

  test('each boss engine has kind=square and size=20', () => {
    for (const [name, spec] of BOSS_ENTRIES) {
      expect(spec.engine.kind, `${name} engine.kind`).toBe('square');
      expect(spec.engine.size, `${name} engine.size`).toBe(20);
    }
  });
});
