import { type SpriteSheet, getFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position, Velocity } from '@flare-engine/ecs';
import { AABB, type CollisionWorld } from '@flare-engine/physics';
import { Sprite } from '@flare-engine/render';
import type { SkImage } from '@shopify/react-native-skia';
import {
  Boss,
  type BossPattern,
  Bullet,
  Enemy,
  type EnemyPattern,
  Hp,
  Lifetime,
  Miniboss,
  type MinibossPattern,
  Ship,
} from './components';
import {
  COLLIDER_SCALE_BOSS,
  COLLIDER_SCALE_ENEMY,
  COLLIDER_SCALE_MINIBOSS,
  ENEMY_SPECS,
} from './config/gameplay';
import { Layer, Mask } from './layers';

export interface AtlasHandle {
  image: SkImage;
  sheet: SpriteSheet;
}

export interface SpawnCtx {
  world: World;
  coll: CollisionWorld;
  atlas: AtlasHandle;
}

/** Shared anchor reference — every entity pivots around its centre so that
 *  Position, physics AABBs and visuals line up (shmup convention). */
const CENTER_ANCHOR = { x: 0.5, y: 0.5 };

function frame(sheet: SpriteSheet, name: string) {
  const f = getFrame(sheet, name);
  if (!f) throw new Error(`pan-tvardowski: missing sprite frame "${name}"`);
  return f;
}

export function spawnPlayer(ctx: SpawnCtx, x: number, y: number): number {
  const { world, coll, atlas } = ctx;
  const id = world.spawn();
  const f = frame(atlas.sheet, 'kogut-zloty');
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Sprite, {
    image: atlas.image,
    frame: f,
    z: 10,
    anchor: CENTER_ANCHOR,
  });
  world.add(id, Ship, { fireRate: 0.18, cooldown: 0 });
  world.add(id, Hp, { current: 100, max: 100 });
  coll.add(id, AABB(f.w * 0.6, f.h * 0.6), x, y, false, Layer.player, Mask.player);
  return id;
}

export function spawnEnemy(
  ctx: SpawnCtx,
  pattern: EnemyPattern,
  x: number,
  y: number,
  seed: number,
): number {
  const { world, coll, atlas } = ctx;
  const spec = ENEMY_SPECS[pattern];
  const id = world.spawn();
  const f = frame(atlas.sheet, spec.frame);
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Sprite, {
    image: atlas.image,
    frame: f,
    z: 8,
    anchor: CENTER_ANCHOR,
  });
  world.add(id, Enemy, {
    pattern,
    t: 0,
    baseX: x,
    speed: spec.speed,
    scoreValue: spec.score,
    fireInterval: spec.fireInterval,
    // Deterministic offset (0..fireInterval) seeded by the entity's spawn index.
    fireCooldown: Number.isFinite(spec.fireInterval)
      ? spec.fireInterval * 0.3 + (seed % 17) * 0.05
      : Number.POSITIVE_INFINITY,
    // Licho teleport interval; harmless for other patterns.
    blinkT: pattern === 'licho' ? 1.8 : 0,
  });
  world.add(id, Hp, { current: spec.hp, max: spec.hp });
  coll.add(
    id,
    AABB(f.w * COLLIDER_SCALE_ENEMY, f.h * COLLIDER_SCALE_ENEMY),
    x,
    y,
    false,
    Layer.enemy,
    Mask.enemy,
  );
  return id;
}

export function spawnBoss(
  ctx: SpawnCtx,
  pattern: BossPattern,
  x: number,
  y: number,
  hpMax: number,
  /** Per-entity AABB scale override. Defaults to COLLIDER_SCALE_BOSS (0.9). */
  colliderScale?: number,
): number {
  const { world, coll, atlas } = ctx;
  const scale = colliderScale ?? COLLIDER_SCALE_BOSS;
  const id = world.spawn();
  const f = frame(atlas.sheet, pattern);
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Sprite, {
    image: atlas.image,
    frame: f,
    z: 9,
    anchor: CENTER_ANCHOR,
  });
  world.add(id, Boss, {
    pattern,
    phase: 'entering',
    t: 0,
    phaseT: 0,
    fireCooldown: 1.5,
    dyingExplosions: 0,
    targetY: 100,
    shieldActive: false,
    minionsAlive: 0,
    shieldDownFor: 0,
    summonsSpawned: 0,
    teleportT: 0,
    twinId: -1,
    firepitCooldown: 0,
    shatterIdx: 0,
    shatterT: 0,
  });
  world.add(id, Hp, { current: hpMax, max: hpMax });
  coll.add(id, AABB(f.w * scale, f.h * scale), x, y, false, Layer.enemy, Mask.enemy);
  return id;
}

export function spawnMiniboss(
  ctx: SpawnCtx,
  pattern: MinibossPattern,
  x: number,
  y: number,
  hpMax: number,
): number {
  const { world, coll, atlas } = ctx;
  const id = world.spawn();
  const f = frame(atlas.sheet, pattern);
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Sprite, {
    image: atlas.image,
    frame: f,
    z: 9,
    anchor: CENTER_ANCHOR,
  });
  world.add(id, Miniboss, {
    pattern,
    phase: 'entering',
    t: 0,
    phaseT: 0,
    fireCooldown: 1.2,
    dyingExplosions: 0,
    targetY: 110,
    rootProgress: 0,
    form: 'deer',
    formT: 0,
    hounds: 0,
    spikeIndex: 0,
  });
  world.add(id, Hp, { current: hpMax, max: hpMax });
  coll.add(
    id,
    AABB(f.w * COLLIDER_SCALE_MINIBOSS, f.h * COLLIDER_SCALE_MINIBOSS),
    x,
    y,
    false,
    Layer.enemy,
    Mask.enemy,
  );
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
  const name = isPlayer ? 'player-bullet' : 'enemy-bullet';
  const mask = isPlayer ? Mask.playerBullet : Mask.enemyBullet;
  const layer = isPlayer ? Layer.playerBullet : Layer.enemyBullet;
  const f = frame(atlas.sheet, name);
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: vx, y: vy });
  world.add(id, Sprite, {
    image: atlas.image,
    frame: f,
    z: 6,
    anchor: CENTER_ANCHOR,
  });
  world.add(id, Bullet, { damage: 1, ownerLayer });
  world.add(id, Lifetime, { remaining: 3 });
  coll.add(id, AABB(f.w, f.h), x, y, true, layer, mask);
  return id;
}
