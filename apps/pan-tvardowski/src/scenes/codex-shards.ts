import type { GameContextValue, Scene } from '@flare-engine/engine';
import type { CodexEntry } from '../codex';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

export interface CodexPartition {
  unlocked: readonly CodexEntry[];
  locked: readonly CodexEntry[];
}

/**
 * Pure helper — partitions all codex entries into unlocked/locked based on
 * the provided set of unlocked ids. Deterministic and side-effect-free so
 * it can be exercised directly in unit tests.
 */
export function filterCodexEntries(
  entries: readonly CodexEntry[],
  unlocked: readonly string[],
): CodexPartition {
  const unlockedSet = new Set(unlocked);
  const result: { unlocked: CodexEntry[]; locked: CodexEntry[] } = {
    unlocked: [],
    locked: [],
  };
  for (const entry of entries) {
    if (unlockedSet.has(entry.id)) {
      result.unlocked.push(entry);
    } else {
      result.locked.push(entry);
    }
  }
  return result;
}

export function createCodexShardsScene(_ctx: GameContextValue): () => Scene {
  return () => ({
    name: 'codex-shards',
    ...shellDefaults(),
    onEnter() {
      gameState.currentScene = 'codex-shards';
      notifyStateChanged();
    },
  });
}
