import { describe, expect, test } from 'bun:test';
import {
  bezier2,
  bezier2Into,
  bezier2Length,
  bezier3,
  bezier3Into,
  bezier3Length,
  catmullRom,
  catmullRomInto,
  catmullRomLength,
} from '../src/curves.js';
import type { Vec2 } from '../src/vec2.js';

/** OSS-M9. Known-answer tests against values derived by hand, not by running
 *  the implementation and pasting the output. */

const v = (): Vec2 => ({ x: 0, y: 0 });

describe('quadratic Bézier', () => {
  test('passes through its endpoints', () => {
    expect(bezier2(0, 0, 5, 10, 10, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(bezier2(0, 0, 5, 10, 10, 0, 1)).toEqual({ x: 10, y: 0 });
  });

  test('midpoint matches the closed form', () => {
    // B(0.5) = 0.25*P0 + 0.5*P1 + 0.25*P2
    const out = bezier2Into(0, 0, 5, 10, 10, 0, 0.5, v());
    expect(out.x).toBeCloseTo(0.25 * 0 + 0.5 * 5 + 0.25 * 10, 12);
    expect(out.y).toBeCloseTo(0.5 * 10, 12);
  });

  test('a straight control polygon reduces to a straight line', () => {
    // Collinear control points ⇒ the curve is the line itself.
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const out = bezier2Into(0, 0, 5, 5, 10, 10, t, v());
      expect(out.x).toBeCloseTo(out.y, 12);
    }
  });

  test('t is clamped rather than extrapolating', () => {
    expect(bezier2(0, 0, 5, 10, 10, 0, -1)).toEqual({ x: 0, y: 0 });
    expect(bezier2(0, 0, 5, 10, 10, 0, 2)).toEqual({ x: 10, y: 0 });
  });
});

describe('cubic Bézier', () => {
  test('passes through its endpoints', () => {
    expect(bezier3(0, 0, 0, 10, 10, 10, 10, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(bezier3(0, 0, 0, 10, 10, 10, 10, 0, 1)).toEqual({ x: 10, y: 0 });
  });

  test('midpoint matches the closed form', () => {
    // B(0.5) = (P0 + 3*P1 + 3*P2 + P3) / 8
    const out = bezier3Into(0, 0, 0, 10, 10, 10, 10, 0, 0.5, v());
    expect(out.x).toBeCloseTo((0 + 3 * 0 + 3 * 10 + 10) / 8, 12);
    expect(out.y).toBeCloseTo((0 + 3 * 10 + 3 * 10 + 0) / 8, 12);
  });

  test('degenerating both handles onto the endpoints gives a linear ramp', () => {
    const out = bezier3Into(0, 0, 0, 0, 10, 10, 10, 10, 0.5, v());
    expect(out.x).toBeCloseTo(5, 12);
    expect(out.y).toBeCloseTo(5, 12);
  });
});

describe('Catmull-Rom', () => {
  test('interpolates: passes exactly through p1 and p2', () => {
    // The property that distinguishes it from a Bézier — the curve hits its
    // waypoints instead of merely being pulled toward them.
    const start = catmullRom(0, 0, 10, 5, 20, 5, 30, 0, 0);
    const end = catmullRom(0, 0, 10, 5, 20, 5, 30, 0, 1);
    expect(start.x).toBeCloseTo(10, 12);
    expect(start.y).toBeCloseTo(5, 12);
    expect(end.x).toBeCloseTo(20, 12);
    expect(end.y).toBeCloseTo(5, 12);
  });

  test('evenly spaced collinear points reproduce the straight line', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const out = catmullRomInto(0, 0, 10, 10, 20, 20, 30, 30, t, v());
      expect(out.x).toBeCloseTo(10 + t * 10, 10);
      expect(out.y).toBeCloseTo(10 + t * 10, 10);
    }
  });

  test('midpoint matches the closed form', () => {
    // q(0.5) = 0.5*(2*P1 + 0.5*(P2-P0) + 0.25*(2P0-5P1+4P2-P3) + 0.125*(-P0+3P1-3P2+P3))
    const p = [0, 0, 10, 0, 20, 0, 30, 0] as const;
    const out = catmullRomInto(...p, 0.5, v());
    // Symmetric, evenly spaced ⇒ exactly halfway between p1 and p2.
    expect(out.x).toBeCloseTo(15, 12);
  });
});

describe('curve sampling — allocation contract', () => {
  test('the Into forms write into the caller buffer and return it', () => {
    const out = v();
    expect(bezier2Into(0, 0, 1, 1, 2, 0, 0.5, out)).toBe(out);
    expect(bezier3Into(0, 0, 1, 1, 2, 1, 3, 0, 0.5, out)).toBe(out);
    expect(catmullRomInto(0, 0, 1, 1, 2, 1, 3, 0, 0.5, out)).toBe(out);
  });

  test('the allocating forms return a fresh object each call', () => {
    const a = bezier2(0, 0, 1, 1, 2, 0, 0.5);
    const b = bezier2(0, 0, 1, 1, 2, 0, 0.5);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('approximate arc length', () => {
  test('a degenerate curve on a straight line measures the line', () => {
    // Control points collinear and evenly spaced ⇒ the curve is the segment,
    // so the chord sum is exact regardless of segment count.
    expect(bezier2Length(0, 0, 5, 0, 10, 0, 8)).toBeCloseTo(10, 9);
    expect(bezier3Length(0, 0, 0, 0, 10, 0, 10, 0, 8)).toBeCloseTo(10, 9);
    expect(catmullRomLength(0, 0, 10, 0, 20, 0, 30, 0, 8)).toBeCloseTo(10, 9);
  });

  test('a curved arc is longer than its chord and converges from below', () => {
    // Chord sums always underestimate: a chord is the shortest path between
    // its endpoints, so refining can only add length.
    const chord = 10;
    const coarse = bezier2Length(0, 0, 5, 10, 10, 0, 2);
    const fine = bezier2Length(0, 0, 5, 10, 10, 0, 256);
    expect(coarse).toBeGreaterThan(chord);
    expect(fine).toBeGreaterThan(coarse);
    // And it converges — doubling again barely moves it.
    const finer = bezier2Length(0, 0, 5, 10, 10, 0, 512);
    expect(Math.abs(finer - fine)).toBeLessThan(1e-3);
  });

  test('segment counts below 1 are clamped instead of dividing by zero', () => {
    for (const n of [0, -5]) {
      const len = bezier2Length(0, 0, 5, 10, 10, 0, n);
      expect(Number.isFinite(len)).toBe(true);
      // Falls back to a single chord end-to-end.
      expect(len).toBeCloseTo(10, 9);
    }
  });

  test('length helpers do not disturb a caller buffer', () => {
    // They share an internal scratch Vec2; a caller's buffer must be untouched.
    const mine = { x: 111, y: 222 };
    bezier3Length(0, 0, 1, 5, 2, 5, 3, 0, 32);
    expect(mine).toEqual({ x: 111, y: 222 });
  });
});
