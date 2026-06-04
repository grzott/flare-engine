import { type SpriteFrame, type SpriteSheet, getFrame } from '@flare-engine/assets';
import type { SkImageLike } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position, Velocity } from '@flare-engine/ecs';
import { AABB, type CollisionWorld } from '@flare-engine/physics';
import { Sprite } from '@flare-engine/render';
import type { SkImage } from '@shopify/react-native-skia';
import type { KenneyAtlasHandle } from './assets/sprites-loader';
import {
  Boss,
  type BossPattern,
  Bullet,
  Enemy,
  type EnemyPattern,
  Exhaust,
  Hp,
  Lifetime,
  Miniboss,
  type MinibossPattern,
  Pickup,
  Ship,
} from './components';
import {
  COLLIDER_SCALE_BOSS,
  COLLIDER_SCALE_ENEMY,
  COLLIDER_SCALE_MINIBOSS,
  ENEMY_SPECS,
} from './config/gameplay';
import { bulletSpriteRotation } from './fx/bullet-rotation';
import { Layer, Mask } from './layers';
import {
  DEFAULT_OWNER_HALF_HEIGHT,
  EXHAUST_FLAME_HALF_HEIGHT,
  EXHAUST_MARGIN,
  EXHAUST_ROTATION_ENEMY,
  EXHAUST_ROTATION_PLAYER,
} from './systems/exhaust';
import { KENNEY_FRAME_MAP, KENNEY_SPRITE_SCALE } from './visual-spec/kenney-frames';
import type { BulletSpecId, PickupDef } from './visual-spec/types';

export interface AtlasHandle {
  image: SkImage;
  sheet: SpriteSheet;
}

export interface SpawnCtx {
  world: World;
  coll: CollisionWorld;
  atlas: AtlasHandle;
  /** Kenney zone-1 atlas — null until the PNG resolves via useImage. KG3 uses
   *  this for frame lookup with shape-atlas fallback. */
  kenney?: KenneyAtlasHandle | null;
}

interface ResolvedSprite {
  image: SkImageLike;
  frame: SpriteFrame;
  /** 1 for shape-atlas paths; KENNEY_SPRITE_SCALE for Kenney atlas paths. */
  scale: number;
}

/** Shared anchor reference — every entity pivots around its centre so that
 *  Position, physics AABBs and visuals line up (shmup convention). */
const CENTER_ANCHOR = { x: 0.5, y: 0.5 };

function frame(sheet: SpriteSheet, name: string) {
  const f = getFrame(sheet, name);
  if (!f) throw new Error(`pan-tvardowski: missing sprite frame "${name}"`);
  return f;
}

/**
 * KG3: resolve the best-available sprite for `name`.
 *
 * If `ctx.kenney` is non-null, its image is live, and `KENNEY_FRAME_MAP` maps
 * `name` to a frame present in the Kenney sheet, return the Kenney image+frame.
 * Otherwise fall through to the shape atlas (zones 2–8 always take this path).
 */
function resolveSprite(ctx: SpawnCtx, name: string): ResolvedSprite {
  if (ctx.kenney !== null && ctx.kenney !== undefined && ctx.kenney.image !== null) {
    const kenneyFrameName = KENNEY_FRAME_MAP.get(name);
    if (kenneyFrameName !== undefined) {
      const kenneyFrame = getFrame(ctx.kenney.sheet, kenneyFrameName);
      if (kenneyFrame !== undefined) {
        return { image: ctx.kenney.image, frame: kenneyFrame, scale: KENNEY_SPRITE_SCALE };
      }
    }
  }
  return { image: ctx.atlas.image, frame: frame(ctx.atlas.sheet, name), scale: 1 };
}

/**
 * Spawns a paired exhaust flame entity for a hull.
 *
 * Kenney-null-safe: uses shape-atlas placeholder frame + alpha=0 when the
 * kenney atlas is not yet live (updateExhaust keeps alpha=0 in that state).
 * No collider — flame is visual-only. Z placed below the hull (z-1) so it
 * renders behind the ship.
 */
export function spawnExhaustFlame(
  ctx: SpawnCtx,
  ownerId: number,
  x: number,
  y: number,
  isPlayer: boolean,
): void {
  const { world } = ctx;
  const id = world.spawn();
  const placeholderFrame = frame(ctx.atlas.sheet, 'piorun-bullet');
  const ownerSprite = world.get(ownerId, Sprite);
  const ownerHalfHeight =
    ownerSprite !== undefined && typeof ownerSprite.height === 'number'
      ? ownerSprite.height / 2
      : DEFAULT_OWNER_HALF_HEIGHT;
  const offsetY = ownerHalfHeight + EXHAUST_FLAME_HALF_HEIGHT + EXHAUST_MARGIN;
  world.add(id, Position, { x, y });
  world.add(id, Sprite, {
    image: ctx.atlas.image,
    frame: placeholderFrame,
    z: isPlayer ? 9 : 7,
    anchor: CENTER_ANCHOR,
    alpha: 0,
    rotation: isPlayer ? EXHAUST_ROTATION_PLAYER : EXHAUST_ROTATION_ENEMY,
  });
  world.add(id, Exhaust, { ownerId, isPlayer, offsetY });
}

export function spawnPlayer(ctx: SpawnCtx, x: number, y: number): number {
  const { world, coll } = ctx;
  const id = world.spawn();
  const s = resolveSprite(ctx, 'kogut-zloty');
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Sprite, {
    image: s.image,
    frame: s.frame,
    z: 10,
    anchor: CENTER_ANCHOR,
    width: s.frame.w * s.scale,
    height: s.frame.h * s.scale,
  });
  world.add(id, Ship, { fireRate: 0.3, cooldown: 0 });
  world.add(id, Hp, { current: 100, max: 100 });
  coll.add(
    id,
    AABB(s.frame.w * s.scale * 0.6, s.frame.h * s.scale * 0.6),
    x,
    y,
    false,
    Layer.player,
    Mask.player,
  );
  spawnExhaustFlame(ctx, id, x, y, true);
  return id;
}

export function spawnEnemy(
  ctx: SpawnCtx,
  pattern: EnemyPattern,
  x: number,
  y: number,
  seed: number,
): number {
  const { world, coll } = ctx;
  const spec = ENEMY_SPECS[pattern];
  const id = world.spawn();
  const s = resolveSprite(ctx, spec.frame);
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Sprite, {
    image: s.image,
    frame: s.frame,
    z: 8,
    anchor: CENTER_ANCHOR,
    width: s.frame.w * s.scale,
    height: s.frame.h * s.scale,
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
    AABB(s.frame.w * s.scale * COLLIDER_SCALE_ENEMY, s.frame.h * s.scale * COLLIDER_SCALE_ENEMY),
    x,
    y,
    false,
    Layer.enemy,
    Mask.enemy,
  );
  spawnExhaustFlame(ctx, id, x, y, false);
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
  const { world, coll } = ctx;
  const scale = colliderScale ?? COLLIDER_SCALE_BOSS;
  const id = world.spawn();
  const s = resolveSprite(ctx, pattern);
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Sprite, {
    image: s.image,
    frame: s.frame,
    z: 9,
    anchor: CENTER_ANCHOR,
    width: s.frame.w * s.scale,
    height: s.frame.h * s.scale,
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
  coll.add(
    id,
    AABB(s.frame.w * s.scale * scale, s.frame.h * s.scale * scale),
    x,
    y,
    false,
    Layer.enemy,
    Mask.enemy,
  );
  spawnExhaustFlame(ctx, id, x, y, false);
  return id;
}

export function spawnMiniboss(
  ctx: SpawnCtx,
  pattern: MinibossPattern,
  x: number,
  y: number,
  hpMax: number,
): number {
  const { world, coll } = ctx;
  const id = world.spawn();
  const s = resolveSprite(ctx, pattern);
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Sprite, {
    image: s.image,
    frame: s.frame,
    z: 9,
    anchor: CENTER_ANCHOR,
    width: s.frame.w * s.scale,
    height: s.frame.h * s.scale,
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
    AABB(
      s.frame.w * s.scale * COLLIDER_SCALE_MINIBOSS,
      s.frame.h * s.scale * COLLIDER_SCALE_MINIBOSS,
    ),
    x,
    y,
    false,
    Layer.enemy,
    Mask.enemy,
  );
  spawnExhaustFlame(ctx, id, x, y, false);
  return id;
}

export function spawnBullet(
  ctx: SpawnCtx,
  x: number,
  y: number,
  vx: number,
  vy: number,
  ownerLayer: number,
  specId?: BulletSpecId,
): number {
  const { world, coll, atlas } = ctx;
  const id = world.spawn();
  const isPlayer = ownerLayer === Layer.player;
  const mask = isPlayer ? Mask.playerBullet : Mask.enemyBullet;
  const layer = isPlayer ? Layer.playerBullet : Layer.enemyBullet;
  let s: ResolvedSprite;
  if (specId !== undefined) {
    const f = frame(atlas.sheet, String(specId));
    s = { image: atlas.image, frame: f, scale: 1 };
  } else {
    s = resolveSprite(ctx, isPlayer ? 'piorun-bullet' : 'enemy-bullet');
  }
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: vx, y: vy });
  world.add(id, Sprite, {
    image: s.image,
    frame: s.frame,
    z: 6,
    anchor: CENTER_ANCHOR,
    width: s.frame.w * s.scale,
    height: s.frame.h * s.scale,
    rotation: bulletSpriteRotation(vx, vy),
  });
  world.add(id, Bullet, { damage: 1, ownerLayer });
  world.add(id, Lifetime, { remaining: 3 });
  coll.add(id, AABB(s.frame.w * s.scale, s.frame.h * s.scale), x, y, true, layer, mask);
  return id;
}

export function spawnPickup(ctx: SpawnCtx, def: PickupDef, x: number, y: number): number {
  const { world, coll } = ctx;
  const id = world.spawn();
  const s = resolveSprite(ctx, String(def.id));
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Sprite, {
    image: s.image,
    frame: s.frame,
    z: 5,
    anchor: CENTER_ANCHOR,
    width: s.frame.w * s.scale,
    height: s.frame.h * s.scale,
  });
  world.add(id, Pickup, { pickupId: def.id, effect: def.effect });
  world.add(id, Lifetime, { remaining: 12 });
  coll.add(
    id,
    AABB(s.frame.w * s.scale, s.frame.h * s.scale),
    x,
    y,
    true,
    Layer.pickup,
    Mask.pickup,
  );
  return id;
}
