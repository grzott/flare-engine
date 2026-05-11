import { describe, expect, test } from 'bun:test';
import { THEME_SPEC } from '../src/visual-spec';
import type { ColorTokenId, SpacingTokenId, TypeTokenId } from '../src/visual-spec/types';

const HEX_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

const COLOR_TOKENS: readonly ColorTokenId[] = [
  'gold',
  'goldDeep',
  'crimson',
  'crimsonDeep',
  'hazard',
  'hazardOrange',
  'inkBlack',
  'void',
  'parchment',
  'parchment2',
  'parchmentDim',
  'bogGreen',
  'moss',
  'verdigris',
  'bone',
  'rust',
  'terracotta',
  'safe',
  'cb-player',
  'cb-hazard',
  'cb-safe',
  'vistulaBlue',
  'foamBlue',
  'mistBlue',
  'lunarInk',
  'katakumbyDark',
];

const TYPE_TOKENS: readonly TypeTokenId[] = [
  'displayXl',
  'displayL',
  'displayM',
  'lede',
  'bodyL',
  'bodyM',
  'bodyS',
  'label',
  'monoHud',
  'monoDebug',
  'smallcap',
];

const SPACING_TOKENS: readonly SpacingTokenId[] = [
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
];

describe('vs-theme — colors', () => {
  test('all 26 ColorTokenIds present in THEME_SPEC.colors', () => {
    for (const id of COLOR_TOKENS) {
      expect(THEME_SPEC.colors[id], `color token: ${id}`).toBeDefined();
    }
    expect(Object.keys(THEME_SPEC.colors).length).toBe(COLOR_TOKENS.length);
  });

  test('every color value is a valid #RRGGBB hex', () => {
    const violations: string[] = [];
    for (const id of COLOR_TOKENS) {
      if (!HEX_RE.test(THEME_SPEC.colors[id])) violations.push(`${id} = ${THEME_SPEC.colors[id]}`);
    }
    expect(violations).toEqual([]);
  });

  test('gold = #C9A24A (exact)', () => {
    expect(THEME_SPEC.colors.gold).toBe('#C9A24A');
  });

  test('hazard and hazardOrange both resolve to #E84B2A (deliberate duplicate)', () => {
    expect(THEME_SPEC.colors.hazard).toBe('#E84B2A');
    expect(THEME_SPEC.colors.hazardOrange).toBe('#E84B2A');
  });

  test('cb-player = #FF8C42, cb-hazard = #FFD23F, cb-safe = #4FC3F7', () => {
    expect(THEME_SPEC.colors['cb-player']).toBe('#FF8C42');
    expect(THEME_SPEC.colors['cb-hazard']).toBe('#FFD23F');
    expect(THEME_SPEC.colors['cb-safe']).toBe('#4FC3F7');
  });
});

describe('vs-theme — typography', () => {
  test('all 11 TypeTokenIds present in THEME_SPEC.typography', () => {
    for (const id of TYPE_TOKENS) {
      expect(THEME_SPEC.typography[id], `type token: ${id}`).toBeDefined();
    }
    expect(Object.keys(THEME_SPEC.typography).length).toBe(TYPE_TOKENS.length);
  });

  test('displayXl: fontSize=132, lineHeight=121, letterSpacing=-2.64', () => {
    const t = THEME_SPEC.typography.displayXl;
    expect(t.fontSize).toBe(132);
    expect(t.lineHeight).toBe(121);
    expect(t.letterSpacing).toBe(-2.64);
  });

  test('monoHud: fontSize=13, letterSpacing=0.26', () => {
    const t = THEME_SPEC.typography.monoHud;
    expect(t.fontSize).toBe(13);
    expect(t.letterSpacing).toBe(0.26);
  });

  test('smallcap: fontSize=12, letterSpacing=2.64, fontWeight=600', () => {
    const t = THEME_SPEC.typography.smallcap;
    expect(t.fontSize).toBe(12);
    expect(t.letterSpacing).toBe(2.64);
    expect(t.fontWeight).toBe('600');
  });

  test('lede: italic=true', () => {
    expect(THEME_SPEC.typography.lede.italic).toBe(true);
  });
});

describe('vs-theme — spacing', () => {
  test('all 19 SpacingTokenIds present in THEME_SPEC.spacing', () => {
    for (const id of SPACING_TOKENS) {
      expect(THEME_SPEC.spacing[id], `spacing token: ${id}`).toBeDefined();
    }
    expect(Object.keys(THEME_SPEC.spacing).length).toBe(SPACING_TOKENS.length);
  });

  test('hudCornerX=16, hudCornerY=32, hudGap=12', () => {
    expect(THEME_SPEC.spacing.hudCornerX).toBe(16);
    expect(THEME_SPEC.spacing.hudCornerY).toBe(32);
    expect(THEME_SPEC.spacing.hudGap).toBe(12);
  });

  test('panelLgWidth=440, panelMdWidth=420', () => {
    expect(THEME_SPEC.spacing.panelLgWidth).toBe(440);
    expect(THEME_SPEC.spacing.panelMdWidth).toBe(420);
  });

  test('bossBarHeight=8, minibossBarHeight=6, weaponMeterHeight=6', () => {
    expect(THEME_SPEC.spacing.bossBarHeight).toBe(8);
    expect(THEME_SPEC.spacing.minibossBarHeight).toBe(6);
    expect(THEME_SPEC.spacing.weaponMeterHeight).toBe(6);
  });
});
