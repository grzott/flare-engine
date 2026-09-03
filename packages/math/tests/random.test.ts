import { describe, expect, it } from 'bun:test';
import {
  choose,
  randomFloat,
  randomInt,
  randomPointInCircle,
  randomVec2InRect,
  SeededRNG,
  shuffle,
} from '../src/index.js';

describe('SeededRNG', () => {
  it('produces deterministic output', () => {
    const a = new SeededRNG(42);
    const b = new SeededRNG(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('different seeds produce different output', () => {
    const a = new SeededRNG(1);
    const b = new SeededRNG(2);
    // Very unlikely all 10 match
    let same = 0;
    for (let i = 0; i < 10; i++) {
      if (a.next() === b.next()) same++;
    }
    expect(same).toBeLessThan(10);
  });

  it('next() returns values in [0, 1)', () => {
    const rng = new SeededRNG(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('float() returns values in range', () => {
    const rng = new SeededRNG(999);
    for (let i = 0; i < 100; i++) {
      const v = rng.float(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it('int() returns integers in range', () => {
    const rng = new SeededRNG(55);
    for (let i = 0; i < 100; i++) {
      const v = rng.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe('randomFloat', () => {
  it('returns values in [min, max)', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomFloat(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });
});

describe('randomInt', () => {
  it('returns integers in [min, max]', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomInt(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe('randomVec2InRect', () => {
  it('returns points inside rect', () => {
    const r = { x: 10, y: 20, width: 30, height: 40 };
    for (let i = 0; i < 100; i++) {
      const p = randomVec2InRect(r);
      expect(p.x).toBeGreaterThanOrEqual(10);
      expect(p.x).toBeLessThanOrEqual(40);
      expect(p.y).toBeGreaterThanOrEqual(20);
      expect(p.y).toBeLessThanOrEqual(60);
    }
  });
});

describe('randomPointInCircle', () => {
  it('returns points inside circle', () => {
    for (let i = 0; i < 100; i++) {
      const p = randomPointInCircle(0, 0, 10);
      const distSq = p.x * p.x + p.y * p.y;
      expect(distSq).toBeLessThanOrEqual(100 + 1e-6);
    }
  });
  it('zero radius returns center', () => {
    const p = randomPointInCircle(5, 10, 0);
    expect(p.x).toBe(5);
    expect(p.y).toBe(10);
  });
});

describe('shuffle', () => {
  it('returns the same array', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result).toBe(arr);
  });
  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    shuffle(arr);
    expect(arr.sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('handles empty array', () => {
    expect(shuffle([])).toEqual([]);
  });
  it('handles single element', () => {
    expect(shuffle([42])).toEqual([42]);
  });
});

describe('choose', () => {
  it('returns undefined for empty array', () => {
    expect(choose([])).toBeUndefined();
  });
  it('returns the only element for single-element array', () => {
    expect(choose([42])).toBe(42);
  });
  it('returns an element from the array', () => {
    const arr = [1, 2, 3, 4, 5];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(choose(arr)!);
    }
  });
});

describe('SeededRNG state round-trip (M9)', () => {
  it('restoring a captured state replays the identical sequence', () => {
    // The point of the feature: a save file stores getState(), and a reload
    // continues the run exactly where it left off.
    const rng = new SeededRNG(12345);
    for (let i = 0; i < 10; i++) rng.next();

    const saved = rng.getState();
    const expected = [rng.next(), rng.next(), rng.next(), rng.next()];

    const restored = new SeededRNG(0);
    restored.setState(saved);
    expect([restored.next(), restored.next(), restored.next(), restored.next()]).toEqual(expected);
  });

  it('state can be rewound on the same instance', () => {
    const rng = new SeededRNG(7);
    const mark = rng.getState();
    const first = [rng.next(), rng.next()];
    rng.setState(mark);
    expect([rng.next(), rng.next()]).toEqual(first);
  });

  it('a fresh generator reports the seed the constructor coerced', () => {
    expect(new SeededRNG(42).getState()).toBe(42);
    // The constructor coerces to int32; getState reports what is actually used.
    expect(new SeededRNG(42.9).getState()).toBe(42);
    expect(new SeededRNG(-1).getState()).toBe(-1);
  });

  it('setState coerces exactly as the constructor does', () => {
    const viaSeed = new SeededRNG(99);
    const viaState = new SeededRNG(0);
    viaState.setState(99.7);
    expect(viaState.getState()).toBe(viaSeed.getState());
    expect(viaState.next()).toBe(viaSeed.next());
  });

  it('state survives a JSON round-trip', () => {
    // int32 is JSON-safe, which is what makes this usable in a save file.
    const rng = new SeededRNG(2024);
    rng.next();
    rng.next();
    const revived = new SeededRNG(0);
    revived.setState(JSON.parse(JSON.stringify({ s: rng.getState() })).s);
    expect(revived.next()).toBe(rng.next());
  });

  it('different states produce different sequences', () => {
    const a = new SeededRNG(0);
    const b = new SeededRNG(0);
    b.setState(1);
    expect(a.next()).not.toBe(b.next());
  });
});
