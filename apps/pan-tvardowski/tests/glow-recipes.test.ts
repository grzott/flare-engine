import { describe, expect, test } from 'bun:test';
import type { BaseSpec, ShapeSpec } from '@flare-engine/shapes';
import { friendlyGlowArgb, hazardGlowArgb } from '@flare-engine/shapes';
import { SHAPE_CATALOGUE } from '../src/shape-catalogue';

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

  test('player ship kogut-zloty has glow: friendly at ShipSpec level', () => {
    const ship = SHAPE_CATALOGUE.ships['kogut-zloty'];
    // ships are now ShipSpec — glow lives on the ShipSpec (BaseSpec) directly.
    expect(ship.glow).toBe('friendly');
  });

  test('all 4 weapon pickups have glow: friendly on first shape', () => {
    for (const [id, shapes] of Object.entries(SHAPE_CATALOGUE.weaponPickups)) {
      expect((shapes[0] as ShapeSpec).glow, `${id} missing glow`).toBe('friendly');
    }
  });

  test('all 6 upgrade pickups have glow: friendly on first shape', () => {
    for (const [id, shapes] of Object.entries(SHAPE_CATALOGUE.upgradePickups)) {
      expect((shapes[0] as ShapeSpec).glow, `${id} missing glow`).toBe('friendly');
    }
  });

  test('enemies have no glow tag', () => {
    for (const [id, spec] of Object.entries(SHAPE_CATALOGUE.enemies)) {
      // enemies are now ShipSpec — glow lives on BaseSpec at the top level
      expect((spec as ShapeSpec).glow, `${id} should not have glow`).toBeUndefined();
    }
  });

  test('bosses have no glow tag', () => {
    for (const [id, spec] of Object.entries(SHAPE_CATALOGUE.bosses)) {
      // bosses are now ShipSpec — cast to BaseSpec to reach the optional glow field.
      expect((spec as BaseSpec).glow, `${id} should not have glow`).toBeUndefined();
    }
  });
});
