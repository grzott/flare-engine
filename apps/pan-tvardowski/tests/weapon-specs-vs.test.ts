import { describe, expect, test } from 'bun:test';
import { BULLET_DEFS, WEAPON_DEFS } from '../src/visual-spec';

describe('weapon-specs-vs', () => {
  test('WEAPON_DEFS has exactly 4 entries with the expected ids', () => {
    expect(WEAPON_DEFS.length).toBe(4);
    const ids = WEAPON_DEFS.map((w) => w.id as string);
    expect(ids).toContain('iskry');
    expect(ids).toContain('piorun');
    expect(ids).toContain('sol-swiecona');
    expect(ids).toContain('znak-pentagramu');
  });

  test('every WeaponDef.bullet resolves in BULLET_DEFS', () => {
    const bulletIds = new Set(BULLET_DEFS.map((b) => b.id));
    const unresolved = WEAPON_DEFS.filter((w) => !bulletIds.has(w.bullet)).map(
      (w) => `${w.id} → ${w.bullet}`,
    );
    expect(unresolved).toEqual([]);
  });
});
