import type { Query, World } from '@flare-engine/engine';
import { Boss } from '../components';
import { gameState } from '../state';

export interface GameSnapshot {
  readonly elapsed: number;
  readonly score: number;
  readonly playerHp: number;
  readonly bombCharges: number;
  readonly enemyCount: number;
  readonly bulletCount: number;
  readonly bossPhase: string;
  readonly currentZone: string;
}

export interface SnapshotSources {
  world: World;
  enemyQuery: Query;
  bulletQuery: Query;
  bossQuery: Query;
  elapsed: () => number;
}

/**
 * Build a cheap, plain-object snapshot for the devtools ring buffer.
 * Iterates pre-created queries only — zero allocations apart from the
 * returned struct (one per capture tick).
 */
export function createGameSnapshot(src: SnapshotSources): GameSnapshot {
  let enemyCount = 0;
  for (const _id of src.enemyQuery) enemyCount++;
  let bulletCount = 0;
  for (const _id of src.bulletQuery) bulletCount++;
  let bossPhase = 'none';
  for (const id of src.bossQuery) {
    const b = src.world.get(id, Boss);
    if (b) {
      bossPhase = b.phase;
      break;
    }
  }
  return {
    elapsed: src.elapsed(),
    score: gameState.score,
    playerHp: gameState.playerHp,
    bombCharges: gameState.bombCharges,
    enemyCount,
    bulletCount,
    bossPhase,
    currentZone: gameState.currentZone,
  };
}
