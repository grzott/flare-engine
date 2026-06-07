import type { ShapeSpec } from '@flare-engine/shapes';
import type { AmbienceKind, ZoneId } from '../zones-palette';
import type { EntityId, ExplosionTier, Hex, PostFxKind } from './foundations';
import type { HudSpec, TypeTokenId } from './instances-ui';

export type ZoneBgKindId =
  | 'roofs-city'
  | 'forest-canopy'
  | 'river-wave'
  | 'moon-crater'
  | 'cave-interior'
  | 'mountain-hills'
  | 'image';

export type ZoneFxKindId = 'rain' | 'sun-shaft' | 'dark-vignette' | 'clouds';

export type ColorTokenId =
  | 'gold'
  | 'goldDeep'
  | 'crimson'
  | 'crimsonDeep'
  | 'hazard'
  | 'hazardOrange'
  | 'inkBlack'
  | 'void'
  | 'parchment'
  | 'parchment2'
  | 'parchmentDim'
  | 'bogGreen'
  | 'moss'
  | 'verdigris'
  | 'bone'
  | 'rust'
  | 'terracotta'
  | 'safe'
  | 'cb-player'
  | 'cb-hazard'
  | 'cb-safe'
  | 'vistulaBlue'
  | 'foamBlue'
  | 'mistBlue'
  | 'lunarInk'
  | 'katakumbyDark'
  | 'riverDepth'
  | 'marshOlive'
  | 'shadowBlack'
  | 'violetDark'
  | 'violetMid'
  | 'violetDeep'
  | 'darkRed'
  | 'leafGreen'
  | 'waterTeal'
  | 'pale'
  | 'teal'
  | 'silver'
  | 'smokeGrey'
  | 'moonBlue'
  | 'deepBlue'
  | 'straw'
  | 'hellfire'
  | 'eyeYellow'
  | 'brown'
  | 'orange'
  | 'purpleBright'
  | 'white'
  | 'portraitKingGold'
  | 'portraitKingCrownBronze'
  | 'portraitFaceParchment'
  | 'portraitTwardowskiViolet'
  | 'portraitInnkeeperBrown'
  | 'portraitInnkeeperHatDark'
  | 'pitchBrown'
  | 'charcoal'
  | 'hpBarDark'
  | 'crashBg'
  | 'parchmentLight'
  | 'ashGrey'
  | 'crashButtonBg'
  | 'pureBlack'
  | 'violetDeepest'
  | 'violetStrong'
  | 'violetAbyss'
  | 'violetMedium';

export interface ZoneBgShaderDef {
  readonly zoneId: ZoneId;
  readonly kind: Exclude<ZoneBgKindId, 'image'>;
  readonly primaryToken: ColorTokenId;
  readonly secondaryToken: ColorTokenId;
  readonly scrollSpeed: number;
  /**
   * Kind-specific geometry parameter routed by B3's dispatcher:
   * - `roofs-city` → `density` (int, roof tile count)
   * - `forest-canopy` → `density` (int, tree count)
   * - `cave-interior` → `stalactiteCount` (int)
   * - `moon-crater` → `craterCount` (int)
   * - `river-wave` → `waveScale` (float)
   * - `mountain-hills` → `ridgeScale` (float)
   */
  readonly density: number;
}

export interface ZoneBgImageDef {
  readonly zoneId: ZoneId;
  readonly kind: 'image';
  readonly scrollSpeed: number;
}

export type ZoneBgDef = ZoneBgShaderDef | ZoneBgImageDef;

export interface ZoneFxDef {
  readonly zoneId: ZoneId;
  readonly kind: ZoneFxKindId;
  readonly intensity: number;
  /**
   * Angle in degrees (0 = straight down / no lateral drift).
   * `dark-vignette` ignores this field at runtime.
   */
  readonly direction: number;
  readonly speed: number;
  /**
   * Rain tint multiplier packed as [R, G, B] in [0, 1]. Absent → uniform
   * defaults to [1, 1, 1] (neutral white). Only rain zones supply this.
   */
  readonly weatherColor?: readonly [number, number, number];
  /** Fraction of columns carrying a drop, 0..1. Absent → uniform default 0.5. */
  readonly density?: number;
  /** Streak length as lit fraction of each repeat period, 0..1. Absent → uniform default 0.15. */
  readonly streakLen?: number;
}

export interface ParallaxLayer {
  readonly id: string;
  /** 0 = static (sky), 1 = locked to camera (foreground). */
  readonly speed: number;
  /** Inline shape composition, 'tilemap' (Tiled .tmj), 'water-shader', 'fog-shader', or 'fire-shader'. */
  readonly content:
    | 'tilemap'
    | 'water-shader'
    | 'fire-shader'
    | 'fog-shader'
    | readonly ShapeSpec[];
  readonly tint?: Hex;
  readonly opacity?: number;
}

export interface ZoneBackground {
  readonly sky: Hex;
  readonly ground: Hex;
  readonly accent: Hex;
  readonly hazard: Hex;
  readonly parallax: readonly ParallaxLayer[];
}

export interface BossPhaseVisual {
  readonly phase: 1 | 2 | 3;
  readonly accent: Hex;
  readonly bullet: Hex;
  /** Verbatim motif from folio XIII (e.g. 'cone-fire sweeps'). */
  readonly motif: string;
  readonly breakTier: ExplosionTier;
}

export interface BossVisualSpec {
  readonly id: EntityId;
  readonly hpTotal: number;
  readonly phases: readonly BossPhaseVisual[];
  readonly particles: { readonly kind: AmbienceKind; readonly count: number };
  readonly postfx: readonly PostFxKind[];
}

export interface ZoneVisualSpec {
  readonly id: ZoneId;
  readonly nameKey: string;
  readonly bg: ZoneBackground;
  readonly boss: BossVisualSpec;
  readonly miniboss?: BossVisualSpec;
  /**
   * Every entity (enemy, miniboss, boss, pickup) that ever appears in this
   * zone. Filled in session #5 — empty array is the schema-stable placeholder.
   */
  readonly entityIds: readonly EntityId[];
  /** Use only when zone overrides the global HUD (e.g. Z8 silver-UI). */
  readonly hudOverride?: Partial<HudSpec>;
  /** Per-zone postfx tuning. Sub-objects replace the corresponding baseline sub-object wholesale. */
  readonly postfxOverride?: Partial<PostFxPresetDef>;
}

export interface PostFxPresetDef {
  readonly vignette: {
    readonly intensity: number;
    readonly radius: number;
  };
  readonly bloom: {
    readonly threshold: number;
    readonly intensity: number;
  };
  readonly chroma: {
    readonly amount: number;
  };
  readonly crt: {
    readonly scanlineIntensity: number;
    readonly curvature: number;
  };
  readonly flashDecayRate: number;
}

export interface ExplosionTierDef {
  readonly tier: ExplosionTier;
  readonly particles: number;
  readonly lifeMs: number;
  readonly shake?: {
    readonly amp: number;
    readonly durMs: number;
    readonly shakeMode: 'sinusoidal' | 'perlin';
  };
  readonly postfx?: {
    readonly grayscaleMs?: number;
    readonly bloomMs?: number;
    readonly hitFlashDecayRate?: number;
  };
  readonly smokeRatio?: number;
}

export interface TypographyValue {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight: '400' | '500' | '600' | '700' | '800';
  readonly lineHeight?: number;
  readonly letterSpacing?: number;
  readonly italic?: boolean;
}

export type SpacingTokenId =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'xxl'
  | 'xxxl'
  | 'hudCornerX'
  | 'hudCornerY'
  | 'hudGap'
  | 'panelLgWidth'
  | 'panelMdWidth'
  | 'panelPadding'
  | 'panelBorderRadius'
  | 'bossBarHeight'
  | 'minibossBarHeight'
  | 'weaponMeterHeight'
  | 'buttonPaddingH'
  | 'buttonPaddingV';

export interface ThemeSpec {
  readonly colors: Readonly<Record<ColorTokenId, Hex>>;
  readonly typography: Readonly<Record<TypeTokenId, TypographyValue>>;
  readonly spacing: Readonly<Record<SpacingTokenId, number>>;
}
