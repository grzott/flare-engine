import { describe, expect, test } from 'bun:test';
import type { BaseSpec, ShapeSpec } from '@flare-engine/shapes';
import { friendlyGlowArgb, hazardGlowArgb } from '@flare-engine/shapes';
import { PICKUP_DEFS } from '../src/visual-spec/pickups';
import { SHIP_DEFS } from '../src/visual-spec/ships';

const ENEMY_DEFS = SHIP_DEFS.filter((d) => d.weaponRatio === '1:8');
const BOSS_DEFS = SHIP_DEFS.filter((d) => d.weaponRatio === '1:12' && d.glow === 'hazard');
const WEAPON_PICKUP_DEFS = PICKUP_DEFS.filter((d) => d.effect.kind === 'weapon-swap');
const UPGRADE_PICKUP_DEFS = PICKUP_DEFS.filter((d) => d.effect.kind !== 'weapon-swap');

describe('glow recipes', () => {
  test('friendlyGlowArgb returns safe color at α ≈ 0.25', () => {
    const argb = friendlyGlowArgb();
    expect((argb >>> 24) & 0xff).toBe(0x40);
    expect(argb & 0x00ffffff).toBe(0x6fa66b);
  });

  test('hazardGlowArgb returns hazardOrange at α ≈ 0.6', () => {
    const argb = hazardGlowArgb();
    expect((argb >>> 24) & 0xff).toBe(0x99);
    expect(argb & 0x00ffffff).toBe(0xe84b2a);
  });

  test('BaseSpec accepts optional glow field', () => {
    const spec: BaseSpec = { glow: 'friendly' };
    expect(spec.glow).toBe('friendly');
    const spec2: BaseSpec = { glow: 'hazard' };
    expect(spec2.glow).toBe('hazard');
    const spec3: BaseSpec = {};
    expect(spec3.glow).toBeUndefined();
  });

  test('player ship kogut-zloty has glow: friendly', () => {
    const def = SHIP_DEFS.find((d) => d.id === 'kogut-zloty');
    expect(def?.glow).toBe('friendly');
  });

  test('all 4 weapon pickups have glow: friendly on first shape', () => {
    for (const def of WEAPON_PICKUP_DEFS) {
      expect((def.shapes[0] as ShapeSpec).glow, `${String(def.id)} missing glow`).toBe('friendly');
    }
  });

  test('all 6 upgrade pickups have glow: friendly on first shape', () => {
    for (const def of UPGRADE_PICKUP_DEFS) {
      expect((def.shapes[0] as ShapeSpec).glow, `${String(def.id)} missing glow`).toBe('friendly');
    }
  });

  test('enemies have no glow tag', () => {
    for (const def of ENEMY_DEFS) {
      expect((def as BaseSpec).glow, `${def.id} should not have glow`).toBeUndefined();
    }
  });

  test('bosses have glow=hazard', () => {
    for (const def of BOSS_DEFS) {
      expect(def.glow, `${def.id} should have hazard glow`).toBe('hazard');
    }
  });
});
