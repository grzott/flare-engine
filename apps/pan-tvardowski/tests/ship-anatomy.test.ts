import { describe, expect, test } from 'bun:test';
import { HULL_PRESETS } from '../src/visual-spec/hull-presets';
import { SHIP_DEFS } from '../src/visual-spec/ships';
import type { ShipDef } from '../src/visual-spec/types';

const ENEMY_DEFS = SHIP_DEFS.filter((d) => d.weaponRatio === '1:8') as ShipDef[];

describe('ship anatomy — 3-element rule (folio XIIIa/XIIIb)', () => {
  test('T1 ShipDef type has id, hullPreset, weaponCount, engineColor', () => {
    const def = ENEMY_DEFS[0];
    expect(def).toBeDefined();
    expect(typeof def?.id).toBe('string');
    expect(typeof def?.hullPreset).toBe('string');
    expect(typeof def?.weaponCount).toBe('number');
    expect(typeof def?.engineColor).toBe('string');
  });

  test('T2 all 14 enemies present in SHIP_DEFS', () => {
    expect(ENEMY_DEFS).toHaveLength(14);
  });

  test('T3 weaponCount is in [1, 2] for all enemies', () => {
    for (const def of ENEMY_DEFS) {
      expect(def.weaponCount, `${def.id} weaponCount`).toBeGreaterThanOrEqual(1);
      expect(def.weaponCount, `${def.id} weaponCount`).toBeLessThanOrEqual(2);
    }
  });

  test('T4 every enemy hullPreset resolves in HULL_PRESETS', () => {
    for (const def of ENEMY_DEFS) {
      expect(HULL_PRESETS[def.hullPreset], `${def.id} hullPreset`).toBeDefined();
    }
  });

  test('T5 no two enemies share the same silhouette key (hullPreset + hullColor + weaponColor)', () => {
    const seen = new Set<string>();
    for (const def of ENEMY_DEFS) {
      const key = `${def.hullPreset}:${def.hullColor}:${def.weaponColor}`;
      expect(seen.has(key), `${def.id} duplicate silhouette key=${key}`).toBe(false);
      seen.add(key);
    }
  });

  test('T6 every enemy has engineColor defined', () => {
    for (const def of ENEMY_DEFS) {
      expect(def.engineColor.length, `${def.id} engineColor`).toBeGreaterThan(0);
    }
  });

  test('T7 every enemy has weaponColor defined', () => {
    for (const def of ENEMY_DEFS) {
      expect(def.weaponColor.length, `${def.id} weaponColor`).toBeGreaterThan(0);
    }
  });
});
