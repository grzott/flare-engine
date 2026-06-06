import { describe, expect, test } from 'bun:test';
import type { WeaponId } from '../src/config/gameplay';
import { LOCALIZATION_KEYS } from '../src/localization/keys';
import { BULLET_DEFS } from '../src/visual-spec/bullets';

const WEAPON_IDS: WeaponId[] = ['iskry', 'piorun', 'sol-swiecona', 'znak-pentagramu'];

describe('weapon bullet visual catalogue — BULLET_DEFS', () => {
  test('BULLET_DEFS has an entry for each weapon (bullet id follows <weapon>-bullet convention)', () => {
    const bulletIds = BULLET_DEFS.map((d) => String(d.id));
    for (const id of WEAPON_IDS) {
      const match = bulletIds.some((bid) => bid.startsWith(id));
      expect(match, `no BULLET_DEFS entry for weapon ${id}`).toBe(true);
    }
  });

  test('each BULLET_DEFS entry has a positive intensity and a hex fill', () => {
    for (const def of BULLET_DEFS) {
      expect(def.intensity, String(def.id)).toBeGreaterThan(0);
      expect(def.fill, String(def.id)).toMatch(/^#[0-9A-Fa-f]{6}$/);
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
