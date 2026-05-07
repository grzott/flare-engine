import { describe, expect, test } from 'bun:test';
import { shapeBoundsRadius, singleShapeRadius } from '../src/bounds.js';
import type { ShapeSpec } from '../src/types.js';

describe('singleShapeRadius — atomic primitive bounds', () => {
  test('circle returns its radius', () => {
    expect(singleShapeRadius({ kind: 'circle', r: 17 })).toBe(17);
  });
  test('ring returns its radius', () => {
    expect(singleShapeRadius({ kind: 'ring', r: 9 })).toBe(9);
  });
  test('triangle returns size', () => {
    expect(singleShapeRadius({ kind: 'triangle', size: 22 })).toBe(22);
  });
  test('ngon returns r', () => {
    expect(singleShapeRadius({ kind: 'ngon', n: 6, r: 30 })).toBe(30);
  });
  test('star returns rOuter (not rInner)', () => {
    expect(singleShapeRadius({ kind: 'star', points: 5, rOuter: 18, rInner: 7 })).toBe(18);
  });
  test('rect returns max(w,h) * 0.6', () => {
    expect(singleShapeRadius({ kind: 'rect', w: 10, h: 20 })).toBeCloseTo(12, 5);
    expect(singleShapeRadius({ kind: 'rect', w: 100, h: 1 })).toBeCloseTo(60, 5);
  });
  test('gradient-rect uses same formula as rect', () => {
    expect(
      singleShapeRadius({ kind: 'gradient-rect', w: 50, h: 25, colorA: 0, colorB: 0, axis: 0 }),
    ).toBeCloseTo(30, 5);
  });
  test('polyline returns max point hypot + strokeWidth', () => {
    expect(
      singleShapeRadius({ kind: 'polyline', points: [0, 0, 3, 4, -1, -1], strokeWidth: 2 }),
    ).toBe(7); // hypot(3,4)=5, +2 stroke
  });
  test('arc returns r', () => {
    expect(singleShapeRadius({ kind: 'arc', r: 24, startAngle: 0, endAngle: Math.PI })).toBe(24);
  });
  test('annulus returns rOuter', () => {
    expect(singleShapeRadius({ kind: 'annulus', rOuter: 30, rInner: 20 })).toBe(30);
  });
  test('trapezoid returns max(topW, botW, h) * 0.6', () => {
    expect(singleShapeRadius({ kind: 'trapezoid', topW: 10, botW: 50, h: 20 })).toBeCloseTo(30, 5);
  });
  test('path uses the boundsR hint', () => {
    expect(singleShapeRadius({ kind: 'path', d: 'M 0 0 L 100 100', boundsR: 142 })).toBe(142);
  });
  test('ship delegates to its hull', () => {
    expect(
      singleShapeRadius({
        kind: 'ship',
        hull: { kind: 'circle', r: 33 },
        weapons: [],
        engine: { kind: 'square', size: 20 },
      }),
    ).toBe(33);
  });
});

describe('shapeBoundsRadius — composition bounds', () => {
  test('single shape with no offset returns its radius + 2 (margin)', () => {
    const r = shapeBoundsRadius([{ kind: 'circle', r: 10 }]);
    expect(r).toBe(12);
  });

  test('shape with offset adds hypot(ox,oy)', () => {
    const r = shapeBoundsRadius([{ kind: 'circle', r: 10, ox: 3, oy: 4 }]);
    // hypot(3,4)=5 + 10 + 2 = 17
    expect(r).toBe(17);
  });

  test('returns max across multiple shapes', () => {
    const r = shapeBoundsRadius([
      { kind: 'circle', r: 5 },
      { kind: 'circle', r: 20, ox: 0, oy: 0 },
      { kind: 'circle', r: 8 },
    ]);
    expect(r).toBe(22); // 20 + 2
  });

  test('rect uses 0.75 factor for tile sizing (not 0.6 like glow radius)', () => {
    const r = shapeBoundsRadius([{ kind: 'rect', w: 40, h: 10 }]);
    // 40 * 0.75 = 30, + 2 margin = 32
    expect(r).toBe(32);
  });

  test('floor is 4 even for tiny shapes', () => {
    expect(shapeBoundsRadius([{ kind: 'circle', r: 0 }])).toBe(4);
    expect(shapeBoundsRadius([])).toBe(4);
  });

  test('ship uses hull radius via shapeBoundsRadius recursion', () => {
    const ship: ShapeSpec = {
      kind: 'ship',
      hull: { kind: 'circle', r: 25 },
      weapons: [],
      engine: { kind: 'square', size: 20 },
    };
    expect(shapeBoundsRadius([ship])).toBe(29); // 25 + 2 margin from inner + 2 outer margin
  });
});
