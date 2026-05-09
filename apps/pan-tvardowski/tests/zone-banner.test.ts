import { describe, expect, test } from 'bun:test';
import type { ZoneId } from '../src/events';
import { rawStyles } from '../src/hud/Hud.styles';
import { zoneRomanNumeral } from '../src/hud/zone-banner';
import { THEME_SPEC, UI_COLORS, fontFamily } from '../src/visual-spec/theme';

describe('zoneRomanNumeral — exhaustive mapping', () => {
  const cases: [ZoneId, string][] = [
    ['z1', 'I'],
    ['z2', 'II'],
    ['z3', 'III'],
    ['z4', 'IV'],
    ['z5', 'V'],
    ['z6', 'VI'],
    ['z7', 'VII'],
    ['z8', 'VIII'],
  ];

  for (const [id, expected] of cases) {
    test(`zoneRomanNumeral('${id}') === '${expected}'`, () => {
      expect(zoneRomanNumeral(id)).toBe(expected);
    });
  }
});

describe('zone banner styles', () => {
  test('zoneBannerNumeral uses serifItalic font family', () => {
    expect(rawStyles.zoneBannerNumeral.fontFamily).toBe(fontFamily.serifItalic);
  });

  test('zoneBannerNumeral color is gold', () => {
    expect(rawStyles.zoneBannerNumeral.color).toBe(UI_COLORS.gold);
  });

  test('zoneBannerRule has gold background', () => {
    expect(rawStyles.zoneBannerRule.backgroundColor).toBe(UI_COLORS.gold);
  });

  test('zoneBannerRule height is 1', () => {
    expect(rawStyles.zoneBannerRule.height).toBe(1);
  });

  test('zoneBannerRule width is 60%', () => {
    expect(rawStyles.zoneBannerRule.width).toBe('60%');
  });

  test('zoneBannerRule marginVertical uses THEME_SPEC.spacing.sm', () => {
    expect(rawStyles.zoneBannerRule.marginVertical).toBe(THEME_SPEC.spacing.sm);
  });
});
