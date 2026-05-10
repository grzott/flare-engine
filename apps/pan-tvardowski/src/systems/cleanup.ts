import type { Query, World } from '@flare-engine/ecs';
import { Position } from '@flare-engine/ecs';
import { easeInCubic, lerp } from '@flare-engine/math';
import type { CollisionWorld } from '@flare-engine/physics';
import { Sprite } from '@flare-engine/render';
import { Enemy, type EnemyPattern, Hp, Lifetime, SpiralCollapse } from '../components';
import { ENEMY_SPECS, OFFSCREEN_PAD } from '../config/gameplay';
import { destroyEntity } from './entity-ops';

export function isElitePattern(pattern: EnemyPattern): boolean {
  return (ENEMY_SPECS[pattern]?.hp ?? 0) >= 4;
}

export interface CleanupDeps {
  coll: CollisionWorld;
  bulletQuery: Query;
  enemyQuery: Query;
  shipQuery: Query;
  lifetimeQuery: Query;
  spiralCollapseQuery: Query;
  bounds: { width: number; height: number };
  onEnemyKilled: (score: number, x: number, y: number, pattern: EnemyPattern) => void;
  onPlayerDown: () => void;
  /**
   * Called when an elite enemy's HP reaches 0. The callback handles either
   * immediate destroy (reducedMotion) or attaching the SpiralCollapse component.
   * Returns true if the spiral animation was attached (deferred destroy);
   * returns false if destroyed immediately.
   */
  onEliteDeath: (entityId: number, x: number, y: number) => boolean;
}

export function cleanup(world: World, dt: number, deps: CleanupDeps): void {
  // Tick active SpiralCollapse entities; apply per-frame spiral visual; destroy when done.
  for (const id of deps.spiralCollapseQuery) {
    const sc = world.get(id, SpiralCollapse);
    if (!sc) continue;
    sc.elapsed += dt;
    if (sc.elapsed >= sc.duration) {
      destroyEntity(world, deps.coll, id);
      continue;
    }
    const t = sc.elapsed / sc.duration; // [0, 1)
    const ease = easeInCubic(t);
    const angle = sc.turns * 2 * Math.PI * t;
    const radius = sc.initialRadius * (1 - ease);
    const pos = world.get(id, Position);
    if (pos) {
      pos.x = sc.originX + Math.cos(angle) * radius;
      pos.y = sc.originY + Math.sin(angle) * radius;
    }
    const sprite = world.get(id, Sprite);
    if (sprite) {
      const scaleFactor = lerp(sc.scaleFrom, sc.scaleTo, t);
      sprite.width = sprite.frame.w * scaleFactor;
      sprite.height = sprite.frame.h * scaleFactor;
      sprite.alpha = lerp(sc.alphaFrom, sc.alphaTo, t);
    }
  }

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
      // Idempotent guard: if spiral is already attached, skip re-triggering.
      if (world.has(id, SpiralCollapse)) continue;
      deps.onEnemyKilled(enemy.scoreValue, pos.x, pos.y, enemy.pattern);
      if (isElitePattern(enemy.pattern)) {
        const deferred = deps.onEliteDeath(id, pos.x, pos.y);
        if (!deferred) {
          // reducedMotion path: destroyed immediately inside onEliteDeath.
        }
      } else {
        destroyEntity(world, deps.coll, id);
      }
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
