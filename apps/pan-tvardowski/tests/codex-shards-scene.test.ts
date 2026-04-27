import { beforeEach, describe, expect, test } from 'bun:test';
import type { GameContextValue, Scene } from '@flare-engine/engine';
import { CODEX_ENTRIES } from '../src/codex';
import type { SaveStore } from '../src/save/store';
import { createCodexShardsScene, filterCodexEntries } from '../src/scenes/codex-shards';
import { gameState, resetGameState } from '../src/state';

const fakeCtx = {} as GameContextValue;

function runOnEnter(scene: Scene): void {
  scene.onEnter?.({} as never);
}

describe('codex-shards scene', () => {
  beforeEach(() => {
    resetGameState();
  });

  test('(a) factory returns scene with name "codex-shards" and onEnter flips currentScene', () => {
    const factory = createCodexShardsScene(fakeCtx);
    const scene = factory();
    expect(scene.name).toBe('codex-shards');
    expect(gameState.currentScene).not.toBe('codex-shards');
    runOnEnter(scene);
    expect(gameState.currentScene).toBe('codex-shards');
  });

  test('(b) filterCodexEntries partitions correctly', () => {
    const entries = CODEX_ENTRIES;
    const unlocked = ['skrzat', 'boruta', 'smok-krzemionkowski'];
    const { unlocked: unlockedPart, locked: lockedPart } = filterCodexEntries(entries, unlocked);

    expect(unlockedPart).toHaveLength(3);
    expect(lockedPart).toHaveLength(entries.length - 3);

    const unlockedIds = unlockedPart.map((e) => e.id);
    expect(unlockedIds).toContain('skrzat');
    expect(unlockedIds).toContain('boruta');
    expect(unlockedIds).toContain('smok-krzemionkowski');

    const lockedIds = lockedPart.map((e) => e.id);
    expect(lockedIds).not.toContain('skrzat');
    expect(lockedIds).not.toContain('boruta');
  });

  test('(c) view-model derivation: bestScore=42, 1 codex entry unlocked', () => {
    const stubSave: Pick<SaveStore, 'getSlot' | 'codexUnlocked'> = {
      getSlot: (_index: number) => ({
        index: 0,
        zoneReached: 'z1' as const,
        bestScore: 42,
        lastScore: 42,
        runs: 1,
        bossDefeated: false,
        savedAt: Date.now(),
      }),
      codexUnlocked: () => ['skrzat'] as readonly string[],
    };

    const slot = stubSave.getSlot(0);
    const shardCount = slot?.bestScore ?? 0;
    const { unlocked } = filterCodexEntries(CODEX_ENTRIES, stubSave.codexUnlocked());

    expect(shardCount).toBe(42);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0]?.id).toBe('skrzat');
  });
});
