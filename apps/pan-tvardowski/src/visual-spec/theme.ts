/**
 * VS-S6 — Theme spec: colors, typography, spacing tokens.
 *
 * Boundary discipline: imports ONLY from './types'. Values are re-stated here
 * in spec form, not imported from theme/. This file is the S7 source of truth.
 *
 * NOTES:
 * - theme/typography.ts:72-107 carries six deprecated aliases (h1/h2/h3/body/
 *   caption/xs) that are excluded from TypeTokenId and therefore omitted here.
 *   They will be deleted in VS-S8 cleanup.
 * - colors.ui.cb.{player,hazard,safe} are flattened to 'cb-player'/'cb-hazard'/
 *   'cb-safe' per ColorTokenId. 'hazard' and 'hazardOrange' both map to #E84B2A
 *   — this is intentional (same physical color, two semantic names in theme/).
 */

import type {
  ColorTokenId,
  SpacingTokenId,
  ThemeSpec,
  TypeTokenId,
  TypographyValue,
} from './types';

export const THEME_SPEC: ThemeSpec = {
  colors: {
    gold: '#C9A24A',
    goldDeep: '#8E6F2C',
    crimson: '#D4213D',
    crimsonDeep: '#7A1322',
    hazard: '#E84B2A',
    hazardOrange: '#E84B2A',
    inkBlack: '#0E1A12',
    void: '#050A07',
    parchment: '#E8DCC4',
    parchment2: '#D9C9A8',
    parchmentDim: '#A8997A',
    bogGreen: '#1A2E1F',
    moss: '#243A29',
    verdigris: '#4A7A6A',
    bone: '#C7B89A',
    rust: '#8B3A1F',
    terracotta: '#B05A3C',
    safe: '#6FA66B',
    'cb-player': '#FF8C42',
    'cb-hazard': '#FFD23F',
    'cb-safe': '#4FC3F7',
  } satisfies Record<ColorTokenId, `#${string}`>,

  typography: {
    displayXl: {
      fontFamily: 'EBGaramond_500Medium',
      fontSize: 132,
      fontWeight: '500',
      lineHeight: 121,
      letterSpacing: -2.64,
    },
    displayL: {
      fontFamily: 'EBGaramond_500Medium',
      fontSize: 72,
      fontWeight: '500',
    },
    displayM: {
      fontFamily: 'EBGaramond_500Medium',
      fontSize: 56,
      fontWeight: '500',
    },
    lede: {
      fontFamily: 'EBGaramond_500Medium_Italic',
      fontSize: 28,
      fontWeight: '500',
      italic: true,
    },
    bodyL: {
      fontFamily: 'SourceSans3_400Regular',
      fontSize: 22,
      fontWeight: '400',
    },
    bodyM: {
      fontFamily: 'SourceSans3_400Regular',
      fontSize: 18,
      fontWeight: '400',
    },
    bodyS: {
      fontFamily: 'SourceSans3_400Regular',
      fontSize: 15,
      fontWeight: '400',
    },
    label: {
      fontFamily: 'SourceSans3_700Bold',
      fontSize: 14,
      fontWeight: '700',
    },
    monoHud: {
      fontFamily: 'JetBrainsMono_500Medium',
      fontSize: 13,
      fontWeight: '500',
      letterSpacing: 0.26,
    },
    monoDebug: {
      fontFamily: 'JetBrainsMono_400Regular',
      fontSize: 11,
      fontWeight: '400',
    },
    smallcap: {
      fontFamily: 'SourceSans3_600SemiBold',
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 2.64,
    },
  } satisfies Record<TypeTokenId, TypographyValue>,

  spacing: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 20,
    xxxl: 24,
    hudCornerX: 16,
    hudCornerY: 32,
    hudGap: 12,
    panelLgWidth: 440,
    panelMdWidth: 420,
    panelPadding: 16,
    panelBorderRadius: 6,
    bossBarHeight: 8,
    minibossBarHeight: 6,
    weaponMeterHeight: 6,
    buttonPaddingH: 20,
    buttonPaddingV: 10,
  } satisfies Record<SpacingTokenId, number>,
};

export const fontFamily = {
  serif: 'EBGaramond_500Medium',
  serifItalic: 'EBGaramond_500Medium_Italic',
  sans: 'SourceSans3_400Regular',
  sansSemiBold: 'SourceSans3_600SemiBold',
  sansBold: 'SourceSans3_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

export const UI_COLORS = {
  // ColorTokenId-backed (sourced from THEME_SPEC.colors)
  gold: THEME_SPEC.colors.gold,
  goldDeep: THEME_SPEC.colors.goldDeep,
  crimson: THEME_SPEC.colors.crimson,
  crimsonDeep: THEME_SPEC.colors.crimsonDeep,
  hazard: THEME_SPEC.colors.hazard,
  hazardOrange: THEME_SPEC.colors.hazardOrange,
  inkBlack: THEME_SPEC.colors.inkBlack,
  void: THEME_SPEC.colors.void,
  parchment: THEME_SPEC.colors.parchment,
  parchment2: THEME_SPEC.colors.parchment2,
  parchmentDim: THEME_SPEC.colors.parchmentDim,
  bogGreen: THEME_SPEC.colors.bogGreen,
  moss: THEME_SPEC.colors.moss,
  verdigris: THEME_SPEC.colors.verdigris,
  bone: THEME_SPEC.colors.bone,
  rust: THEME_SPEC.colors.rust,
  terracotta: THEME_SPEC.colors.terracotta,
  safe: THEME_SPEC.colors.safe,
  // Derived aliases (not in ColorTokenId)
  primary: THEME_SPEC.colors.gold,
  secondary: THEME_SPEC.colors.crimson,
  neutralLight: '#E8DCC4' as const,
  neutralMid: '#D9C9A8' as const,
  border: THEME_SPEC.colors.gold,
  lockedBadge: THEME_SPEC.colors.rust,
  bodyBg: 'rgba(14, 26, 18, 0.92)' as const,
  overlay: 'rgba(0, 0, 0, 0.55)' as const,
  tint60: 'rgba(255, 255, 255, 0.6)' as const,
  tint55: 'rgba(255,255,255,0.55)' as const,
  onPrimary: THEME_SPEC.colors.inkBlack,
  backdropModal: 'rgba(14, 26, 18, 0.88)' as const,
  divider: 'rgba(255,255,255,0.06)' as const,
  dividerStrong: 'rgba(255,255,255,0.12)' as const,
  cb: {
    player: THEME_SPEC.colors['cb-player'],
    hazard: THEME_SPEC.colors['cb-hazard'],
    safe: THEME_SPEC.colors['cb-safe'],
  },
} as const;

const { italic: _ledeItalic, ...ledeForRn } = THEME_SPEC.typography.lede;
export const TYPOGRAPHY = {
  displayXl: THEME_SPEC.typography.displayXl,
  displayL: THEME_SPEC.typography.displayL,
  displayM: THEME_SPEC.typography.displayM,
  lede: ledeForRn,
  bodyL: THEME_SPEC.typography.bodyL,
  bodyM: THEME_SPEC.typography.bodyM,
  bodyS: THEME_SPEC.typography.bodyS,
  label: THEME_SPEC.typography.label,
  monoHud: THEME_SPEC.typography.monoHud,
  monoDebug: THEME_SPEC.typography.monoDebug,
  smallcap: THEME_SPEC.typography.smallcap,
} as const;
