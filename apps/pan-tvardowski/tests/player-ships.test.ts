import { describe, expect, test } from 'bun:test';
import { SHIP_DEFS } from '../src/visual-spec/ships';
import type { ShipDef } from '../src/visual-spec/types';

/**
 * Player ship anatomy — session #77 M3 (migrated from SHAPE_CATALOGUE).
 * All 3 player ships: kogut-zloty (GOLD), alembik (BOG_GREEN), zwierciadlo (DEEP_BLUE).
 */

const PLAYER_DEFS = SHIP_DEFS.filter(
  (d): d is ShipDef => d.weaponRatio === '1:12' && d.glow === 'friendly',
);

// Brand hue hex values (must match ships.ts / theme.ts)
const GOLD = '#C9A24A';
const BOG_GREEN = '#1A2E1F';
const DEEP_BLUE = '#1A2E4A';

describe('player ShipDef structure — session #77 M3', () => {
  test('all 3 player ships present', () => {
    expect(PLAYER_DEFS).toHaveLength(3);
  });

  test('all 3 player ships have glow=friendly', () => {
    for (const def of PLAYER_DEFS) {
      expect(def.glow, `${def.id} glow`).toBe('friendly');
    }
  });

  test('each player ship has weaponCount=2', () => {
    for (const def of PLAYER_DEFS) {
      expect(def.weaponCount, `${def.id} weaponCount`).toBe(2);
    }
  });
});

describe('player ship brand hue families — session #77 M3', () => {
  test('kogut-zloty uses GOLD hull color', () => {
    const def = PLAYER_DEFS.find((d) => d.id === 'kogut-zloty');
    expect(def?.hullColor.toUpperCase()).toBe(GOLD.toUpperCase());
  });

  test('alembik uses BOG_GREEN hull color', () => {
    const def = PLAYER_DEFS.find((d) => d.id === 'alembik');
    expect(def?.hullColor.toUpperCase()).toBe(BOG_GREEN.toUpperCase());
  });

  test('zwierciadlo uses DEEP_BLUE hull color', () => {
    const def = PLAYER_DEFS.find((d) => d.id === 'zwierciadlo');
    expect(def?.hullColor.toUpperCase()).toBe(DEEP_BLUE.toUpperCase());
  });
});
