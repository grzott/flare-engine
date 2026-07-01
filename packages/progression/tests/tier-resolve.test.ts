import { describe, expect, it } from 'bun:test';
import { resolveTier, resolveTierIndex } from '../src/index.js';

type Rank = 'bronze' | 'silver' | 'gold';

const TIERS = [
  { at: 1, tier: 'bronze' as Rank },
  { at: 10, tier: 'silver' as Rank },
  { at: 50, tier: 'gold' as Rank },
];

describe('resolveTier', () => {
  it('below all thresholds returns null', () => {
    expect(resolveTier(TIERS, 0)).toBeNull();
  });

  it('exactly at lowest threshold', () => {
    expect(resolveTier(TIERS, 1)).toBe('bronze');
  });

  it('between thresholds returns lower tier', () => {
    expect(resolveTier(TIERS, 9)).toBe('bronze');
  });

  it('exactly at second threshold', () => {
    expect(resolveTier(TIERS, 10)).toBe('silver');
  });

  it('beyond all thresholds returns highest', () => {
    expect(resolveTier(TIERS, 1000)).toBe('gold');
  });

  it('empty entries returns null', () => {
    expect(resolveTier([], 100)).toBeNull();
  });

  it('applies the highest satisfied tier (known-answer table)', () => {
    const entries = [
      { at: 1, tier: 'art' as const },
      { at: 10, tier: 'lore' as const },
      { at: 50, tier: 'stats' as const },
    ];
    const cases: readonly (readonly [number, 'art' | 'lore' | 'stats' | null])[] = [
      [0, null],
      [1, 'art'],
      [5, 'art'],
      [10, 'lore'],
      [49, 'lore'],
      [50, 'stats'],
      [100, 'stats'],
    ];
    for (const [tally, want] of cases) {
      expect(resolveTier(entries, tally)).toBe(want);
    }
  });

  it('ties on identical at resolve to the last matching entry', () => {
    const dup = [
      { at: 10, tier: 'first' as const },
      { at: 10, tier: 'second' as const },
    ];
    expect(resolveTier(dup, 10)).toBe('second');
    expect(resolveTier(dup, 9)).toBeNull();
  });

  it('unsorted input: picks highest satisfied at', () => {
    const unsorted = [
      { at: 50, tier: 'gold' as Rank },
      { at: 1, tier: 'bronze' as Rank },
      { at: 10, tier: 'silver' as Rank },
    ];
    expect(resolveTier(unsorted, 11)).toBe('silver');
    expect(resolveTier(unsorted, 51)).toBe('gold');
  });
});

describe('resolveTierIndex', () => {
  it('below all returns -1', () => {
    expect(resolveTierIndex(TIERS, 0)).toBe(-1);
  });

  it('exactly at first threshold returns 0', () => {
    expect(resolveTierIndex(TIERS, 1)).toBe(0);
  });

  it('at second threshold returns 1', () => {
    expect(resolveTierIndex(TIERS, 10)).toBe(1);
  });

  it('beyond all returns last index', () => {
    expect(resolveTierIndex(TIERS, 1000)).toBe(2);
  });

  it('ties on identical at resolve to the last matching index', () => {
    const dup = [
      { at: 10, tier: 'a' as const },
      { at: 10, tier: 'b' as const },
      { at: 5, tier: 'c' as const },
    ];
    expect(resolveTierIndex(dup, 10)).toBe(1);
    expect(resolveTierIndex(dup, 5)).toBe(2);
  });

  it('index matches resolveTier semantically', () => {
    for (const tally of [0, 1, 9, 10, 49, 50, 200]) {
      const idx = resolveTierIndex(TIERS, tally);
      const tier = resolveTier(TIERS, tally);
      if (idx === -1) {
        expect(tier).toBeNull();
      } else {
        expect(String(TIERS[idx]?.tier)).toBe(String(tier));
      }
    }
  });
});
