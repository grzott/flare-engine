import type { Query, World } from '@flare-engine/engine';
import type { CollisionWorld } from '@flare-engine/physics';
import { Boss, Enemy, Hp, Miniboss } from '../components';
import { bombButtonState, gameState, notifyStateChanged } from '../state';
import { destroyEntity } from './entity-ops';

export interface BombFlashState {
  alpha: number;
  targetAlpha: number;
}

export function createBombFlashState(): BombFlashState {
  return { alpha: 0, targetAlpha: 0 };
}

export interface BombDeps {
  coll: CollisionWorld;
  enemyQuery: Query;
  bossQuery: Query;
  minibossQuery: Query;
  flash: BombFlashState;
  onFired?: () => void;
}

/**
 * Bomb clears every non-boss enemy on screen and deals 25 % damage to any
 * active boss. Consumes one charge; no-op when charges exhausted or boss is
 * invulnerable.
 */
export function processBomb(world: World, dt: number, deps: BombDeps): void {
  const fire = bombButtonState.justPressed && gameState.bombCharges > 0 && !gameState.gameOver;
  if (fire) {
    gameState.bombCharges -= 1;
    gameState.runStats.bombsUsed += 1;
    deps.flash.targetAlpha = 1;
    deps.onFired?.();

    const toDrop: number[] = [];
    for (const id of deps.enemyQuery) {
      const hp = world.get(id, Hp);
      const e = world.get(id, Enemy);
      if (!hp || !e) continue;
      gameState.score += e.scoreValue;
      gameState.runStats.kills[e.pattern] += 1;
      toDrop.push(id);
    }
    for (const id of toDrop) destroyEntity(world, deps.coll, id);

    for (const id of deps.bossQuery) {
      const b = world.get(id, Boss);
      const hp = world.get(id, Hp);
      if (!b || !hp) continue;
      if (b.phase === 'phase1' || b.phase === 'phase2') hp.current -= Math.floor(hp.max * 0.25);
    }
    for (const id of deps.minibossQuery) {
      const m = world.get(id, Miniboss);
      const hp = world.get(id, Hp);
      if (!m || !hp) continue;
      if (m.phase === 'active') hp.current -= Math.floor(hp.max * 0.25);
    }
    notifyStateChanged();
  }

  // Fade flash toward target.
  const targetAlpha = deps.flash.targetAlpha;
  const alpha = deps.flash.alpha;
  if (targetAlpha > 0) {
    deps.flash.alpha = Math.min(1, alpha + dt * 6);
    if (deps.flash.alpha >= 0.99) deps.flash.targetAlpha = 0;
  } else if (alpha > 0) {
    deps.flash.alpha = Math.max(0, alpha - dt * 2);
  }
}
