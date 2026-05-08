import { describe, expect, test } from 'bun:test';
import { colors, spacing, typography } from '../src/theme';
import { THEME_SPEC } from '../src/visual-spec/theme';

describe('VS-S7 runtime rewire — spacing shim', () => {
  test('spacing is the THEME_SPEC.spacing reference', () => {
    expect(spacing).toBe(THEME_SPEC.spacing);
  });

  test('all 19 SpacingTokenId keys present in spacing', () => {
    const expected = [
      'xs',
      'sm',
      'md',
      'lg',
      'xl',
      'xxl',
      'xxxl',
      'hudCornerX',
      'hudCornerY',
      'hudGap',
      'panelLgWidth',
      'panelMdWidth',
      'panelPadding',
      'panelBorderRadius',
      'bossBarHeight',
      'minibossBarHeight',
      'weaponMeterHeight',
      'buttonPaddingH',
      'buttonPaddingV',
    ] as const;
    for (const key of expected) {
      expect(typeof spacing[key], `spacing.${key}`).toBe('number');
    }
    expect(Object.keys(spacing).length).toBe(expected.length);
  });
});

describe('VS-S7 runtime rewire — colors shim', () => {
  test('colors.ui.gold sourced from THEME_SPEC', () => {
    expect(colors.ui.gold).toBe(THEME_SPEC.colors.gold);
  });

  test('colors.ui.crimson sourced from THEME_SPEC', () => {
    expect(colors.ui.crimson).toBe(THEME_SPEC.colors.crimson);
  });

  test('colors.ui.hazard sourced from THEME_SPEC', () => {
    expect(colors.ui.hazard).toBe(THEME_SPEC.colors.hazard);
  });

  test('colors.ui.inkBlack sourced from THEME_SPEC', () => {
    expect(colors.ui.inkBlack).toBe(THEME_SPEC.colors.inkBlack);
  });

  test('colors.ui.safe sourced from THEME_SPEC', () => {
    expect(colors.ui.safe).toBe(THEME_SPEC.colors.safe);
  });

  test('colors.ui.cb.player sourced from THEME_SPEC cb-player', () => {
    expect(colors.ui.cb.player).toBe(THEME_SPEC.colors['cb-player']);
  });

  test('derived alias primary equals gold (same literal value)', () => {
    expect(colors.ui.primary).toBe(colors.ui.gold);
  });
});

describe('VS-S7 runtime rewire — typography shim', () => {
  test('displayXl.fontSize === 132', () => {
    expect(typography.displayXl.fontSize).toBe(132);
  });

  test('displayXl.lineHeight === 121', () => {
    expect(typography.displayXl.lineHeight).toBe(121);
  });

  test('displayXl.letterSpacing === -2.64', () => {
    expect(typography.displayXl.letterSpacing).toBe(-2.64);
  });

  test('lede does not have italic field (spec-only metadata stripped)', () => {
    expect((typography.lede as Record<string, unknown>).italic).toBeUndefined();
  });

  test('lede.fontFamily matches spec italic serif font string', () => {
    expect(typography.lede.fontFamily).toBe(THEME_SPEC.typography.lede.fontFamily);
  });

  test('six deprecated aliases are present', () => {
    const deprecated = ['h1', 'h2', 'h3', 'body', 'caption', 'xs'] as const;
    for (const key of deprecated) {
      const tok = typography[key] as { fontFamily: string; fontSize: number };
      expect(typeof tok.fontFamily, `typography.${key}.fontFamily`).toBe('string');
      expect(tok.fontSize, `typography.${key}.fontSize`).toBeGreaterThan(0);
    }
  });
});
