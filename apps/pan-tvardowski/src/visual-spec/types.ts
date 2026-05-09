/**
 * Visual spec — typed schema. Authored against, not drawn.
 *
 * **Schema is locked at session #1 of the visual-spec rebuild.** After lock,
 * the only permitted evolutions are: adding optional fields, adding union
 * variants (exhaustive switches checked by tsc), and adding new files. Any
 * rename or type change requires the deprecation cycle described in the plan
 * file `i-looked-at-visual-spec-mighty-anchor.md`.
 *
 * The schema is split LDtk-style:
 *   - **Definitions** — what an entity IS (HullPreset, ShipDef, BulletDef,
 *     WeaponDef, PickupDef, AnimationDef). Reusable, referenced by Id.
 *   - **Instances** — where/how entities APPEAR (ZoneVisualSpec, BossVisualSpec,
 *     HudSpec, OverlaySpec, ScreenSpec). Reference Defs.
 *   - **Foundations** — ThemeSpec, Hex, Pos, Size, Anchor, Inset.
 *
 * Shape primitives (ShapeSpec) are imported from `../shapes` until session #2,
 * after which they live in `@flare-engine/shapes`.
 */

import type { ShapeSpec } from '@flare-engine/shapes';
import type { AmbienceKind, ZoneId } from './zones-palette';

export type EntityId =
  | 'skrzat'
  | 'latawiec'
  | 'czart'
  | 'bies'
  | 'licho'
  | 'strzyga'
  | 'topielec'
  | 'mamuna'
  | 'nocnica'
  | 'poludnica'
  | 'wapierz'
  | 'hound'
  | 'dziwozona'
  | 'moon-wraith'
  | 'rokita'
  | 'leszy'
  | 'nocny-lowca'
  | 'madej'
  | 'smok-krzemionkowski'
  | 'borowy-krol'
  | 'wodnik-wislanny'
  | 'boruta'
  | 'baba-jaga'
  | 'bazyliszek-warszawski'
  | 'mefistofeles'
  | 'lucyper-ksiezycowy'
  | 'kogut-zloty'
  | 'alembik'
  | 'zwierciadlo'
  | 'iskry'
  | 'piorun'
  | 'sol-swiecona'
  | 'znak-pentagramu'
  | 'czarna-ksiega'
  | 'siedmiomilowe-buty'
  | 'amulet-wegrowski'
  | 'koguci-pioro'
  | 'srebrna-tarcza'
  | 'kamien-filozoficzny';

// ============================================================================
// FOUNDATIONS
// ============================================================================

/**
 * CSS-style hex color: `#rrggbb` or `#rrggbbaa`. Validated at runtime by the
 * invariant test against `/^#[0-9A-F]{6}([0-9A-F]{2})?$/i`.
 */
export type Hex = `#${string}`;

/** Position in design coordinates (1080×1920 mobile-portrait reference frame). */
export interface Pos {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly w: number;
  readonly h: number;
}

export type Anchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'mid-left'
  | 'mid-center'
  | 'mid-right'
  | 'bot-left'
  | 'bot-center'
  | 'bot-right';

export interface Inset {
  readonly dx?: number;
  readonly dy?: number;
}

export type PostFxKind = 'bloom' | 'vignette' | 'chrom' | 'flash' | 'crt' | 'grayscale';

export type ExplosionTier = 'chip' | 'pop' | 'burst' | 'detonation' | 'cataclysm';

// ============================================================================
// DEFINITIONS — what entities ARE (referenced by Id)
// ============================================================================

// ---- Hull presets (folio XIIIa: hull + N rect weapons + 1 square engine) ----

export type HullPresetId =
  | 'square'
  | 'triangle'
  | 'circle'
  | 'half-circle'
  | 'quarter-moon'
  | 'eighth-moon'
  | 'trapeze'
  | 'two-triangles'
  | 'donut'
  | 'half-donut';

/**
 * Named hull composition with weapon-hook and engine-hook anchors. All
 * positions are in **hull-local coordinates** (origin = hull center, +y is
 * forward / screen-up).
 *
 * Adding a new HullPreset is data-only: append one entry to
 * `visual-spec/hull-presets.ts`, no engine change.
 */
export interface HullPreset {
  readonly id: HullPresetId;
  /** Body composition — primitives from `@flare-engine/shapes`. */
  readonly shapes: readonly ShapeSpec[];
  /**
   * Weapon mount anchors. Per user's plan:
   *  - I-weapon: front-of-ship (`one`)
   *  - II-weapons: side-mounted at preset-specific lateral offset (`two`)
   * User calibrates exact `Pos` values visually after Session 3 capture render.
   */
  readonly weaponHooks: {
    readonly one: Pos;
    readonly two: readonly [Pos, Pos];
  };
  /** Back-of-ship engine-square anchor. */
  readonly engineHook: Pos;
  /** 0..1 — fraction of engine-square that overlaps the hull body. Default 0.5. */
  readonly engineOverflow: number;
  /** Collision radius in design pixels. */
  readonly bounds: { readonly r: number };
}

// ---- Ship definition --------------------------------------------------------

/**
 * Lean ship spec. Replaces the inline hull+weapons+engine composition in
 * `shape-catalogue.ts` with a hull-preset reference + color overrides. Migration
 * happens in session #3.
 */
export interface ShipDef {
  readonly id: EntityId;
  readonly hullPreset: HullPresetId;
  readonly hullColor: Hex;
  readonly weaponCount: 1 | 2;
  /** Weapon-rect aspect ratio (width:length); preset-driven for visual rhythm. */
  readonly weaponRatio: '1:8' | '1:10' | '1:12';
  readonly weaponColor: Hex;
  readonly engineColor: Hex;
  /** Engine-exhaust trail color (different per ship for silhouette readability). */
  readonly exhaustColor: Hex;
  /** Defaults to `'shatter-3'` if omitted at use site. */
  readonly destruction?: AnimationPresetId;
  readonly glow?: 'friendly' | 'hazard';
  /** Optional outline (e.g. wapierz, leszy). */
  readonly hullStroke?: Hex;
  readonly hullStrokeWidth?: number;
}

// ---- Bullet definition (discriminated by `kind`) ----------------------------

export type BulletKind = 'line' | 'dot' | 'laser' | 'dots' | 'rocket';

export type BulletSpecId = string & { readonly __brand: 'BulletSpecId' };

interface BulletBase {
  readonly id: BulletSpecId;
  /** Visual intensity / brightness multiplier; 0..2 typical. */
  readonly intensity: number;
  readonly fill: Hex;
  readonly glow?: 'friendly' | 'hazard';
}

export interface BulletLineDef extends BulletBase {
  readonly kind: 'line';
  readonly width: number;
  readonly length: number;
}

export interface BulletDotDef extends BulletBase {
  readonly kind: 'dot';
  readonly r: number;
}

export interface BulletLaserDef extends BulletBase {
  readonly kind: 'laser';
  /** Beam width; the ray extends from the muzzle to the screen edge. */
  readonly width: number;
}

export interface BulletDotsDef extends BulletBase {
  readonly kind: 'dots';
  readonly scheme: 'circle' | 'random';
  readonly count: number;
  /** Per-dot radius. */
  readonly r: number;
  /** Cluster spread radius (for `'circle'`) or jitter radius (for `'random'`). */
  readonly spread: number;
}

export interface BulletRocketDef extends BulletBase {
  readonly kind: 'rocket';
  readonly width: number;
  readonly length: number;
  /** Rocket trail particle preset. */
  readonly trail?: AnimationPresetId;
}

export type BulletDef =
  | BulletLineDef
  | BulletDotDef
  | BulletLaserDef
  | BulletDotsDef
  | BulletRocketDef;

// ---- Weapon definition ------------------------------------------------------

export type WeaponSpecId = string & { readonly __brand: 'WeaponSpecId' };

export interface WeaponDef {
  readonly id: WeaponSpecId;
  /** Bullet shape this weapon fires (BulletDef.id). */
  readonly bullet: BulletSpecId;
  /** Shots per second. */
  readonly fireRate: number;
  /** Spread half-angle in degrees (0 = straight). */
  readonly spread: number;
  /** Number of bullets per shot (1 = single, >1 = volley). */
  readonly volley: number;
  /** Damage per bullet. */
  readonly damage: number;
  /** Audio key for fire SFX (resolved by `audio/sfx.ts`). */
  readonly sfxKey: string;
  readonly muzzleFlash?: AnimationPresetId;
}

// ---- Pickup definition ------------------------------------------------------

export type PickupSpecId = string & { readonly __brand: 'PickupSpecId' };

/**
 * What a pickup does when collected. Closed union of known kinds; new kinds
 * are added as new variants (free per stability protocol).
 */
export type PickupEffect =
  | { readonly kind: 'weapon-swap'; readonly weapon: WeaponSpecId }
  | { readonly kind: 'shield'; readonly hits: number }
  | { readonly kind: 'speed-boost'; readonly multiplier: number; readonly durationMs: number }
  | { readonly kind: 'invuln'; readonly durationMs: number }
  | { readonly kind: 'damage-boost'; readonly multiplier: number; readonly durationMs: number }
  | { readonly kind: 'screen-clear' }
  | { readonly kind: 'extra-life' }
  | { readonly kind: 'bomb' }
  | { readonly kind: 'score'; readonly value: number };

export interface PickupDef {
  readonly id: PickupSpecId;
  /** Visual composition (primitives from `@flare-engine/shapes`). */
  readonly shapes: readonly ShapeSpec[];
  readonly effect: PickupEffect;
  /** Pickups are always friendly-glow per folio §5. */
  readonly glow: 'friendly';
}

// ---- Animation preset definition --------------------------------------------

export type AnimationPresetId =
  | 'shatter-3'
  | 'exhaust-pulse'
  | 'muzzle-flash'
  | 'rocket-trail'
  | 'spiral-collapse';

export interface ShatterDef {
  readonly id: 'shatter-3';
  /** Number of fragments the ship breaks into on death. */
  readonly fragments: 3;
  readonly direction: 'random';
  readonly fxTier: ExplosionTier;
}

export interface ExhaustPulseDef {
  readonly id: 'exhaust-pulse';
  /** Pulse frequency in Hz. */
  readonly hz: number;
  readonly minOpacity: number;
  readonly maxOpacity: number;
}

export interface MuzzleFlashDef {
  readonly id: 'muzzle-flash';
  readonly durationMs: number;
  readonly color: Hex;
  readonly r: number;
}

export interface RocketTrailDef {
  readonly id: 'rocket-trail';
  /** Particles emitted per second. */
  readonly emitRate: number;
  readonly color: Hex;
  readonly lifetimeMs: number;
}

export interface SpiralCollapseDef {
  readonly id: 'spiral-collapse';
  readonly turns: number;
  readonly durationMs: number;
}

export type AnimationDef =
  | ShatterDef
  | ExhaustPulseDef
  | MuzzleFlashDef
  | RocketTrailDef
  | SpiralCollapseDef;

// ============================================================================
// INSTANCES — where/how entities APPEAR (reference Defs)
// ============================================================================

// ---- HUD layout (folio IX) --------------------------------------------------

export type HudSlotId =
  | 'score'
  | 'combo'
  | 'zone-banner'
  | 'bombs'
  | 'hp-bar'
  | 'weapon-meter'
  | 'boss-bar'
  | 'miniboss-bar';

/** Token id from `ThemeSpec.typography`. */
export type TypeTokenId =
  | 'displayXl'
  | 'displayL'
  | 'displayM'
  | 'lede'
  | 'bodyL'
  | 'bodyM'
  | 'bodyS'
  | 'label'
  | 'monoHud'
  | 'monoDebug'
  | 'smallcap';

export interface HudSlot {
  readonly id: HudSlotId;
  readonly anchor: Anchor;
  readonly inset?: Inset;
  readonly size?: Size;
  readonly type?: TypeTokenId;
  readonly fg?: Hex;
  readonly bg?: Hex;
  readonly notes?: string;
}

export interface HudSpec {
  readonly slots: readonly HudSlot[];
}

// ---- Overlay layout (folio XI) ----------------------------------------------

export type OverlayId =
  | 'inventory'
  | 'codex-shards'
  | 'achievements'
  | 'shop'
  | 'pause'
  | 'dialogue'
  | 'paywall'
  | 'privacy'
  | 'boot'
  | 'menu';

export type OverlayPanelSize = 'sm' | 'md' | 'lg';

export type OverlaySectionType =
  | 'text'
  | 'list'
  | 'buttons'
  | 'logo'
  | 'progress'
  | 'image'
  | 'tabs'
  | 'grid';

export interface OverlaySection {
  readonly id: string;
  readonly title?: string;
  /** Top-to-bottom order within the panel. */
  readonly order: number;
  readonly type: OverlaySectionType;
  /** If `true`, this section receives focus first when overlay opens. */
  readonly focusFirst?: boolean;
  readonly notes?: string;
}

export interface OverlaySpec {
  readonly id: OverlayId;
  readonly panel: OverlayPanelSize;
  readonly sections: readonly OverlaySection[];
  readonly closeButton?: 'top-right' | 'bot-center' | 'none';
  /** Background dimming alpha 0..1. */
  readonly backdropAlpha?: number;
}

// ---- Frontmatter screens (folio X) ------------------------------------------

export type ScreenId = 'boot' | 'menu' | 'save-select' | 'settings' | 'credits';

export interface ScreenSection {
  readonly id: string;
  readonly title?: string;
  readonly order: number;
  readonly type: OverlaySectionType;
  readonly notes?: string;
}

export interface ScreenSpec {
  readonly id: ScreenId;
  /** Background tokens — driven by ThemeSpec colors at use site. */
  readonly background: {
    readonly sky: Hex;
    readonly ground?: Hex;
    readonly ambience?: { readonly kind: AmbienceKind; readonly count: number };
  };
  readonly sections: readonly ScreenSection[];
  /** What kind of navigation this screen offers (drives back-button + flow). */
  readonly navigation: 'next' | 'choices' | 'back' | 'none';
}

// ---- Background, parallax, ambience (folios XII / XIIB) --------------------

export interface ParallaxLayer {
  readonly id: string;
  /** 0 = static (sky), 1 = locked to camera (foreground). */
  readonly speed: number;
  /** Inline shape composition, 'tilemap' (Tiled .tmj), 'water-shader', or 'fog-shader'. */
  readonly content: 'tilemap' | 'water-shader' | 'fog-shader' | readonly ShapeSpec[];
  readonly tint?: Hex;
  readonly opacity?: number;
}

export interface ZoneBackground {
  readonly sky: Hex;
  readonly ground: Hex;
  readonly accent: Hex;
  readonly hazard: Hex;
  readonly parallax: readonly ParallaxLayer[];
  readonly ambience: { readonly kind: AmbienceKind; readonly count: number };
}

// ---- Boss visual recipe (folios XIII / XIIIf) ------------------------------

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

// ---- Zone instance ----------------------------------------------------------

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
}

// ============================================================================
// THEME — colors, typography, spacing tokens (replaces theme/ in session #6)
// ============================================================================

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
  | 'cb-safe';

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
