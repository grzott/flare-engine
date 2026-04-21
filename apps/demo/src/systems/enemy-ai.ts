import type { Query, World } from '@flare-engine/engine';
import { Position, Velocity } from '@flare-engine/engine';
import { Enemy } from '../components';
import { BULLET_SPAWN_OFFSET } from '../config/gameplay';
import { Layer } from '../layers';
import type { SpawnCtx } from '../spawn';
import { spawnBullet } from '../spawn';
import { type Direction2D, normalizeDirection } from '../util/direction';

const ENEMY_BULLET_SPEED = 280;
/** Horizontal velocity spread for aimed enemy bullets (0..1 of base speed). */
const AIM_SPEED_X_RATIO = 0.6;

/** Reused output vector for direction normalization — avoids per-frame allocs. */
const aim: Direction2D = { x: 0, y: 0 };

export interface EnemyDeps {
  spawnCtx: SpawnCtx;
  query: Query;
  playerX: number;
  playerY: number;
}

export function updateEnemyAI(world: World, dt: number, deps: EnemyDeps): void {
  for (const id of deps.query) {
    const e = world.get(id, Enemy);
    const pos = world.get(id, Position);
    const vel = world.get(id, Velocity);
    if (!e || !pos || !vel) continue;

    e.t += dt;

    if (e.pattern === 'straight') {
      vel.x = 0;
      vel.y = e.speed;
    } else if (e.pattern === 'sine') {
      vel.x = Math.cos(e.t * 2.2) * 80;
      vel.y = e.speed;
    } else {
      vel.x = e.baseX > deps.playerX ? -e.speed * 0.4 : e.speed * 0.4;
      vel.y = e.speed;
    }

    e.fireCooldown -= dt;
    if (e.fireCooldown <= 0) {
      normalizeDirection(deps.playerX - pos.x, deps.playerY - pos.y, ENEMY_BULLET_SPEED, aim);
      spawnBullet(
        deps.spawnCtx,
        pos.x,
        pos.y + BULLET_SPAWN_OFFSET.enemy,
        aim.x * AIM_SPEED_X_RATIO,
        aim.y,
        Layer.enemy,
      );
      e.fireCooldown = e.fireInterval;
    }
  }
}
