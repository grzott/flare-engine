import type { EnemyPattern } from '../components';

export interface EnemySpec {
  frame: string;
  hp: number;
  score: number;
  speed: number;
  fireInterval: number;
}

/** Zone-1 + Zone-2 enemy specs (build plan §7). */
export const ENEMY_SPECS: Record<EnemyPattern, EnemySpec> = {
  skrzat: {
    frame: 'skrzat',
    hp: 1,
    score: 100,
    speed: 150,
    fireInterval: Number.POSITIVE_INFINITY,
  },
  latawiec: {
    frame: 'latawiec',
    hp: 2,
    score: 150,
    speed: 140,
    fireInterval: 1.8,
  },
  czart: {
    frame: 'czart',
    hp: 3,
    score: 220,
    speed: 120,
    fireInterval: 2.1,
  },
  bies: {
    frame: 'bies',
    hp: 2,
    score: 180,
    speed: 100,
    fireInterval: 1.6,
  },
  topielec: {
    frame: 'topielec',
    hp: 4,
    score: 260,
    speed: -120,
    fireInterval: 2.0,
  },
  strzyga: {
    frame: 'strzyga',
    hp: 3,
    score: 220,
    speed: 130,
    fireInterval: 1.9,
  },
  mamuna: {
    frame: 'mamuna',
    hp: 3,
    score: 240,
    speed: 60,
    fireInterval: 1.4,
  },
  licho: {
    frame: 'licho',
    hp: 4,
    score: 320,
    speed: 70,
    fireInterval: 2.6,
  },
};

export const BULLET_SPEED = {
  player: 520,
  enemy: 260,
  boss: 240,
};

export const BULLET_SPAWN_OFFSET = {
  player: -20,
  enemy: 16,
  boss: 36,
};

/** Smok Krzemionkowski HP per phase (build plan §9). */
export const SMOK_PHASE_HP = 400;
export const SMOK_HP_MAX = SMOK_PHASE_HP * 2;

/** Borowy Król HP per phase (build plan §9). */
export const BOROWY_PHASE_HP = 500;
export const BOROWY_HP_MAX = BOROWY_PHASE_HP * 2;

/** Rokita miniboss HP (build plan §8). */
export const ROKITA_HP = 150;

/** Wodnik Wiślany HP per phase (build plan §9). */
export const WODNIK_PHASE_HP = 600;
export const WODNIK_HP_MAX = WODNIK_PHASE_HP * 2;

/** How many shield minions Wodnik spawns each time the bubble re-raises. */
export const WODNIK_SHIELD_MINIONS = 4;

/** Seconds between shield rebuilds after all minions die. */
export const WODNIK_SHIELD_REBUILD_SEC = 5;

/** Padding past the play-field before an entity is culled. */
export const OFFSCREEN_PAD = 64;

/** Starting bombs for Kogut Złoty (base 2 + starter-ship bonus +1). */
export const START_BOMBS = 3;

/** Player max HP. */
export const PLAYER_HP_MAX = 100;

/** Seconds before the Zone-1 boss enters (§5 length = 3:00). */
export const BOSS_SPAWN_T = 150;
/** Seconds before the Zone-2 miniboss (Rokita) enters (§5 length = 3:30). */
export const ZONE2_MINIBOSS_T = 90;
/** Seconds before the Zone-2 boss (Borowy Król) enters. */
export const ZONE2_BOSS_T = 200;
/** Seconds before the Zone-3 boss (Wodnik Wiślany) enters (§5 length = 4:00). */
export const ZONE3_BOSS_T = 220;

/** Leszy miniboss HP (build plan §8). */
export const LESZY_HP = 200;

/** Seconds per Leszy form before shape-shifting to the next (build plan §8). */
export const LESZY_FORM_SEC = 10;

/** Boruta HP per phase (build plan §9). */
export const BORUTA_PHASE_HP = 700;
export const BORUTA_HP_MAX = BORUTA_PHASE_HP * 2;

/** Number of Bies summoned when Boruta enters phase 2 (build plan §9). */
export const BORUTA_SUMMON_COUNT = 3;

/** Seconds before the Zone-4 miniboss (Leszy) enters (§5 length = 4:30). */
export const ZONE4_MINIBOSS_T = 100;
/** Seconds before the Zone-4 boss (Boruta) enters. */
export const ZONE4_BOSS_T = 230;

/** Licho teleport-blink cadence (seconds). */
export const LICHO_BLINK_SEC = 1.8;
