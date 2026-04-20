import { describe, expect, test } from 'bun:test';
import { NoopLeaderboardsProvider } from '../src/provider.js';

describe('NoopLeaderboardsProvider', () => {
  test('submitScore resolves with no value', async () => {
    const result = await NoopLeaderboardsProvider.submitScore('daily', 100);
    expect(result).toBeUndefined();
  });

  test('submitScore accepts meta payload', async () => {
    await NoopLeaderboardsProvider.submitScore('daily', 100, { run: 1 });
    // no throw = pass
  });

  test('getTopN returns empty array', async () => {
    const top = await NoopLeaderboardsProvider.getTopN('daily', 10);
    expect(top).toEqual([]);
    expect(Array.isArray(top)).toBe(true);
  });

  test('getTopN returns the same shape regardless of n', async () => {
    expect(await NoopLeaderboardsProvider.getTopN('daily', 0)).toEqual([]);
    expect(await NoopLeaderboardsProvider.getTopN('daily', 1000)).toEqual([]);
  });

  test('getPlayerRank resolves to null', async () => {
    const rank = await NoopLeaderboardsProvider.getPlayerRank('daily');
    expect(rank).toBeNull();
  });
});
