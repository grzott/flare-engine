/**
 * Tests for visual-spec/lighting.ts (RIM_LIGHT_DEFS) and the
 * setRimLightDef / setRimLight wiring on PanPostFxController.
 */

import { describe, expect, test } from 'bun:test';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';
import { RIM_LIGHT_DEFS } from '../src/visual-spec/lighting';

// All 8 boss EntityIds that must have an entry.
const BOSS_IDS = [
  'smok-krzemionkowski',
  'borowy-krol',
  'wodnik-wislanny',
  'boruta',
  'baba-jaga',
  'bazyliszek-warszawski',
  'mefistofeles',
  'lucyper-ksiezycowy',
] as const;

describe('RIM_LIGHT_DEFS — completeness', () => {
  test('all 8 boss ids are present', () => {
    for (const id of BOSS_IDS) {
      expect(RIM_LIGHT_DEFS[id], `missing entry for ${id}`).toBeDefined();
    }
  });

  test('exactly 8 entries — no extra keys', () => {
    expect(Object.keys(RIM_LIGHT_DEFS).length).toBe(8);
  });
});

describe('RIM_LIGHT_DEFS — field ranges', () => {
  for (const id of BOSS_IDS) {
    const def = RIM_LIGHT_DEFS[id];
    if (!def) continue;

    test(`${id}: colorR/G/B in [0, 1]`, () => {
      expect(def.colorR).toBeGreaterThanOrEqual(0);
      expect(def.colorR).toBeLessThanOrEqual(1);
      expect(def.colorG).toBeGreaterThanOrEqual(0);
      expect(def.colorG).toBeLessThanOrEqual(1);
      expect(def.colorB).toBeGreaterThanOrEqual(0);
      expect(def.colorB).toBeLessThanOrEqual(1);
    });

    test(`${id}: intensity > 0`, () => {
      expect(def.intensity).toBeGreaterThan(0);
    });

    test(`${id}: falloffRadius > bossDiscRadius`, () => {
      expect(def.falloffRadius).toBeGreaterThan(def.bossDiscRadius);
    });

    test(`${id}: bossDiscRadius > 0`, () => {
      expect(def.bossDiscRadius).toBeGreaterThan(0);
    });
  }
});

describe('RIM_LIGHT_DEFS — smok parity with prior hardcodes', () => {
  test('smok colorR === 1.0 (exact parity)', () => {
    expect(RIM_LIGHT_DEFS['smok-krzemionkowski']?.colorR).toBe(1.0);
  });
  test('smok colorG === 0.72 (exact parity)', () => {
    expect(RIM_LIGHT_DEFS['smok-krzemionkowski']?.colorG).toBe(0.72);
  });
  test('smok colorB === 0.25 (exact parity)', () => {
    expect(RIM_LIGHT_DEFS['smok-krzemionkowski']?.colorB).toBe(0.25);
  });
  test('smok intensity === 1.8 (exact parity)', () => {
    expect(RIM_LIGHT_DEFS['smok-krzemionkowski']?.intensity).toBe(1.8);
  });
  test('smok falloffRadius === 160 (exact parity)', () => {
    expect(RIM_LIGHT_DEFS['smok-krzemionkowski']?.falloffRadius).toBe(160);
  });
  test('smok bossDiscRadius === 48 (exact parity)', () => {
    expect(RIM_LIGHT_DEFS['smok-krzemionkowski']?.bossDiscRadius).toBe(48);
  });
});

describe('PanPostFxController — setRimLightDef wiring', () => {
  test('setRimLightDef is callable and does not throw', () => {
    const fx = createPanTvardowskiPostFx(null);
    const def = RIM_LIGHT_DEFS['smok-krzemionkowski'];
    expect(() => {
      if (def) fx.setRimLightDef(def);
    }).not.toThrow();
  });

  test('default def is smok — calling setRimLight before setRimLightDef uses smok values', () => {
    const fx = createPanTvardowskiPostFx(null);
    // rimLightEnabled starts false; setRimLight enables it
    expect(fx.rimLightEnabled).toBe(false);
    // setRimLight with no prior setRimLightDef should not throw (defaults to smok)
    expect(() => fx.setRimLight(100, 100, 200, 300)).not.toThrow();
    expect(fx.rimLightEnabled).toBe(true);
  });

  test('setRimLightDef followed by setRimLight uses new def (no throw)', () => {
    const fx = createPanTvardowskiPostFx(null);
    const def = RIM_LIGHT_DEFS['lucyper-ksiezycowy'];
    if (def) fx.setRimLightDef(def);
    expect(() => fx.setRimLight(50, 50, 180, 300)).not.toThrow();
    expect(fx.rimLightEnabled).toBe(true);
  });

  test('disableRimLight resets rimLightEnabled to false', () => {
    const fx = createPanTvardowskiPostFx(null);
    fx.setRimLight(100, 100, 200, 300);
    expect(fx.rimLightEnabled).toBe(true);
    fx.disableRimLight();
    expect(fx.rimLightEnabled).toBe(false);
  });
});

describe('RIM_LIGHT_DEFS — schema additive check', () => {
  test('RimLightDef has exactly 6 numeric fields', () => {
    const def = RIM_LIGHT_DEFS['smok-krzemionkowski'];
    expect(def).toBeDefined();
    if (!def) return;
    const keys = Object.keys(def);
    expect(keys).toContain('colorR');
    expect(keys).toContain('colorG');
    expect(keys).toContain('colorB');
    expect(keys).toContain('intensity');
    expect(keys).toContain('falloffRadius');
    expect(keys).toContain('bossDiscRadius');
    expect(keys.length).toBe(6);
  });
});
