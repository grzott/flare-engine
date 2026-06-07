import { Position, Velocity } from '@flare-engine/ecs';
import type { Vec2 } from '@flare-engine/math';
import { Miniboss } from '../../components';
import type { MinibossCtx } from './types';

export const MINIBOSS_HALF_W = 40;
export const DYING_INTERVAL = 0.16;
export const DYING_TOTAL = 10;

export const aim: Vec2 = { x: 0, y: 0 };

export function sweepMove(c: MinibossCtx, speed: number): void {
  const m = c.world.get(c.id, Miniboss);
  const pos = c.world.get(c.id, Position);
  const vel = c.world.get(c.id, Velocity);
  if (!m || !pos || !vel) return;
  vel.x = Math.cos(m.t * 0.9) * speed;
  vel.y = 0;
  if (pos.x < MINIBOSS_HALF_W) {
    pos.x = MINIBOSS_HALF_W;
    vel.x = Math.abs(vel.x);
  } else if (pos.x > c.deps.bounds.width - MINIBOSS_HALF_W) {
    pos.x = c.deps.bounds.width - MINIBOSS_HALF_W;
    vel.x = -Math.abs(vel.x);
  }
}
