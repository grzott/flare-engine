import { describe, expect, test } from 'bun:test';
import {
  AABB,
  CircleShape,
  createOverlap,
  overlap,
  overlapInto,
  shapeOverlap,
} from '../src/shape.js';

/**
 * OSS-M11 — `shapeOverlap` answers only *whether* two shapes collide, which
 * leaves a detection-only consumer unable to separate them. These cover the
 * minimum translation vector: known-answer depths and axes, worked by hand.
 */

describe('overlapInto — AABB vs AABB', () => {
  test('separates along the least-penetrated axis', () => {
    // 10x10 boxes (half-extent 5), centres 8 apart on x and 2 apart on y.
    // Overlap is 10-8=2 on x but 10-2=8 on y, so x is the shallower axis.
    const out = createOverlap();
    const hit = overlapInto(AABB(10, 10), 0, 0, AABB(10, 10), 8, 2, out);
    expect(hit).toBe(out);
    expect(out.x).toBe(1);
    expect(out.y).toBe(0);
    expect(out.depth).toBeCloseTo(2, 12); // 5 + 5 - 8
  });

  test('separates along y when y is the shallower axis', () => {
    const out = createOverlap();
    // Overlap is 10-1=9 on x but 10-9=1 on y, so now y wins.
    overlapInto(AABB(10, 10), 0, 0, AABB(10, 10), 1, 9, out);
    expect(out.x).toBe(0);
    expect(out.y).toBe(1);
    expect(out.depth).toBeCloseTo(1, 12); // 5 + 5 - 9
  });

  test('the axis points from a toward b', () => {
    const out = createOverlap();
    overlapInto(AABB(10, 10), 0, 0, AABB(10, 10), -9, 0, out);
    expect(out.x).toBe(-1);
    expect(out.depth).toBeCloseTo(1, 12);
  });

  test('non-overlapping boxes return null and leave the buffer untouched', () => {
    const out = createOverlap();
    out.x = 42;
    out.y = 43;
    out.depth = 44;
    expect(overlapInto(AABB(10, 10), 0, 0, AABB(10, 10), 50, 0, out)).toBeNull();
    expect(out).toEqual({ x: 42, y: 43, depth: 44 });
  });

  test('exactly touching is not an overlap', () => {
    // Centres 10 apart, half-widths 5 + 5 — depth would be 0.
    expect(overlap(AABB(10, 10), 0, 0, AABB(10, 10), 10, 0)).toBeNull();
  });
});

describe('overlapInto — circle vs circle', () => {
  test('depth is the radius sum minus centre distance', () => {
    const out = createOverlap();
    overlapInto(CircleShape(5), 0, 0, CircleShape(5), 6, 0, out);
    expect(out.x).toBeCloseTo(1, 12);
    expect(out.y).toBeCloseTo(0, 12);
    expect(out.depth).toBeCloseTo(4, 12);
  });

  test('the axis is unit length on a diagonal', () => {
    const out = createOverlap();
    overlapInto(CircleShape(5), 0, 0, CircleShape(5), 3, 4, out);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1, 12);
    expect(out.depth).toBeCloseTo(5, 12); // 10 - 5
  });

  test('concentric circles get a usable axis instead of NaN', () => {
    // Normalising a zero vector would produce NaN and silently corrupt whatever
    // the caller does next.
    const out = createOverlap();
    overlapInto(CircleShape(3), 7, 7, CircleShape(4), 7, 7, out);
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.y)).toBe(true);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1, 12);
    expect(out.depth).toBeCloseTo(7, 12);
  });

  test('touching circles do not overlap', () => {
    expect(overlap(CircleShape(5), 0, 0, CircleShape(5), 10, 0)).toBeNull();
  });
});

describe('overlapInto — mixed AABB and circle', () => {
  test('circle outside the box separates along the closest-point normal', () => {
    const out = createOverlap();
    overlapInto(AABB(10, 10), 0, 0, CircleShape(3), 7, 0, out);
    expect(out.x).toBeCloseTo(1, 12);
    expect(out.y).toBeCloseTo(0, 12);
    expect(out.depth).toBeCloseTo(1, 12); // radius 3, centre 2 beyond the face
  });

  test('circle centre inside the box pushes out through the nearest face', () => {
    const out = createOverlap();
    // Box half-width 5; centre at x=4 is 1 from the right face, 9 from the left.
    overlapInto(AABB(10, 10), 0, 0, CircleShape(2), 4, 0, out);
    expect(out.x).toBe(1);
    expect(out.y).toBe(0);
    expect(out.depth).toBeCloseTo(3, 12); // 1 to the face + radius 2
  });

  test('argument order is symmetric — the axis still points from a to b', () => {
    const ab = createOverlap();
    const ba = createOverlap();
    overlapInto(AABB(10, 10), 0, 0, CircleShape(3), 7, 0, ab);
    overlapInto(CircleShape(3), 7, 0, AABB(10, 10), 0, 0, ba);
    expect(ba.x).toBeCloseTo(-ab.x, 12);
    expect(ba.y).toBeCloseTo(-ab.y, 12);
    expect(ba.depth).toBeCloseTo(ab.depth, 12);
  });

  test('a circle clear of the box returns null', () => {
    expect(overlap(AABB(10, 10), 0, 0, CircleShape(2), 20, 0)).toBeNull();
  });
});

describe('overlap agrees with shapeOverlap', () => {
  test('a non-null MTV implies shapeOverlap is true', () => {
    const cases = [
      [AABB(10, 10), 0, 0, AABB(10, 10), 8, 2],
      [CircleShape(5), 0, 0, CircleShape(5), 6, 0],
      [AABB(10, 10), 0, 0, CircleShape(3), 7, 0],
      [CircleShape(3), 7, 0, AABB(10, 10), 0, 0],
      [AABB(10, 10), 0, 0, AABB(10, 10), 50, 0],
      [CircleShape(5), 0, 0, CircleShape(5), 40, 0],
    ] as const;
    for (const [a, ax, ay, b, bx, by] of cases) {
      const mtv = overlap(a, ax, ay, b, bx, by);
      if (mtv !== null) {
        expect(shapeOverlap(a, ax, ay, b, bx, by)).toBe(true);
      }
    }
  });

  test('the allocating twin matches the Into form', () => {
    const out = createOverlap();
    const into = overlapInto(AABB(10, 10), 0, 0, AABB(10, 10), 8, 2, out);
    const alloc = overlap(AABB(10, 10), 0, 0, AABB(10, 10), 8, 2);
    expect(alloc).toEqual(into!);
    expect(alloc).not.toBe(into);
  });

  test('one buffer serves many pairs without allocating', () => {
    const out = createOverlap();
    for (let i = 0; i < 50; i++) {
      const r = overlapInto(CircleShape(5), 0, 0, CircleShape(5), i * 0.1, 0, out);
      if (r !== null) expect(r).toBe(out);
    }
  });
});
