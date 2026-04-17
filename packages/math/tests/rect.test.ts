import { describe, expect, it } from 'bun:test';
import { Rect } from '../src/index.js';

describe('Rect.contains', () => {
  const r = { x: 0, y: 0, width: 10, height: 10 };
  it('point inside', () => expect(Rect.contains(r, { x: 5, y: 5 })).toBe(true));
  it('point on edge', () => expect(Rect.contains(r, { x: 0, y: 0 })).toBe(true));
  it('point on far edge', () => expect(Rect.contains(r, { x: 10, y: 10 })).toBe(true));
  it('point outside left', () => expect(Rect.contains(r, { x: -1, y: 5 })).toBe(false));
  it('point outside right', () => expect(Rect.contains(r, { x: 11, y: 5 })).toBe(false));
  it('point outside top', () => expect(Rect.contains(r, { x: 5, y: -1 })).toBe(false));
  it('point outside bottom', () => expect(Rect.contains(r, { x: 5, y: 11 })).toBe(false));
});

describe('Rect.intersects', () => {
  it('overlapping rects', () => {
    expect(
      Rect.intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }),
    ).toBe(true);
  });
  it('non-overlapping rects', () => {
    expect(
      Rect.intersects({ x: 0, y: 0, width: 5, height: 5 }, { x: 10, y: 10, width: 5, height: 5 }),
    ).toBe(false);
  });
  it('touching edges do not intersect', () => {
    expect(
      Rect.intersects({ x: 0, y: 0, width: 5, height: 5 }, { x: 5, y: 0, width: 5, height: 5 }),
    ).toBe(false);
  });
  it('contained rect', () => {
    expect(
      Rect.intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 2, y: 2, width: 3, height: 3 }),
    ).toBe(true);
  });
});

describe('Rect.intersection', () => {
  it('returns overlap area', () => {
    const result = Rect.intersection(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 5, y: 5, width: 10, height: 10 },
    );
    expect(result).toEqual({ x: 5, y: 5, width: 5, height: 5 });
  });
  it('returns null when no overlap', () => {
    expect(
      Rect.intersection({ x: 0, y: 0, width: 5, height: 5 }, { x: 10, y: 10, width: 5, height: 5 }),
    ).toBeNull();
  });
  it('returns null for touching edges', () => {
    expect(
      Rect.intersection({ x: 0, y: 0, width: 5, height: 5 }, { x: 5, y: 0, width: 5, height: 5 }),
    ).toBeNull();
  });
});

describe('Rect.union', () => {
  it('returns bounding rect', () => {
    expect(
      Rect.union({ x: 0, y: 0, width: 5, height: 5 }, { x: 10, y: 10, width: 5, height: 5 }),
    ).toEqual({ x: 0, y: 0, width: 15, height: 15 });
  });
  it('union of same rect is same rect', () => {
    const r = { x: 1, y: 2, width: 3, height: 4 };
    expect(Rect.union(r, r)).toEqual(r);
  });
});

describe('Rect.fromPoints', () => {
  it('creates bounding box from points', () => {
    const result = Rect.fromPoints([
      { x: 1, y: 3 },
      { x: 5, y: 1 },
      { x: 2, y: 7 },
    ]);
    expect(result).toEqual({ x: 1, y: 1, width: 4, height: 6 });
  });
  it('single point returns zero-size rect', () => {
    expect(Rect.fromPoints([{ x: 5, y: 5 }])).toEqual({
      x: 5,
      y: 5,
      width: 0,
      height: 0,
    });
  });
  it('empty array returns zero rect', () => {
    expect(Rect.fromPoints([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe('Rect.center', () => {
  it('center of unit rect at origin', () => {
    expect(Rect.center({ x: 0, y: 0, width: 10, height: 10 })).toEqual({
      x: 5,
      y: 5,
    });
  });
  it('center of offset rect', () => {
    expect(Rect.center({ x: 2, y: 4, width: 6, height: 8 })).toEqual({
      x: 5,
      y: 8,
    });
  });
});

describe('Rect.expand', () => {
  it('expands rect', () => {
    expect(Rect.expand({ x: 5, y: 5, width: 10, height: 10 }, 2)).toEqual({
      x: 3,
      y: 3,
      width: 14,
      height: 14,
    });
  });
  it('negative expansion shrinks', () => {
    expect(Rect.expand({ x: 0, y: 0, width: 10, height: 10 }, -2)).toEqual({
      x: 2,
      y: 2,
      width: 6,
      height: 6,
    });
  });
});
