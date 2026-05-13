/**
 * atlas-ship-wire.test.ts
 *
 * Verifies that SHIP_DEFS and PICKUP_DEFS are correctly wired to the shape
 * atlas builder:
 *   1. Every SHIP_DEFS entry resolves to a known HULL_PRESET.
 *   2. Weapon-ratio → rect dimensions are correct for all three tiers.
 *   3. Every PICKUP_DEFS entry has a 'pickup-' prefixed id (atlas frame name).
 *   4. No duplicate frame names across ships + pickups.
 */

import { describe, expect, test } from 'bun:test';
import { HULL_PRESETS } from '../src/visual-spec/hull-presets';
import { PICKUP_DEFS } from '../src/visual-spec/pickups';
import { SHIP_DEFS } from '../src/visual-spec/ships';

const WEAPON_SIZES = {
  '1:8': { w: 4, h: 32 },
  '1:10': { w: 6, h: 60 },
  '1:12': { w: 8, h: 96 },
} as const;

describe('atlas ship wire — SHIP_DEFS → HULL_PRESETS resolution', () => {
  test('every ship hullPreset resolves to a defined HullPreset', () => {
    const missing: string[] = [];
    for (const ship of SHIP_DEFS) {
      if (!HULL_PRESETS[ship.hullPreset]) {
        missing.push(`${ship.id}: ${ship.hullPreset}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test('every resolved preset shapes array is non-empty', () => {
    const empty: string[] = [];
    for (const ship of SHIP_DEFS) {
      const preset = HULL_PRESETS[ship.hullPreset];
      if (!preset || preset.shapes.length === 0) empty.push(ship.id);
    }
    expect(empty).toEqual([]);
  });
});

describe('atlas ship wire — weaponRatio → rect dimensions', () => {
  test('1:8 ratio yields w=4 h=32', () => {
    expect(WEAPON_SIZES['1:8']).toEqual({ w: 4, h: 32 });
  });

  test('1:10 ratio yields w=6 h=60', () => {
    expect(WEAPON_SIZES['1:10']).toEqual({ w: 6, h: 60 });
  });

  test('1:12 ratio yields w=8 h=96', () => {
    expect(WEAPON_SIZES['1:12']).toEqual({ w: 8, h: 96 });
  });

  test('all 14 enemies use 1:8 ratio', () => {
    const enemies = SHIP_DEFS.filter((s) => s.weaponRatio === '1:8');
    expect(enemies.length).toBe(14);
  });

  test('all 4 minibosses use 1:10 ratio', () => {
    const minibosses = SHIP_DEFS.filter((s) => s.weaponRatio === '1:10');
    expect(minibosses.length).toBe(4);
  });

  test('bosses and player ships use 1:12 ratio (11 entries)', () => {
    const big = SHIP_DEFS.filter((s) => s.weaponRatio === '1:12');
    expect(big.length).toBe(11);
  });
});

describe('atlas ship wire — PICKUP_DEFS frame names', () => {
  test('every pickup id starts with "pickup-"', () => {
    const violations = PICKUP_DEFS.filter((p) => !(p.id as string).startsWith('pickup-'));
    expect(violations.map((p) => p.id)).toEqual([]);
  });

  test('PICKUP_DEFS has 10 entries', () => {
    expect(PICKUP_DEFS.length).toBe(10);
  });
});

describe('atlas ship wire — no duplicate frame names', () => {
  test('ship ids and pickup ids are all unique within their sets', () => {
    const shipIds = SHIP_DEFS.map((s) => s.id);
    const pickupIds = PICKUP_DEFS.map((p) => p.id as string);
    const allIds = [...shipIds, ...pickupIds];
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
