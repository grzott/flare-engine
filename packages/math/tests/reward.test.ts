import { describe, expect, it } from 'bun:test';
import {
  advanceWindowedStreak,
  cappedBonus,
  remainingInWindow,
  windowExpired,
} from '../src/index.js';

describe('cappedBonus', () => {
  it('returns 0 for zero pay', () => {
    expect(cappedBonus(0, 0.5, 1.0)).toBe(0);
  });

  it('returns 0 for negative pay', () => {
    expect(cappedBonus(-10, 0.5, 1.0)).toBe(0);
  });

  it('floors the result', () => {
    expect(cappedBonus(10, 0.3, 1.0)).toBe(3);
    expect(cappedBonus(10, 0.35, 1.0)).toBe(3);
  });

  it('cap bounds the multiplier', () => {
    // frac=2.0 > capFrac=1.0 → min(2.0, 1.0)=1.0
    expect(cappedBonus(100, 2.0, 1.0)).toBe(100);
  });

  it('frac below cap is used directly', () => {
    expect(cappedBonus(100, 0.6, 1.0)).toBe(60);
  });

  it('chain × perLink pattern matches PT reference', () => {
    const killPay = 25;
    const fracPerLink = 0.04;
    const capFrac = 1.0;
    // PT: Math.floor(killPay * Math.min(chain * fracPerLink, capFrac))
    for (let chain = 1; chain <= 30; chain++) {
      const frac = chain * fracPerLink;
      const expected = Math.floor(killPay * Math.min(frac, capFrac));
      expect(cappedBonus(killPay, frac, capFrac)).toBe(expected);
    }
  });
});

describe('advanceWindowedStreak', () => {
  it('lastT < 0 (first event) resets to 1', () => {
    expect(advanceWindowedStreak(5, 10, -1, 2.5)).toBe(1);
  });

  it('within window increments', () => {
    expect(advanceWindowedStreak(3, 12.0, 10.0, 2.5)).toBe(4);
  });

  it('exactly at window boundary still increments (<=)', () => {
    expect(advanceWindowedStreak(3, 12.5, 10.0, 2.5)).toBe(4);
  });

  it('beyond window resets to 1', () => {
    expect(advanceWindowedStreak(3, 12.51, 10.0, 2.5)).toBe(1);
  });

  it('matches PT advanceChain reference byte-for-byte', () => {
    // PT: if (lastKillT >= 0 && elapsed - lastKillT <= CHAIN_WINDOW_SEC) return prev + 1; return 1;
    const window = 2.5;
    const cases: [number, number, number][] = [
      [1, 5.0, 3.0],
      [10, 5.0, 2.6],
      [7, 5.0, 2.4],
      [1, 5.0, -1],
      [3, 10.0, 7.4],
    ];
    for (const [prev, elapsed, lastT] of cases) {
      const ptRef = lastT >= 0 && elapsed - lastT <= window ? prev + 1 : 1;
      expect(advanceWindowedStreak(prev, elapsed, lastT, window)).toBe(ptRef);
    }
  });
});

describe('windowExpired', () => {
  it('lastT < 0 never expires', () => {
    expect(windowExpired(1000, -1, 2.5)).toBe(false);
  });

  it('elapsed <= lastT + window is not expired', () => {
    expect(windowExpired(12.5, 10.0, 2.5)).toBe(false);
  });

  it('elapsed > lastT + window is expired', () => {
    expect(windowExpired(12.51, 10.0, 2.5)).toBe(true);
  });

  it('matches PT chainLapsed reference byte-for-byte', () => {
    // PT: return lastKillT >= 0 && elapsed - lastKillT > CHAIN_WINDOW_SEC;
    const window = 2.5;
    const cases: [number, number][] = [
      [10.0, -1],
      [12.5, 10.0],
      [12.51, 10.0],
      [0.0, 0.0],
      [5.1, 2.6],
    ];
    for (const [elapsed, lastT] of cases) {
      const ptRef = lastT >= 0 && elapsed - lastT > window;
      expect(windowExpired(elapsed, lastT, window)).toBe(ptRef);
    }
  });
});

describe('remainingInWindow', () => {
  it('returns cap when none awarded', () => {
    expect(remainingInWindow(0, 8)).toBe(8);
  });

  it('decrements correctly', () => {
    expect(remainingInWindow(5, 8)).toBe(3);
  });

  it('clamps to 0 when at cap', () => {
    expect(remainingInWindow(8, 8)).toBe(0);
  });

  it('clamps to 0 when over cap', () => {
    expect(remainingInWindow(10, 8)).toBe(0);
  });

  it('matches PT grazeRemainingThisSec pattern', () => {
    // PT: return Math.max(0, GRAZE_PER_SEC_CAP - awardedThisSec);
    const cap = 8;
    for (let awarded = 0; awarded <= 12; awarded++) {
      const ptRef = Math.max(0, cap - awarded);
      expect(remainingInWindow(awarded, cap)).toBe(ptRef);
    }
  });
});
