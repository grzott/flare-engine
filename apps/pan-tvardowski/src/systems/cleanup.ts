import type { CollisionWorld, Query, World } from '@flare-engine/engine';
import { Position } from '@flare-engine/engine';
import { Enemy, type EnemyPattern, Hp, Lifetime } from '../components';
import { OFFSCREEN_PAD } from '../config/gameplay';
import { destroyEntity } from './entity-ops';

export interface CleanupDeps {
  coll: CollisionWorld;
  bulletQuery: Query;
  enemyQuery: Query;
  shipQuery: Query;
  lifetimeQuery: Query;
  bounds: { width: number; height: number };
  onEnemyKilled: (score: number, x: number, y: number, pattern: EnemyPattern) => void;
  onPlayerDown: () => void;
}

export function cleanup(world: World, dt: number, deps: CleanupDeps): void {
  // Unified Lifetime tick — bullets and particles share a lifetime timer.
  // Runs first so the bullet pass only has to do offscreen culling.
  for (const id of deps.lifetimeQuery) {
    const life = world.get(id, Lifetime);
    if (!life) continue;
    life.remaining -= dt;
    if (life.remaining <= 0) {
      destroyEntity(world, deps.coll, id);
    }
  }
  for (const id of deps.bulletQuery) {
    const pos = world.get(id, Position);
    if (!pos) continue;
    if (
      pos.x < -OFFSCREEN_PAD ||
      pos.x > deps.bounds.width + OFFSCREEN_PAD ||
      pos.y < -OFFSCREEN_PAD ||
      pos.y > deps.bounds.height + OFFSCREEN_PAD
    ) {
      destroyEntity(world, deps.coll, id);
    }
  }

  for (const id of deps.enemyQuery) {
    const pos = world.get(id, Position);
    const hp = world.get(id, Hp);
    const enemy = world.get(id, Enemy);
    if (!pos || !hp || !enemy) continue;
    if (hp.current <= 0) {
      deps.onEnemyKilled(enemy.scoreValue, pos.x, pos.y, enemy.pattern);
      destroyEntity(world, deps.coll, id);
      continue;
    }
    if (pos.y > deps.bounds.height + OFFSCREEN_PAD || pos.y < -OFFSCREEN_PAD) {
      destroyEntity(world, deps.coll, id);
    }
  }

  for (const id of deps.shipQuery) {
    const hp = world.get(id, Hp);
    if (!hp) continue;
    if (hp.current <= 0) {
      deps.onPlayerDown();
      destroyEntity(world, deps.coll, id);
    }
  }
}
