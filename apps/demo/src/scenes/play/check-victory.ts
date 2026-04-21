import type { GameContextValue } from '@flare-engine/engine';
import { gameState, notifyStateChanged } from '../../state';
import { computeBossStatus } from '../../systems/boss';
import type { PlayState } from './deps';

type World = GameContextValue['world'];

/**
 * Mirror the current boss lifecycle + HP onto `gameState` so the HUD renders
 * the boss bar. Only notifies when a visible field actually changes.
 */
export function publishBossStatus(world: World, state: PlayState): void {
  const status = computeBossStatus(world, state.bossQuery);
  const wasActive = gameState.bossActive;
  const visible = status.alive && status.phase !== 'defeated';
  const activeNow = visible && status.phase !== 'entering';
  if (
    gameState.bossActive !== activeNow ||
    gameState.bossHp !== status.hp ||
    gameState.bossHpMax !== status.hpMax
  ) {
    gameState.bossActive = activeNow;
    gameState.bossHp = status.hp;
    gameState.bossHpMax = status.hpMax;
    notifyStateChanged();
  } else if (!activeNow && wasActive) {
    notifyStateChanged();
  }
}

/**
 * Check end-of-run conditions and trigger the appropriate scene transition.
 * Returns `true` if a transition was scheduled and the caller should bail
 * out of further per-frame work.
 */
export function checkVictory(world: World, state: PlayState, ctx: GameContextValue): boolean {
  if (gameState.gameOver) {
    void ctx.scenes.go('game-over');
    return true;
  }
  if (!state.bossSpawned) return false;
  const phase = computeBossStatus(world, state.bossQuery).phase ?? null;
  const bossDone = !state.bossQuery.count || phase === 'defeated';
  if (bossDone && !gameState.victory) {
    gameState.victory = true;
    gameState.bossActive = false;
    notifyStateChanged();
    void ctx.scenes.go('victory');
    return true;
  }
  return false;
}
