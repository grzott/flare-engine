import { describe, expect, test } from 'bun:test';
import { PICKUP_DEFS } from '../src/visual-spec/pickups';
import { SHIP_DEFS } from '../src/visual-spec/ships';

const ENEMIES = SHIP_DEFS.filter((d) => d.weaponRatio === '1:8');
const MINIBOSSES = SHIP_DEFS.filter((d) => d.weaponRatio === '1:10');
const BOSSES = SHIP_DEFS.filter((d) => d.weaponRatio === '1:12' && d.glow === 'hazard');
const PLAYER_SHIPS = SHIP_DEFS.filter((d) => d.weaponRatio === '1:12' && d.glow === 'friendly');
const WEAPON_PICKUPS = PICKUP_DEFS.filter((d) => d.effect.kind === 'weapon-swap');
const UPGRADE_PICKUPS = PICKUP_DEFS.filter((d) => d.effect.kind !== 'weapon-swap');

describe('ship + pickup catalogue — category counts', () => {
  test('14 enemies, 4 minibosses, 8 bosses, 3 player ships', () => {
    expect(ENEMIES).toHaveLength(14);
    expect(MINIBOSSES).toHaveLength(4);
    expect(BOSSES).toHaveLength(8);
    expect(PLAYER_SHIPS).toHaveLength(3);
    expect(SHIP_DEFS).toHaveLength(29);
  });

  test('4 weapon pickups, 6 upgrade pickups', () => {
    expect(WEAPON_PICKUPS).toHaveLength(4);
    expect(UPGRADE_PICKUPS).toHaveLength(6);
    expect(PICKUP_DEFS).toHaveLength(10);
  });

  test('every ShipDef has a non-empty id, hullPreset, and weaponCount >= 1', () => {
    for (const def of SHIP_DEFS) {
      expect(def.id.length, def.id).toBeGreaterThan(0);
      expect(def.hullPreset.length, def.id).toBeGreaterThan(0);
      expect(def.weaponCount, def.id).toBeGreaterThanOrEqual(1);
    }
  });

  test('every PickupDef has a non-empty id, non-empty shapes, and an effect', () => {
    for (const def of PICKUP_DEFS) {
      expect(String(def.id).length, String(def.id)).toBeGreaterThan(0);
      expect(def.shapes.length, String(def.id)).toBeGreaterThan(0);
      expect(def.effect.kind.length, String(def.id)).toBeGreaterThan(0);
    }
  });

  test('all ShipDef ids are unique', () => {
    const ids = SHIP_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all PickupDef ids are unique', () => {
    const ids = PICKUP_DEFS.map((d) => String(d.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
