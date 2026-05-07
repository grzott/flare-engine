/**
 * Draw dispatch tests using a stub Skia. Verifies that each ShapeSpec kind
 * produces the expected draw-call sequence (counts + arg values), so a
 * regression in the dispatcher fails loudly.
 *
 * Real Skia rendering (pixel output) cannot be exercised in Bun's test
 * environment without the native module. Visual parity is verified at
 * runtime via the capture-scene workflow described in the plan.
 */

import { describe, expect, test } from 'bun:test';
import { argbTo, drawShape, friendlyGlowArgb, hazardGlowArgb } from '../src/draw.js';
import type { ShapeSpec } from '../src/types.js';

interface Call {
  readonly method: string;
  readonly args: readonly unknown[];
}

function createStubSkia(svgPathReturnsNull = false): {
  Skia: unknown;
  canvas: unknown;
  paint: unknown;
  calls: Call[];
} {
  const calls: Call[] = [];

  const path = {
    moveTo: (x: number, y: number) => calls.push({ method: 'path.moveTo', args: [x, y] }),
    lineTo: (x: number, y: number) => calls.push({ method: 'path.lineTo', args: [x, y] }),
    close: () => calls.push({ method: 'path.close', args: [] }),
    addArc: (oval: unknown, startDeg: number, sweepDeg: number) =>
      calls.push({ method: 'path.addArc', args: [oval, startDeg, sweepDeg] }),
  };

  const canvas = {
    save: () => calls.push({ method: 'canvas.save', args: [] }),
    restore: () => calls.push({ method: 'canvas.restore', args: [] }),
    translate: (x: number, y: number) => calls.push({ method: 'canvas.translate', args: [x, y] }),
    rotate: (deg: number, px: number, py: number) =>
      calls.push({ method: 'canvas.rotate', args: [deg, px, py] }),
    drawCircle: (cx: number, cy: number, r: number, _paint: unknown) =>
      calls.push({ method: 'canvas.drawCircle', args: [cx, cy, r] }),
    drawRect: (rect: unknown, _paint: unknown) =>
      calls.push({ method: 'canvas.drawRect', args: [rect] }),
    drawPath: (_path: unknown, _paint: unknown) =>
      calls.push({ method: 'canvas.drawPath', args: [] }),
  };

  const paint = {
    setColor: (_c: Float32Array) => {},
    setStyle: (_s: number) => {},
    setStrokeWidth: (_w: number) => {},
  };

  const Skia = {
    Path: {
      Make: () => path,
      MakeFromSVGString: (d: string) => {
        calls.push({ method: 'Skia.Path.MakeFromSVGString', args: [d] });
        return svgPathReturnsNull ? null : path;
      },
    },
    XYWHRect: (x: number, y: number, w: number, h: number) => ({ x, y, w, h }),
    Paint: () => paint,
  };

  return { Skia, canvas, paint, calls };
}

function methodCounts(calls: readonly Call[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of calls) counts[c.method] = (counts[c.method] ?? 0) + 1;
  return counts;
}

// =============================================================================

describe('drawShape — circle', () => {
  test('filled circle invokes drawCircle once at (cx, cy, r)', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'circle', r: 10, fill: 0xff0000ff },
      5,
      7,
      0,
    );
    const drawCalls = calls.filter((c) => c.method === 'canvas.drawCircle');
    expect(drawCalls).toHaveLength(1);
    expect(drawCalls[0]?.args).toEqual([5, 7, 10]);
  });

  test('stroked-only circle invokes drawCircle once', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'circle', r: 10, stroke: 0xff000000, strokeWidth: 2 },
      0,
      0,
      0,
    );
    expect(calls.filter((c) => c.method === 'canvas.drawCircle')).toHaveLength(1);
  });

  test('fill+stroke circle invokes drawCircle twice', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'circle', r: 10, fill: 0xffff0000, stroke: 0xff000000 },
      0,
      0,
      0,
    );
    expect(calls.filter((c) => c.method === 'canvas.drawCircle')).toHaveLength(2);
  });

  test('ox/oy translate the draw position', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'circle', r: 10, fill: 0xff0000ff, ox: 3, oy: -4 },
      100,
      100,
      0,
    );
    const drawCalls = calls.filter((c) => c.method === 'canvas.drawCircle');
    expect(drawCalls[0]?.args).toEqual([103, 96, 10]);
  });
});

describe('drawShape — rect / triangle / ngon / star', () => {
  test('rect emits save/translate/drawRect/restore', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'rect', w: 20, h: 10, fill: 0xff112233 },
      50,
      60,
      0,
    );
    const sequence = calls.map((c) => c.method);
    expect(sequence).toEqual([
      'canvas.save',
      'canvas.translate',
      'canvas.drawRect',
      'canvas.restore',
    ]);
    const trans = calls.find((c) => c.method === 'canvas.translate');
    expect(trans?.args).toEqual([50, 60]);
  });

  test('rect with rotation emits canvas.rotate', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'rect', w: 20, h: 10, fill: 0xff112233 },
      0,
      0,
      Math.PI / 2,
    );
    const rotate = calls.find((c) => c.method === 'canvas.rotate');
    expect(rotate?.args[0]).toBeCloseTo(90, 5);
  });

  test('triangle builds a 3-point path', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'triangle', size: 10, fill: 0xff00ff00 },
      0,
      0,
      0,
    );
    const c = methodCounts(calls);
    expect(c['path.moveTo']).toBe(1);
    expect(c['path.lineTo']).toBe(2);
    expect(c['path.close']).toBe(1);
    expect(c['canvas.drawPath']).toBe(1);
  });

  test('ngon (n=6) builds a 6-point path with one moveTo + 5 lineTos', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'ngon', n: 6, r: 10, fill: 0xffffffff },
      0,
      0,
      0,
    );
    const c = methodCounts(calls);
    expect(c['path.moveTo']).toBe(1);
    expect(c['path.lineTo']).toBe(5);
    expect(c['path.close']).toBe(1);
  });

  test('star with 5 points produces 10 vertices (alternating outer/inner)', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'star', points: 5, rOuter: 10, rInner: 4, fill: 0xff8844ff },
      0,
      0,
      0,
    );
    const c = methodCounts(calls);
    expect(c['path.moveTo']).toBe(1);
    expect(c['path.lineTo']).toBe(9);
    expect(c['path.close']).toBe(1);
  });
});

describe('drawShape — ring / polyline / gradient-rect', () => {
  test('ring emits one stroked drawCircle, no fill', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'ring', r: 12, stroke: 0xff000000, strokeWidth: 2 },
      0,
      0,
      0,
    );
    expect(calls.filter((c) => c.method === 'canvas.drawCircle')).toHaveLength(1);
    expect(calls.filter((c) => c.method === 'canvas.drawRect')).toHaveLength(0);
  });

  test('polyline emits moveTo + (n-1) lineTos, no close', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      {
        kind: 'polyline',
        points: [0, 0, 5, 5, 10, 0, 5, -5],
        stroke: 0xffffffff,
        strokeWidth: 1,
      },
      0,
      0,
      0,
    );
    const c = methodCounts(calls);
    expect(c['path.moveTo']).toBe(1);
    expect(c['path.lineTo']).toBe(3);
    expect(c['path.close'] ?? 0).toBe(0);
  });

  test('polyline with <2 points is a no-op', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'polyline', points: [0, 0], stroke: 0xffffffff },
      0,
      0,
      0,
    );
    // No draw calls reach the canvas at all.
    expect(calls.filter((c) => c.method === 'canvas.drawPath')).toHaveLength(0);
  });

  test('gradient-rect axis=0 draws two halves side-by-side', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'gradient-rect', w: 40, h: 10, colorA: 0xffff0000, colorB: 0xff00ff00, axis: 0 },
      0,
      0,
      0,
    );
    const drawRects = calls.filter((c) => c.method === 'canvas.drawRect');
    expect(drawRects).toHaveLength(2);
  });
});

describe('drawShape — new primitives (arc, annulus, trapezoid, path)', () => {
  test('arc as sector emits moveTo(0,0) + addArc + close', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'arc', r: 20, startAngle: 0, endAngle: Math.PI, sector: true, fill: 0xffff0000 },
      0,
      0,
      0,
    );
    const c = methodCounts(calls);
    expect(c['path.moveTo']).toBe(1);
    expect(c['path.addArc']).toBe(1);
    expect(c['path.close']).toBe(1);
    const moveTo = calls.find((cc) => cc.method === 'path.moveTo');
    expect(moveTo?.args).toEqual([0, 0]);
  });

  test('arc as open arc has no moveTo or close', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      {
        kind: 'arc',
        r: 20,
        startAngle: 0,
        endAngle: Math.PI / 2,
        stroke: 0xff000000,
        strokeWidth: 2,
      },
      0,
      0,
      0,
    );
    const c = methodCounts(calls);
    expect(c['path.addArc']).toBe(1);
    expect(c['path.moveTo'] ?? 0).toBe(0);
    expect(c['path.close'] ?? 0).toBe(0);
  });

  test('arc converts radians to degrees (sweep = endAngle - startAngle)', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'arc', r: 10, startAngle: 0, endAngle: Math.PI, fill: 0xff000000, sector: true },
      0,
      0,
      0,
    );
    const arc = calls.find((c) => c.method === 'path.addArc');
    // startDeg = 0, sweepDeg = π * 180/π = 180
    expect(arc?.args[1]).toBeCloseTo(0, 5);
    expect(arc?.args[2]).toBeCloseTo(180, 5);
  });

  test('annulus (full) emits one stroked drawCircle at midRadius', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'annulus', rOuter: 30, rInner: 20, fill: 0xff8844cc },
      0,
      0,
      0,
    );
    const drawCircles = calls.filter((c) => c.method === 'canvas.drawCircle');
    expect(drawCircles).toHaveLength(1);
    // midR = (30 + 20) / 2 = 25
    expect(drawCircles[0]?.args).toEqual([0, 0, 25]);
  });

  test('annulus (partial — half-donut) emits addArc with stroked path, no drawCircle', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      {
        kind: 'annulus',
        rOuter: 30,
        rInner: 20,
        startAngle: 0,
        endAngle: Math.PI,
        fill: 0xff8844cc,
      },
      0,
      0,
      0,
    );
    expect(calls.filter((c) => c.method === 'path.addArc')).toHaveLength(1);
    expect(calls.filter((c) => c.method === 'canvas.drawCircle')).toHaveLength(0);
    expect(calls.filter((c) => c.method === 'canvas.drawPath')).toHaveLength(1);
  });

  test('trapezoid builds a 4-point path', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'trapezoid', topW: 10, botW: 30, h: 20, fill: 0xff442211 },
      0,
      0,
      0,
    );
    const c = methodCounts(calls);
    expect(c['path.moveTo']).toBe(1);
    expect(c['path.lineTo']).toBe(3);
    expect(c['path.close']).toBe(1);
  });

  test('trapezoid first point is the narrow-top-left corner', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'trapezoid', topW: 10, botW: 30, h: 20, fill: 0xff442211 },
      0,
      0,
      0,
    );
    const moveTo = calls.find((c) => c.method === 'path.moveTo');
    // -topW/2, -h/2 = -5, -10
    expect(moveTo?.args).toEqual([-5, -10]);
  });

  test('path calls Skia.Path.MakeFromSVGString with the d string', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    const d = 'M 0 0 L 10 10 Z';
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'path', d, boundsR: 14, fill: 0xffff8800 },
      0,
      0,
      0,
    );
    const parse = calls.find((c) => c.method === 'Skia.Path.MakeFromSVGString');
    expect(parse?.args).toEqual([d]);
    expect(calls.filter((c) => c.method === 'canvas.drawPath')).toHaveLength(1);
  });

  test('path with malformed d (Skia returns null) silently skips draw', () => {
    const { Skia, canvas, paint, calls } = createStubSkia(true);
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      { kind: 'path', d: 'NOT A VALID PATH', boundsR: 10, fill: 0xff000000 },
      0,
      0,
      0,
    );
    expect(calls.filter((c) => c.method === 'canvas.drawPath')).toHaveLength(0);
    expect(calls.filter((c) => c.method === 'canvas.save')).toHaveLength(0);
  });
});

describe('drawShape — ship composite', () => {
  test("ship draws engine → hull → weapons in order (painter's algorithm)", () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      {
        kind: 'ship',
        hull: { kind: 'circle', r: 14, fill: 0xff336699 },
        weapons: [
          { kind: 'rect', w: 4, h: 8, fill: 0xff993300, ox: -8 },
          { kind: 'rect', w: 4, h: 8, fill: 0xff993300, ox: 8 },
        ],
        engine: { kind: 'square', size: 20, fill: 0xff000000 },
      },
      0,
      0,
      0,
    );
    // engine = drawRect (square delegates to rect), hull = drawCircle, 2 weapon = 2× drawRect
    expect(calls.filter((c) => c.method === 'canvas.drawCircle')).toHaveLength(1);
    expect(calls.filter((c) => c.method === 'canvas.drawRect')).toHaveLength(3); // engine + 2 weapons
  });

  test('ship with no weapons still emits engine + hull', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    drawShape(
      Skia as never,
      canvas as never,
      paint as never,
      {
        kind: 'ship',
        hull: { kind: 'circle', r: 14, fill: 0xff336699 },
        weapons: [],
        engine: { kind: 'square', size: 20, fill: 0xff000000 },
      },
      0,
      0,
      0,
    );
    expect(calls.filter((c) => c.method === 'canvas.drawRect')).toHaveLength(1);
    expect(calls.filter((c) => c.method === 'canvas.drawCircle')).toHaveLength(1);
  });
});

describe('drawShape — glow halo', () => {
  test('friendly glow emits one extra drawCircle behind the body', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    const spec: ShapeSpec = { kind: 'circle', r: 10, fill: 0xff00ff00, glow: 'friendly' };
    drawShape(Skia as never, canvas as never, paint as never, spec, 0, 0, 0);
    // 1 glow ring + 1 body = 2 drawCircle
    expect(calls.filter((c) => c.method === 'canvas.drawCircle')).toHaveLength(2);
    // First is the glow at r+4
    expect(calls.find((c) => c.method === 'canvas.drawCircle')?.args).toEqual([0, 0, 14]);
  });

  test('hazard glow emits two drawCircle rings + body', () => {
    const { Skia, canvas, paint, calls } = createStubSkia();
    const spec: ShapeSpec = { kind: 'circle', r: 10, fill: 0xff00ff00, glow: 'hazard' };
    drawShape(Skia as never, canvas as never, paint as never, spec, 0, 0, 0);
    // 2 glow rings (r+1, r+2) + 1 body = 3 drawCircle
    expect(calls.filter((c) => c.method === 'canvas.drawCircle')).toHaveLength(3);
  });
});

describe('color plumbing', () => {
  test('argbTo extracts ARGB into a Float32Array in [r,g,b,a] order, normalized', () => {
    const out = new Float32Array(4);
    argbTo(out, 0xff_80_40_20); // alpha=255, r=128, g=64, b=32
    expect(out[0]).toBeCloseTo(128 / 255, 5);
    expect(out[1]).toBeCloseTo(64 / 255, 5);
    expect(out[2]).toBeCloseTo(32 / 255, 5);
    expect(out[3]).toBeCloseTo(1, 5);
  });

  test('friendlyGlowArgb is safe-green at α=0.25', () => {
    expect(friendlyGlowArgb()).toBe((0x40 << 24) | 0x6fa66b);
  });

  test('hazardGlowArgb is hazard-orange at α=0.6', () => {
    expect(hazardGlowArgb()).toBe((0x99 << 24) | 0xe84b2a);
  });
});
