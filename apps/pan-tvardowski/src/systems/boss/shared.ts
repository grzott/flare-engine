import { Position, Velocity } from '@flare-engine/ecs';
import { Boss } from '../../components';
import type { BossCtx } from './types';

export { clearEnemyBullets } from '../fire-helpers';

export const BOSS_HALF_W = 52;
export const PHASE2_HP_RATIO = 0.5;
export const DYING_INTERVAL = 0.18;
export const DYING_TOTAL = 14;

/** Shared horizontal sweep movement for phase 1 / 2 (and default phase 3). */
export function sweepMove(c: BossCtx, speed: number): void {
  const b = c.world.get(c.id, Boss);
  const pos = c.world.get(c.id, Position);
  const vel = c.world.get(c.id, Velocity);
  if (!b || !pos || !vel) return;
  vel.x = Math.cos(b.t * 1.1) * speed;
  vel.y = 0;
  if (pos.x < BOSS_HALF_W) {
    pos.x = BOSS_HALF_W;
    vel.x = Math.abs(vel.x);
  } else if (pos.x > c.deps.bounds.width - BOSS_HALF_W) {
    pos.x = c.deps.bounds.width - BOSS_HALF_W;
    vel.x = -Math.abs(vel.x);
  }
}
