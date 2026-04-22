import type { EnemyPattern } from '../components';

export interface EnemySpec {
  frame: string;
  hp: number;
  score: number;
  speed: number;
  fireInterval: number;
}

/** Zone-1 enemy specs (build plan §7). */
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

/** Padding past the play-field before an entity is culled. */
export const OFFSCREEN_PAD = 64;

/** Starting bombs for Kogut Złoty (base 2 + starter-ship bonus +1). */
export const START_BOMBS = 3;

/** Player max HP. */
export const PLAYER_HP_MAX = 100;

/** Seconds before the boss enters (Zone 1 length per §5 is 3:00). */
export const BOSS_SPAWN_T = 150;
