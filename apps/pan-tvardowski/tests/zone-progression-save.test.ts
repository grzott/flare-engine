import { describe, expect, test } from 'bun:test';
import { createMemoryAdapter } from '@flare-engine/storage';
import { createSaveStore } from '../src/save/store';

describe('zone-progression-save — M10 PT-Bugfix-A M2', () => {
  test('boss defeat advances zoneReached (z1 → z2)', async () => {
    const adapter = createMemoryAdapter();
    const store = createSaveStore(adapter);
    await store.load();
    await store.createSlot(0);

    const before = store.getSlot(0);
    expect(before?.zoneReached).toBe('z1');

    await store.commitRun(500, false, 'z2');

    const after = store.getSlot(0);
    expect(after?.zoneReached).toBe('z2');
  });

  test('game-over persists current zone', async () => {
    const adapter = createMemoryAdapter();
    const store = createSaveStore(adapter);
    await store.load();
    await store.createSlot(0);

    await store.commitRun(300, false, 'z3');

    const slot = store.getSlot(0);
    expect(slot?.zoneReached).toBe('z3');
  });

  test('maxZone ordering preserved — no rollback to earlier zone', async () => {
    const adapter = createMemoryAdapter();
    const store = createSaveStore(adapter);
    await store.load();
    await store.createSlot(0);

    await store.commitRun(400, false, 'z4');
    await store.commitRun(100, false, 'z2');

    const slot = store.getSlot(0);
    expect(slot?.zoneReached).toBe('z4');
  });

  test('bossDefeated not set true on mid-campaign run (non-victory)', async () => {
    const adapter = createMemoryAdapter();
    const store = createSaveStore(adapter);
    await store.load();
    await store.createSlot(0);

    await store.commitRun(800, false, 'z5');

    const slot = store.getSlot(0);
    expect(slot?.bossDefeated).toBe(false);
  });
});
