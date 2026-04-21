import type { GameContextValue, SFXPool } from '@flare-engine/engine';
import { Position } from '@flare-engine/engine';
import type { BeepKey } from '../../audio';
import { SFX_VOLUME } from '../../config/audio';
import { gameState } from '../../state';
import { updateBoss } from '../../systems/boss';
import { updateEnemyAI } from '../../systems/enemy-ai';
import { integrate } from '../../systems/integrate';
import { updatePlayer } from '../../systems/player';
import type { PlayState } from './deps';

type World = GameContextValue['world'];

function playSfx(sfx: SFXPool | null, key: BeepKey, volume: number = SFX_VOLUME[key]): void {
  sfx?.play(key, { volume });
}

/**
 * Advance all per-entity AI/input/physics systems for this frame. Reads
 * player position via `state.playerId` to feed enemy + boss targeting.
 */
export function updateSystems(
  world: World,
  dt: number,
  state: PlayState,
  camera: GameContextValue['camera'],
  sfx: SFXPool | null,
): void {
  const { bounds, spawnCtx } = state;
  const player = world.get(state.playerId, Position);
  const playerX = player?.x ?? bounds.width / 2;
  const playerY = player?.y ?? bounds.height - 90;

  updatePlayer(world, dt, {
    spawnCtx,
    query: state.shipQuery,
    bounds,
    onShoot: () => playSfx(sfx, 'shoot'),
  });

  updateEnemyAI(world, dt, {
    spawnCtx,
    query: state.enemyQuery,
    playerX,
    playerY,
  });

  updateBoss(world, dt, {
    spawnCtx,
    query: state.bossQuery,
    playerX,
    playerY,
    bounds,
    onPhaseChange: (phase) => {
      playSfx(sfx, 'hit', 0.7);
      if (phase === 'phase2' && gameState.settings.screenShake) camera.shake(8, 0.3);
    },
    onDefeated: () => {
      state.bossId = -1;
      gameState.runStats.kills.boss += 1;
      if (gameState.settings.screenShake) camera.shake(14, 0.6);
    },
    onExplosion: () => {
      playSfx(sfx, 'explode', 0.5);
    },
  });

  integrate(world, dt, state.posQuery);
}
