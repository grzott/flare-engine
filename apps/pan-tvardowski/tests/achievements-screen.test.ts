import { beforeEach, describe, expect, test } from 'bun:test';
import type { GameContextValue } from '@flare-engine/engine';
import { createMemoryAdapter } from '@flare-engine/storage';
import { LOCALIZATION_KEYS } from '../src/localization/keys';
import { createSaveStore } from '../src/save/store';
import {
  ACHIEVEMENT_ENTRIES,
  createAchievementsScene,
  filterAchievements,
} from '../src/scenes/achievements';
import { gameState, resetGameState } from '../src/state';

const fakeCtx = {} as GameContextValue;

describe('achievements screen', () => {
  beforeEach(() => {
    resetGameState();
  });

  test('(a) ACHIEVEMENT_ENTRIES has exactly 12 entries; every nameKey and descKey is in LOCALIZATION_KEYS', () => {
    expect(ACHIEVEMENT_ENTRIES).toHaveLength(12);
    const keySet = new Set<string>(LOCALIZATION_KEYS);
    for (const entry of ACHIEVEMENT_ENTRIES) {
      expect(keySet.has(entry.nameKey)).toBe(true);
      expect(keySet.has(entry.descKey)).toBe(true);
    }
  });

  test('(b) filterAchievements partitions correctly, order preserved within each bucket', () => {
    const all = ACHIEVEMENT_ENTRIES;
    const unlocked = ['no_bomb_boss', 'all_shards'];
    const { unlocked: unlockedPart, locked: lockedPart } = filterAchievements(all, unlocked);

    expect(unlockedPart).toHaveLength(2);
    expect(lockedPart).toHaveLength(all.length - 2);

    expect(unlockedPart[0]?.id).toBe('no_bomb_boss');
    expect(unlockedPart[1]?.id).toBe('all_shards');

    const lockedIds = lockedPart.map((e) => e.id);
    expect(lockedIds).not.toContain('no_bomb_boss');
    expect(lockedIds).not.toContain('all_shards');
    expect(lockedIds[0]).toBe('first_shard');
  });

  test('(c) scene factory sets currentScene to "achievements" on onEnter; SaveStore.unlockAchievement reflects in unlockedAchievements()', async () => {
    const store = createSaveStore(createMemoryAdapter());
    await store.load();

    expect(store.unlockedAchievements()).toHaveLength(0);

    await store.unlockAchievement('first_shard');
    await store.unlockAchievement('no_bomb_boss');

    expect(store.unlockedAchievements()).toHaveLength(2);
    expect(store.unlockedAchievements()).toContain('first_shard');
    expect(store.unlockedAchievements()).toContain('no_bomb_boss');

    const { unlocked } = filterAchievements(ACHIEVEMENT_ENTRIES, store.unlockedAchievements());
    expect(unlocked).toHaveLength(2);

    const factory = createAchievementsScene(fakeCtx);
    const scene = factory();
    expect(scene.name).toBe('achievements');
    expect(gameState.currentScene).not.toBe('achievements');
    scene.onEnter?.({} as never);
    expect(gameState.currentScene).toBe('achievements');
  });
});
