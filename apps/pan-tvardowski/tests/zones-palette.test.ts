/**
 * zones-palette.test.ts — token-routing guard for ZONE_PALETTES.
 *
 * After the Session 178 refactor, all argb literals in zones-palette.ts are
 * routed through hexToArgb(THEME_SPEC.colors.<token>). These tests pin:
 *   1. hexToArgb round-trip for each of the 14 distinct tokens in use.
 *   2. ZONE_PALETTES bit-for-bit preservation for all 8 zones.
 *   3. getUiPrimary parity (gold for z1, bone for z8).
 *   4. getUiPrimaryHex CSS string output.
 *   5. Non-color field spot-check (ambienceName, ambienceParticles, silverUi).
 */

import { describe, expect, test } from 'bun:test';
import { hexToArgb } from '../src/visual-spec/color-util';
import { THEME_SPEC } from '../src/visual-spec/theme';
import { ZONE_PALETTES, getUiPrimary, getUiPrimaryHex } from '../src/visual-spec/zones-palette';

describe('zones-palette — hexToArgb token round-trip', () => {
  test('gold', () => {
    expect(hexToArgb(THEME_SPEC.colors.gold)).toBe(0xffc9a24a >>> 0);
  });
  test('bone', () => {
    expect(hexToArgb(THEME_SPEC.colors.bone)).toBe(0xffc7b89a >>> 0);
  });
  test('terracotta', () => {
    expect(hexToArgb(THEME_SPEC.colors.terracotta)).toBe(0xffb05a3c >>> 0);
  });
  test('inkBlack', () => {
    expect(hexToArgb(THEME_SPEC.colors.inkBlack)).toBe(0xff0e1a12 >>> 0);
  });
  test('moss', () => {
    expect(hexToArgb(THEME_SPEC.colors.moss)).toBe(0xff243a29 >>> 0);
  });
  test('verdigris', () => {
    expect(hexToArgb(THEME_SPEC.colors.verdigris)).toBe(0xff4a7a6a >>> 0);
  });
  test('goldDeep', () => {
    expect(hexToArgb(THEME_SPEC.colors.goldDeep)).toBe(0xff8e6f2c >>> 0);
  });
  test('hazard', () => {
    expect(hexToArgb(THEME_SPEC.colors.hazard)).toBe(0xffe84b2a >>> 0);
  });
  test('crimsonDeep', () => {
    expect(hexToArgb(THEME_SPEC.colors.crimsonDeep)).toBe(0xff7a1322 >>> 0);
  });
  test('katakumbyDark', () => {
    expect(hexToArgb(THEME_SPEC.colors.katakumbyDark)).toBe(0xff1a1410 >>> 0);
  });
  test('rust', () => {
    expect(hexToArgb(THEME_SPEC.colors.rust)).toBe(0xff8b3a1f >>> 0);
  });
  test('parchment', () => {
    expect(hexToArgb(THEME_SPEC.colors.parchment)).toBe(0xffe8dcc4 >>> 0);
  });
  test('lunarInk', () => {
    expect(hexToArgb(THEME_SPEC.colors.lunarInk)).toBe(0xff1a1f2a >>> 0);
  });
  test('crimson', () => {
    expect(hexToArgb(THEME_SPEC.colors.crimson)).toBe(0xffd4213d >>> 0);
  });
});

describe('zones-palette — ZONE_PALETTES exact channel values', () => {
  test('Z1 channels', () => {
    expect(ZONE_PALETTES[1].primary).toBe(0xffb05a3c >>> 0); // terracotta
    expect(ZONE_PALETTES[1].accent).toBe(0xff0e1a12 >>> 0); // inkBlack
    expect(ZONE_PALETTES[1].hazard).toBe(0xffc9a24a >>> 0); // gold
  });
  test('Z2 channels', () => {
    expect(ZONE_PALETTES[2].primary).toBe(0xff243a29 >>> 0); // moss
    expect(ZONE_PALETTES[2].accent).toBe(0xff4a7a6a >>> 0); // verdigris
    expect(ZONE_PALETTES[2].hazard).toBe(0xffc7b89a >>> 0); // bone
  });
  test('Z3 channels', () => {
    expect(ZONE_PALETTES[3].primary).toBe(0xff4a7a6a >>> 0); // verdigris
    expect(ZONE_PALETTES[3].accent).toBe(0xff8e6f2c >>> 0); // goldDeep
    expect(ZONE_PALETTES[3].hazard).toBe(0xffc7b89a >>> 0); // bone
  });
  test('Z4 channels', () => {
    expect(ZONE_PALETTES[4].primary).toBe(0xff243a29 >>> 0); // moss
    expect(ZONE_PALETTES[4].accent).toBe(0xff8e6f2c >>> 0); // goldDeep
    expect(ZONE_PALETTES[4].hazard).toBe(0xffe84b2a >>> 0); // hazard
  });
  test('Z5 channels', () => {
    expect(ZONE_PALETTES[5].primary).toBe(0xff7a1322 >>> 0); // crimsonDeep
    expect(ZONE_PALETTES[5].accent).toBe(0xff0e1a12 >>> 0); // inkBlack
    expect(ZONE_PALETTES[5].hazard).toBe(0xffc9a24a >>> 0); // gold
  });
  test('Z6 channels', () => {
    expect(ZONE_PALETTES[6].primary).toBe(0xff1a1410 >>> 0); // katakumbyDark
    expect(ZONE_PALETTES[6].accent).toBe(0xff8e6f2c >>> 0); // goldDeep
    expect(ZONE_PALETTES[6].hazard).toBe(0xff7a1322 >>> 0); // crimsonDeep
  });
  test('Z7 channels', () => {
    expect(ZONE_PALETTES[7].primary).toBe(0xff8b3a1f >>> 0); // rust
    expect(ZONE_PALETTES[7].accent).toBe(0xff7a1322 >>> 0); // crimsonDeep
    expect(ZONE_PALETTES[7].hazard).toBe(0xffe8dcc4 >>> 0); // parchment
  });
  test('Z8 channels', () => {
    expect(ZONE_PALETTES[8].primary).toBe(0xffc7b89a >>> 0); // bone
    expect(ZONE_PALETTES[8].accent).toBe(0xff1a1f2a >>> 0); // lunarInk
    expect(ZONE_PALETTES[8].hazard).toBe(0xffd4213d >>> 0); // crimson
  });
});

describe('zones-palette — getUiPrimary parity', () => {
  test('z1 returns gold ARGB', () => {
    expect(getUiPrimary('z1')).toBe(hexToArgb(THEME_SPEC.colors.gold));
  });
  test('z8 returns bone ARGB (silverUi branch)', () => {
    expect(getUiPrimary('z8')).toBe(hexToArgb(THEME_SPEC.colors.bone));
  });
});

describe('zones-palette — getUiPrimaryHex roundtrip', () => {
  test('z1 returns gold as CSS hex', () => {
    expect(getUiPrimaryHex('z1')).toBe('#c9a24a');
  });
  test('z8 returns bone as CSS hex', () => {
    expect(getUiPrimaryHex('z8')).toBe('#c7b89a');
  });
});

describe('zones-palette — non-color field spot-check', () => {
  test('Z1 ambienceName and ambienceParticles are intact', () => {
    expect(ZONE_PALETTES[1].ambienceName).toBe('ember');
    expect(ZONE_PALETTES[1].ambienceParticles).toBe(32);
  });
  test('Z8 silverUi flag is set', () => {
    expect(ZONE_PALETTES[8].silverUi).toBe(true);
  });
});
