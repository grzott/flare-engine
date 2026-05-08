import { describe, expect, test } from 'bun:test';
import { ZONE_PALETTES } from '../src/palette';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { shapes } from '../src/visual-spec/shapes';

describe('theme exports', () => {
  test('all four exports are defined', () => {
    expect(colors).toBeDefined();
    expect(typography).toBeDefined();
    expect(spacing).toBeDefined();
    expect(shapes).toBeDefined();
  });
});

describe('colors', () => {
  test('zone re-export matches ZONE_PALETTES keys', () => {
    const themeKeys = Object.keys(colors.zone).sort();
    const paletteKeys = Object.keys(ZONE_PALETTES).sort();
    expect(themeKeys).toEqual(paletteKeys);
  });

  test('zone re-export is the same reference', () => {
    expect(colors.zone).toBe(ZONE_PALETTES);
  });

  test('every ui token is a non-empty string (cb sub-object skipped)', () => {
    for (const [key, value] of Object.entries(colors.ui)) {
      if (typeof value !== 'string') continue;
      expect(value.length, `colors.ui.${key}`).toBeGreaterThan(0);
    }
  });

  test('deck-hex tokens — critical functional tokens', () => {
    expect(colors.ui.primary).toBe('#C9A24A');
    expect(colors.ui.hazard).toBe('#E84B2A');
    expect(colors.ui.secondary).toBe('#D4213D');
    expect(colors.ui.verdigris).toBe('#4A7A6A');
    expect(colors.ui.parchment).toBe('#E8DCC4');
    expect(colors.ui.inkBlack).toBe('#0E1A12');
    expect(colors.ui.void).toBe('#050A07');
  });

  test('tertiary alias removed after M2 sweep', () => {
    expect((colors.ui as Record<string, unknown>).tertiary).toBeUndefined();
  });
});

describe('ZONE_PALETTES — deck ARGB spot-checks', () => {
  test('Z1 primary === terracotta 0xffb05a3c', () => {
    expect(ZONE_PALETTES[1].primary).toBe(0xffb05a3c);
  });

  test('Z5 primary === crimson-deep 0xff7a1322', () => {
    expect(ZONE_PALETTES[5].primary).toBe(0xff7a1322);
  });

  test('Z8 primary === bone 0xffc7b89a', () => {
    expect(ZONE_PALETTES[8].primary).toBe(0xffc7b89a);
  });
});

describe('typography', () => {
  const VALID_WEIGHTS = new Set(['100', '200', '300', '400', '500', '600', '700', '800', '900']);

  test('every variant has fontSize > 0', () => {
    for (const [key, value] of Object.entries(typography)) {
      expect(value.fontSize, `typography.${key}.fontSize`).toBeGreaterThan(0);
    }
  });

  test('every variant has a valid fontWeight string', () => {
    for (const [key, value] of Object.entries(typography)) {
      expect(
        VALID_WEIGHTS.has(value.fontWeight),
        `typography.${key}.fontWeight="${value.fontWeight}"`,
      ).toBe(true);
    }
  });

  test('every variant has a non-empty fontFamily string', () => {
    for (const [key, value] of Object.entries(typography)) {
      const v = value as { fontFamily?: string };
      expect(typeof v.fontFamily, `typography.${key}.fontFamily`).toBe('string');
      expect((v.fontFamily ?? '').length, `typography.${key}.fontFamily`).toBeGreaterThan(0);
    }
  });
});

describe('spacing', () => {
  test('every token is a positive number', () => {
    for (const [key, value] of Object.entries(spacing)) {
      expect(typeof value, `spacing.${key}`).toBe('number');
      expect(value, `spacing.${key}`).toBeGreaterThan(0);
    }
  });
});

describe('shapes', () => {
  test('every shape radius r > 0', () => {
    const shapeEntries = Object.entries(shapes).filter(([key]) => key !== 'stroke');
    for (const [key, value] of shapeEntries) {
      const v = value as { r?: number; rInner?: number };
      expect(v.r, `shapes.${key}.r`).toBeGreaterThan(0);
    }
  });

  test('minibossHuge has rInner > 0', () => {
    expect(shapes.minibossHuge.rInner).toBeGreaterThan(0);
  });

  test('every stroke width > 0', () => {
    for (const [key, value] of Object.entries(shapes.stroke)) {
      expect(value, `shapes.stroke.${key}`).toBeGreaterThan(0);
    }
  });
});
