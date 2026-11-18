import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { catmullRomInto } from '@flare-engine/math';
import {
  type ArcTable,
  buildArcTable,
  type PathPose,
  pathPoseAtInto,
} from '../../../src/core/path/arc-table';

const LINE = [0, 0, 33, 0, 66, 0, 100, 0];
// Circular arc from (100, 0) to (0, 100), the usual 4/3·(√2 − 1) handle length.
const KAPPA = 0.5522847498;
const QUARTER = [100, 0, 100, 100 * KAPPA, 100 * KAPPA, 100, 0, 100];
const S_CURVE = [0, 0, 200, 0, -100, 100, 100, 100];

const pose = (): PathPose => ({ x: 0, y: 0, angleDeg: 0 });

const cubicAt = (c: readonly number[], offset: number, t: number): { x: number; y: number } => {
  const v = 1 - t;
  const a = v * v * v;
  const b = 3 * v * v * t;
  const cc = 3 * v * t * t;
  const d = t * t * t;
  return {
    x: a * c[offset]! + b * c[offset + 2]! + cc * c[offset + 4]! + d * c[offset + 6]!,
    y: a * c[offset + 1]! + b * c[offset + 3]! + cc * c[offset + 5]! + d * c[offset + 7]!,
  };
};

describe('buildArcTable', () => {
  test('a straight cubic is as long as its chord', () => {
    const table = buildArcTable({ cubic: LINE });
    expect(Math.abs(table.total - 100)).toBeLessThan(1e-3);
    expect(table.segCount).toBe(1);
    expect(table.samplesPerSeg).toBe(32);
    expect(table.segs).toBeInstanceOf(Float32Array);
    expect(Array.from(table.segs)).toEqual(LINE);
    expect(table.lut).toBeInstanceOf(Float32Array);
    expect(table.lut.length).toBe(33);
    expect(table.lut[0]).toBe(0);
    expect(table.lut[32]).toBe(table.total);
  });

  test('a quarter circle of r = 100 is about 157.08 long', () => {
    expect(Math.abs(buildArcTable({ cubic: QUARTER }).total - 157.08)).toBeLessThan(0.2);
  });

  test('32 samples measure an S-curve within 0.5% of a 4,096-sample reference', () => {
    const coarse = buildArcTable({ cubic: S_CURVE }, 32);
    const reference = buildArcTable({ cubic: S_CURVE }, 4096);
    const error = Math.abs(coarse.total - reference.total) / reference.total;
    console.log(`S-curve total length error at 32 samples: ${(error * 100).toFixed(4)}%`);
    expect(error).toBeLessThan(0.005);
  });

  test('32 samples place a pose within 0.5% of the path length of the reference', () => {
    const coarse = buildArcTable({ cubic: S_CURVE }, 32);
    const reference = buildArcTable({ cubic: S_CURVE }, 4096);
    const a = pose();
    const b = pose();
    let worst = 0;
    for (let i = 0; i <= 200; i++) {
      const fraction = i / 200;
      pathPoseAtInto(coarse, fraction * coarse.total, a);
      pathPoseAtInto(reference, fraction * reference.total, b);
      worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y));
    }
    const error = worst / reference.total;
    console.log(`S-curve worst pose error at 32 samples: ${(error * 100).toFixed(4)}%`);
    expect(error).toBeLessThan(0.005);
  });

  test('the lookup table never decreases and has one entry per sample plus the start', () => {
    const table = buildArcTable({ cubic: [...LINE, 100, 0, 100, 33, 100, 66, 100, 100] }, 8);
    expect(table.segCount).toBe(2);
    expect(table.lut.length).toBe(17);
    for (let i = 1; i < table.lut.length; i++) {
      expect(table.lut[i]!).toBeGreaterThanOrEqual(table.lut[i - 1]!);
    }
    expect(table.total).toBeCloseTo(200, 3);
  });

  test('svg path data builds the same table as its cubics', () => {
    const fromSvg = buildArcTable({ svg: 'M0 0 C200 0 -100 100 100 100' });
    const fromCubic = buildArcTable({ cubic: S_CURVE });
    expect(Array.from(fromSvg.segs)).toEqual(Array.from(fromCubic.segs));
    expect(fromSvg.total).toBe(fromCubic.total);
  });

  test('points become one cubic per gap, passing through every point', () => {
    const points = [0, 0, 50, 80, 120, 60, 200, 0];
    const table = buildArcTable({ points });
    expect(table.segCount).toBe(3);
    for (let s = 0; s < 3; s++) {
      expect(table.segs[s * 8]!).toBeCloseTo(points[s * 2]!, 4);
      expect(table.segs[s * 8 + 1]!).toBeCloseTo(points[s * 2 + 1]!, 4);
      expect(table.segs[s * 8 + 6]!).toBeCloseTo(points[s * 2 + 2]!, 4);
      expect(table.segs[s * 8 + 7]!).toBeCloseTo(points[s * 2 + 3]!, 4);
    }
  });

  test('points at the default curviness trace the Catmull-Rom spline', () => {
    const points = [0, 0, 50, 80, 120, 60, 200, 0];
    const segs = Array.from(buildArcTable({ points }).segs);
    const expected = { x: 0, y: 0 };
    // The end points stand in for the missing neighbours.
    const padded = [0, 0, ...points, 200, 0];
    for (let s = 0; s < 3; s++) {
      for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        const o = s * 2;
        catmullRomInto(
          padded[o]!,
          padded[o + 1]!,
          padded[o + 2]!,
          padded[o + 3]!,
          padded[o + 4]!,
          padded[o + 5]!,
          padded[o + 6]!,
          padded[o + 7]!,
          t,
          expected,
        );
        const actual = cubicAt(segs, s * 8, t);
        expect(actual.x).toBeCloseTo(expected.x, 3);
        expect(actual.y).toBeCloseTo(expected.y, 3);
      }
    }
  });

  test('curviness 0 joins the points with straight lines', () => {
    const table = buildArcTable({ points: [0, 0, 30, 40, 30, 100], curviness: 0 });
    expect(table.total).toBeCloseTo(110, 3);
  });

  test('curviness scales the handles, so more of it makes a longer path', () => {
    const points = [0, 0, 50, 80, 120, 60, 200, 0];
    const straight = buildArcTable({ points, curviness: 0 }).total;
    const normal = buildArcTable({ points }).total;
    const loose = buildArcTable({ points, curviness: 2 }).total;
    expect(buildArcTable({ points, curviness: 1 }).total).toBe(normal);
    expect(normal).toBeGreaterThan(straight);
    expect(loose).toBeGreaterThan(normal);
  });

  test('two points make a straight line', () => {
    const table = buildArcTable({ points: [0, 0, 30, 40] });
    expect(table.segCount).toBe(1);
    expect(table.total).toBeCloseTo(50, 3);
  });

  test('rejects a path with no segments or a ragged coordinate list', () => {
    expect(() => buildArcTable({ cubic: [] })).toThrow(RangeError);
    expect(() => buildArcTable({ cubic: [0, 0, 1, 1, 2, 2, 3] })).toThrow(RangeError);
    expect(() => buildArcTable({ cubic: [0, 0, 1, 1, 2, 2, 3, Number.NaN] })).toThrow(RangeError);
    expect(() => buildArcTable({ points: [0, 0] })).toThrow(RangeError);
    expect(() => buildArcTable({ points: [0, 0, 1] })).toThrow(RangeError);
    expect(() => buildArcTable({ points: [0, 0, 1, Number.POSITIVE_INFINITY] })).toThrow(
      RangeError,
    );
    expect(() => buildArcTable({ points: [0, 0, 1, 1], curviness: Number.NaN })).toThrow(
      RangeError,
    );
    expect(() => buildArcTable({ svg: 'M0 0' })).toThrow(RangeError);
  });

  test('rejects a sample count that is not a positive integer', () => {
    expect(() => buildArcTable({ cubic: LINE }, 0)).toThrow(RangeError);
    expect(() => buildArcTable({ cubic: LINE }, 2.5)).toThrow(RangeError);
    expect(() => buildArcTable({ cubic: LINE }, Number.NaN)).toThrow(RangeError);
  });
});

describe('pathPoseAtInto', () => {
  const line: ArcTable = buildArcTable({ cubic: LINE });

  test('halfway along the straight cubic is (50, 0) heading 0°', () => {
    const out = pose();
    expect(pathPoseAtInto(line, 50, out)).toBe(out);
    expect(out.x).toBeCloseTo(50, 3);
    expect(out.y).toBeCloseTo(0, 6);
    expect(out.angleDeg).toBeCloseTo(0, 6);
  });

  test('the ends of the path are its end points', () => {
    const out = pose();
    pathPoseAtInto(line, 0, out);
    expect(out.x).toBeCloseTo(0, 6);
    expect(out.angleDeg).toBeCloseTo(0, 6);
    pathPoseAtInto(line, line.total, out);
    expect(out.x).toBeCloseTo(100, 3);
    expect(out.angleDeg).toBeCloseTo(0, 6);
  });

  test('a vertical-down line has a tangent of 90°', () => {
    const table = buildArcTable({ cubic: [0, 0, 0, 33, 0, 66, 0, 100] });
    const out = pose();
    for (const distance of [-10, 0, 25, 50, 100, 130]) {
      pathPoseAtInto(table, distance, out);
      expect(out.angleDeg).toBeCloseTo(90, 6);
      expect(out.x).toBeCloseTo(0, 6);
      expect(out.y).toBeCloseTo(distance, 3);
    }
  });

  test('up is -90° and leftwards is 180°', () => {
    const out = pose();
    pathPoseAtInto(buildArcTable({ cubic: [0, 0, 0, -33, 0, -66, 0, -100] }), 50, out);
    expect(out.angleDeg).toBeCloseTo(-90, 6);
    pathPoseAtInto(buildArcTable({ cubic: [0, 0, -33, 0, -66, 0, -100, 0] }), 50, out);
    expect(Math.abs(out.angleDeg)).toBeCloseTo(180, 6);
  });

  test('a distance past the end extrapolates along the end tangent', () => {
    const out = pose();
    pathPoseAtInto(line, 120, out);
    expect(out.x).toBeCloseTo(120, 3);
    expect(out.y).toBeCloseTo(0, 6);
    expect(out.angleDeg).toBeCloseTo(0, 6);
  });

  test('a negative distance extrapolates back along the start tangent', () => {
    const out = pose();
    pathPoseAtInto(line, -20, out);
    expect(out.x).toBeCloseTo(-20, 3);
    expect(out.y).toBeCloseTo(0, 6);
    expect(out.angleDeg).toBeCloseTo(0, 6);
  });

  test('extrapolation off a curve follows the tangent at that end', () => {
    const table = buildArcTable({ cubic: QUARTER });
    const out = pose();
    // The arc starts at (100, 0) heading +y and ends at (0, 100) heading -x.
    pathPoseAtInto(table, -10, out);
    expect(out.x).toBeCloseTo(100, 4);
    expect(out.y).toBeCloseTo(-10, 4);
    expect(out.angleDeg).toBeCloseTo(90, 4);
    pathPoseAtInto(table, table.total + 10, out);
    expect(out.x).toBeCloseTo(-10, 4);
    expect(out.y).toBeCloseTo(100, 4);
    expect(Math.abs(out.angleDeg)).toBeCloseTo(180, 4);
  });

  test('a handle sitting on its end point still gives that end a tangent', () => {
    // c1 = p0 and c2 = p3: the derivative is zero at both ends.
    const table = buildArcTable({ cubic: [0, 0, 0, 0, 100, 0, 100, 0] });
    const out = pose();
    pathPoseAtInto(table, -5, out);
    expect(out.x).toBeCloseTo(-5, 4);
    expect(out.angleDeg).toBeCloseTo(0, 6);
    pathPoseAtInto(table, table.total + 5, out);
    expect(out.x).toBeCloseTo(105, 3);
    expect(out.angleDeg).toBeCloseTo(0, 6);
  });

  test('the midpoint of the quarter circle sits on the circle at 135°', () => {
    const table = buildArcTable({ cubic: QUARTER });
    const out = pose();
    pathPoseAtInto(table, table.total / 2, out);
    expect(out.x).toBeCloseTo(out.y, 2);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(100, 1);
    expect(out.angleDeg).toBeCloseTo(135, 1);
  });

  test('distances either side of a segment boundary land in the right segment', () => {
    // Right 100, then down 100.
    const table = buildArcTable({ cubic: [...LINE, 100, 0, 100, 33, 100, 66, 100, 100] });
    const out = pose();
    pathPoseAtInto(table, 90, out);
    expect(out.x).toBeCloseTo(90, 3);
    expect(out.y).toBeCloseTo(0, 6);
    expect(out.angleDeg).toBeCloseTo(0, 6);
    pathPoseAtInto(table, 110, out);
    expect(out.x).toBeCloseTo(100, 3);
    expect(out.y).toBeCloseTo(10, 3);
    expect(out.angleDeg).toBeCloseTo(90, 6);
    pathPoseAtInto(table, 100, out);
    expect(out.x).toBeCloseTo(100, 3);
    expect(out.y).toBeCloseTo(0, 3);
    pathPoseAtInto(table, 230, out);
    expect(out.x).toBeCloseTo(100, 3);
    expect(out.y).toBeCloseTo(130, 3);
    expect(out.angleDeg).toBeCloseTo(90, 6);
  });

  test('equal distance steps are equal steps along an unevenly parameterised curve', () => {
    // The handles bunch the parameter up at the start, so equal t steps are not equal lengths.
    const table = buildArcTable({ cubic: [0, 0, 5, 0, 10, 0, 300, 0] });
    const out = pose();
    for (let i = 0; i <= 10; i++) {
      pathPoseAtInto(table, (i / 10) * table.total, out);
      expect(Math.abs(out.x - i * 30)).toBeLessThan(0.3);
    }
  });

  test('equal distance steps keep a near-even pace along the S-curve', () => {
    const table = buildArcTable({ cubic: S_CURVE });
    const a = pose();
    const b = pose();
    const step = table.total / 500;
    let slowest = Number.POSITIVE_INFINITY;
    let fastest = 0;
    for (let i = 0; i < 500; i++) {
      pathPoseAtInto(table, i * step, a);
      pathPoseAtInto(table, (i + 1) * step, b);
      const pace = Math.hypot(b.x - a.x, b.y - a.y) / step;
      slowest = Math.min(slowest, pace);
      fastest = Math.max(fastest, pace);
    }
    console.log(`S-curve pace at 32 samples: ${slowest.toFixed(4)}..${fastest.toFixed(4)}`);
    expect(slowest).toBeGreaterThan(0.85);
    expect(fastest).toBeLessThan(1.15);
  });

  test('a joint between straight runs still has a heading', () => {
    // Curviness 0 puts every handle on its end point, so the derivative is zero at each joint.
    const table = buildArcTable({ points: [0, 0, 100, 0, 100, 100], curviness: 0 });
    const out = pose();
    pathPoseAtInto(table, 100, out);
    expect(out.x).toBeCloseTo(100, 3);
    expect(out.y).toBeCloseTo(0, 3);
    expect(out.angleDeg).toBeCloseTo(90, 6);
  });

  test('extrapolation skips zero-length segments at either end', () => {
    const table = buildArcTable({
      cubic: [0, 0, 0, 0, 0, 0, 0, 0, ...LINE, 100, 0, 100, 0, 100, 0, 100, 0],
    });
    const out = pose();
    pathPoseAtInto(table, -20, out);
    expect(out.x).toBeCloseTo(-20, 3);
    expect(out.angleDeg).toBeCloseTo(0, 6);
    pathPoseAtInto(table, 120, out);
    expect(out.x).toBeCloseTo(120, 3);
    expect(out.angleDeg).toBeCloseTo(0, 6);
  });

  test('a path of zero length stays on its point at 0°', () => {
    const table = buildArcTable({ cubic: [7, 9, 7, 9, 7, 9, 7, 9] });
    expect(table.total).toBe(0);
    const out = pose();
    for (const distance of [-10, 0, 10]) {
      pathPoseAtInto(table, distance, out);
      expect(out).toEqual({ x: 7, y: 9, angleDeg: 0 });
    }
  });

  test('a zero-length segment between two real ones is stepped over', () => {
    const table = buildArcTable({
      cubic: [...LINE, 100, 0, 100, 0, 100, 0, 100, 0, 100, 0, 100, 33, 100, 66, 100, 100],
    });
    const out = pose();
    pathPoseAtInto(table, 150, out);
    expect(out.x).toBeCloseTo(100, 3);
    expect(out.y).toBeCloseTo(50, 3);
    expect(out.angleDeg).toBeCloseTo(90, 6);
  });

  test('is a worklet that writes into and returns the out object it was given', () => {
    // Bun drops directives from Function.prototype.toString, so the source is what gets checked.
    const source = readFileSync(
      join(import.meta.dir, '..', '..', '..', 'src', 'core', 'path', 'arc-table.ts'),
      'utf8',
    );
    expect(source).toMatch(/function pathPoseAtInto\([^)]*\): PathPose \{\s*'worklet';/);
    const out = pose();
    expect(pathPoseAtInto(line, 10, out)).toBe(out);
    expect(pathPoseAtInto(line, -10, out)).toBe(out);
    expect(pathPoseAtInto(line, 1000, out)).toBe(out);
  });
});
