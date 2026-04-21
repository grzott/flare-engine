import type { GameContextValue } from '@flare-engine/engine';
import { BOSS_HP_MAX } from '../../config/gameplay';
import { DEFAULT_WAVE_SCHEDULE } from '../../config/waves';
import { spawnBoss, spawnEnemy } from '../../spawn';
import { gameState, notifyStateChanged } from '../../state';
import { tickSpawner } from '../../systems/spawner';
import type { PlayState } from './deps';

/**
 * Advance the wave spawner, emit enemy entities, and — once the schedule is
 * exhausted and the last wave is cleared — spawn the boss. Updates the UI's
 * boss HP on the transition frame.
 */
export function processSpawning(
  dt: number,
  state: PlayState,
  camera: GameContextValue['camera'],
): void {
  state.spawnEvents.length = 0;
  tickSpawner(state.spawner, DEFAULT_WAVE_SCHEDULE, dt, state.spawnEvents);
  for (const ev of state.spawnEvents) {
    spawnEnemy(state.spawnCtx, ev.pattern, ev.x, ev.y);
  }

  if (state.spawner.done && !state.bossSpawned && state.enemyQuery.count === 0) {
    const w = camera.viewportWidth || state.bounds.width;
    state.bossId = spawnBoss(state.spawnCtx, w / 2, -40, BOSS_HP_MAX);
    state.bossSpawned = true;
    gameState.bossHpMax = BOSS_HP_MAX;
    gameState.bossHp = BOSS_HP_MAX;
    notifyStateChanged();
  }
}
