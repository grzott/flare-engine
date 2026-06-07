import type { ShapeSpec } from '@flare-engine/shapes';
import type { AnimationPresetId } from './definitions-animations';
import type { Hex } from './foundations';

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
