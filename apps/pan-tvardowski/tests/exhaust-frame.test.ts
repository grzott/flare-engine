import { describe, expect, test } from 'bun:test';
import {
  EXHAUST_HZ,
  EXHAUST_MAX_OPACITY,
  EXHAUST_MIN_OPACITY,
  exhaustFrameIndex,
  exhaustPulseAlpha,
} from '../src/fx/exhaust-frame';

const FRAME_COUNT = 20;

describe('exhaustFrameIndex', () => {
  test('returns 0 at t=0', () => {
    expect(exhaustFrameIndex(0, FRAME_COUNT, EXHAUST_HZ)).toBe(0);
  });

  test('advances through all frames within one period', () => {
    const period = 1 / EXHAUST_HZ;
    const seen = new Set<number>();
    const steps = FRAME_COUNT * 4;
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * period;
      seen.add(exhaustFrameIndex(t, FRAME_COUNT, EXHAUST_HZ));
    }
    for (let f = 0; f < FRAME_COUNT; f++) {
      expect(seen.has(f), `frame ${f} never visited`).toBe(true);
    }
  });

  test('wraps at period boundary — same index as t=0', () => {
    const period = 1 / EXHAUST_HZ;
    expect(exhaustFrameIndex(period, FRAME_COUNT, EXHAUST_HZ)).toBe(
      exhaustFrameIndex(0, FRAME_COUNT, EXHAUST_HZ),
    );
  });

  test('stays in [0, frameCount-1] across 200 samples', () => {
    const period = 1 / EXHAUST_HZ;
    for (let i = 0; i < 200; i++) {
      const t = (i / 200) * period * 3.7;
      const idx = exhaustFrameIndex(t, FRAME_COUNT, EXHAUST_HZ);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(FRAME_COUNT);
      expect(Number.isInteger(idx)).toBe(true);
    }
  });

  test('monotonicity within first period: index at t+epsilon >= index at t, strictly greater across a frame boundary', () => {
    const period = 1 / EXHAUST_HZ;
    const frameWidth = period / FRAME_COUNT;
    // Sample just before a frame boundary and just after; index must advance.
    const tBefore = frameWidth * 1 - 1e-9;
    const tAfter = frameWidth * 1 + 1e-9;
    const idxBefore = exhaustFrameIndex(tBefore, FRAME_COUNT, EXHAUST_HZ);
    const idxAfter = exhaustFrameIndex(tAfter, FRAME_COUNT, EXHAUST_HZ);
    expect(idxAfter).toBeGreaterThan(idxBefore);

    // Within a single frame slot the index must be constant (non-decreasing = same).
    const tMid = frameWidth * 2 + frameWidth * 0.5;
    const tMidPlusEps = tMid + 1e-9;
    expect(exhaustFrameIndex(tMidPlusEps, FRAME_COUNT, EXHAUST_HZ)).toBe(
      exhaustFrameIndex(tMid, FRAME_COUNT, EXHAUST_HZ),
    );
  });
});

describe('exhaustPulseAlpha', () => {
  test('returns 0 when !visible', () => {
    expect(
      exhaustPulseAlpha(0, EXHAUST_HZ, EXHAUST_MIN_OPACITY, EXHAUST_MAX_OPACITY, false, false),
    ).toBe(0);
    expect(
      exhaustPulseAlpha(0.5, EXHAUST_HZ, EXHAUST_MIN_OPACITY, EXHAUST_MAX_OPACITY, false, true),
    ).toBe(0);
  });

  test('returns maxOpacity under reducedMotion when visible', () => {
    expect(
      exhaustPulseAlpha(0.1, EXHAUST_HZ, EXHAUST_MIN_OPACITY, EXHAUST_MAX_OPACITY, true, true),
    ).toBe(EXHAUST_MAX_OPACITY);
  });

  test('stays within [minOpacity, maxOpacity] over a full cycle', () => {
    const period = 1 / EXHAUST_HZ;
    const steps = 100;
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * period;
      const alpha = exhaustPulseAlpha(
        t,
        EXHAUST_HZ,
        EXHAUST_MIN_OPACITY,
        EXHAUST_MAX_OPACITY,
        true,
        false,
      );
      expect(alpha).toBeGreaterThanOrEqual(EXHAUST_MIN_OPACITY - 1e-9);
      expect(alpha).toBeLessThanOrEqual(EXHAUST_MAX_OPACITY + 1e-9);
    }
  });

  test('hits minOpacity at sine trough', () => {
    const period = 1 / EXHAUST_HZ;
    // sine trough at t = 3*period/4
    const tTrough = (3 / 4) * period;
    const alpha = exhaustPulseAlpha(
      tTrough,
      EXHAUST_HZ,
      EXHAUST_MIN_OPACITY,
      EXHAUST_MAX_OPACITY,
      true,
      false,
    );
    expect(alpha).toBeCloseTo(EXHAUST_MIN_OPACITY, 5);
  });

  test('hits maxOpacity at sine peak', () => {
    const period = 1 / EXHAUST_HZ;
    // sine peak at t = period/4
    const tPeak = (1 / 4) * period;
    const alpha = exhaustPulseAlpha(
      tPeak,
      EXHAUST_HZ,
      EXHAUST_MIN_OPACITY,
      EXHAUST_MAX_OPACITY,
      true,
      false,
    );
    expect(alpha).toBeCloseTo(EXHAUST_MAX_OPACITY, 5);
  });

  test('spec values: hz=6, minOpacity=0.4, maxOpacity=1.0', () => {
    expect(EXHAUST_HZ).toBe(6);
    expect(EXHAUST_MIN_OPACITY).toBe(0.4);
    expect(EXHAUST_MAX_OPACITY).toBe(1.0);
  });
});
