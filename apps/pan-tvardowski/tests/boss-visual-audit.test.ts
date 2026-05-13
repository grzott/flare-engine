import { describe, expect, test } from 'bun:test';
import { SHIP_DEFS } from '../src/visual-spec/ships';
import type { ShipDef } from '../src/visual-spec/types';

/**
 * Boss visual audit — rewritten for ShipDef (session #77 M2, migrated from SHAPE_CATALOGUE).
 */

const BOSS_DEFS = SHIP_DEFS.filter(
  (d): d is ShipDef => d.weaponRatio === '1:12' && d.glow === 'hazard',
);

describe('all 8 bosses are ShipDef — session #77 M2', () => {
  test('all 8 bosses are present', () => {
    expect(BOSS_DEFS).toHaveLength(8);
  });

  test('each boss has id, hullPreset, hullColor, weaponColor, engineColor defined', () => {
    for (const def of BOSS_DEFS) {
      expect(def.id.length, `${def.id} id`).toBeGreaterThan(0);
      expect(def.hullPreset.length, `${def.id} hullPreset`).toBeGreaterThan(0);
      expect(def.hullColor.length, `${def.id} hullColor`).toBeGreaterThan(0);
      expect(def.weaponColor.length, `${def.id} weaponColor`).toBeGreaterThan(0);
      expect(def.engineColor.length, `${def.id} engineColor`).toBeGreaterThan(0);
    }
  });
});

describe('boss hull diversity — session #77 M2', () => {
  test('no two bosses share the same hullColor', () => {
    const fills = new Set<string>();
    for (const def of BOSS_DEFS) {
      expect(
        fills.has(def.hullColor),
        `boss "${def.id}" shares hullColor ${def.hullColor} with another boss`,
      ).toBe(false);
      fills.add(def.hullColor);
    }
  });

  test('boss hull presets span at least 3 distinct presets', () => {
    const presets = new Set(BOSS_DEFS.map((d) => d.hullPreset));
    expect(presets.size).toBeGreaterThanOrEqual(3);
  });

  test('each boss engineColor is defined (non-empty hex)', () => {
    for (const def of BOSS_DEFS) {
      expect(def.engineColor, `${def.id} engineColor`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
