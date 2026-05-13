import { describe, expect, test } from 'bun:test';
import { HULL_PRESETS } from '../src/visual-spec/hull-presets';
import { SHIP_DEFS } from '../src/visual-spec/ships';
import type { ShipDef } from '../src/visual-spec/types';

/**
 * Mini-boss ship anatomy — session #77 M1 (migrated from SHAPE_CATALOGUE).
 * All 4 mini-bosses use crimson hue family (folio XIIIb+).
 */

const MINIBOSS_DEFS = SHIP_DEFS.filter((d): d is ShipDef => d.weaponRatio === '1:10');

// Crimson: r dominant, g+b low, redish hue 345–15°.
function isCrimsonHex(hex: string): boolean {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return r > g && r > b && r >= 0x70;
}

describe('mini-boss ShipDef structure — session #77 M1', () => {
  test('all 4 mini-bosses have weaponRatio 1:10', () => {
    expect(MINIBOSS_DEFS).toHaveLength(4);
  });

  test('each mini-boss hullColor is in the crimson hue family', () => {
    for (const def of MINIBOSS_DEFS) {
      expect(
        isCrimsonHex(def.hullColor),
        `${def.id} hullColor ${def.hullColor} not in crimson family`,
      ).toBe(true);
    }
  });

  test('each mini-boss engineColor is in the crimson hue family', () => {
    for (const def of MINIBOSS_DEFS) {
      expect(
        isCrimsonHex(def.engineColor),
        `${def.id} engineColor ${def.engineColor} not in crimson family`,
      ).toBe(true);
    }
  });

  test('each mini-boss has weaponCount of 2', () => {
    for (const def of MINIBOSS_DEFS) {
      expect(def.weaponCount, `${def.id} weaponCount`).toBe(2);
    }
  });

  test('each mini-boss hullPreset resolves in HULL_PRESETS', () => {
    for (const def of MINIBOSS_DEFS) {
      expect(HULL_PRESETS[def.hullPreset], `${def.id} hullPreset`).toBeDefined();
    }
  });
});
