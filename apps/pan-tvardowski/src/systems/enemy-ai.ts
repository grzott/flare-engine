import { Position, Velocity } from '@flare-engine/ecs';
import type { World } from '@flare-engine/engine';
import { Vec2 as V, type Vec2 } from '@flare-engine/math';
import { Enemy } from '../components';
import { BULLET_SPEED } from '../config/gameplay';
import { ENEMY_BEHAVIORS, type EnemyDeps } from './enemy-behaviors';

export type { EnemyDeps } from './enemy-behaviors';

const aim: Vec2 = { x: 0, y: 0 };

/**
 * Advance every enemy by `dt`. Movement + firing is dispatched through the
 * per-pattern registry in `enemy-behaviors.ts` — adding a new enemy pattern
 * does not require any edit here.
 */
export function updateEnemyAI(world: World, dt: number, deps: EnemyDeps): void {
  for (const id of deps.query) {
    const e = world.get(id, Enemy);
    const pos = world.get(id, Position);
    const vel = world.get(id, Velocity);
    if (!e || !pos || !vel) continue;
    e.t += dt;

    const behavior = ENEMY_BEHAVIORS[e.pattern];
    if (!behavior) continue;
    behavior.move(e, pos, vel, dt, deps);

    if (!Number.isFinite(e.fireInterval) || !behavior.fire) continue;
    e.fireCooldown -= dt;
    if (e.fireCooldown <= 0) {
      V.normalizeOut(deps.playerX - pos.x, deps.playerY - pos.y, BULLET_SPEED.enemy, aim);
      behavior.fire(e, pos, aim, deps);
      e.fireCooldown = e.fireInterval;
    }
  }
}
