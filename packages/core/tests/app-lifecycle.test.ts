import { describe, expect, it } from 'bun:test';
import { AppLifecycle } from '../src/app-lifecycle.js';
import { GameLoop } from '../src/game-loop.js';

function createLoop(): GameLoop {
  const loop = new GameLoop();
  loop.tick = () => 1;
  loop.cancelTick = () => {};
  return loop;
}

describe('AppLifecycle.background', () => {
  it('pauses the game loop', () => {
    const loop = createLoop();
    const lifecycle = new AppLifecycle(loop);
    loop.start();
    lifecycle.background();
    expect(loop.isPaused).toBe(true);
  });

  it('fires onBackground signal', () => {
    const loop = createLoop();
    const lifecycle = new AppLifecycle(loop);
    let fired = false;
    lifecycle.onBackground.add(() => {
      fired = true;
    });
    lifecycle.background();
    expect(fired).toBe(true);
  });

  it('does not pause if already paused', () => {
    const loop = createLoop();
    const lifecycle = new AppLifecycle(loop);
    loop.start();
    loop.pause(); // Manually paused
    lifecycle.background();
    // wasRunningBeforeBackground should be false since it was already paused
    lifecycle.foreground();
    // Should NOT resume since it wasn't running before background
    expect(loop.isPaused).toBe(true);
    loop.stop();
  });
});

describe('AppLifecycle.foreground', () => {
  it('resumes the game loop', () => {
    const loop = createLoop();
    const lifecycle = new AppLifecycle(loop);
    loop.start();
    lifecycle.background();
    lifecycle.foreground();
    expect(loop.isPaused).toBe(false);
    loop.stop();
  });

  it('fires onForeground signal', () => {
    const loop = createLoop();
    const lifecycle = new AppLifecycle(loop);
    let fired = false;
    lifecycle.onForeground.add(() => {
      fired = true;
    });
    lifecycle.foreground();
    expect(fired).toBe(true);
  });

  it('does not resume if loop was not running before background', () => {
    const loop = createLoop();
    const lifecycle = new AppLifecycle(loop);
    // Loop never started
    lifecycle.background();
    lifecycle.foreground();
    expect(loop.isRunning).toBe(false);
  });
});

describe('AppLifecycle.memoryWarning', () => {
  it('fires onMemoryWarning signal', () => {
    const loop = createLoop();
    const lifecycle = new AppLifecycle(loop);
    let fired = false;
    lifecycle.onMemoryWarning.add(() => {
      fired = true;
    });
    lifecycle.memoryWarning();
    expect(fired).toBe(true);
  });
});

describe('AppLifecycle idempotency', () => {
  it('second background() call is a no-op — foreground() still resumes', () => {
    const loop = createLoop();
    const lifecycle = new AppLifecycle(loop);
    loop.start();
    lifecycle.background();
    expect(loop.isPaused).toBe(true);
    lifecycle.background(); // second call — must not overwrite wasRunning flag
    lifecycle.foreground();
    expect(loop.isPaused).toBe(false);
    loop.stop();
  });

  it('onBackground fires only on the first background() call', () => {
    const loop = createLoop();
    const lifecycle = new AppLifecycle(loop);
    loop.start();
    let count = 0;
    lifecycle.onBackground.add(() => {
      count++;
    });
    lifecycle.background();
    lifecycle.background();
    expect(count).toBe(1);
    loop.stop();
  });
});
