import { describe, expect, test } from 'bun:test';
import { clipPolygonToUnitInto } from '../../../src/core/fracture/clip';

const clip = (points: readonly number[]): number[] => {
  const out = new Float32Array(points.length + 16);
  const n = clipPolygonToUnitInto(Float32Array.from(points), points.length / 2, out);
  return Array.from(out.subarray(0, n * 2));
};

const area = (points: readonly number[]): number => {
  let twice = 0;
  for (let i = 0; i < points.length; i += 2) {
    const j = (i + 2) % points.length;
    twice += points[i]! * points[j + 1]! - points[j]! * points[i + 1]!;
  }
  return Math.abs(twice) / 2;
};

describe('clipPolygonToUnitInto', () => {
  test('a polygon inside the unit square comes back unchanged', () => {
    const inside = [0.25, 0.25, 0.75, 0.25, 0.75, 0.75, 0.25, 0.75];
    expect(clip(inside)).toEqual(inside);
  });

  test('a polygon covering the square clips to the square', () => {
    const clipped = clip([-1, -1, 2, -1, 2, 2, -1, 2]);
    expect(clipped.length).toBe(8);
    expect(area(clipped)).toBeCloseTo(1, 6);
  });

  test('a polygon outside the square clips to nothing', () => {
    expect(clip([1.5, 0.2, 2, 0.2, 2, 0.8])).toEqual([]);
    expect(clip([0.2, -2, 0.8, -2, 0.5, -1])).toEqual([]);
  });

  test('a polygon across one edge keeps the part inside', () => {
    // Half of a square centred on the right edge.
    const clipped = clip([0.5, 0.25, 1.5, 0.25, 1.5, 0.75, 0.5, 0.75]);
    expect(area(clipped)).toBeCloseTo(0.25, 6);
    for (let i = 0; i < clipped.length; i++) {
      expect(clipped[i]!).toBeGreaterThanOrEqual(0);
      expect(clipped[i]!).toBeLessThanOrEqual(1);
    }
  });

  test('a triangle over a corner gains vertices', () => {
    const clipped = clip([0.25, 0.25, 1.5, 0.25, 0.25, 1.5]);
    expect(clipped.length / 2).toBe(5);
    // A 0.75 square, less the corner the hypotenuse x + y = 1.75 cuts off it.
    expect(area(clipped)).toBeCloseTo(0.75 * 0.75 - (0.25 * 0.25) / 2, 6);
  });

  test('either winding gives the same area', () => {
    const forward = [0.5, -0.5, 1.5, 0.5, 0.5, 1.5, -0.5, 0.5];
    const backward = [-0.5, 0.5, 0.5, 1.5, 1.5, 0.5, 0.5, -0.5];
    expect(area(clip(forward))).toBeCloseTo(area(clip(backward)), 6);
    // The diamond's sides pass through the square's corners, so all of the square is inside it.
    expect(area(clip(forward))).toBeCloseTo(1, 6);
  });

  test('reads only the first n vertices of src', () => {
    const src = Float32Array.from([0.1, 0.1, 0.9, 0.1, 0.5, 0.9, 5, 5, 6, 6]);
    const out = new Float32Array(32);
    expect(clipPolygonToUnitInto(src, 3, out)).toBe(3);
    expect(Array.from(out.subarray(0, 6))).toEqual(Array.from(src.subarray(0, 6)));
  });

  test('rejects an out buffer too small for the worst case', () => {
    const src = Float32Array.from([0.1, 0.1, 0.9, 0.1, 0.5, 0.9]);
    expect(() => clipPolygonToUnitInto(src, 3, new Float32Array(6))).toThrow(RangeError);
  });
});
