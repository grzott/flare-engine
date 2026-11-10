import { describe, expect, spyOn, test } from 'bun:test';
import { createFrameBudget } from '../src/frame-budget.js';
import type { FrameBudgetOpts } from '../src/index.js';

const LIMITS = { draws: 100, particles: 50 };

describe('createFrameBudget', () => {
  test('accepts an options object typed as the exported FrameBudgetOpts', () => {
    let fired = 0;
    const opts: FrameBudgetOpts = {
      limits: { draws: 10 },
      ringSize: 4,
      fpsThreshold: 55,
      onWatchdog: () => {
        fired += 1;
      },
    };
    const h = createFrameBudget(opts);
    for (let i = 0; i < 4; i++) h.recordFrame(1 / 30);
    expect(h.getAvgFps()).toBeCloseTo(30, 3);
    expect(fired).toBe(1);
    h.recordCounters({ draws: 7 });
    expect(h.getSnapshot().draws).toBe(7);
  });

  test('getAvgFps returns 0 before ring is full', () => {
    const h = createFrameBudget({ limits: LIMITS, ringSize: 10 });
    for (let i = 0; i < 9; i++) h.recordFrame(1 / 60);
    expect(h.getAvgFps()).toBe(0);
  });

  test('getAvgFps returns correct average when ring is exactly full', () => {
    const ringSize = 10;
    const h = createFrameBudget({ limits: LIMITS, ringSize });
    const dt = 1 / 60;
    for (let i = 0; i < ringSize; i++) h.recordFrame(dt);
    expect(h.getAvgFps()).toBeCloseTo(60, 3);
  });

  test('ring wrap-around evicts oldest value and reflects new window', () => {
    const ringSize = 4;
    const h = createFrameBudget({ limits: LIMITS, ringSize, fpsThreshold: 0 });
    // Fill with 30 fps dt
    for (let i = 0; i < ringSize; i++) h.recordFrame(1 / 30);
    expect(h.getAvgFps()).toBeCloseTo(30, 3);
    // Overwrite all with 60 fps dt (one full extra revolution)
    for (let i = 0; i < ringSize; i++) h.recordFrame(1 / 60);
    expect(h.getAvgFps()).toBeCloseTo(60, 3);
  });

  test('watchdog fires once when avg fps drops below threshold', () => {
    let fired = 0;
    const ringSize = 4;
    const h = createFrameBudget({
      limits: LIMITS,
      ringSize,
      fpsThreshold: 55,
      onWatchdog: () => {
        fired += 1;
      },
    });
    for (let i = 0; i < ringSize; i++) h.recordFrame(1 / 30);
    expect(fired).toBe(1);
  });

  test('watchdog does not re-fire on subsequent under-threshold frames', () => {
    let fired = 0;
    const ringSize = 4;
    const h = createFrameBudget({
      limits: LIMITS,
      ringSize,
      fpsThreshold: 55,
      onWatchdog: () => {
        fired += 1;
      },
    });
    for (let i = 0; i < ringSize * 3; i++) h.recordFrame(1 / 30);
    expect(fired).toBe(1);
  });

  test('watchdog does not fire when avg fps is above threshold', () => {
    let fired = 0;
    const ringSize = 4;
    const h = createFrameBudget({
      limits: LIMITS,
      ringSize,
      fpsThreshold: 55,
      onWatchdog: () => {
        fired += 1;
      },
    });
    for (let i = 0; i < ringSize; i++) h.recordFrame(1 / 60);
    expect(fired).toBe(0);
  });

  test('resetFpsRing clears ring and re-arms watchdog', () => {
    let fired = 0;
    const ringSize = 4;
    const h = createFrameBudget({
      limits: LIMITS,
      ringSize,
      fpsThreshold: 55,
      onWatchdog: () => {
        fired += 1;
      },
    });
    for (let i = 0; i < ringSize; i++) h.recordFrame(1 / 30);
    expect(fired).toBe(1);

    h.resetFpsRing();
    expect(h.getAvgFps()).toBe(0);

    for (let i = 0; i < ringSize; i++) h.recordFrame(1 / 30);
    expect(fired).toBe(2);
  });

  test('getAvgFps matches a brute-force window average for non-uniform dts across wraps', () => {
    const ringSize = 8;
    const h = createFrameBudget({ limits: LIMITS, ringSize, fpsThreshold: 0 });
    const dts: number[] = [];
    const expectedFps = (): number => {
      let sum = 0;
      for (let i = dts.length - ringSize; i < dts.length; i++) {
        sum += Math.fround(dts[i] as number);
      }
      return ringSize / sum;
    };
    let checkedMidRing = 0;
    let checkedAtWrap = 0;
    for (let k = 0; k < ringSize * 5 + 3; k++) {
      const dt = 1 / 120 + ((k * 37) % 11) * 0.0013;
      dts.push(dt);
      h.recordFrame(dt);
      if (dts.length < ringSize) continue;
      expect(h.getAvgFps()).toBeCloseTo(expectedFps(), 9);
      if (dts.length % ringSize === 0) checkedAtWrap += 1;
      else checkedMidRing += 1;
    }
    expect(checkedAtWrap).toBe(5);
    expect(checkedMidRing).toBe(ringSize * 4 + 3 - 4);
  });

  for (const [label, bad] of [
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['1e30', 1e30],
  ] as const) {
    test(`getAvgFps recovers once a ${label} dt has left the window`, () => {
      const ringSize = 6;
      const h = createFrameBudget({ limits: LIMITS, ringSize, fpsThreshold: 0 });
      for (let i = 0; i < ringSize; i++) h.recordFrame(1 / 60);
      h.recordFrame(bad);
      for (let i = 0; i < ringSize * 2; i++) h.recordFrame(1 / 60);
      // The ring stores f32, so a window of 1/60 reads 1 / fround(1/60) = 59.9999969, not 60.
      expect(h.getAvgFps()).toBeCloseTo(1 / Math.fround(1 / 60), 6);
    });
  }

  test('getAvgFps does not drift over 1e6 frames with the default ring', () => {
    const ringSize = 180;
    const frames = 1_000_000;
    const h = createFrameBudget({ limits: LIMITS, fpsThreshold: 0 });
    for (let k = 0; k < frames; k++) {
      h.recordFrame(1 / 60 + (k % 7) * 1e-4);
    }
    let sum = 0;
    for (let k = frames - ringSize; k < frames; k++) {
      sum += Math.fround(1 / 60 + (k % 7) * 1e-4);
    }
    expect(h.getAvgFps()).toBeCloseTo(ringSize / sum, 9);
  });

  test('resetFpsRing discards the old window so a refill reads only new frames', () => {
    const ringSize = 5;
    const h = createFrameBudget({ limits: LIMITS, ringSize, fpsThreshold: 0 });
    for (let i = 0; i < ringSize; i++) h.recordFrame(1 / 60);
    expect(h.getAvgFps()).toBeCloseTo(60, 3);
    h.resetFpsRing();
    for (let i = 0; i < ringSize - 1; i++) h.recordFrame(1 / 30);
    expect(h.getAvgFps()).toBe(0);
    h.recordFrame(1 / 30);
    expect(h.getAvgFps()).toBeCloseTo(30, 3);
  });

  test('recordCounters copies snapshot and warns on limit breach when debug=true', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    const h = createFrameBudget({ limits: LIMITS, debug: true });

    h.recordCounters({ draws: 50, particles: 80 });
    const snap = h.getSnapshot();

    expect(snap.draws).toBe(50);
    expect(snap.particles).toBe(80);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/particles over limit/);

    warnSpy.mockRestore();
  });

  test('getSnapshot returns same object reference across calls (zero-alloc)', () => {
    const h = createFrameBudget({ limits: LIMITS });
    const ref1 = h.getSnapshot();
    h.recordCounters({ draws: 10, particles: 5 });
    const ref2 = h.getSnapshot();
    expect(ref1).toBe(ref2);
  });
});
