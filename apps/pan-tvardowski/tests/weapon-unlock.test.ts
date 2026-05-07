import { describe, expect, test } from 'bun:test';
import { WEAPON_UNLOCK_ZONE } from '../src/config/gameplay';
import type { WeaponId } from '../src/config/gameplay';

const WEAPON_IDS: WeaponId[] = ['iskry', 'piorun', 'sol-swiecona', 'znak-pentagramu'];

describe('WEAPON_UNLOCK_ZONE — M2', () => {
  test('l2 < l3 (monotone unlock order) for all weapons', () => {
    for (const id of WEAPON_IDS) {
      const { l2, l3 } = WEAPON_UNLOCK_ZONE[id];
      expect(l2, `${id} l2 < l3`).toBeLessThan(l3);
    }
  });

  test('canonical values: l2=3, l3=6 for all weapons (build plan §10)', () => {
    for (const id of WEAPON_IDS) {
      const { l2, l3 } = WEAPON_UNLOCK_ZONE[id];
      expect(l2, `${id} l2`).toBe(3);
      expect(l3, `${id} l3`).toBe(6);
    }
  });
});
