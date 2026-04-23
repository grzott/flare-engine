/**
 * Mefistofeles helpers (Zone 7).
 *
 *  - `spawnFirepit(ctx, x, y)` — persistent enemy-owned ground hazard (phase 2).
 *  - `spawnSpikeLane(ctx, x, yTop, yBot)` — Madej miniboss spike column: a
 *    vertical band of slow-drifting enemy bullets in one lane.
 *  - `spawnMirrorTwin(ctx, x, y)` / `updateMirrorTwin` — phase-3 clone that
 *    mirrors the player's x across the screen centre and fires downward every
 *    {@link MEFISTOFELES_TWIN_FIRE} s.
 */

import { getFrame } from '@flare-engine/assets';
import type { Query, World } from '@flare-engine/ecs';
import { Position, Velocity } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import { Lifetime, MirrorTwin } from '../components';
import {
  BULLET_SPEED,
  MADEJ_SPIKE_LIFETIME_SEC,
  MEFISTOFELES_FIREPIT_LIFETIME_SEC,
  MEFISTOFELES_TWIN_FIRE,
  MEFISTOFELES_TWIN_Y_OFFSET,
} from '../config/gameplay';
import { Layer } from '../layers';
import { type SpawnCtx, spawnBullet } from '../spawn';

/** Phase-2 fire-pit: a slow-drifting enemy bullet with long lifetime. */
export function spawnFirepit(ctx: SpawnCtx, x: number, y: number): number {
  const id = spawnBullet(ctx, x, y, 0, 20, Layer.enemy);
  const life = ctx.world.get(id, Lifetime);
  if (life) life.remaining = MEFISTOFELES_FIREPIT_LIFETIME_SEC;
  return id;
}

/**
 * Madej spike-lane: drop 3 slow vertical enemy bullets in a fixed column so
 * the player must leave the lane. The three bullets stagger ~24 px apart.
 */
export function spawnSpikeLane(ctx: SpawnCtx, laneX: number, topY: number): void {
  for (let i = 0; i < 3; i++) {
    const id = spawnBullet(ctx, laneX, topY + i * 26, 0, 55, Layer.enemy);
    const life = ctx.world.get(id, Lifetime);
    if (life) life.remaining = MADEJ_SPIKE_LIFETIME_SEC;
  }
}

/**
 * Spawn the Mefistofeles phase-3 mirror-twin: a sprite-only entity that
 * mirrors the player's x and fires downward. Has no Hp and no collider — it
 * is pure ambient pressure until phase 3 ends.
 */
export function spawnMirrorTwin(ctx: SpawnCtx, x: number, y: number): number {
  const { world, atlas } = ctx;
  const id = world.spawn();
  const f = getFrame(atlas.sheet, 'kogut-zloty');
  if (!f) return -1;
  world.add(id, Position, { x, y });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Sprite, {
    image: atlas.image,
    frame: f,
    z: 10,
    anchor: { x: 0.5, y: 0.5 },
  });
  world.add(id, MirrorTwin, {
    ownerId: -1,
    fireCooldown: MEFISTOFELES_TWIN_FIRE * 0.6,
  });
  return id;
}

export function despawnMirrorTwin(world: World, id: number): void {
  if (id < 0) return;
  const hasPos = world.get(id, Position);
  if (!hasPos) return;
  world.destroy(id);
}

export interface MirrorTwinDeps {
  spawnCtx: SpawnCtx;
  query: Query;
  playerX: number;
  playerY: number;
  bounds: { width: number; height: number };
}

/**
 * Per-tick update: mirror twin.x around viewport centre from player.x,
 * offset twin.y above player. Fires a downward bullet every
 * {@link MEFISTOFELES_TWIN_FIRE} seconds.
 */
export function updateMirrorTwin(world: World, dt: number, deps: MirrorTwinDeps): void {
  for (const id of deps.query) {
    const t = world.get(id, MirrorTwin);
    const pos = world.get(id, Position);
    if (!t || !pos) continue;
    pos.x = deps.bounds.width - deps.playerX;
    pos.y = deps.playerY + MEFISTOFELES_TWIN_Y_OFFSET;
    t.fireCooldown -= dt;
    if (t.fireCooldown <= 0) {
      t.fireCooldown = MEFISTOFELES_TWIN_FIRE;
      spawnBullet(deps.spawnCtx, pos.x, pos.y + 16, 0, BULLET_SPEED.enemy, Layer.enemy);
    }
  }
}
