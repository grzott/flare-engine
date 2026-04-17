import { describe, expect, it } from 'bun:test';
import { GameLoop } from '../src/game-loop.js';

describe('GameLoop.step', () => {
  it('fires onUpdate with scaled dt', () => {
    const loop = new GameLoop();
    const dts: number[] = [];
    loop.onUpdate.add((dt) => {
      dts.push(dt);
    });
    loop.step(1 / 60);
    expect(dts.length).toBe(1);
    expect(dts[0]).toBeCloseTo(1 / 60);
  });

  it('fires onLateUpdate after onUpdate', () => {
    const loop = new GameLoop();
    const order: string[] = [];
    loop.onUpdate.add(() => {
      order.push('update');
    });
    loop.onLateUpdate.add(() => {
      order.push('late');
    });
    loop.step(1 / 60);
    expect(order).toEqual(['update', 'late']);
  });

  it('fires onPreRender and onPostRender', () => {
    const loop = new GameLoop();
    const order: string[] = [];
    loop.onUpdate.add(() => {
      order.push('update');
    });
    loop.onPreRender.add(() => {
      order.push('pre');
    });
    loop.onPostRender.add(() => {
      order.push('post');
    });
    loop.step(1 / 60);
    expect(order).toEqual(['update', 'pre', 'post']);
  });

  it('fires fixed updates at fixed rate', () => {
    const loop = new GameLoop({ fixedDt: 1 / 60 });
    let fixedCount = 0;
    loop.onFixedUpdate.add(() => {
      fixedCount++;
    });
    // Step with 2.5 fixed steps worth of time
    loop.step(2.5 / 60);
    expect(fixedCount).toBe(2);
  });

  it('accumulates remainder for next fixed update', () => {
    const loop = new GameLoop({ fixedDt: 1 / 60 });
    let fixedCount = 0;
    loop.onFixedUpdate.add(() => {
      fixedCount++;
    });
    loop.step(0.5 / 60); // Not enough for one fixed step
    expect(fixedCount).toBe(0);
    loop.step(0.6 / 60); // Now total > 1 fixedDt
    expect(fixedCount).toBe(1);
  });

  it('caps dt to prevent spiral of death', () => {
    const loop = new GameLoop({ maxDt: 0.1 });
    loop.step(1.0); // Huge dt
    expect(loop.clock.rawDt).toBeCloseTo(0.1);
  });

  it('does nothing when paused', () => {
    const loop = new GameLoop();
    let called = false;
    loop.onUpdate.add(() => {
      called = true;
    });
    loop.tick = () => 1;
    loop.cancelTick = () => {};
    loop.start();
    loop.pause();
    loop.step(1 / 60);
    expect(called).toBe(false);
    loop.stop();
  });

  it('respects timescale', () => {
    const loop = new GameLoop();
    loop.clock.timescale = 0.5;
    const dts: number[] = [];
    loop.onUpdate.add((dt) => {
      dts.push(dt);
    });
    loop.step(1 / 60);
    expect(dts[0]).toBeCloseTo(1 / 120);
  });

  it('fixed update receives fixedDt not variable dt', () => {
    const loop = new GameLoop({ fixedDt: 1 / 60 });
    const fixedDts: number[] = [];
    loop.onFixedUpdate.add((dt) => {
      fixedDts.push(dt);
    });
    loop.step(2 / 60);
    expect(fixedDts.length).toBe(2);
    expect(fixedDts[0]).toBeCloseTo(1 / 60);
    expect(fixedDts[1]).toBeCloseTo(1 / 60);
  });
});

describe('GameLoop.start/stop', () => {
  it('sets isRunning', () => {
    const loop = new GameLoop();
    loop.tick = () => 1;
    loop.cancelTick = () => {};
    expect(loop.isRunning).toBe(false);
    loop.start();
    expect(loop.isRunning).toBe(true);
    loop.stop();
    expect(loop.isRunning).toBe(false);
  });

  it('start is idempotent', () => {
    const loop = new GameLoop();
    // Mock tick to prevent actual rAF
    loop.tick = () => 1;
    loop.cancelTick = () => {};
    loop.start();
    loop.start(); // Should not throw
    loop.stop();
  });
});

describe('GameLoop.pause/resume', () => {
  it('sets isPaused', () => {
    const loop = new GameLoop();
    loop.tick = () => 1;
    loop.cancelTick = () => {};
    loop.start();
    expect(loop.isPaused).toBe(false);
    loop.pause();
    expect(loop.isPaused).toBe(true);
    loop.resume();
    expect(loop.isPaused).toBe(false);
    loop.stop();
  });

  it('pause before start is no-op', () => {
    const loop = new GameLoop();
    loop.pause();
    expect(loop.isPaused).toBe(false);
  });

  it('resume before pause is no-op', () => {
    const loop = new GameLoop();
    loop.tick = () => 1;
    loop.cancelTick = () => {};
    loop.start();
    loop.resume(); // Not paused — should not throw
    loop.stop();
  });
});

describe('GameLoop with custom tick', () => {
  it('drives frames via custom tick', () => {
    const loop = new GameLoop();
    const callbacks: ((time: number) => void)[] = [];
    loop.tick = (cb) => {
      callbacks.push(cb);
      return callbacks.length;
    };
    loop.cancelTick = () => {};

    const dts: number[] = [];
    loop.onUpdate.add((dt) => {
      dts.push(dt);
    });

    loop.start();
    // First callback sets lastTime
    callbacks[0]!(1000);
    // Second callback produces a frame
    callbacks[1]!(1016.67);

    expect(dts.length).toBe(1);
    expect(dts[0]).toBeCloseTo(0.01667, 3);
    loop.stop();
  });
});
