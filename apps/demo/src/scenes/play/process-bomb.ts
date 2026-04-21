import type { GameContextValue, SFXPool } from '@flare-engine/engine';
import type { BeepKey } from '../../audio';
import { SFX_VOLUME } from '../../config/audio';
import { ALPHA_EPSILON } from '../../config/gameplay';
import { bombButtonState, gameState, notifyStateChanged } from '../../state';
import { bombFlashAlpha, tickBombFlash, tryBomb } from '../../systems/bomb';
import type { PlayState } from './deps';

type World = GameContextValue['world'];

function playSfx(sfx: SFXPool | null, key: BeepKey, volume: number = SFX_VOLUME[key]): void {
  sfx?.play(key, { volume });
}

/**
 * Consume a bomb press (if any), tick the bomb-flash tween, and mirror the
 * resulting alpha onto `gameState` so the HUD redraws the white flash. Only
 * notifies when alpha actually changes past {@link ALPHA_EPSILON}.
 */
export function processBomb(
  world: World,
  dt: number,
  state: PlayState,
  camera: GameContextValue['camera'],
  sfx: SFXPool | null,
): void {
  const newCharges = tryBomb(world, gameState.bombCharges, bombButtonState.justPressed, {
    coll: state.coll,
    enemyQuery: state.enemyQuery,
    bulletQuery: state.bulletQuery,
    bossQuery: state.bossQuery,
    flash: state.flash,
    camera: gameState.settings.screenShake ? camera : undefined,
    onBossHit: () => playSfx(sfx, 'hit', 0.9),
    onEnemyCleared: () => playSfx(sfx, 'bomb'),
  });
  if (newCharges !== gameState.bombCharges) {
    gameState.runStats.bombsUsed += 1;
    gameState.bombCharges = newCharges;
    notifyStateChanged();
  }

  tickBombFlash(state.flash, dt);
  const nextAlpha = bombFlashAlpha(state.flash);
  if (Math.abs(gameState.bombFlashAlpha - nextAlpha) > ALPHA_EPSILON) {
    gameState.bombFlashAlpha = nextAlpha;
    notifyStateChanged();
  }
}
