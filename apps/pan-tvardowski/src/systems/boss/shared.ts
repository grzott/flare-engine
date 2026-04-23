import { Position, Velocity } from '@flare-engine/ecs';
import { Boss, Bullet } from '../../components';
import { Layer } from '../../layers';
import { destroyEntity } from '../entity-ops';
import type { BossCtx } from './types';

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

/** Clear every live enemy-bullet — used between phase transitions. */
export function clearEnemyBullets(c: BossCtx): void {
  const toDrop: number[] = [];
  const q = c.world.query(Bullet);
  for (const bid of q) {
    const b = c.world.get(bid, Bullet);
    if (b && b.ownerLayer === Layer.enemy) toDrop.push(bid);
  }
  for (const id of toDrop) destroyEntity(c.world, c.deps.spawnCtx.coll, id);
}
