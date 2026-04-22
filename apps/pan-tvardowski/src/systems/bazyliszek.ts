/**
 * Bazyliszek Warszawski helpers (Zone 6).
 *
 * Provides two scene-level utilities:
 *  - `countHounds(world, enemyQuery)` — counts live Nocny Łowca homing hounds
 *    so the miniboss FSM can re-summon once the pack has been wiped.
 *  - `spawnPuddle(ctx, x, y)` — drops a slow-drifting enemy bullet that acts
 *    as a persistent venom puddle in Bazyliszek's phase-2 pattern.
 */

import type { Query, World } from '@flare-engine/ecs';
import { Enemy, Lifetime } from '../components';
import { BAZYLISZEK_PUDDLE_LIFETIME_SEC } from '../config/gameplay';
import { Layer } from '../layers';
import { type SpawnCtx, spawnBullet } from '../spawn';

export function countHounds(world: World, enemyQuery: Query): number {
  let count = 0;
  for (const id of enemyQuery) {
    const e = world.get(id, Enemy);
    if (e && e.pattern === 'hound') count += 1;
  }
  return count;
}

export function spawnPuddle(ctx: SpawnCtx, x: number, y: number): number {
  // A slow-drifting enemy bullet with a long lifetime acts as a persistent
  // ground hazard the player must weave around.
  const id = spawnBullet(ctx, x, y, 0, 30, Layer.enemy);
  const life = ctx.world.get(id, Lifetime);
  if (life) life.remaining = BAZYLISZEK_PUDDLE_LIFETIME_SEC;
  return id;
}
