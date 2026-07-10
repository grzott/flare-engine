import { describe, expect, test } from 'bun:test';
import {
  type AchievementsStore,
  createMemoryAchievements,
  createStorageAchievements,
} from '../src/memory.js';

/** Fake async KV store backed by a Map, recording writes for assertions. */
function makeStore(): AchievementsStore & { map: Map<string, string>; sets: number } {
  const map = new Map<string, string>();
  return {
    map,
    sets: 0,
    async get(key: string): Promise<string | null> {
      return map.get(key) ?? null;
    },
    async set(key: string, value: string): Promise<void> {
      this.sets += 1;
      map.set(key, value);
    },
  };
}

describe('createMemoryAchievements', () => {
  test('unlock with no progress arg fully unlocks and stamps unlockedAt', async () => {
    const a = createMemoryAchievements({ now: () => 1000 });
    await a.unlock('first_blood');
    expect(await a.getState('first_blood')).toEqual({
      id: 'first_blood',
      unlocked: true,
      progress: 1,
      unlockedAt: 1000,
    });
  });

  test('progress is monotonic — a lower value is ignored', async () => {
    const a = createMemoryAchievements();
    await a.unlock('marathon', 0.5);
    await a.unlock('marathon', 0.2);
    expect(await a.getState('marathon')).toEqual({
      id: 'marathon',
      unlocked: false,
      progress: 0.5,
    });
  });

  test('reaching progress 1 latches unlocked and sets unlockedAt', async () => {
    const a = createMemoryAchievements({ now: () => 4242 });
    await a.unlock('done', 1);
    const s = await a.getState('done');
    expect(s.unlocked).toBe(true);
    expect(s.progress).toBe(1);
    expect(s.unlockedAt).toBe(4242);
  });

  test('re-unlock is a no-op — original unlockedAt is preserved', async () => {
    let t = 1000;
    const a = createMemoryAchievements({
      now: () => {
        const v = t;
        t = 2000;
        return v;
      },
    });
    await a.unlock('winner');
    await a.unlock('winner');
    const s = await a.getState('winner');
    expect(s.unlockedAt).toBe(1000);
    expect(s.progress).toBe(1);
    expect(s.unlocked).toBe(true);
  });

  test('progress clamps and non-finite is treated as 0', async () => {
    const a = createMemoryAchievements({ now: () => 7 });

    await a.unlock('over', 2);
    expect(await a.getState('over')).toEqual({
      id: 'over',
      unlocked: true,
      progress: 1,
      unlockedAt: 7,
    });

    await a.unlock('under', -1);
    expect(await a.getState('under')).toEqual({ id: 'under', unlocked: false, progress: 0 });

    await a.unlock('nan', Number.NaN);
    expect(await a.getState('nan')).toEqual({ id: 'nan', unlocked: false, progress: 0 });
  });

  test('getState returns the default for an untracked id', async () => {
    const a = createMemoryAchievements();
    expect(await a.getState('ghost')).toEqual({ id: 'ghost', unlocked: false, progress: 0 });
  });

  test('getAll reflects all tracked achievements', async () => {
    const a = createMemoryAchievements({ now: () => 100 });
    await a.unlock('a', 1);
    await a.unlock('b', 0.3);
    const all = await a.getAll();
    expect(all).toEqual([
      { id: 'a', unlocked: true, progress: 1, unlockedAt: 100 },
      { id: 'b', unlocked: false, progress: 0.3 },
    ]);
  });
});

describe('createStorageAchievements', () => {
  test('round-trips through the store and rehydrates in a new provider', async () => {
    const store = makeStore();

    const a = createStorageAchievements(store, { now: () => 1000 });
    await a.unlock('persisted');
    expect(store.sets).toBeGreaterThan(0);

    const b = createStorageAchievements(store, { now: () => 9999 });
    expect(await b.getState('persisted')).toEqual({
      id: 'persisted',
      unlocked: true,
      progress: 1,
      unlockedAt: 1000,
    });
  });

  test('monotonic progress survives a reload', async () => {
    const store = makeStore();

    const a = createStorageAchievements(store);
    await a.unlock('climb', 0.6);

    const b = createStorageAchievements(store);
    await b.unlock('climb', 0.3);
    expect(await b.getState('climb')).toEqual({
      id: 'climb',
      unlocked: false,
      progress: 0.6,
    });
  });

  test('a corrupt payload hydrates empty', async () => {
    const store = makeStore();
    store.map.set('flare.achievements', '{not json');

    const a = createStorageAchievements(store);
    expect(await a.getAll()).toEqual([]);
  });

  test('concurrent unlocks serialize without losing an update', async () => {
    const store = makeStore();
    const a = createStorageAchievements(store, { now: () => 1 });

    await Promise.all([a.unlock('x', 1), a.unlock('y', 1), a.unlock('z', 0.4)]);

    const all = await a.getAll();
    expect(all).toHaveLength(3);
    expect(all.map((s) => s.id).sort()).toEqual(['x', 'y', 'z']);
    expect(await a.getState('x')).toEqual({ id: 'x', unlocked: true, progress: 1, unlockedAt: 1 });
    expect(await a.getState('z')).toEqual({ id: 'z', unlocked: false, progress: 0.4 });
  });

  test('uses a custom persistence key', async () => {
    const store = makeStore();
    const a = createStorageAchievements(store, { key: 'custom.key', now: () => 5 });
    await a.unlock('k', 1);
    expect(store.map.has('custom.key')).toBe(true);
    expect(store.map.has('flare.achievements')).toBe(false);
  });
});
