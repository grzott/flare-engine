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
  test('ship uses hull radius when hull dominates weapons + engine', () => {
    expect(
      singleShapeRadius({
        kind: 'ship',
        hull: { kind: 'circle', r: 33 },
        weapons: [],
        engine: { kind: 'square', size: 20 },
      }),
    ).toBe(33);
  });

  test('ship glow radius grows to contain wing weapons', () => {
    const r = singleShapeRadius({
      kind: 'ship',
      hull: { kind: 'triangle', size: 20 },
      weapons: [
        { kind: 'rect', w: 6, h: 14, ox: -30, oy: 5 },
        { kind: 'rect', w: 6, h: 14, ox: 30, oy: 5 },
      ],
      engine: { kind: 'square', size: 12, oy: 22 },
    });
    // far weapon reach = hypot(30,5) + max(6,14)*0.6 = 30.413812... + 8.4 = 38.813812...
    expect(r).toBeCloseTo(38.8138, 3);
    expect(r).toBeGreaterThan(20); // regression guard: hull-only radius is 20
  });

  test('ship glow radius grows to contain an offset engine', () => {
    const r = singleShapeRadius({
      kind: 'ship',
      hull: { kind: 'circle', r: 8 },
      weapons: [],
      engine: { kind: 'square', size: 10, oy: 40 },
    });
    // engine reach = hypot(0,40) + 10*0.6 = 40 + 6 = 46
    expect(r).toBe(46);
    expect(r).toBeGreaterThan(8); // regression guard: hull-only radius is 8
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

  test('ship tile uses hull radius when hull dominates', () => {
    const ship: ShapeSpec = {
      kind: 'ship',
      hull: { kind: 'circle', r: 25 },
      weapons: [],
      engine: { kind: 'square', size: 20 },
    };
    expect(shapeBoundsRadius([ship])).toBe(29); // 25 + 2 margin from inner + 2 outer margin
  });

  test('ship tile grows to contain wing weapons', () => {
    const wingShip: ShapeSpec = {
      kind: 'ship',
      hull: { kind: 'triangle', size: 20 },
      weapons: [
        { kind: 'rect', w: 6, h: 14, ox: -30, oy: 5 },
        { kind: 'rect', w: 6, h: 14, ox: 30, oy: 5 },
      ],
      engine: { kind: 'square', size: 12, oy: 22 },
    };
    const hullOnlyShip: ShapeSpec = {
      kind: 'ship',
      hull: { kind: 'triangle', size: 20 },
      weapons: [],
      engine: { kind: 'square', size: 12, oy: 22 },
    };
    const withWeapons = shapeBoundsRadius([wingShip]);
    const withoutWeapons = shapeBoundsRadius([hullOnlyShip]);
    // weapon reach = hypot(30,5) + 14*0.75 + 2 = 30.413812... + 10.5 + 2 = 42.913812...
    // outer margin +2 → 44.913812...
    expect(withWeapons).toBeCloseTo(44.9138, 3);
    expect(withWeapons).toBeGreaterThan(withoutWeapons); // weapons widen the tile
  });
});

describe('shapeBoundsRadius — stroke-width margin (F017)', () => {
  test('a painted stroke adds max(2, strokeWidth/2) on top of the base +2 margin', () => {
    const r = shapeBoundsRadius([{ kind: 'circle', r: 10, stroke: 0xff000000, strokeWidth: 6 }]);
    expect(r).toBe(15); // 10 + 2 (base) + max(2, 3) (stroke)
  });

  test('an unspecified strokeWidth uses the draw.ts default of 1', () => {
    const r = shapeBoundsRadius([{ kind: 'circle', r: 10, stroke: 0xff000000 }]);
    expect(r).toBe(14); // 10 + 2 + max(2, 0.5)
  });

  test('a fill-only circle (no stroke) is unaffected — matches the pinned no-stroke case', () => {
    const r = shapeBoundsRadius([{ kind: 'circle', r: 10, fill: 0xffffffff }]);
    expect(r).toBe(12);
  });

  test('ring always adds the stroke margin, even with no explicit stroke color', () => {
    const r = shapeBoundsRadius([{ kind: 'ring', r: 10 }]);
    expect(r).toBe(14); // ring is always stroked by draw.ts (default strokeWidth 1)
  });

  test('polyline always adds the stroke margin', () => {
    const r = shapeBoundsRadius([{ kind: 'polyline', points: [0, 0, 10, 0], strokeWidth: 8 }]);
    // boundsR falls through to singleShapeRadius: max hypot(10,0)=10, +strokeWidth(8) = 18
    expect(r).toBe(24); // 18 + 2 (base) + max(2, 4) (stroke)
  });

  test('gradient-rect ignores an explicit stroke field — draw.ts never paints one', () => {
    const r = shapeBoundsRadius([
      {
        kind: 'gradient-rect',
        w: 40,
        h: 10,
        colorA: 0,
        colorB: 0,
        axis: 0,
        stroke: 0xff000000,
        strokeWidth: 20,
      },
    ]);
    expect(r).toBe(32); // same as the no-stroke case; the bogus strokeWidth is not counted
  });

  test('annulus ignores the generic stroke field — its ring is already bounded by rOuter', () => {
    const r = shapeBoundsRadius([
      { kind: 'annulus', rOuter: 30, rInner: 20, stroke: 0xff000000, strokeWidth: 99 },
    ]);
    expect(r).toBe(32); // 30 + 2, unaffected by the unrelated strokeWidth
  });
});

describe('shapeBoundsRadius — glow-ring margin (F017)', () => {
  test('friendly glow adds +5.5 beyond the base margin, containing the ring drawShape paints', () => {
    const r = shapeBoundsRadius([{ kind: 'circle', r: 10, glow: 'friendly' }]);
    expect(r).toBe(17.5); // 10 + 2 + 5.5
    // drawShape's friendly ring outer edge is r + 4 + (strokeWidth 3)/2 = 15.5.
    expect(r).toBeGreaterThan(10 + 4 + 1.5);
  });

  test('hazard glow adds +2.25 beyond the base margin, containing the outer ring', () => {
    const r = shapeBoundsRadius([{ kind: 'circle', r: 10, glow: 'hazard' }]);
    expect(r).toBe(14.25); // 10 + 2 + 2.25
    // drawShape's hazard outer ring edge is r + 2 + (strokeWidth 0.5)/2 = 12.25.
    expect(r).toBeGreaterThan(10 + 2 + 0.25);
  });

  test('stroke and glow margins stack', () => {
    const r = shapeBoundsRadius([
      { kind: 'circle', r: 10, stroke: 0xff000000, strokeWidth: 4, glow: 'hazard' },
    ]);
    expect(r).toBe(16.25); // 10 + 2 (base) + max(2, 2) (stroke) + 2.25 (glow)
  });

  test('a ship engine glow ring widens the ship tile relative to no glow', () => {
    const glowedShip: ShapeSpec = {
      kind: 'ship',
      hull: { kind: 'circle', r: 8 },
      weapons: [],
      engine: { kind: 'square', size: 10, oy: 40, glow: 'friendly' },
    };
    const plainShip: ShapeSpec = {
      kind: 'ship',
      hull: { kind: 'circle', r: 8 },
      weapons: [],
      engine: { kind: 'square', size: 10, oy: 40 },
    };
    // engine reach (boundsR uses the rect 0.75 factor) = hypot(0,40) + 10*0.75 + 2 = 49.5;
    // +2 outer margin = 51.5 without glow, +5.5 more = 57 with glow.
    expect(shapeBoundsRadius([plainShip])).toBeCloseTo(51.5, 5);
    expect(shapeBoundsRadius([glowedShip])).toBeCloseTo(57, 5);
  });
});
