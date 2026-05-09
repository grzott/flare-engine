import { describe, expect, test } from 'bun:test';
import { THEME_SPEC, TYPOGRAPHY, UI_COLORS } from '../src/visual-spec/theme';

describe('VS-S7 runtime rewire — spacing shim', () => {
  test('spacing is the THEME_SPEC.spacing reference', () => {
    expect(THEME_SPEC.spacing).toBe(THEME_SPEC.spacing);
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
      expect(typeof THEME_SPEC.spacing[key], `spacing.${key}`).toBe('number');
    }
    expect(Object.keys(THEME_SPEC.spacing).length).toBe(expected.length);
  });
});

describe('VS-S8f — UI_COLORS direct assertions', () => {
  test('UI_COLORS.gold sourced from THEME_SPEC', () => {
    expect(UI_COLORS.gold).toBe(THEME_SPEC.colors.gold);
  });

  test('UI_COLORS.crimson sourced from THEME_SPEC', () => {
    expect(UI_COLORS.crimson).toBe(THEME_SPEC.colors.crimson);
  });

  test('UI_COLORS.hazard sourced from THEME_SPEC', () => {
    expect(UI_COLORS.hazard).toBe(THEME_SPEC.colors.hazard);
  });

  test('UI_COLORS.inkBlack sourced from THEME_SPEC', () => {
    expect(UI_COLORS.inkBlack).toBe(THEME_SPEC.colors.inkBlack);
  });

  test('UI_COLORS.safe sourced from THEME_SPEC', () => {
    expect(UI_COLORS.safe).toBe(THEME_SPEC.colors.safe);
  });

  test('UI_COLORS.cb.player sourced from THEME_SPEC cb-player', () => {
    expect(UI_COLORS.cb.player).toBe(THEME_SPEC.colors['cb-player']);
  });

  test('derived alias primary equals gold (same literal value)', () => {
    expect(UI_COLORS.primary).toBe(UI_COLORS.gold);
  });
});

describe('VS-S8f — TYPOGRAPHY direct assertions', () => {
  test('displayXl.fontSize === 132', () => {
    expect(TYPOGRAPHY.displayXl.fontSize).toBe(132);
  });

  test('displayXl.lineHeight === 121', () => {
    expect(TYPOGRAPHY.displayXl.lineHeight).toBe(121);
  });

  test('displayXl.letterSpacing === -2.64', () => {
    expect(TYPOGRAPHY.displayXl.letterSpacing).toBe(-2.64);
  });

  test('lede does not have italic field (spec-only metadata stripped)', () => {
    expect((TYPOGRAPHY.lede as Record<string, unknown>).italic).toBeUndefined();
  });

  test('lede.fontFamily matches spec italic serif font string', () => {
    expect(TYPOGRAPHY.lede.fontFamily).toBe(THEME_SPEC.typography.lede.fontFamily);
  });

  test('six deprecated aliases are absent', () => {
    const deprecated = ['h1', 'h2', 'h3', 'body', 'caption', 'xs'] as const;
    for (const key of deprecated) {
      expect((TYPOGRAPHY as Record<string, unknown>)[key], `TYPOGRAPHY.${key}`).toBeUndefined();
    }
  });
});
