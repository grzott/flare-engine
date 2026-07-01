import { describe, expect, it } from 'bun:test';
import { SeededRNG, weightedIndex, weightedIndexBy, weightedPick } from '../src/index.js';

// Known-answer band table for weights [10,3,7,1,5] (total 26): each roll maps to
// the half-open cumulative band [prev,cum) it lands in — derived from the weighted
// semantics, independent of the implementation under test.
const BANDS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.1, 0],
  [0.384, 0],
  [0.385, 1],
  [0.4, 1],
  [0.5, 2],
  [0.75, 2],
  [0.8, 3],
  [0.99, 4],
  [0.999999, 4],
];

describe('weightedIndex', () => {
  it('empty array returns 0', () => {
    expect(weightedIndex([], 0.5)).toBe(0);
  });

  it('all-zero weights returns 0', () => {
    expect(weightedIndex([0, 0, 0], 0.5)).toBe(0);
  });

  it('single weight always returns 0', () => {
    expect(weightedIndex([10], 0)).toBe(0);
    expect(weightedIndex([10], 0.99)).toBe(0);
  });

  it('uniform weights distribute evenly', () => {
    const weights = [1, 1, 1, 1];
    const counts = [0, 0, 0, 0];
    const rng = new SeededRNG(0xbeef);
    for (let i = 0; i < 4000; i++) {
      const idx = weightedIndex(weights, rng.next());
      counts[idx] = (counts[idx] ?? 0) + 1;
    }
    for (const c of counts) {
      expect(c).toBeGreaterThan(800);
      expect(c).toBeLessThan(1200);
    }
  });

  it('skewed weights favor heavy entry', () => {
    const weights = [1, 99];
    const counts = [0, 0];
    const rng = new SeededRNG(0xcafe);
    for (let i = 0; i < 1000; i++) {
      const idx = weightedIndex(weights, rng.next());
      counts[idx] = (counts[idx] ?? 0) + 1;
    }
    expect(counts[1]).toBeGreaterThan(counts[0]! * 50);
  });

  it('roll=0 always picks first non-zero weight', () => {
    expect(weightedIndex([0, 5, 10], 0)).toBe(1);
    expect(weightedIndex([5, 5, 10], 0)).toBe(0);
  });

  it('lands in the correct cumulative band (known-answer table)', () => {
    const weights = [10, 3, 7, 1, 5];
    for (const [roll, want] of BANDS) {
      expect(weightedIndex(weights, roll)).toBe(want);
    }
  });
});

describe('weightedIndexBy', () => {
  it('empty array returns 0', () => {
    expect(weightedIndexBy([], (x: number) => x, 0.5)).toBe(0);
  });

  it('picks by accessor weight', () => {
    const items = [{ w: 0 }, { w: 10 }, { w: 0 }];
    for (let roll = 0; roll < 1; roll += 0.1) {
      expect(weightedIndexBy(items, (x) => x.w, roll)).toBe(1);
    }
  });

  it('matches weightedIndex when weights extracted', () => {
    const weights = [2, 5, 3];
    const items = weights.map((w) => ({ w }));
    const rng = new SeededRNG(0x1234);
    for (let i = 0; i < 500; i++) {
      const roll = rng.next();
      expect(weightedIndexBy(items, (x) => x.w, roll)).toBe(weightedIndex(weights, roll));
    }
  });
});

describe('weightedPick', () => {
  it('returns undefined for empty array', () => {
    expect(weightedPick([], (x: number) => x, 0.5)).toBeUndefined();
  });

  it('returns the item at the weighted index', () => {
    const items = [
      { name: 'a', w: 0 },
      { name: 'b', w: 10 },
      { name: 'c', w: 0 },
    ];
    for (let roll = 0; roll < 1; roll += 0.1) {
      expect(weightedPick(items, (x) => x.w, roll)?.name).toBe('b');
    }
  });

  it('single item always returned', () => {
    expect(weightedPick(['only'], () => 1, 0.0)).toBe('only');
    expect(weightedPick(['only'], () => 1, 0.99)).toBe('only');
  });

  it('all items reachable with appropriate rolls', () => {
    const items = [{ v: 'x' }, { v: 'y' }, { v: 'z' }];
    const reached = new Set<string>();
    const rng = new SeededRNG(0xface);
    for (let i = 0; i < 300; i++) {
      const picked = weightedPick(items, () => 1, rng.next());
      if (picked !== undefined) reached.add(picked.v);
    }
    expect(reached.size).toBe(3);
  });
});
