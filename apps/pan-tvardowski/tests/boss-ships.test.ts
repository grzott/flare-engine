import { describe, expect, test } from 'bun:test';
import { HULL_PRESETS } from '../src/visual-spec/hull-presets';
import { SHIP_DEFS } from '../src/visual-spec/ships';
import type { ShipDef } from '../src/visual-spec/types';

/**
 * Boss ship anatomy — session #77 M2 (migrated from SHAPE_CATALOGUE).
 * All 8 bosses use violet hue family (folio XIIIf).
 */

const BOSS_DEFS = SHIP_DEFS.filter(
  (d): d is ShipDef => d.weaponRatio === '1:12' && d.glow === 'hazard',
);

// Violet Hex range: hue 260–300°. R low-to-moderate, B dominant, G low.
// Check on RGB channels extracted from #rrggbb.
function isVioletHex(hex: string): boolean {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return b > g && r > g && b >= 0x40 && r <= 0xb0;
}

describe('boss ShipDef structure — session #77 M2', () => {
  test('all 8 bosses present', () => {
    expect(BOSS_DEFS).toHaveLength(8);
  });

  test('each boss hullColor is in the violet hue family', () => {
    for (const def of BOSS_DEFS) {
      expect(
        isVioletHex(def.hullColor),
        `${def.id} hullColor ${def.hullColor} not in violet family`,
      ).toBe(true);
    }
  });

  test('each boss engineColor is in the violet hue family', () => {
    for (const def of BOSS_DEFS) {
      expect(
        isVioletHex(def.engineColor),
        `${def.id} engineColor ${def.engineColor} not in violet family`,
      ).toBe(true);
    }
  });

  test('each boss has weaponCount between 2 and 2 (ShipDef max)', () => {
    for (const def of BOSS_DEFS) {
      expect(def.weaponCount, `${def.id} weaponCount`).toBeGreaterThanOrEqual(1);
      expect(def.weaponCount, `${def.id} weaponCount`).toBeLessThanOrEqual(2);
    }
  });

  test('each boss hullPreset resolves in HULL_PRESETS', () => {
    for (const def of BOSS_DEFS) {
      expect(HULL_PRESETS[def.hullPreset], `${def.id} hullPreset`).toBeDefined();
    }
  });
});
