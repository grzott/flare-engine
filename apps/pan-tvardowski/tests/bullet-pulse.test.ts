/**
 * KG4 — bulletPulseAlpha pure-function tests.
 *
 * Verifies the smooth alpha pulse helper is:
 *   - monotonically rising then falling across one half-cycle (smooth, not binary)
 *   - confined to the expected min/max ranges per bullet type
 *   - returning 1.0 under reducedMotion (no animation)
 *   - alpha-only (no side-effects, pure function)
 */

import { describe, expect, test } from 'bun:test';
import { bulletPulseAlpha } from '../src/fx/bullet-pulse';

const PERIOD = 2.0;
const STEPS = 64;

describe('bulletPulseAlpha — reduced motion', () => {
  test('returns exactly 1.0 for player bullet under reducedMotion', () => {
    for (let i = 0; i < STEPS; i++) {
      const t = (i / STEPS) * PERIOD * 2;
      expect(bulletPulseAlpha(t, true, true)).toBe(1.0);
    }
  });

  test('returns exactly 1.0 for enemy bullet under reducedMotion', () => {
    for (let i = 0; i < STEPS; i++) {
      const t = (i / STEPS) * PERIOD * 2;
      expect(bulletPulseAlpha(t, false, true)).toBe(1.0);
    }
  });
});

describe('bulletPulseAlpha — alpha range', () => {
  test('player bullet alpha stays within [0.55, 1.0]', () => {
    for (let i = 0; i < STEPS; i++) {
      const t = (i / STEPS) * PERIOD;
      const alpha = bulletPulseAlpha(t, true, false);
      expect(alpha).toBeGreaterThanOrEqual(0.55 - 1e-9);
      expect(alpha).toBeLessThanOrEqual(1.0 + 1e-9);
    }
  });

  test('enemy bullet alpha stays within [0.45, 0.9]', () => {
    for (let i = 0; i < STEPS; i++) {
      const t = (i / STEPS) * PERIOD;
      const alpha = bulletPulseAlpha(t, false, false);
      expect(alpha).toBeGreaterThanOrEqual(0.45 - 1e-9);
      expect(alpha).toBeLessThanOrEqual(0.9 + 1e-9);
    }
  });

  test('player bullet hits minimum 0.55 near t=3/4 period (sine trough)', () => {
    // sine is -1 at t = 3T/4 → unit=0 → alpha = 0.55
    const t = (3 / 4) * PERIOD;
    const alpha = bulletPulseAlpha(t, true, false);
    expect(alpha).toBeCloseTo(0.55, 4);
  });

  test('player bullet hits maximum 1.0 near t=1/4 period (sine peak)', () => {
    // sine is +1 at t = T/4 → unit=1 → alpha = 0.55 + 0.45 = 1.0
    const t = (1 / 4) * PERIOD;
    const alpha = bulletPulseAlpha(t, true, false);
    expect(alpha).toBeCloseTo(1.0, 4);
  });

  test('enemy bullet hits minimum 0.45 near t=3/4 period (sine trough)', () => {
    const t = (3 / 4) * PERIOD;
    const alpha = bulletPulseAlpha(t, false, false);
    expect(alpha).toBeCloseTo(0.45, 4);
  });

  test('enemy bullet hits maximum 0.9 near t=1/4 period (sine peak)', () => {
    // 0.45 + 0.45 = 0.9
    const t = (1 / 4) * PERIOD;
    const alpha = bulletPulseAlpha(t, false, false);
    expect(alpha).toBeCloseTo(0.9, 4);
  });
});

describe('bulletPulseAlpha — smooth (monotonic half-cycles)', () => {
  test('player bullet rises monotonically from t=0 to t=T/4', () => {
    let prev = bulletPulseAlpha(0, true, false);
    for (let i = 1; i <= STEPS / 4; i++) {
      const t = (i / STEPS) * PERIOD;
      const curr = bulletPulseAlpha(t, true, false);
      expect(curr).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = curr;
    }
  });

  test('player bullet falls monotonically from t=T/4 to t=3T/4', () => {
    let prev = bulletPulseAlpha((1 / 4) * PERIOD, true, false);
    for (let i = 1; i <= STEPS / 2; i++) {
      const t = (1 / 4 + i / (2 * STEPS)) * PERIOD;
      const curr = bulletPulseAlpha(t, true, false);
      expect(curr).toBeLessThanOrEqual(prev + 1e-9);
      prev = curr;
    }
  });
});
