import { describe, expect, test } from 'bun:test';
import {
  type ShapeBoundsBox,
  shapeBoundsBox,
  shapeBoundsBoxInto,
  shapeBoundsRadius,
} from '../src/bounds.js';
import type { ShapeSpec, ShipSpec } from '../src/types.js';

function reach(box: ShapeBoundsBox): number {
  return Math.max(Math.abs(box.minX), Math.abs(box.maxX), Math.abs(box.minY), Math.abs(box.maxY));
}

// Hull forward (-y), engine aft, a single weapon on the +x side.
const asymmetricShip: ShipSpec = {
  kind: 'ship',
  hull: { kind: 'triangle', size: 20, oy: -10 },
  weapons: [{ kind: 'rect', w: 6, h: 14, ox: 30, oy: 5 }],
  engine: { kind: 'square', size: 12, oy: 22 },
};

const everyKind: readonly ShapeSpec[] = [
  { kind: 'circle', r: 10 },
  { kind: 'rect', w: 40, h: 10 },
  { kind: 'triangle', size: 20 },
  { kind: 'ngon', n: 5, r: 12 },
  { kind: 'star', points: 5, rOuter: 18, rInner: 7 },
  { kind: 'ring', r: 9 },
  { kind: 'polyline', points: [0, 0, 10, 0, 10, 5], strokeWidth: 2 },
  { kind: 'gradient-rect', w: 50, h: 25, colorA: 0, colorB: 0, axis: 0 },
  { kind: 'arc', r: 24, startAngle: 0, endAngle: Math.PI },
  { kind: 'annulus', rOuter: 30, rInner: 20 },
  { kind: 'trapezoid', topW: 10, botW: 50, h: 20 },
  { kind: 'path', d: 'M 0 0 L 100 100', boundsR: 142 },
  asymmetricShip,
];

function variants(s: ShapeSpec): readonly ShapeSpec[] {
  return [
    s,
    { ...s, ox: 7, oy: -3 },
    { ...s, stroke: 0xff000000, strokeWidth: 3 },
    { ...s, glow: 'friendly' },
    { ...s, ox: -11, oy: 5, stroke: 0xff000000, strokeWidth: 6, glow: 'hazard' },
    { ...s, rot: 0.7 },
    { ...s, rot: 0.7, ox: 7, oy: -3, glow: 'friendly' },
    { ...s, glow: { color: 0xff00ffff, width: 8 } },
    { ...s, rot: 0.7, ox: 7, oy: -3, glow: { color: 0xff00ffff, width: 8 } },
  ];
}

describe('shapeBoundsBox — per-axis extents', () => {
  test('a centred circle gives a symmetric box equal to its radius reach', () => {
    const c: ShapeSpec = { kind: 'circle', r: 10 };
    const r = shapeBoundsRadius([c]);
    expect(r).toBe(12);
    expect(shapeBoundsBox([c])).toEqual({ minX: -r, minY: -r, maxX: r, maxY: r });
  });

  test('an offset rect gives an asymmetric box around its own centre', () => {
    const box = shapeBoundsBox([{ kind: 'rect', w: 10, h: 4, ox: 20, oy: -6 }]);
    // x: 20 ± 5, y: -6 ± 2, then +2 on every side
    expect(box).toEqual({ minX: 13, minY: -10, maxX: 27, maxY: -2 });
  });

  test('a composition unions the boxes of its specs', () => {
    const box = shapeBoundsBox([
      { kind: 'circle', r: 10, ox: -20 },
      { kind: 'circle', r: 10, ox: 30 },
    ]);
    expect(box).toEqual({ minX: -32, minY: -12, maxX: 42, maxY: 12 });
  });

  test('triangle box is asymmetric in y: -size to +0.4·size plus margin', () => {
    const box = shapeBoundsBox([{ kind: 'triangle', size: 20 }]);
    expect(box).toEqual({ minX: -14, minY: -22, maxX: 14, maxY: 10 });
  });

  test('ngon box follows the drawNgon vertices (n=3 is a flat-bottomed triangle)', () => {
    const box = shapeBoundsBox([{ kind: 'ngon', n: 3, r: 10 }]);
    const hx = Math.cos(Math.PI / 6) * 10;
    expect(box.minX).toBeCloseTo(-hx - 2, 10);
    expect(box.maxX).toBeCloseTo(hx + 2, 10);
    expect(box.minY).toBe(-12);
    expect(box.maxY).toBeCloseTo(5 + 2, 10);
  });

  test('star box is bounded by its outer vertices', () => {
    const box = shapeBoundsBox([{ kind: 'star', points: 4, rOuter: 10, rInner: 4 }]);
    expect(box.minX).toBeCloseTo(-12, 10);
    expect(box.maxX).toBeCloseTo(12, 10);
    expect(box.minY).toBeCloseTo(-12, 10);
    expect(box.maxY).toBeCloseTo(12, 10);
  });

  test('polyline box is the point min/max plus strokeWidth plus the stroke margin', () => {
    const box = shapeBoundsBox([
      { kind: 'polyline', points: [0, 0, 10, 0, 10, 5], strokeWidth: 2 },
    ]);
    // points x [0,10] y [0,5]; +2 strokeWidth; +2 base +max(2, 1) stroke margin
    expect(box).toEqual({ minX: -6, minY: -6, maxX: 16, maxY: 11 });
  });

  test('trapezoid box uses the wider edge and h', () => {
    const box = shapeBoundsBox([{ kind: 'trapezoid', topW: 10, botW: 50, h: 20 }]);
    expect(box).toEqual({ minX: -27, minY: -12, maxX: 27, maxY: 12 });
  });

  test('empty specs give an all-zero box, not the 4-unit atlas floor', () => {
    expect(shapeBoundsBox([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    expect(shapeBoundsRadius([])).toBe(4);
  });
});

describe('shapeBoundsBox — ship', () => {
  test('an asymmetric ship is the union of hull, weapons and engine boxes', () => {
    // hull   triangle 20 at (0,-10): x ±12, y [-30,-2]  → +2: x [-14,14], y [-32,0]
    // weapon rect 6x14 at (30,5):    x [27,33], y [-2,12] → +2: x [25,35], y [-4,14]
    // engine square 12 at (0,22):    x ±6, y [16,28]     → +2: x [-8,8],  y [14,30]
    // union x [-14,35], y [-32,30]; ship's own +2
    const box = shapeBoundsBox([asymmetricShip]);
    expect(box).toEqual({ minX: -16, minY: -34, maxX: 37, maxY: 32 });
    const r = shapeBoundsRadius([asymmetricShip]);
    expect(r).toBeCloseTo(44.9138, 3);
    expect(reach(box)).toBeLessThan(r);
    expect(-box.minX).toBeLessThan(r - 20);
  });

  test('ship offset and glow translate and pad the union', () => {
    const box = shapeBoundsBox([{ ...asymmetricShip, ox: 5, oy: -3, glow: 'friendly' }]);
    expect(box).toEqual({ minX: -16.5, minY: -42.5, maxX: 47.5, maxY: 34.5 });
  });

  test('engine stroke and glow widen only the engine box', () => {
    const plain = shapeBoundsBox([asymmetricShip]);
    const glowed = shapeBoundsBox([
      {
        ...asymmetricShip,
        engine: {
          kind: 'square',
          size: 12,
          oy: 22,
          stroke: 0xff000000,
          strokeWidth: 6,
          glow: 'hazard',
        },
      },
    ]);
    // engine box y max 30 + 3 (stroke) + 2.25 (glow) = 35.25, +2 ship margin
    expect(glowed.maxY).toBe(37.25);
    expect(glowed.minY).toBe(plain.minY);
    expect(glowed.maxX).toBe(plain.maxX);
  });

  test('a rotated ship rotates each part about its own centre: parts fall back to radial reach', () => {
    const rotated: ShapeSpec = { ...asymmetricShip, rot: 0.3 };
    // hull   e=20   at (0,-10): x ±20,  y [-30,10]   → +2: x [-22,22],   y [-32,12]
    // weapon e=10.5 at (30,5):  x [19.5,40.5], y [-5.5,15.5] → +2: x [17.5,42.5], y [-7.5,17.5]
    // engine e=9    at (0,22):  x ±9,   y [13,31]    → +2: x [-11,11],   y [11,33]
    // union x [-22,42.5], y [-32,33]; ship's own +2
    const box = shapeBoundsBox([rotated]);
    expect(box).toEqual({ minX: -24, minY: -34, maxX: 44.5, maxY: 35 });
    expect(reach(box)).toBeLessThanOrEqual(shapeBoundsRadius([rotated]));
  });
});

describe('shapeBoundsBox — margins match shapeBoundsRadius', () => {
  const rect: ShapeSpec = { kind: 'rect', w: 40, h: 10 };
  const plainBox = shapeBoundsBox([rect]);
  const plainR = shapeBoundsRadius([rect]);

  function deltas(spec: ShapeSpec): { box: number[]; radius: number } {
    const b = shapeBoundsBox([spec]);
    return {
      box: [
        plainBox.minX - b.minX,
        plainBox.minY - b.minY,
        b.maxX - plainBox.maxX,
        b.maxY - plainBox.maxY,
      ],
      radius: shapeBoundsRadius([spec]) - plainR,
    };
  }

  test('a painted stroke widens every side by the radius delta', () => {
    const d = deltas({ ...rect, stroke: 0xff000000, strokeWidth: 6 });
    expect(d.radius).toBe(3);
    expect(d.box).toEqual([3, 3, 3, 3]);
  });

  test('friendly glow widens every side by 5.5', () => {
    const d = deltas({ ...rect, glow: 'friendly' });
    expect(d.radius).toBe(5.5);
    expect(d.box).toEqual([5.5, 5.5, 5.5, 5.5]);
  });

  test('hazard glow widens every side by 2.25', () => {
    const d = deltas({ ...rect, glow: 'hazard' });
    expect(d.radius).toBe(2.25);
    expect(d.box).toEqual([2.25, 2.25, 2.25, 2.25]);
  });

  test('a GlowSpec widens every side by exactly 2.5 + width', () => {
    const d = deltas({ ...rect, glow: { color: 0xff00ffff, width: 8 } });
    expect(d.radius).toBe(10.5);
    expect(d.box).toEqual([10.5, 10.5, 10.5, 10.5]);
  });

  test.each([Number.NaN, -1, Number.POSITIVE_INFINITY])(
    'a GlowSpec with width %p widens nothing',
    (width) => {
      const d = deltas({ ...rect, glow: { color: 0xff00ffff, width } });
      expect(d.radius).toBe(0);
      expect(d.box).toEqual([0, 0, 0, 0]);
    },
  );

  test('gradient-rect ignores a stroke field, as the radius does', () => {
    const d = deltas({
      kind: 'gradient-rect',
      w: 40,
      h: 10,
      colorA: 0,
      colorB: 0,
      axis: 0,
      stroke: 0xff000000,
      strokeWidth: 20,
    });
    expect(d.radius).toBe(0);
    expect(d.box).toEqual([0, 0, 0, 0]);
  });
});

describe('shapeBoundsBox — rotation', () => {
  test('a rotated rect falls back to its radial reach on both axes', () => {
    const spec: ShapeSpec = { kind: 'rect', w: 40, h: 10, rot: Math.PI / 4, ox: 3 };
    const r = shapeBoundsRadius([{ ...spec, ox: 0 }]);
    expect(r).toBe(32);
    expect(shapeBoundsBox([spec])).toEqual({ minX: 3 - r, minY: -r, maxX: 3 + r, maxY: r });
  });

  test('a rotated circle is unchanged by rotation', () => {
    const plain = shapeBoundsBox([{ kind: 'circle', r: 10, ox: 4 }]);
    expect(shapeBoundsBox([{ kind: 'circle', r: 10, ox: 4, rot: 1 }])).toEqual(plain);
    expect(plain).toEqual({ minX: -8, minY: -12, maxX: 16, maxY: 12 });
  });

  test('rot: 0 is unrotated', () => {
    expect(shapeBoundsBox([{ kind: 'triangle', size: 20, rot: 0 }])).toEqual(
      shapeBoundsBox([{ kind: 'triangle', size: 20 }]),
    );
  });
});

describe('shapeBoundsBox — never exceeds the radius on any axis', () => {
  for (const base of everyKind) {
    test(`${base.kind}: centred, offset, stroked, glowed and rotated variants`, () => {
      for (const v of variants(base)) {
        const box = shapeBoundsBox([v]);
        expect(box.minX).toBeLessThanOrEqual(box.maxX);
        expect(box.minY).toBeLessThanOrEqual(box.maxY);
        expect(reach(box)).toBeLessThanOrEqual(shapeBoundsRadius([v]));
      }
    });
  }
});

describe('shapeBoundsBoxInto', () => {
  const specs: readonly ShapeSpec[] = [
    asymmetricShip,
    { ...asymmetricShip, rot: 0.3, ox: 5, glow: 'friendly' },
    { kind: 'polyline', points: [0, 0, 10, 0, 10, 5], strokeWidth: 2 },
    { kind: 'star', points: 5, rOuter: 18, rInner: 7, ox: -40 },
    { kind: 'ngon', n: 6, r: 12, oy: 30, stroke: 0xff000000 },
  ];

  test('returns the same out object with the allocating form’s values', () => {
    const out: ShapeBoundsBox = { minX: 1, minY: 1, maxX: 1, maxY: 1 };
    expect(shapeBoundsBoxInto(specs, out)).toBe(out);
    expect(out).toEqual(shapeBoundsBox(specs));
    expect(shapeBoundsBoxInto([], out)).toBe(out);
    expect(out).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  test('does not grow the heap over repeated calls', () => {
    const out: ShapeBoundsBox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    for (let i = 0; i < 2_000; i++) shapeBoundsBoxInto(specs, out);

    Bun.gc(true);
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 50_000; i++) shapeBoundsBoxInto(specs, out);
    Bun.gc(true);
    const after = process.memoryUsage().heapUsed;

    expect(after - before).toBeLessThan(256 * 1024);
  });
});
