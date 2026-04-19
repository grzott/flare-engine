import { describe, expect, test } from 'bun:test';
import { createGrid, getCost, inBounds, isWalkable, setCost, setWalkable } from '../src/grid.js';

describe('createGrid', () => {
  test('creates grid with default cost 1', () => {
    const g = createGrid({ width: 3, height: 3 });
    expect(g.width).toBe(3);
    expect(g.height).toBe(3);
    expect(g.data.length).toBe(9);
    for (let i = 0; i < 9; i++) {
      expect(g.data[i]).toBe(1);
    }
  });

  test('creates grid with custom default cost', () => {
    const g = createGrid({ width: 2, height: 2, defaultCost: 5 });
    for (let i = 0; i < 4; i++) {
      expect(g.data[i]).toBe(5);
    }
  });

  test('creates blocked grid with defaultCost 0', () => {
    const g = createGrid({ width: 2, height: 2, defaultCost: 0 });
    for (let i = 0; i < 4; i++) {
      expect(g.data[i]).toBe(0);
    }
  });

  test('accepts pre-filled data', () => {
    const data = new Uint8Array([1, 0, 1, 1]);
    const g = createGrid({ width: 2, height: 2, data });
    expect(g.data).toBe(data);
  });

  test('throws on data length mismatch', () => {
    expect(() => createGrid({ width: 2, height: 2, data: new Uint8Array(3) })).toThrow(RangeError);
  });

  test('throws on non-positive dimensions', () => {
    expect(() => createGrid({ width: 0, height: 5 })).toThrow(RangeError);
    expect(() => createGrid({ width: 5, height: -1 })).toThrow(RangeError);
  });
});

describe('inBounds', () => {
  const g = createGrid({ width: 3, height: 3 });

  test('returns true for valid coords', () => {
    expect(inBounds(g, 0, 0)).toBe(true);
    expect(inBounds(g, 2, 2)).toBe(true);
  });

  test('returns false for out of bounds', () => {
    expect(inBounds(g, -1, 0)).toBe(false);
    expect(inBounds(g, 3, 0)).toBe(false);
    expect(inBounds(g, 0, -1)).toBe(false);
    expect(inBounds(g, 0, 3)).toBe(false);
  });
});

describe('isWalkable / getCost', () => {
  test('reports walkability correctly', () => {
    const data = new Uint8Array([1, 0, 3, 0]);
    const g = createGrid({ width: 2, height: 2, data });
    expect(isWalkable(g, 0, 0)).toBe(true);
    expect(isWalkable(g, 1, 0)).toBe(false);
    expect(isWalkable(g, 0, 1)).toBe(true);
    expect(isWalkable(g, 1, 1)).toBe(false);
  });

  test('out of bounds is not walkable', () => {
    const g = createGrid({ width: 2, height: 2 });
    expect(isWalkable(g, -1, 0)).toBe(false);
    expect(isWalkable(g, 5, 0)).toBe(false);
  });

  test('getCost returns tile cost', () => {
    const data = new Uint8Array([1, 0, 5, 2]);
    const g = createGrid({ width: 2, height: 2, data });
    expect(getCost(g, 0, 0)).toBe(1);
    expect(getCost(g, 1, 0)).toBe(0);
    expect(getCost(g, 0, 1)).toBe(5);
    expect(getCost(g, 1, 1)).toBe(2);
  });

  test('getCost returns 0 for out of bounds', () => {
    const g = createGrid({ width: 2, height: 2 });
    expect(getCost(g, -1, 0)).toBe(0);
  });
});

describe('setWalkable / setCost', () => {
  test('setWalkable toggles cell', () => {
    const g = createGrid({ width: 2, height: 2 });
    expect(isWalkable(g, 0, 0)).toBe(true);
    setWalkable(g, 0, 0, false);
    expect(isWalkable(g, 0, 0)).toBe(false);
    setWalkable(g, 0, 0, true);
    expect(isWalkable(g, 0, 0)).toBe(true);
  });

  test('setCost updates cost', () => {
    const g = createGrid({ width: 2, height: 2 });
    setCost(g, 1, 1, 10);
    expect(getCost(g, 1, 1)).toBe(10);
  });

  test('setCost clamps to [0, 255]', () => {
    const g = createGrid({ width: 2, height: 2 });
    setCost(g, 0, 0, 300);
    expect(getCost(g, 0, 0)).toBe(255);
    setCost(g, 0, 0, -5);
    expect(getCost(g, 0, 0)).toBe(0);
  });

  test('out-of-bounds writes are no-ops', () => {
    const g = createGrid({ width: 2, height: 2 });
    setWalkable(g, -1, 0, false);
    setCost(g, 5, 0, 10);
    // No throw
  });
});
