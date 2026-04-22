import type { Query, World } from '@flare-engine/engine';
import { Position, Velocity } from '@flare-engine/engine';
import { Enemy } from '../components';
import { BULLET_SPAWN_OFFSET, BULLET_SPEED } from '../config/gameplay';
import { Layer } from '../layers';
import { type SpawnCtx, spawnBullet } from '../spawn';
import { type Direction2D, normalizeDirection } from '../util/direction';

const aim: Direction2D = { x: 0, y: 0 };

export interface EnemyDeps {
  spawnCtx: SpawnCtx;
  query: Query;
  playerX: number;
  playerY: number;
}

/**
 * Zone-1 enemy AI:
 *  - skrzat: zig-zag sine kamikaze (fires nothing).
 *  - latawiec: straight dive + aimed single shot every `fireInterval` s.
 */
export function updateEnemyAI(world: World, dt: number, deps: EnemyDeps): void {
  for (const id of deps.query) {
    const e = world.get(id, Enemy);
    const pos = world.get(id, Position);
    const vel = world.get(id, Velocity);
    if (!e || !pos || !vel) continue;
    e.t += dt;

    if (e.pattern === 'skrzat') {
      vel.x = Math.cos(e.t * 3.2) * 90;
      vel.y = e.speed;
    } else {
      vel.x = 0;
      vel.y = e.speed;
    }

    if (!Number.isFinite(e.fireInterval)) continue;
    e.fireCooldown -= dt;
    if (e.fireCooldown <= 0) {
      normalizeDirection(deps.playerX - pos.x, deps.playerY - pos.y, BULLET_SPEED.enemy, aim);
      spawnBullet(
        deps.spawnCtx,
        pos.x,
        pos.y + BULLET_SPAWN_OFFSET.enemy,
        aim.x * 0.6,
        aim.y,
        Layer.enemy,
      );
      e.fireCooldown = e.fireInterval;
    }
  }
}
