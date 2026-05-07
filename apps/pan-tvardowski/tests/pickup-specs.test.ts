import { describe, expect, test } from 'bun:test';
import { PICKUP_DEFS, WEAPON_DEFS } from '../src/visual-spec';

describe('pickup-specs', () => {
  test('PICKUP_DEFS has exactly 10 entries', () => {
    expect(PICKUP_DEFS.length).toBe(10);
  });

  test('all weapon-swap pickups reference a valid WeaponDef id', () => {
    const weaponIds = new Set(WEAPON_DEFS.map((w) => w.id));
    const swapPickups = PICKUP_DEFS.filter((p) => p.effect.kind === 'weapon-swap');
    const unresolved = swapPickups
      .filter((p) => {
        const effect = p.effect;
        return effect.kind === 'weapon-swap' && !weaponIds.has(effect.weapon);
      })
      .map((p) => p.id);
    expect(unresolved).toEqual([]);
  });
});
