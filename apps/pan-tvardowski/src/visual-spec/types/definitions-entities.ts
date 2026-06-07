import type { EntityId, Hex } from './foundations';

export type ParticleSpecId = string & { readonly __brand: 'ParticleSpecId' };

export interface ParticleDef {
  readonly id: ParticleSpecId;
  readonly fill: Hex;
  readonly shape: 'circle';
  /** Radius in design pixels. */
  readonly size: number;
  /** Optional lifetime cap in milliseconds. Omit for fire-and-forget. */
  readonly lifetimeMs?: number;
}

export type TileSpecId = string & { readonly __brand: 'TileSpecId' };

export interface TileDef {
  readonly id: TileSpecId;
  readonly size: number;
  readonly baseFill: Hex;
  readonly accent?: {
    readonly fill: Hex;
    readonly pattern: 'ripple-2line';
  };
}

/**
 * One summon entry within a BossLayoutDef.
 * `ox` = lateral spacing between adjacent summons (design px).
 * `oy` = vertical offset from the origin point (design px).
 * `origin` defaults to `'boss'` (offset relative to boss position).
 * `'screen-bottom'` means the Y origin is `bounds.height + oy` (summons enter
 * from below the visible area — used by Wodnik Wiślany Topielec shield minions).
 */
export interface BossLayoutSummon {
  readonly kind: EntityId;
  readonly ox: number;
  readonly oy: number;
  readonly origin?: 'boss' | 'screen-bottom';
}

/**
 * Spawn-layout descriptor for one boss or miniboss.
 * `summons` lists every summon type the boss can produce; the FSM is the
 * authoritative source for timing and count — this def carries geometry only.
 */
export interface BossLayoutDef {
  readonly id: EntityId;
  readonly summons?: readonly BossLayoutSummon[];
}

/**
 * Per-phase sweep + fire-cadence tuning for a 2-phase or 3-phase boss.
 * `sweepSpeed3` / `fire3CooldownSec` are required only when `threePhase` is true.
 */
export interface BossTuningDef {
  readonly id: EntityId;
  readonly sweepSpeed1: number;
  readonly sweepSpeed2: number;
  readonly sweepSpeed3?: number;
  readonly fire1CooldownSec: number;
  readonly fire2CooldownSec: number;
  readonly fire3CooldownSec?: number;
}

/**
 * Tuning def for simple minibosses (Rokita, Nocny Łowca, Madej):
 * a single sweep speed and a single fire cooldown.
 */
export interface MinibossSimpleTuningDef {
  readonly kind: 'simple';
  readonly id: EntityId;
  readonly sweepSpeed: number;
  readonly fireCooldownSec: number;
}

/**
 * Tuning def for Leszy: three per-form fire cooldowns.
 * Sweep speed per form is derived from the FSM (form-branch) — only
 * the fire cadences are data-driven here.
 */
export interface MinibossLeszyTuningDef {
  readonly kind: 'leszy';
  readonly id: EntityId;
  readonly sweepSpeedDeer: number;
  readonly sweepSpeedBear: number;
  readonly sweepSpeedOwl: number;
  readonly fireCooldownDeerSec: number;
  readonly fireCooldownBearSec: number;
  readonly fireCooldownOwlSec: number;
}

export type MinibossTuningDef = MinibossSimpleTuningDef | MinibossLeszyTuningDef;
