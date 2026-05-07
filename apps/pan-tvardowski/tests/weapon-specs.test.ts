import { describe, expect, test } from 'bun:test';
import { WEAPON_PROJECTILE_SPECS } from '../src/config/gameplay';
import type { WeaponId } from '../src/config/gameplay';
import { LOCALIZATION_KEYS } from '../src/localization/keys';
import { SHAPE_CATALOGUE } from '../src/shape-catalogue';

const WEAPON_IDS: WeaponId[] = ['iskry', 'piorun', 'sol-swiecona', 'znak-pentagramu'];

describe('weapon projectile catalogue — M1', () => {
  test('weaponProjectiles has exactly 4 entries (one per WeaponId)', () => {
    const entries = Object.keys(SHAPE_CATALOGUE.weaponProjectiles);
    expect(entries.length).toBe(4);
    for (const id of WEAPON_IDS) {
      expect(entries).toContain(id);
    }
  });

  test('each weaponProjectiles entry is non-empty', () => {
    for (const id of WEAPON_IDS) {
      const shapes = SHAPE_CATALOGUE.weaponProjectiles[id];
      expect(shapes.length, `${id} projectile shapes`).toBeGreaterThan(0);
    }
  });
});

describe('WEAPON_PROJECTILE_SPECS — M1', () => {
  test('all WeaponIds present in WEAPON_PROJECTILE_SPECS', () => {
    for (const id of WEAPON_IDS) {
      const spec = WEAPON_PROJECTILE_SPECS[id];
      expect(spec).toBeDefined();
      expect(spec.damagePerBullet).toBeGreaterThan(0);
      expect(spec.cooldownMs).toBeGreaterThan(0);
    }
  });
});

describe('weapon tier locale keys — M3', () => {
  test('tier1/tier2/tier3 keys present for all WeaponIds in LOCALIZATION_KEYS', () => {
    const keySet = new Set<string>(LOCALIZATION_KEYS);
    for (const id of WEAPON_IDS) {
      for (const tier of ['tier1', 'tier2', 'tier3'] as const) {
        const key = `weapons.${id}.${tier}`;
        expect(keySet.has(key), `missing key: ${key}`).toBe(true);
      }
    }
  });
});
