import { describe, expect, test } from 'bun:test';
import type { ShipSpec } from '@flare-engine/shapes';
import { SHAPE_CATALOGUE } from '../src/shape-catalogue';

/**
 * Player ship anatomy — session #77 M3.
 * All 3 player ships rewritten as ShipSpec with brand hue families (folio XIIIc).
 * kogut-zloty = GOLD, alembik = BOG_GREEN/Twardoń, zwierciadlo = DEEP_BLUE/Bazyl.
 */

const { ships } = SHAPE_CATALOGUE;
const SHIP_ENTRIES = Object.entries(ships) as [string, ShipSpec][];

// Brand hue constants (must match shape-catalogue.ts)
const GOLD = 0xffc9a24a;
const BOG_GREEN = 0xff1a2e1f;
const DEEP_BLUE = 0xff1a2e4a;

describe('player ShipSpec structure — session #77 M3', () => {
  test('all 3 player ships have kind=ship', () => {
    expect(SHIP_ENTRIES).toHaveLength(3);
    for (const [name, spec] of SHIP_ENTRIES) {
      expect(spec.kind, name).toBe('ship');
    }
  });

  test('all 3 player ships have glow=friendly at ShipSpec level', () => {
    for (const [name, spec] of SHIP_ENTRIES) {
      expect(spec.glow, `${name} glow`).toBe('friendly');
    }
  });

  test('each player ship has exactly 2 weapons', () => {
    for (const [name, spec] of SHIP_ENTRIES) {
      expect(spec.weapons.length, `${name} weapons.length`).toBe(2);
    }
  });
});

describe('player ship brand hue families — session #77 M3', () => {
  test('kogut-zloty uses GOLD hull fill', () => {
    const spec = ships['kogut-zloty'];
    expect(spec.hull.fill).toBe(GOLD);
  });

  test('alembik uses BOG_GREEN hull fill', () => {
    const spec = ships.alembik;
    expect(spec.hull.fill).toBe(BOG_GREEN);
  });

  test('zwierciadlo uses DEEP_BLUE hull fill', () => {
    const spec = ships.zwierciadlo;
    expect(spec.hull.fill).toBe(DEEP_BLUE);
  });
});
