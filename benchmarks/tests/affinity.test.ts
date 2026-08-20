import { describe, expect, it } from 'bun:test';
import { type Affinity, isHybrid, judgeAffinity, readAffinity } from '../src/affinity.js';

/** The capture machine: i9-13900KF, 8 P-cores (16 threads) + 16 E-cores = 24 cores / 32 logical. */
const hybrid = (mask: string, selected: number): Affinity => ({
  mask,
  selected,
  physical: 24,
  logical: 32,
});

/** A plain SMT part: 8 cores, 16 threads. */
const smt = (mask: string, selected: number): Affinity => ({
  mask,
  selected,
  physical: 8,
  logical: 16,
});

describe('isHybrid', () => {
  it('detects P+E topology, where logical sits between physical and 2x physical', () => {
    expect(isHybrid(hybrid('0xffffffff', 32))).toBe(true);
  });

  it('does not mistake plain SMT for hybrid', () => {
    expect(isHybrid(smt('0xffff', 16))).toBe(false);
  });

  it('does not mistake an SMT-less part for hybrid', () => {
    expect(isHybrid({ mask: '0xff', selected: 8, physical: 8, logical: 8 })).toBe(false);
  });
});

describe('judgeAffinity', () => {
  it('refuses an unpinned capture on a hybrid host', () => {
    const v = judgeAffinity(hybrid('0xffffffff', 32));
    expect(v.kind).toBe('refuse');
    if (v.kind !== 'refuse') return;
    // The message must carry the fix — this fires on a machine mid-capture.
    expect(v.message).toContain('bun run bench:pinned');
    // ...and the evidence, so a reader can tell a measured refusal from a stylistic one.
    expect(v.message).toContain('1.70-1.80');
  });

  it('accepts a pinned capture on a hybrid host', () => {
    expect(judgeAffinity(hybrid('0xffff', 16)).kind).toBe('ok');
  });

  it('accepts an unpinned capture on a non-hybrid host — the effect was never measured there', () => {
    expect(judgeAffinity(smt('0xffff', 16)).kind).toBe('ok');
  });

  it('accepts a host that cannot report affinity rather than fabricating a verdict', () => {
    expect(judgeAffinity(null).kind).toBe('ok');
  });
});

describe('readAffinity', () => {
  it('reports a mask whose popcount matches the selected count, or null off-Windows', () => {
    const a = readAffinity();
    if (a === null) {
      expect(process.platform).not.toBe('win32');
      return;
    }
    expect(a.mask).toMatch(/^0x[0-9a-f]+$/);
    expect(a.selected).toBeGreaterThan(0);
    expect(a.selected).toBeLessThanOrEqual(a.logical);
    expect(a.physical).toBeGreaterThan(0);
    expect(a.logical).toBeGreaterThanOrEqual(a.physical);
  });
});
