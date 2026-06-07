import type { ExplosionTier, Hex } from './foundations';

export type AnimationPresetId =
  | 'shatter-3'
  | 'exhaust-pulse'
  | 'sigil-pulse'
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
  readonly inwardEasing?: string;
  readonly scaleFrom?: number;
  readonly scaleTo?: number;
  readonly alphaFrom?: number;
  readonly alphaTo?: number;
}

export interface SigilPulseDef {
  readonly id: 'sigil-pulse';
  /** Pulse frequency in Hz. 1/hz gives the full cycle period in seconds. */
  readonly hz: number;
  readonly minOpacity: number;
  readonly maxOpacity: number;
}

export type AnimationDef =
  | ShatterDef
  | ExhaustPulseDef
  | SigilPulseDef
  | MuzzleFlashDef
  | RocketTrailDef
  | SpiralCollapseDef;
