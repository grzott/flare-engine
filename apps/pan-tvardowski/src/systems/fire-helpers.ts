import { Position } from '@flare-engine/ecs';
import type { World } from '@flare-engine/engine';
import { Vec2 as V, type Vec2 } from '@flare-engine/math';
import { Boss, Bullet } from '../components';
import { BULLET_SPAWN_OFFSET, BULLET_SPEED } from '../config/gameplay';
import { Layer } from '../layers';
import { type SpawnCtx, spawnBullet } from '../spawn';
import type { BossCtx } from './boss/types';
import { destroyEntity } from './entity-ops';

export interface FireCtx {
  world: World;
  id: number;
  deps: { playerX: number; playerY: number; spawnCtx: SpawnCtx };
}

const aim: Vec2 = { x: 0, y: 0 };

export function fireRadial(c: BossCtx, rays: number, spinRate: number, speedMul = 1): void {
  const pos = c.world.get(c.id, Position);
  const b = c.world.get(c.id, Boss);
  if (!pos || !b) return;
  const spin = b.t * spinRate;
  for (let i = 0; i < rays; i++) {
    const a = spin + (i / rays) * Math.PI * 2;
    spawnBullet(
      c.deps.spawnCtx,
      pos.x,
      pos.y,
      Math.cos(a) * BULLET_SPEED.boss * speedMul,
      Math.sin(a) * BULLET_SPEED.boss * speedMul,
      Layer.enemy,
    );
  }
}

export function fireAimedFan(c: FireCtx, count: number, spread: number, speedMul = 1): void {
  const pos = c.world.get(c.id, Position);
  if (!pos) return;
  // Magnitude includes speedMul (not just BULLET_SPEED.boss): atan2 is
  // scale-invariant in real math but not in IEEE-754, so normalizing to the
  // exact magnitude each per-boss caller used keeps the base angle bit-identical.
  V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss * speedMul, aim);
  const base = Math.atan2(aim.y, aim.x);
  const half = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    const a = base + (i - half) * spread;
    spawnBullet(
      c.deps.spawnCtx,
      pos.x,
      pos.y + BULLET_SPAWN_OFFSET.boss,
      Math.cos(a) * BULLET_SPEED.boss * speedMul,
      Math.sin(a) * BULLET_SPEED.boss * speedMul,
      Layer.enemy,
    );
  }
}

export function clearEnemyBullets(c: FireCtx): void {
  const toDrop: number[] = [];
  const q = c.world.query(Bullet);
  for (const bid of q) {
    const b = c.world.get(bid, Bullet);
    if (b && b.ownerLayer === Layer.enemy) toDrop.push(bid);
  }
  for (const id of toDrop) destroyEntity(c.world, c.deps.spawnCtx.coll, id);
}
