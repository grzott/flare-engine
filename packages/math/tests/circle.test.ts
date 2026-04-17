import { describe, expect, it } from 'bun:test';
import { Circle } from '../src/index.js';

describe('Circle.contains', () => {
  const c = { x: 0, y: 0, radius: 5 };
  it('center point', () => expect(Circle.contains(c, { x: 0, y: 0 })).toBe(true));
  it('point inside', () => expect(Circle.contains(c, { x: 3, y: 3 })).toBe(true));
  it('point on edge', () => expect(Circle.contains(c, { x: 5, y: 0 })).toBe(true));
  it('point outside', () => expect(Circle.contains(c, { x: 6, y: 0 })).toBe(false));
  it('zero radius at center', () => {
    expect(Circle.contains({ x: 0, y: 0, radius: 0 }, { x: 0, y: 0 })).toBe(true);
  });
  it('zero radius away', () => {
    expect(Circle.contains({ x: 0, y: 0, radius: 0 }, { x: 1, y: 0 })).toBe(false);
  });
});

describe('Circle.intersects', () => {
  it('overlapping circles', () => {
    expect(Circle.intersects({ x: 0, y: 0, radius: 5 }, { x: 8, y: 0, radius: 5 })).toBe(true);
  });
  it('non-overlapping circles', () => {
    expect(Circle.intersects({ x: 0, y: 0, radius: 3 }, { x: 10, y: 0, radius: 3 })).toBe(false);
  });
  it('touching circles (exact radii sum) do not intersect', () => {
    expect(Circle.intersects({ x: 0, y: 0, radius: 5 }, { x: 10, y: 0, radius: 5 })).toBe(false);
  });
  it('concentric circles', () => {
    expect(Circle.intersects({ x: 0, y: 0, radius: 5 }, { x: 0, y: 0, radius: 3 })).toBe(true);
  });
  it('same circle', () => {
    expect(Circle.intersects({ x: 0, y: 0, radius: 5 }, { x: 0, y: 0, radius: 5 })).toBe(true);
  });
});

describe('Circle.intersectsRect', () => {
  it('circle overlaps rect', () => {
    expect(
      Circle.intersectsRect({ x: 0, y: 0, radius: 5 }, { x: 3, y: 3, width: 10, height: 10 }),
    ).toBe(true);
  });
  it('circle inside rect', () => {
    expect(
      Circle.intersectsRect({ x: 5, y: 5, radius: 2 }, { x: 0, y: 0, width: 10, height: 10 }),
    ).toBe(true);
  });
  it('circle outside rect', () => {
    expect(
      Circle.intersectsRect({ x: 20, y: 20, radius: 2 }, { x: 0, y: 0, width: 10, height: 10 }),
    ).toBe(false);
  });
  it('circle touches rect corner', () => {
    // Circle at (15,15), radius 5*sqrt(2) ≈ 7.07, touching corner at (10,10)
    expect(
      Circle.intersectsRect(
        { x: 15, y: 15, radius: Math.sqrt(50) },
        { x: 0, y: 0, width: 10, height: 10 },
      ),
    ).toBe(true);
  });
  it('rect encloses circle center', () => {
    expect(
      Circle.intersectsRect({ x: 5, y: 5, radius: 100 }, { x: 0, y: 0, width: 10, height: 10 }),
    ).toBe(true);
  });
});
