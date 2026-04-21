import type { GameContextValue, SFXPool } from '@flare-engine/engine';
import type { BeepKey } from '../../audio';
import { SFX_VOLUME } from '../../config/audio';
import { gameState, notifyStateChanged } from '../../state';
import { cleanup } from '../../systems/cleanup';
import { syncColliders } from '../../systems/physics-sync';
import type { PlayState } from './deps';

type World = GameContextValue['world'];

function playSfx(sfx: SFXPool | null, key: BeepKey, volume: number = SFX_VOLUME[key]): void {
  sfx?.play(key, { volume });
}

/**
 * Resolve physics for the frame: sync ECS positions into the collision world,
 * step the broadphase (which fires collision callbacks via `resolveCollision`),
 * then cull offscreen/dead entities.
 */
export function processCollisions(
  world: World,
  dt: number,
  state: PlayState,
  camera: GameContextValue['camera'],
  sfx: SFXPool | null,
): void {
  syncColliders(world, state.coll, state.posQuery);
  state.coll.step();

  cleanup(world, dt, {
    coll: state.coll,
    bulletQuery: state.bulletQuery,
    enemyQuery: state.enemyQuery,
    shipQuery: state.shipQuery,
    bounds: state.bounds,
    onEnemyKilled: (score, _x, _y, pattern) => {
      gameState.score += score;
      gameState.runStats.score = gameState.score;
      gameState.runStats.kills[pattern] += 1;
      notifyStateChanged();
      playSfx(sfx, 'explode', 0.7);
    },
    onPlayerDown: () => {
      gameState.gameOver = true;
      notifyStateChanged();
      playSfx(sfx, 'explode', 1);
      if (gameState.settings.screenShake) camera.shake(16, 0.7);
    },
  });

  if (state.playerHitShake) {
    state.playerHitShake = false;
    if (gameState.settings.screenShake) camera.shake(6, 0.2);
  }
}
