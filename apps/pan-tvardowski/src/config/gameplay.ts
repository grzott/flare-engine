import type { EnemyPattern } from '../components';

/**
 * Balance freeze date — `YYYY-MM-DD`. After this date, edits to this file are
 * blocked by `scripts/check-balance-freeze.sh` unless `ALLOW_BALANCE_CHANGE=1`
 * is set in the environment. Bump only with intent (post-launch balance pass).
 */
export const BALANCE_FROZEN_AT = '2026-04-28';

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
  nocnica: {
    frame: 'nocnica',
    hp: 2,
    score: 200,
    speed: 220,
    fireInterval: 3.0,
  },
  dziwozona: {
    frame: 'dziwozona',
    hp: 4,
    score: 300,
    speed: 45,
    fireInterval: Number.POSITIVE_INFINITY,
  },
  wapierz: {
    frame: 'wapierz',
    hp: 8,
    score: 420,
    speed: 55,
    fireInterval: 1.8,
  },
  poludnica: {
    frame: 'poludnica',
    hp: 5,
    score: 360,
    speed: 40,
    fireInterval: 2.2,
  },
  hound: {
    frame: 'hound',
    hp: 3,
    score: 0,
    speed: 170,
    fireInterval: Number.POSITIVE_INFINITY,
  },
  'moon-wraith': {
    frame: 'moon-wraith',
    hp: 2,
    score: 200,
    speed: 160,
    fireInterval: 2.2,
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

/** Baba Jaga HP per phase (build plan §9). */
export const BABA_JAGA_PHASE_HP = 500;
export const BABA_JAGA_HP_MAX = BABA_JAGA_PHASE_HP * 3;

/** Seconds before the Zone-5 boss (Baba Jaga) enters (§5 length = 5:00). */
export const ZONE5_BOSS_T = 260;

/** HP ratio threshold at which 3-phase bosses transition phase2 → phase3. */
export const PHASE3_HP_RATIO = 1 / 3;

/** HP ratio threshold at which 3-phase bosses transition phase1 → phase2 (2/3 gate). */
export const THREE_PHASE_P2_RATIO = 2 / 3;

/** Dziwożona splits into this many Skrzats on death (build plan §7 “spawns 2 Skrzats on death”). */
export const DZIWOZONA_SKRZAT_SPAWN = 2;

/** Nocny Łowca miniboss HP (build plan §8). */
export const NOCNY_LOWCA_HP = 250;

/** Number of homing hounds Nocny Łowca keeps in the arena. */
export const NOCNY_LOWCA_HOUND_COUNT = 4;

/** Bazyliszek Warszawski HP per phase (build plan §9). */
export const BAZYLISZEK_PHASE_HP = 600;
export const BAZYLISZEK_HP_MAX = BAZYLISZEK_PHASE_HP * 3;

/** Seconds before the Zone-6 miniboss (Nocny Łowca) enters (§5 length = 5:30). */
export const ZONE6_MINIBOSS_T = 100;
/** Seconds before the Zone-6 boss (Bazyliszek Warszawski) enters. */
export const ZONE6_BOSS_T = 290;

/** Bazyliszek phase-3 teleport cadence (seconds between relocations). */
export const BAZYLISZEK_TELEPORT_SEC = 3;

/** Venom puddle persistence (seconds) — Bazyliszek phase 2. */
export const BAZYLISZEK_PUDDLE_LIFETIME_SEC = 4;

/** Player speed multiplier while Bazyliszek phase-1 stone-gaze is active. */
export const BAZYLISZEK_GAZE_SPEED_MUL = 0.55;

/** Madej miniboss HP (build plan §8). */
export const MADEJ_HP = 300;

/** Madej spike-lane cadence: spawns a vertical hazard on one of 3 columns. */
export const MADEJ_SPIKE_SEC = 3.2;

/** Madej aimed heavy fire cadence (between spike-lane drops). */
export const MADEJ_FIRE_COOLDOWN = 1.1;

/** Madej spike hazard lifetime (a slow downward drifting enemy bullet). */
export const MADEJ_SPIKE_LIFETIME_SEC = 2.6;

/** Mefistofeles HP per phase (build plan §9, 700/700/700). */
export const MEFISTOFELES_PHASE_HP = 700;
export const MEFISTOFELES_HP_MAX = MEFISTOFELES_PHASE_HP * 3;

/** Mefistofeles phase-2 fire-pit drop cadence. */
export const MEFISTOFELES_FIREPIT_SEC = 2.4;

/** Mefistofeles phase-2 fire-pit lifetime (persistent ground hazard). */
export const MEFISTOFELES_FIREPIT_LIFETIME_SEC = 5;

/** Mefistofeles phase-3 mirror-twin downward fire cadence. */
export const MEFISTOFELES_TWIN_FIRE = 0.6;

/** Mefistofeles phase-3 mirror-twin vertical offset from player y. */
export const MEFISTOFELES_TWIN_Y_OFFSET = -40;

/** Seconds before the Zone-7 miniboss (Madej) enters (§5 length = 6:00). */
export const ZONE7_MINIBOSS_T = 105;
/** Seconds before the Zone-7 boss (Mefistofeles) enters. */
export const ZONE7_BOSS_T = 300;

/** Lucyper Księżycowy HP per phase (build plan §9, 800/800/800). */
export const LUCYPER_PHASE_HP = 800;
export const LUCYPER_HP_MAX = LUCYPER_PHASE_HP * 3;

/** Lucyper phase-3: seconds between shattered-mirror pattern rotations. */
export const LUCYPER_SHATTER_CYCLE = 3.2;

/** Seconds before the Zone-8 boss (Lucyper Księżycowy) enters (§5 length = 6:30). */
export const ZONE8_BOSS_T = 340;

// ---- Weapon ids ----

export type WeaponId = 'iskry' | 'piorun' | 'sol-swiecona' | 'znak-pentagramu';

// ---- Collider scale factors (AABB vs sprite frame) --------------------------
// These are geometry constants, not balance — they don't affect game feel
// directly, only collision fairness. BALANCE_FROZEN_AT does not apply.

/** Default AABB scale for regular enemies (width × height). */
export const COLLIDER_SCALE_ENEMY = 0.7;

/** Default AABB scale for mini-bosses. Slightly tighter than boss to reflect
 *  their mid-weight role and give the player a bit more room to manoeuvre. */
export const COLLIDER_SCALE_MINIBOSS = 0.85;

/** Default AABB scale for bosses. Larger than enemy/miniboss — bosses are
 *  slower so a bigger hitbox keeps combat fair at phone resolution. */
export const COLLIDER_SCALE_BOSS = 0.9;
