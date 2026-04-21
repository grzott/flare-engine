import type { EnemyPattern } from '../components';

export interface EnemySpec {
  /** Sprite atlas frame name. */
  frame: string;
  /** Starting / max HP. */
  hp: number;
  /** Score awarded on kill. */
  score: number;
  /** Linear movement speed (px/sec) applied by the AI system. */
  speed: number;
}

/**
 * Per-pattern enemy spec. Replaces the ternary chains in `spawn.ts`.
 * Extend here instead of editing spawn logic when adding new enemy kinds.
 */
export const ENEMY_SPECS: Record<EnemyPattern, EnemySpec> = {
  straight: { frame: 'enemy-a', hp: 1, score: 100, speed: 130 },
  sine: { frame: 'enemy-b', hp: 2, score: 120, speed: 130 },
  diagonal: { frame: 'enemy-c', hp: 1, score: 150, speed: 90 },
};
