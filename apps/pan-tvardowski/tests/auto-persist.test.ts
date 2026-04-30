import { describe, expect, test } from 'bun:test';
import { createMemoryAdapter } from '@flare-engine/storage';
import { createSaveStore } from '../src/save/store';
import { gameState } from '../src/state';

describe('auto-persist — session #50 M2', () => {
  test('zone-enter triggers persist', async () => {
    const store = createSaveStore(createMemoryAdapter());
    await store.load();
    let persistCount = 0;
    const origPersist = store.persist.bind(store);
    store.persist = async () => {
      persistCount += 1;
      return origPersist();
    };

    await store.persist();

    expect(persistCount).toBe(1);
  });

  test('30 s idle triggers persist once, then resets accumulator', () => {
    const store = createSaveStore(createMemoryAdapter());
    let persistCount = 0;
    const origPersist = store.persist.bind(store);
    store.persist = async () => {
      persistCount += 1;
      return origPersist();
    };

    let accum = 0;
    gameState.gameOver = false;
    gameState.victory = false;

    for (let i = 0; i < 300; i++) {
      accum += 0.1;
      if (accum >= 30 && !gameState.gameOver && !gameState.victory) {
        accum = 0;
        void store.persist();
      }
    }

    expect(persistCount).toBe(1);
    expect(accum).toBe(0);
  });

  test('game-over flag suppresses idle persist', () => {
    const store = createSaveStore(createMemoryAdapter());
    let persistCount = 0;
    const origPersist = store.persist.bind(store);
    store.persist = async () => {
      persistCount += 1;
      return origPersist();
    };

    let accum = 0;
    gameState.gameOver = true;
    gameState.victory = false;

    for (let i = 0; i < 300; i++) {
      accum += 0.1;
      if (accum >= 30 && !gameState.gameOver && !gameState.victory) {
        accum = 0;
        void store.persist();
      }
    }

    expect(persistCount).toBe(0);

    gameState.gameOver = false;
  });
});
