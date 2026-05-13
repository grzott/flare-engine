import { describe, expect, test } from 'bun:test';
import { SHIP_DEFS } from '../src/visual-spec/ships';
import type { ShipDef } from '../src/visual-spec/types';

const ENEMY_DEFS = SHIP_DEFS.filter((d): d is ShipDef => d.weaponRatio === '1:8');
const MINIBOSS_DEFS = SHIP_DEFS.filter((d): d is ShipDef => d.weaponRatio === '1:10');
const BOSS_DEFS = SHIP_DEFS.filter(
  (d): d is ShipDef => d.weaponRatio === '1:12' && d.glow === 'hazard',
);
const PLAYER_DEFS = SHIP_DEFS.filter(
  (d): d is ShipDef => d.weaponRatio === '1:12' && d.glow === 'friendly',
);

describe('ship silhouette uniqueness audit — session #78 M2', () => {
  test('T1: exactly 29 ShipDef entries (14 enemies + 4 minibosses + 8 bosses + 3 players)', () => {
    expect(ENEMY_DEFS).toHaveLength(14);
    expect(MINIBOSS_DEFS).toHaveLength(4);
    expect(BOSS_DEFS).toHaveLength(8);
    expect(PLAYER_DEFS).toHaveLength(3);
    expect(SHIP_DEFS).toHaveLength(29);
  });

  test('T2: no two ships share the same silhouette key (hullPreset + hullColor + weaponColor)', () => {
    const seen = new Map<string, string>();
    for (const def of SHIP_DEFS) {
      const key = `${def.hullPreset}:${def.hullColor}:${def.weaponColor}`;
      const prev = seen.get(key);
      expect(prev, `${def.id} and ${prev ?? '?'} share silhouette key: ${key}`).toBeUndefined();
      seen.set(key, def.id);
    }
  });

  test('T3: every enemy has weaponCount in [1, 2]', () => {
    for (const def of ENEMY_DEFS) {
      expect(def.weaponCount, `enemy ${def.id} weaponCount`).toBeGreaterThanOrEqual(1);
      expect(def.weaponCount, `enemy ${def.id} weaponCount`).toBeLessThanOrEqual(2);
    }
  });

  test('T4: every miniboss has weaponCount=2', () => {
    for (const def of MINIBOSS_DEFS) {
      expect(def.weaponCount, `miniboss ${def.id} weaponCount`).toBe(2);
    }
  });

  test('T5: every boss has weaponCount in [1, 2]', () => {
    for (const def of BOSS_DEFS) {
      expect(def.weaponCount, `boss ${def.id} weaponCount`).toBeGreaterThanOrEqual(1);
      expect(def.weaponCount, `boss ${def.id} weaponCount`).toBeLessThanOrEqual(2);
    }
  });

  test('T6: every player ship has weaponCount=2', () => {
    for (const def of PLAYER_DEFS) {
      expect(def.weaponCount, `player ${def.id} weaponCount`).toBe(2);
    }
  });
});
