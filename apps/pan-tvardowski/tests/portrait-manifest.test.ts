import { describe, expect, test } from 'bun:test';
import { Color } from '@flare-engine/math';
import { PORTRAIT_MANIFEST, resolvePortraitShape } from '../src/dialogue/portrait-manifest';
import { THEME_SPEC } from '../src/visual-spec';

function hexToArgb(hex: string): number {
  return Color.toSkColor(Color.fromHex(hex));
}

describe('portrait-manifest — shape routing via THEME_SPEC tokens', () => {
  test('portrait.king base shape fill routes to portraitKingGold ARGB', () => {
    const shapes = PORTRAIT_MANIFEST['portrait.king'];
    expect(shapes[0]?.fill).toBe(hexToArgb(THEME_SPEC.colors.portraitKingGold));
  });

  test('portrait.king crown fill routes to portraitKingCrownBronze ARGB', () => {
    const shapes = PORTRAIT_MANIFEST['portrait.king'];
    expect(shapes[1]?.fill).toBe(hexToArgb(THEME_SPEC.colors.portraitKingCrownBronze));
  });

  test('portrait.king face fill routes to portraitFaceParchment ARGB', () => {
    const shapes = PORTRAIT_MANIFEST['portrait.king'];
    expect(shapes[2]?.fill).toBe(hexToArgb(THEME_SPEC.colors.portraitFaceParchment));
  });

  test('portrait.twardowski base shape fill routes to portraitTwardowskiViolet ARGB', () => {
    const shapes = PORTRAIT_MANIFEST['portrait.twardowski'];
    expect(shapes[0]?.fill).toBe(hexToArgb(THEME_SPEC.colors.portraitTwardowskiViolet));
  });

  test('portrait.twardowski star fill routes to purpleBright ARGB', () => {
    const shapes = PORTRAIT_MANIFEST['portrait.twardowski'];
    expect(shapes[1]?.fill).toBe(hexToArgb(THEME_SPEC.colors.purpleBright));
  });

  test('portrait.innkeeper base shape fill routes to portraitInnkeeperBrown ARGB', () => {
    const shapes = PORTRAIT_MANIFEST['portrait.innkeeper'];
    expect(shapes[0]?.fill).toBe(hexToArgb(THEME_SPEC.colors.portraitInnkeeperBrown));
  });

  test('portrait.innkeeper hat fill routes to portraitInnkeeperHatDark ARGB', () => {
    const shapes = PORTRAIT_MANIFEST['portrait.innkeeper'];
    expect(shapes[1]?.fill).toBe(hexToArgb(THEME_SPEC.colors.portraitInnkeeperHatDark));
  });

  test('portrait.lucyper star fill routes to hellfire ARGB', () => {
    const shapes = PORTRAIT_MANIFEST['portrait.lucyper'];
    expect(shapes[0]?.fill).toBe(hexToArgb(THEME_SPEC.colors.hellfire));
  });

  test('portrait.lucyper center fill routes to shadowBlack ARGB', () => {
    const shapes = PORTRAIT_MANIFEST['portrait.lucyper'];
    expect(shapes[1]?.fill).toBe(hexToArgb(THEME_SPEC.colors.shadowBlack));
  });

  test('portrait.boruta fill routes to shadowBlack ARGB', () => {
    const shapes = PORTRAIT_MANIFEST['portrait.boruta'];
    expect(shapes[0]?.fill).toBe(hexToArgb(THEME_SPEC.colors.shadowBlack));
  });

  test('portrait.boruta stroke routes to hellfire ARGB', () => {
    const shapes = PORTRAIT_MANIFEST['portrait.boruta'];
    const s = shapes[0];
    expect(s && 'stroke' in s ? s.stroke : undefined).toBe(hexToArgb(THEME_SPEC.colors.hellfire));
  });
});

describe('portrait-manifest — resolvePortraitShape', () => {
  test('resolves known key to non-empty array', () => {
    const shapes = resolvePortraitShape('portrait.king');
    expect(shapes).toBeDefined();
    expect(shapes!.length).toBeGreaterThan(0);
  });

  test('returns undefined for unknown key', () => {
    expect(resolvePortraitShape('portrait.unknown')).toBeUndefined();
  });

  test('returns undefined for undefined input', () => {
    expect(resolvePortraitShape(undefined)).toBeUndefined();
  });

  test('all 6 portrait keys resolve to non-empty shape arrays', () => {
    const keys = [
      'portrait.king',
      'portrait.twardowski',
      'portrait.innkeeper',
      'portrait.lucyper',
      'portrait.spider',
      'portrait.boruta',
    ] as const;
    for (const key of keys) {
      const shapes = resolvePortraitShape(key);
      expect(shapes, `key: ${key}`).toBeDefined();
      expect(shapes!.length, `key: ${key} shape count`).toBeGreaterThan(0);
    }
  });
});
