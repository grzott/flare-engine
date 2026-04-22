import { describe, expect, test } from 'bun:test';
import { createMemoryAdapter } from '@flare-engine/storage';
import { createSaveStore } from '../src/save/store';

describe('save store / round-trip', () => {
  test('default → createSlot → commitRun persists across reloads', async () => {
    const adapter = createMemoryAdapter();
    const s1 = createSaveStore(adapter);
    await s1.load();
    await s1.createSlot(0);
    await s1.commitRun(1500, false);
    await s1.commitRun(900, true);

    const s2 = createSaveStore(adapter);
    await s2.load();
    const slot = s2.getSlot(0);
    expect(slot).not.toBeNull();
    expect(slot!.runs).toBe(2);
    expect(slot!.bestScore).toBe(1500);
    expect(slot!.lastScore).toBe(900);
    expect(slot!.bossDefeated).toBe(true);
    expect(s2.activeSlot()).toBe(0);
  });

  test('corrupt json falls back to default', async () => {
    const adapter = createMemoryAdapter();
    await adapter.set('pan-tvardowski:save', '{not valid json');
    const s = createSaveStore(adapter);
    await s.load();
    expect(s.activeSlot()).toBeNull();
    expect(s.getSlot(0)).toBeNull();
  });
});
