import { describe, expect, test } from 'bun:test';
import { createMemoryLeaderboards, type SeedScore } from '../src/memory.js';

const BOARD = 'daily_high_score';

function seeded(rows: readonly SeedScore[]) {
  return createMemoryLeaderboards({ seed: { [BOARD]: rows } });
}

describe('createMemoryLeaderboards', () => {
  test('ranks seeded competitors and the local submission descending', async () => {
    const lb = seeded([
      { playerId: 'a', displayName: 'A', score: 300 },
      { playerId: 'b', displayName: 'B', score: 200 },
      { playerId: 'c', displayName: 'C', score: 100 },
    ]);
    await lb.submitScore(BOARD, 250);

    const top = await lb.getTopN(BOARD, 10);
    expect(top.map((e) => e.score)).toEqual([300, 250, 200, 100]);
    expect(top.map((e) => e.rank)).toEqual([1, 2, 3, 4]);
    expect(top[1]?.playerId).toBe('local');
    expect(await lb.getPlayerRank(BOARD)).toBe(2);
  });

  test('breaks score ties by insertion order (first seeded ranks higher)', async () => {
    const lb = seeded([
      { playerId: 'first', displayName: 'First', score: 500 },
      { playerId: 'second', displayName: 'Second', score: 500 },
    ]);

    const top = await lb.getTopN(BOARD, 10);
    expect(top[0]?.playerId).toBe('first');
    expect(top[0]?.rank).toBe(1);
    expect(top[1]?.playerId).toBe('second');
    expect(top[1]?.rank).toBe(2);
  });

  test('keeps the local best score and replaces meta on a higher submission', async () => {
    const lb = createMemoryLeaderboards();

    await lb.submitScore(BOARD, 100, { run: 'first' });
    await lb.submitScore(BOARD, 50, { run: 'second' });

    let top = await lb.getTopN(BOARD, 10);
    expect(top).toHaveLength(1);
    expect(top[0]?.score).toBe(100);
    expect(top[0]?.meta).toEqual({ run: 'first' });

    await lb.submitScore(BOARD, 200, { run: 'third' });
    top = await lb.getTopN(BOARD, 10);
    expect(top).toHaveLength(1);
    expect(top[0]?.score).toBe(200);
    expect(top[0]?.meta).toEqual({ run: 'third' });
    expect(await lb.getPlayerRank(BOARD)).toBe(1);
  });

  test('uses configured local identity for submissions', async () => {
    const lb = createMemoryLeaderboards({ playerId: 'me', displayName: 'Me' });
    await lb.submitScore(BOARD, 42);

    const top = await lb.getTopN(BOARD, 10);
    expect(top[0]?.playerId).toBe('me');
    expect(top[0]?.displayName).toBe('Me');
  });

  test('returns empty results and null rank for unknown or empty queries', async () => {
    const lb = createMemoryLeaderboards();

    expect(await lb.getTopN('missing', 10)).toEqual([]);
    expect(await lb.getPlayerRank('missing')).toBeNull();

    await lb.submitScore(BOARD, 10);
    expect(await lb.getTopN(BOARD, 0)).toEqual([]);
    expect(await lb.getTopN(BOARD, -1)).toEqual([]);
  });
});
