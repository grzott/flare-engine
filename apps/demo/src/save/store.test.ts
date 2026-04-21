import { describe, expect, it } from 'bun:test';
import { createMemoryAdapter } from '@flare-engine/storage';
import { gameState } from '../state';
import { createRunStats } from '../state';
import { mergeRunIntoSlot, parseSaveFile } from './schema';
import { createSaveStore } from './store';

describe('parseSaveFile', () => {
  it('returns defaults on null', () => {
    const f = parseSaveFile(null);
    expect(f.slots).toHaveLength(3);
    expect(f.slots[0]).toBeNull();
    expect(f.lastSlotIndex).toBeNull();
    expect(f.settings.sfxVolume).toBe(1);
  });

  it('returns defaults on garbage', () => {
    const f = parseSaveFile('not-json');
    expect(f.slots).toHaveLength(3);
  });

  it('round-trips a valid save', () => {
    const raw = JSON.stringify({
      version: 1,
      settings: { sfxVolume: 0.5, musicVolume: 0.3, screenShake: false },
      slots: [
        {
          index: 0,
          savedAt: 123,
          runs: 2,
          bestScore: 500,
          lastScore: 400,
          totalKills: 10,
          bossDefeated: true,
          firstRunSeen: true,
          pendingVictoryDialogue: false,
        },
        null,
        null,
      ],
      lastSlotIndex: 0,
    });
    const f = parseSaveFile(raw);
    expect(f.slots[0]?.bestScore).toBe(500);
    expect(f.settings.screenShake).toBe(false);
    expect(f.lastSlotIndex).toBe(0);
  });
});

describe('mergeRunIntoSlot', () => {
  it('accumulates totals and tracks best score', () => {
    const slot = {
      index: 0,
      savedAt: 0,
      runs: 1,
      bestScore: 200,
      lastScore: 200,
      totalKills: 3,
      bossDefeated: false,
      firstRunSeen: true,
      pendingVictoryDialogue: false,
    };
    const run = createRunStats();
    run.score = 500;
    run.kills.straight = 2;
    run.kills.boss = 1;
    const merged = mergeRunIntoSlot(slot, run, true);
    expect(merged.bestScore).toBe(500);
    expect(merged.lastScore).toBe(500);
    expect(merged.totalKills).toBe(3 + 2 + 1);
    expect(merged.runs).toBe(2);
    expect(merged.bossDefeated).toBe(true);
    expect(merged.pendingVictoryDialogue).toBe(true);
  });
});

describe('SaveStore with memory adapter', () => {
  it('persists and reloads settings + slots', async () => {
    const adapter = createMemoryAdapter();
    const store = createSaveStore(adapter);
    await store.load();
    await store.setSettings({ sfxVolume: 0.2 });
    await store.createSlot(1);
    const run = createRunStats();
    run.score = 777;
    run.kills.straight = 5;
    await store.commitRun(run, false);

    // New store sees the same underlying adapter → reload picks up the write.
    gameState.activeSlot = null;
    gameState.slots = [null, null, null];
    const store2 = createSaveStore(adapter);
    await store2.load();
    expect(gameState.settings.sfxVolume).toBe(0.2);
    expect(gameState.slots[1]?.bestScore).toBe(777);
    expect(gameState.slots[1]?.totalKills).toBe(5);
    expect(gameState.lastSlotIndex).toBe(1);
  });

  it('resets a slot cleanly', async () => {
    const adapter = createMemoryAdapter();
    const store = createSaveStore(adapter);
    await store.load();
    await store.createSlot(0);
    await store.resetSlot(0);
    expect(gameState.slots[0]).toBeNull();
    expect(gameState.activeSlot).toBeNull();
  });
});
