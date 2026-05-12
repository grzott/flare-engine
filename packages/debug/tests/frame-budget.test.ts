import { describe, expect, spyOn, test } from 'bun:test';
import { createFrameBudget } from '../src/frame-budget.js';

const LIMITS = { draws: 100, particles: 50 };

describe('createFrameBudget', () => {
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
