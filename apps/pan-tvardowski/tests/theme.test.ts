import { describe, expect, test } from 'bun:test';
import { ZONE_PALETTES } from '../src/palette';
import { colors, shapes, spacing, typography } from '../src/theme';

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

  test('every ui token is a non-empty string', () => {
    for (const [key, value] of Object.entries(colors.ui)) {
      expect(typeof value, `colors.ui.${key}`).toBe('string');
      expect((value as string).length, `colors.ui.${key}`).toBeGreaterThan(0);
    }
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
