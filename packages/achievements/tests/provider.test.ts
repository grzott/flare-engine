import { describe, expect, test } from 'bun:test';
import { NoopAchievementsProvider } from '../src/provider.js';

describe('NoopAchievementsProvider', () => {
  test('unlock resolves silently', async () => {
    const r = await NoopAchievementsProvider.unlock('first_blood');
    expect(r).toBeUndefined();
  });

  test('unlock accepts partial progress', async () => {
    await NoopAchievementsProvider.unlock('marathon', 0.5);
  });

  test('getState returns default false/0 for any id', async () => {
    const s = await NoopAchievementsProvider.getState('anything');
    expect(s).toEqual({ id: 'anything', unlocked: false, progress: 0 });
  });

  test('getState echoes the requested id', async () => {
    const a = await NoopAchievementsProvider.getState('a');
    const b = await NoopAchievementsProvider.getState('b');
    expect(a.id).toBe('a');
    expect(b.id).toBe('b');
  });

  test('getAll returns empty array', async () => {
    const all = await NoopAchievementsProvider.getAll();
    expect(all).toEqual([]);
  });
});
