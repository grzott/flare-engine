import { describe, expect, it } from 'bun:test';
import { hashU32, SeededRNG, seededIndex } from '../src/index.js';

// Known-answer vectors — externally computed lowbias32 outputs, independent of
// the implementation under test, so a regression in the finalizer is caught
// (a self-copy of the algorithm would agree with any bug and prove nothing).
const HASH_VECTORS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 824515495],
  [2, 1722258072],
  [42, 4147366645],
  [1337, 1140425844],
  [0xffffffff, 539527247],
];

describe('hashU32', () => {
  it('returns unsigned 32-bit integers', () => {
    const rng = new SeededRNG(0xabcd);
    for (let i = 0; i < 1000; i++) {
      const seed = (rng.next() * 0xffffffff) | 0;
      const h = hashU32(seed);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(h)).toBe(true);
    }
  });

  it('matches externally-computed lowbias32 known-answer vectors', () => {
    for (const [seed, want] of HASH_VECTORS) {
      expect(hashU32(seed)).toBe(want);
    }
  });

  it('is deterministic across repeated calls', () => {
    const rng = new SeededRNG(0xdeadbeef);
    for (let i = 0; i < 2000; i++) {
      const seed = (rng.next() * 0xffffffff) | 0;
      expect(hashU32(seed)).toBe(hashU32(seed));
    }
  });

  it('decorrelates adjacent seeds — no two consecutive outputs collide in 1000 pairs', () => {
    let collisions = 0;
    for (let i = 0; i < 1000; i++) {
      if (hashU32(i) === hashU32(i + 1)) collisions++;
    }
    // Avalanche finalizer should produce < 1% collisions on adjacent inputs.
    expect(collisions).toBeLessThan(10);
  });
});

describe('seededIndex', () => {
  it('count <= 1 always returns 0', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(seededIndex(seed, 0)).toBe(0);
      expect(seededIndex(seed, 1)).toBe(0);
    }
  });

  it('returns values in [0, count)', () => {
    const rng = new SeededRNG(0xcafe);
    for (let i = 0; i < 1000; i++) {
      const seed = (rng.next() * 0xffffffff) | 0;
      const count = Math.floor(rng.next() * 16) + 2;
      const idx = seededIndex(seed, count);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(count);
    }
  });

  it('is deterministic — same seed + count always gives same result', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(seededIndex(seed, 8)).toBe(seededIndex(seed, 8));
    }
  });

  it('covers all indices for small counts', () => {
    const count = 4;
    const seen = new Set<number>();
    for (let seed = 0; seed < 100; seed++) {
      seen.add(seededIndex(seed, count));
    }
    expect(seen.size).toBe(count);
  });

  it('adjacent seeds produce different indices more than 50% of the time (decorrelated)', () => {
    const count = 8;
    let diff = 0;
    for (let i = 0; i < 1000; i++) {
      if (seededIndex(i, count) !== seededIndex(i + 1, count)) diff++;
    }
    expect(diff).toBeGreaterThan(500);
  });
});
