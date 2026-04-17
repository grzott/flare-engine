import { describe, expect, it } from 'bun:test';
import { Clock } from '../src/clock.js';

describe('Clock.update', () => {
  it('sets dt with timescale', () => {
    const clock = new Clock();
    clock.timescale = 0.5;
    clock.update(1 / 60);
    expect(clock.rawDt).toBeCloseTo(1 / 60);
    expect(clock.dt).toBeCloseTo(1 / 120);
  });

  it('accumulates elapsed time', () => {
    const clock = new Clock();
    clock.update(0.016);
    clock.update(0.016);
    clock.update(0.016);
    expect(clock.elapsed).toBeCloseTo(0.048);
  });

  it('increments frame counter', () => {
    const clock = new Clock();
    clock.update(0.016);
    clock.update(0.016);
    expect(clock.frame).toBe(2);
  });

  it('computes fps', () => {
    const clock = new Clock();
    // First frame initializes fps from instant value
    clock.update(1 / 60);
    expect(clock.fps).toBeCloseTo(60, 0);
    // Subsequent frames smooth
    clock.update(1 / 60);
    expect(clock.fps).toBeCloseTo(60, 0);
  });

  it('fps handles zero dt gracefully', () => {
    const clock = new Clock();
    clock.update(0);
    expect(clock.fps).toBe(0);
  });

  it('timescale 0 stops elapsed', () => {
    const clock = new Clock();
    clock.timescale = 0;
    clock.update(0.016);
    expect(clock.dt).toBe(0);
    expect(clock.elapsed).toBe(0);
  });
});

describe('Clock.schedule', () => {
  it('fires after delay', () => {
    const clock = new Clock();
    let fired = false;
    clock.schedule(0.1, () => {
      fired = true;
    });
    clock.update(0.05);
    expect(fired).toBe(false);
    clock.update(0.06);
    expect(fired).toBe(true);
  });

  it('fires only once', () => {
    const clock = new Clock();
    let count = 0;
    clock.schedule(0.05, () => {
      count++;
    });
    clock.update(0.1);
    clock.update(0.1);
    expect(count).toBe(1);
  });

  it('can be cancelled', () => {
    const clock = new Clock();
    let fired = false;
    const cancel = clock.schedule(0.05, () => {
      fired = true;
    });
    cancel();
    clock.update(0.1);
    expect(fired).toBe(false);
  });

  it('respects timescale', () => {
    const clock = new Clock();
    clock.timescale = 2;
    let fired = false;
    clock.schedule(0.1, () => {
      fired = true;
    });
    // rawDt=0.04 → scaled dt=0.08 (not enough)
    clock.update(0.04);
    expect(fired).toBe(false);
    // rawDt=0.02 → scaled dt=0.04, total=0.12 (enough)
    clock.update(0.02);
    expect(fired).toBe(true);
  });
});

describe('Clock.repeat', () => {
  it('fires repeatedly', () => {
    const clock = new Clock();
    let count = 0;
    clock.repeat(0.1, () => {
      count++;
    });
    clock.update(0.15);
    expect(count).toBe(1);
    clock.update(0.1);
    expect(count).toBe(2);
  });

  it('can be cancelled', () => {
    const clock = new Clock();
    let count = 0;
    const cancel = clock.repeat(0.1, () => {
      count++;
    });
    clock.update(0.15);
    expect(count).toBe(1);
    cancel();
    clock.update(0.15);
    expect(count).toBe(1);
  });
});

describe('Clock.reset', () => {
  it('resets all state', () => {
    const clock = new Clock();
    clock.update(0.016);
    clock.update(0.016);
    clock.timescale = 2;
    clock.reset();
    expect(clock.dt).toBe(0);
    expect(clock.rawDt).toBe(0);
    expect(clock.elapsed).toBe(0);
    expect(clock.fps).toBe(0);
    expect(clock.frame).toBe(0);
    expect(clock.timescale).toBe(1);
  });

  it('clears scheduled callbacks', () => {
    const clock = new Clock();
    let fired = false;
    clock.schedule(0.05, () => {
      fired = true;
    });
    clock.reset();
    clock.update(0.1);
    expect(fired).toBe(false);
  });
});
