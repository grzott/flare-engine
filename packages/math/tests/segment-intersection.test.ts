import { describe, expect, test } from 'bun:test';
import {
  segmentIntersection,
  segmentIntersectionInto,
  segmentsIntersect,
} from '../src/intersection.js';

/**
 * OSS-M9 — `intersection.ts` could previously only answer *whether* things
 * intersect. These cover *where*, and the cases where "where" has no answer.
 */

describe('segmentIntersection', () => {
  test('crossing segments meet at the expected point', () => {
    // A vertical and a horizontal segment through (5, 5).
    expect(segmentIntersection(5, 0, 5, 10, 0, 5, 10, 5)).toEqual({ x: 5, y: 5 });
  });

  test('diagonals of a square meet at its centre', () => {
    const hit = segmentIntersection(0, 0, 10, 10, 0, 10, 10, 0);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(5, 12);
    expect(hit!.y).toBeCloseTo(5, 12);
  });

  test('segments that would cross only if extended do not intersect', () => {
    // The classic false positive from testing infinite lines instead of
    // segments: these lines cross at (5,5), but neither segment reaches it.
    expect(segmentIntersection(0, 0, 2, 2, 10, 0, 8, 2)).toBeNull();
  });

  test('touching at an endpoint counts as an intersection', () => {
    expect(segmentIntersection(0, 0, 5, 5, 5, 5, 10, 0)).toEqual({ x: 5, y: 5 });
  });

  test('a T-junction intersects at the touching point', () => {
    expect(segmentIntersection(0, 5, 10, 5, 5, 5, 5, 15)).toEqual({ x: 5, y: 5 });
  });

  test('parallel segments never intersect', () => {
    expect(segmentIntersection(0, 0, 10, 0, 0, 5, 10, 5)).toBeNull();
  });

  test('collinear overlap returns null — there is no single point', () => {
    // They do overlap, but at infinitely many points, so there is nothing to
    // write into `out`. segmentsIntersect is the function for this question.
    expect(segmentIntersection(0, 0, 10, 0, 5, 0, 15, 0)).toBeNull();
    expect(segmentsIntersect(0, 0, 10, 0, 5, 0, 15, 0)).toBe(true);
  });

  test('collinear but disjoint segments do not intersect either way', () => {
    expect(segmentIntersection(0, 0, 5, 0, 10, 0, 15, 0)).toBeNull();
    expect(segmentsIntersect(0, 0, 5, 0, 10, 0, 15, 0)).toBe(false);
  });
});

describe('segmentIntersectionInto', () => {
  test('writes into the caller buffer and returns it', () => {
    const out = { x: 0, y: 0 };
    const result = segmentIntersectionInto(5, 0, 5, 10, 0, 5, 10, 5, out);
    expect(result).toBe(out);
    expect(out).toEqual({ x: 5, y: 5 });
  });

  test('leaves the buffer untouched when there is no intersection', () => {
    // A caller reusing one buffer across many probes must be able to trust that
    // a null result did not scribble on it.
    const out = { x: -1, y: -2 };
    expect(segmentIntersectionInto(0, 0, 1, 0, 0, 5, 1, 5, out)).toBeNull();
    expect(out).toEqual({ x: -1, y: -2 });
  });

  test('agrees with the allocating twin', () => {
    const out = { x: 0, y: 0 };
    const a = segmentIntersectionInto(0, 0, 10, 10, 0, 10, 10, 0, out);
    const b = segmentIntersection(0, 0, 10, 10, 0, 10, 10, 0);
    expect(a).toEqual(b!);
  });
});

describe('segmentsIntersect — collinear handling', () => {
  test('vertical collinear overlap is detected', () => {
    // Projecting onto the dominant axis is what keeps this exact: projecting
    // onto x would compare zero-width intervals.
    expect(segmentsIntersect(0, 0, 0, 10, 0, 5, 0, 15)).toBe(true);
    expect(segmentsIntersect(0, 0, 0, 5, 0, 10, 0, 15)).toBe(false);
  });

  test('collinear segments touching at exactly one endpoint overlap', () => {
    expect(segmentsIntersect(0, 0, 5, 0, 5, 0, 10, 0)).toBe(true);
  });

  test('parallel but not collinear is false', () => {
    expect(segmentsIntersect(0, 0, 10, 0, 0, 1, 10, 1)).toBe(false);
  });

  test('agrees with segmentIntersection wherever a unique point exists', () => {
    const cases: [number, number, number, number, number, number, number, number][] = [
      [5, 0, 5, 10, 0, 5, 10, 5],
      [0, 0, 10, 10, 0, 10, 10, 0],
      [0, 0, 2, 2, 10, 0, 8, 2],
      [0, 0, 10, 0, 0, 5, 10, 5],
      [0, 0, 5, 5, 5, 5, 10, 0],
    ];
    for (const c of cases) {
      if (segmentIntersection(...c) !== null) {
        expect(segmentsIntersect(...c)).toBe(true);
      }
    }
  });

  test('a degenerate zero-length segment is handled without NaN', () => {
    // A point on the other segment, and a point off it.
    expect(segmentsIntersect(5, 5, 5, 5, 0, 5, 10, 5)).toBe(true);
    expect(segmentsIntersect(5, 9, 5, 9, 0, 5, 10, 5)).toBe(false);
  });
});

describe('degenerate segments (found by test, fixed in M9)', () => {
  test('a point ON a segment yields that point, not null', () => {
    // A zero-length segment lying on another does have a unique intersection.
    expect(segmentIntersection(5, 5, 5, 5, 0, 5, 10, 5)).toEqual({ x: 5, y: 5 });
    expect(segmentIntersection(0, 5, 10, 5, 5, 5, 5, 5)).toEqual({ x: 5, y: 5 });
  });

  test('a point OFF a segment misses on both axes, not just one', () => {
    // The original bug: `denom` and the collinearity test are both trivially 0
    // for a zero-length segment, so it was judged collinear with everything and
    // then overlap-tested on x alone — (5,9) "hit" a segment at y=5.
    expect(segmentsIntersect(5, 9, 5, 9, 0, 5, 10, 5)).toBe(false);
    expect(segmentIntersection(5, 9, 5, 9, 0, 5, 10, 5)).toBeNull();
    // Off the far end of the span, on the right line.
    expect(segmentsIntersect(20, 5, 20, 5, 0, 5, 10, 5)).toBe(false);
  });

  test('two identical points intersect; two different points do not', () => {
    expect(segmentsIntersect(3, 4, 3, 4, 3, 4, 3, 4)).toBe(true);
    expect(segmentIntersection(3, 4, 3, 4, 3, 4, 3, 4)).toEqual({ x: 3, y: 4 });
    expect(segmentsIntersect(3, 4, 3, 4, 3, 5, 3, 5)).toBe(false);
    expect(segmentIntersection(3, 4, 3, 4, 3, 5, 3, 5)).toBeNull();
  });

  test('a point at a segment endpoint counts as on it', () => {
    expect(segmentsIntersect(0, 5, 0, 5, 0, 5, 10, 5)).toBe(true);
    expect(segmentsIntersect(10, 5, 10, 5, 0, 5, 10, 5)).toBe(true);
  });
});
