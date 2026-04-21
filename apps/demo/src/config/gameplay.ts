/** Gameplay tuning constants shared across systems and scenes. */

/** Boss starting / max HP. */
export const BOSS_HP_MAX = 40;

/** Padding past the play-field bounds before an entity is culled. */
export const OFFSCREEN_PAD = 60;

/** Y-offset (relative to owner position) where bullets spawn by owner kind. */
export const BULLET_SPAWN_OFFSET = {
  player: -20,
  enemy: 16,
  boss: 32,
} as const;

/** Epsilon for bomb-flash alpha equality checks — avoids redundant re-renders. */
export const ALPHA_EPSILON = 0.001;

/** Window (sec) during which 3 taps on the title enter the bench easter egg. */
export const TRIPLE_TAP_WINDOW = 0.6;

/** Seconds a scene locks input after entry so trailing touches don't leak in. */
export const SCENE_ARM_DURATION = 0.2;
