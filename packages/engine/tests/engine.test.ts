import { describe, expect, it } from 'bun:test';
import { createGame } from '../src/engine.js';

describe('createGame', () => {
  it('returns a GameInstance with all subsystems', () => {
    const game = createGame();
    expect(game.world).toBeDefined();
    expect(game.camera).toBeDefined();
    expect(game.renderer).toBeDefined();
    expect(game.batch).toBeDefined();
    expect(game.input).toBeDefined();
    expect(game.audio).toBeDefined();
    expect(game.assets).toBeDefined();
    expect(game.scenes).toBeDefined();
    expect(game.loop).toBeDefined();
  });

  it('returns start and stop functions', () => {
    const game = createGame();
    expect(typeof game.start).toBe('function');
    expect(typeof game.stop).toBe('function');
  });

  it('starts and stops the loop', () => {
    const game = createGame();
    // Provide a custom tick to prevent actual rAF
    game.loop.tick = (cb) => {
      void cb;
      return 0;
    };
    game.loop.cancelTick = () => {};

    game.start();
    expect(game.loop.isRunning).toBe(true);
    game.stop();
    expect(game.loop.isRunning).toBe(false);
  });

  it('accepts config with fixedDt and maxDt', () => {
    const game = createGame({ fixedDt: 1 / 30, maxDt: 0.5 });
    expect(game.loop.clock.fixedDt).toBeCloseTo(1 / 30);
  });

  it('creates independent instances', () => {
    const a = createGame();
    const b = createGame();
    expect(a.world).not.toBe(b.world);
    expect(a.loop).not.toBe(b.loop);
  });

  it('uses provided assetLoader', () => {
    let called = false;
    const loader = async () => {
      called = true;
      return null;
    };
    const game = createGame({ assetLoader: loader });
    // Load a single entry to confirm the loader is wired
    game.assets.load([{ key: 'test', type: 'json', path: 'test.json' }]);
    expect(called).toBe(true);
  });
});
