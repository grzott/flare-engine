import type { Query, World } from '@flare-engine/engine';
import { Position, Velocity } from '@flare-engine/engine';
import { Enemy } from '../components';
import { Layer } from '../layers';
import type { SpawnCtx } from '../spawn';
import { spawnBullet } from '../spawn';

const ENEMY_BULLET_SPEED = 280;

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
      const dx = deps.playerX - pos.x;
      const dy = deps.playerY - pos.y;
      const mag = Math.hypot(dx, dy) || 1;
      const vx = (dx / mag) * ENEMY_BULLET_SPEED * 0.6;
      const vy = (dy / mag) * ENEMY_BULLET_SPEED;
      spawnBullet(deps.spawnCtx, pos.x, pos.y + 16, vx, vy, Layer.enemy);
      e.fireCooldown = e.fireInterval;
    }
  }
}
