import { describe, expect, test } from 'bun:test';
import type { ShipSpec } from '@flare-engine/shapes';
import { SHAPE_CATALOGUE } from '../src/visual-spec/shapes-catalogue';

/**
 * Boss ship anatomy — session #77 M2.
 * All 8 bosses rewritten as ShipSpec, violet hue family (folio XIIIf).
 */

const { bosses } = SHAPE_CATALOGUE;
const BOSS_ENTRIES = Object.entries(bosses) as [string, ShipSpec][];

// Violet hue range: hue 260–300°, any saturation/value within the purple band.
// R channel stays low (≤ 0xb0), B channel stays high (≥ 0x40) relative to G.
function isVioletFamily(argb: number): boolean {
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  // Violet: blue dominant, red moderate-to-high, green low.
  return b > g && r > g && b >= 0x40 && r <= 0xb0;
}

describe('boss ShipSpec structure — session #77 M2', () => {
  test('all 8 bosses have kind=ship', () => {
    expect(BOSS_ENTRIES).toHaveLength(8);
    for (const [name, spec] of BOSS_ENTRIES) {
      expect(spec.kind, name).toBe('ship');
    }
  });

  test('each boss hull and engine fill is in the violet hue family', () => {
    for (const [name, spec] of BOSS_ENTRIES) {
      const hullFill = spec.hull.fill ?? 0;
      const engineFill = spec.engine.fill ?? 0;
      expect(
        isVioletFamily(hullFill),
        `${name} hull fill 0x${hullFill.toString(16)} not in violet family`,
      ).toBe(true);
      expect(
        isVioletFamily(engineFill),
        `${name} engine fill 0x${engineFill.toString(16)} not in violet family`,
      ).toBe(true);
    }
  });

  test('each boss has between 2 and 4 weapons', () => {
    for (const [name, spec] of BOSS_ENTRIES) {
      expect(spec.weapons.length, `${name} weapons.length`).toBeGreaterThanOrEqual(2);
      expect(spec.weapons.length, `${name} weapons.length`).toBeLessThanOrEqual(4);
    }
  });
});
