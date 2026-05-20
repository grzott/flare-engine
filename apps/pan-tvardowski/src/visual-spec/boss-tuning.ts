import type { BossTuningDef, MinibossTuningDef } from './types';

/**
 * Per-boss sweep speed + fire-cadence tuning.
 * Single source of truth — FSM scripts read from here; values are the same
 * as the formerly-inline literals (pure refactor, zero balance change).
 */
export const BOSS_TUNING_DEFS = {
  'smok-krzemionkowski': {
    id: 'smok-krzemionkowski',
    sweepSpeed1: 80,
    sweepSpeed2: 140,
    fire1CooldownSec: 0.5,
    fire2CooldownSec: 1.1,
  },
  'borowy-krol': {
    id: 'borowy-krol',
    sweepSpeed1: 60,
    sweepSpeed2: 110,
    fire1CooldownSec: 0.7,
    fire2CooldownSec: 0.55,
  },
  'wodnik-wislanny': {
    id: 'wodnik-wislanny',
    sweepSpeed1: 70,
    sweepSpeed2: 95,
    fire1CooldownSec: 0.45,
    fire2CooldownSec: 0.9,
  },
  boruta: {
    id: 'boruta',
    sweepSpeed1: 55,
    sweepSpeed2: 90,
    fire1CooldownSec: 0.22,
    fire2CooldownSec: 0.7,
  },
  'baba-jaga': {
    id: 'baba-jaga',
    sweepSpeed1: 50,
    sweepSpeed2: 120,
    sweepSpeed3: 35,
    fire1CooldownSec: 0.85,
    fire2CooldownSec: 0.6,
    fire3CooldownSec: 0.18,
  },
  'bazyliszek-warszawski': {
    id: 'bazyliszek-warszawski',
    sweepSpeed1: 45,
    sweepSpeed2: 80,
    sweepSpeed3: 25,
    fire1CooldownSec: 0.7,
    fire2CooldownSec: 0.55,
    fire3CooldownSec: 0.22,
  },
  mefistofeles: {
    id: 'mefistofeles',
    sweepSpeed1: 55,
    sweepSpeed2: 80,
    sweepSpeed3: 40,
    fire1CooldownSec: 1.4,
    fire2CooldownSec: 0.9,
    fire3CooldownSec: 0.9,
  },
  'lucyper-ksiezycowy': {
    id: 'lucyper-ksiezycowy',
    sweepSpeed1: 60,
    sweepSpeed2: 90,
    sweepSpeed3: 110,
    fire1CooldownSec: 1.3,
    fire2CooldownSec: 0.85,
    fire3CooldownSec: 0.55,
  },
} as const satisfies Record<string, BossTuningDef>;

/**
 * Per-miniboss sweep speed + fire-cadence tuning.
 * Rokita / Nocny Łowca / Madej use the `'simple'` variant.
 * Leszy uses the `'leszy'` variant with per-form cooldowns.
 */
export const MINIBOSS_TUNING_DEFS = {
  rokita: {
    kind: 'simple',
    id: 'rokita',
    sweepSpeed: 55,
    fireCooldownSec: 1.1,
  },
  leszy: {
    kind: 'leszy',
    id: 'leszy',
    sweepSpeedDeer: 95,
    sweepSpeedBear: 35,
    sweepSpeedOwl: 130,
    fireCooldownDeerSec: 0.8,
    fireCooldownBearSec: 1.3,
    fireCooldownOwlSec: 1.6,
  },
  'nocny-lowca': {
    kind: 'simple',
    id: 'nocny-lowca',
    sweepSpeed: 120,
    fireCooldownSec: 0.9,
  },
  madej: {
    kind: 'simple',
    id: 'madej',
    sweepSpeed: 50,
    fireCooldownSec: 1.1,
  },
} as const satisfies Record<string, MinibossTuningDef>;
