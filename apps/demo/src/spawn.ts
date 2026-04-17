import { type SkImageLike, type SpriteSheet, getFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position, Velocity } from '@flare-engine/ecs';
import { AABB, type CollisionWorld } from '@flare-engine/physics';
import { Sprite } from '@flare-engine/render';
import { Boss, Bullet, Enemy, type EnemyPattern, Hp, Lifetime, Ship } from './components';
import { Layer, Mask } from './layers';

export interface AtlasHandle {
  image: SkImageLike;
  sheet: SpriteSheet;
}

export interface SpawnCtx {
  world: World;
  coll: CollisionWorld;
  atlas: AtlasHandle;
}

function frame(sheet: SpriteSheet, name: string) {
  const f = getFrame(sheet, name);
  if (!f) throw new Error(`missing sprite frame: ${name}`);
  return f;
}

export function spawnPlayer(ctx: SpawnCtx, x: number, y: number): number {
  const { world, coll, atlas } = ctx;
  const id = world.spawn();
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Sprite, { image: atlas.image, frame: frame(atlas.sheet, 'player'), z: 10 });
  world.add(id, Ship, { fireRate: 0.18, cooldown: 0 });
  world.add(id, Hp, { current: 3, max: 3 });
  coll.add(id, AABB(28, 28), x, y, false, Layer.player, Mask.player);
  return id;
}

export function spawnEnemy(ctx: SpawnCtx, pattern: EnemyPattern, x: number, y: number): number {
  const { world, coll, atlas } = ctx;
  const id = world.spawn();
  const frameName = pattern === 'sine' ? 'enemy-b' : pattern === 'diagonal' ? 'enemy-c' : 'enemy-a';
  const hp = pattern === 'sine' ? 2 : 1;
  const score = pattern === 'diagonal' ? 150 : pattern === 'sine' ? 120 : 100;
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Sprite, { image: atlas.image, frame: frame(atlas.sheet, frameName), z: 8 });
  world.add(id, Enemy, {
    pattern,
    t: 0,
    baseX: x,
    speed: pattern === 'diagonal' ? 90 : 130,
    scoreValue: score,
    fireInterval: 2.4,
    fireCooldown: 1.2 + Math.random(),
  });
  world.add(id, Hp, { current: hp, max: hp });
  coll.add(id, AABB(24, 24), x, y, false, Layer.enemy, Mask.enemy);
  return id;
}

export function spawnBoss(ctx: SpawnCtx, x: number, y: number, hpMax: number): number {
  const { world, coll, atlas } = ctx;
  const id = world.spawn();
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Sprite, { image: atlas.image, frame: frame(atlas.sheet, 'boss'), z: 9 });
  world.add(id, Boss, {
    phase: 'entering',
    t: 0,
    phaseT: 0,
    fireCooldown: 1.5,
    dyingExplosions: 0,
    targetY: 90,
  });
  world.add(id, Hp, { current: hpMax, max: hpMax });
  coll.add(id, AABB(88, 56), x, y, false, Layer.enemy, Mask.enemy);
  return id;
}

export function spawnBullet(
  ctx: SpawnCtx,
  x: number,
  y: number,
  vx: number,
  vy: number,
  ownerLayer: number,
): number {
  const { world, coll, atlas } = ctx;
  const id = world.spawn();
  const isPlayer = ownerLayer === Layer.player;
  const name = isPlayer ? 'bullet-player' : 'bullet-enemy';
  const mask = isPlayer ? Mask.playerBullet : Mask.enemyBullet;
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: vx, y: vy });
  world.add(id, Sprite, { image: atlas.image, frame: frame(atlas.sheet, name), z: 6 });
  world.add(id, Bullet, { damage: 1, ownerLayer });
  world.add(id, Lifetime, { remaining: 3 });
  coll.add(
    id,
    AABB(6, 14),
    x,
    y,
    true,
    ownerLayer === Layer.player ? Layer.playerBullet : Layer.enemyBullet,
    mask,
  );
  return id;
}
