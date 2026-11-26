import { describe, expect, test } from 'bun:test';
import type { Rect } from '@flare-engine/math';
import {
  createMaskPose,
  createMaskShape,
  isMaskSolidAt,
  type MaskPose,
  type MaskShape,
  maskBounds,
  maskBoundsInto,
  maskOverlapsBox,
  maskOverlapsCircle,
  maskOverlapsMask,
  maskOverlapsSweptBox,
  maskStripStop,
  rayVsMask,
} from '../src/mask.js';

const UNIT = 2;

function pose(x: number, y: number, px: number, py: number, turn = 0, unit = UNIT): MaskPose {
  const p = createMaskPose();
  p.x = x;
  p.y = y;
  p.px = px;
  p.py = py;
  p.cos = Math.cos(turn);
  p.sin = Math.sin(turn);
  p.unit = unit;
  return p;
}

/**
 * A hull (columns 0-2) and a wing (columns 6-8) with a 3 px gap (3-5), and a
 * 1 px wing tip at column 9, row 4. The pivot is the hull's centre pixel.
 */
const WINGED = createMaskShape([
  '###.......',
  '###...###.',
  '###...###.',
  '###...###.',
  '###...####',
  '###...###.',
  '###.......',
]);
/** The pivot (1, 3): its centre (1.5, 3.5) sits on the position. */
const W = pose(100, 100, 1.5, 3.5);

/** The world x of the left edge of column `c` (unturned). */
const colX = (p: MaskPose, c: number): number => p.x + (c - p.px) * p.unit;
const rowY = (p: MaskPose, r: number): number => p.y + (r - p.py) * p.unit;

describe('mask geometry (ported from PV-05a)', () => {
  test('a box over a solid pixel hits; one in the gap misses', () => {
    expect(maskOverlapsBox(WINGED, W, colX(W, 1) + 1, rowY(W, 3) + 1, 0.5, 0.5, false)).toBe(true);
    // The gap is columns 3-5: a box inside it, clear of both edges, misses.
    const gapMid = colX(W, 4.5);
    expect(maskOverlapsBox(WINGED, W, gapMid, rowY(W, 3), 0.9, 0.9, false)).toBe(false);
    // Touching an edge is not overlapping.
    expect(maskOverlapsBox(WINGED, W, colX(W, 3) + 1, rowY(W, 3), 1, 1, false)).toBe(false);
  });

  test('a shot through the gap between wing and hull misses', () => {
    const x = colX(W, 4.5);
    expect(maskOverlapsSweptBox(WINGED, W, x, rowY(W, -5), x, rowY(W, 12), 0.8, 2)).toBe(false);
  });

  test('a shot crossing a 1 px wing tip between frames hits', () => {
    const x = colX(W, 9.5);
    const from = rowY(W, -2);
    const to = rowY(W, 10);
    // Neither end of its flight touches the mask; only the sweep crosses the tip.
    expect(maskOverlapsBox(WINGED, W, x, from, 0.5, 0.5, false)).toBe(false);
    expect(maskOverlapsBox(WINGED, W, x, to, 0.5, 0.5, false)).toBe(false);
    expect(maskOverlapsSweptBox(WINGED, W, x, from, x, to, 0.5, 0.5)).toBe(true);
    // One column further out, the same sweep misses.
    const out = colX(W, 10.5);
    expect(maskOverlapsSweptBox(WINGED, W, out, from, out, to, 0.5, 0.5)).toBe(false);
  });

  test('the eroded mask drops the outline: a graze on it is no contact', () => {
    const block = createMaskShape(['#####', '#####', '#####', '#####', '#####']);
    const p = pose(0, 0, 2.5, 2.5);
    // A box over column 4 only (the outline's right edge).
    const x = colX(p, 4.5);
    expect(maskOverlapsBox(block, p, x, 0, 0.4, 0.4, false)).toBe(true);
    expect(maskOverlapsBox(block, p, x, 0, 0.4, 0.4, true)).toBe(false);
    // One pixel in, the eroded mask is solid.
    expect(maskOverlapsBox(block, p, colX(p, 3.5), 0, 0.4, 0.4, true)).toBe(true);
  });

  test('a beam stops at the first opaque pixel', () => {
    // A T: a bar on row 0 (columns 0-4), a stem on column 2 down to row 3.
    const t = createMaskShape(['#####', '..#..', '..#..', '..#..']);
    const p = pose(50, 50, 2.5, 1.5);
    // A forward beam, up from y 80, 1 unit either side of the stem's centre.
    const stem = colX(p, 2.5);
    expect(maskStripStop(t, p, stem - 1, 0, stem + 1, 80, 0, -1)).toBeCloseTo(rowY(p, 4), 9);
    // Beside the stem it reaches the bar's underside.
    const side = colX(p, 0.5);
    expect(maskStripStop(t, p, side - 1, 0, side + 1, 80, 0, -1)).toBeCloseTo(rowY(p, 1), 9);
    // Clear of the mask it stops nowhere.
    expect(Number.isNaN(maskStripStop(t, p, 0, 0, 2, 80, 0, -1))).toBe(true);
    // A ray straight up the stem stops at its bottom.
    expect(rayVsMask(t, p, stem, 80, 0, -1, 100)).toBeCloseTo(80 - rowY(p, 4), 9);
    // A side beam from the left, along row 0, stops at the bar's left edge.
    const row0 = rowY(p, 0.5);
    expect(maskStripStop(t, p, 0, row0 - 0.5, 50, row0 + 0.5, 1, 0)).toBeCloseTo(colX(p, 0), 9);
  });

  test('a ray that misses every pixel reads -1; one starting inside a pixel reads 0', () => {
    const t = createMaskShape(['#####', '..#..']);
    const p = pose(0, 0, 2.5, 1);
    expect(rayVsMask(t, p, colX(p, 0.5), 20, 0, 1, 100)).toBe(-1);
    expect(rayVsMask(t, p, colX(p, 2.5), rowY(p, 0.5), 1, 0, 100)).toBe(0);
  });

  test('a turned mask is hit where its art is', () => {
    // A bar 5 px wide, 1 tall, pivot at its centre; turned a quarter it stands upright.
    const bar = createMaskShape(['#####']);
    const p = pose(0, 0, 2.5, 0.5, Math.PI / 2);
    // Upright: 2 px above the position is art, 2 px to the side is not.
    expect(maskOverlapsBox(bar, p, 0, -2 * UNIT, 0.4, 0.4, false)).toBe(true);
    expect(maskOverlapsBox(bar, p, 2 * UNIT, 0, 0.4, 0.4, false)).toBe(false);
    // A ray from the right hits the upright bar's side; one above its top misses.
    expect(rayVsMask(bar, p, 20, -2 * UNIT, -1, 0, 40)).toBeCloseTo(20 - 0.5 * UNIT, 9);
    expect(rayVsMask(bar, p, 20, -3 * UNIT, -1, 0, 40)).toBe(-1);
  });

  test('an asymmetric mask, its art off the pivot, is hit at its far edge, turned or not', () => {
    // The pivot at column 0; the art runs 7 px to its right.
    const arm = createMaskShape(['########']);
    const far = 7.5;
    const flat = pose(0, 0, 0.5, 0.5);
    expect(maskOverlapsBox(arm, flat, (far - 0.5) * UNIT, 0, 0.4, 0.4, false)).toBe(true);
    expect(maskOverlapsBox(arm, flat, -(far - 0.5) * UNIT, 0, 0.4, 0.4, false)).toBe(false);
    // Turned a half: the far edge is to the left now.
    const turned = pose(0, 0, 0.5, 0.5, Math.PI);
    expect(maskOverlapsBox(arm, turned, -(far - 0.5) * UNIT, 0, 0.4, 0.4, false)).toBe(true);
    expect(maskOverlapsBox(arm, turned, (far - 0.5) * UNIT, 0, 0.4, 0.4, false)).toBe(false);
  });
});

describe('createMaskShape / isMaskSolidAt', () => {
  test('rows become bounds at the given offset, one word per 32 columns', () => {
    const m = createMaskShape(['#.', '.#', '##'], 4, 7);
    expect(m.x).toBe(4);
    expect(m.y).toBe(7);
    expect(m.w).toBe(2);
    expect(m.h).toBe(3);
    expect(Array.from(m.words)).toEqual([0b01, 0b10, 0b11]);
  });

  test('cells are addressed in frame px: the bounds offset is part of the coordinate', () => {
    const m = createMaskShape(['#.', '.#'], 4, 7);
    expect(isMaskSolidAt(m, 4, 7)).toBe(true);
    expect(isMaskSolidAt(m, 5, 7)).toBe(false);
    expect(isMaskSolidAt(m, 5, 8)).toBe(true);
    expect(isMaskSolidAt(m, 0, 0)).toBe(false);
  });

  test('outside the bounds nothing is solid', () => {
    const m = createMaskShape(['##', '##']);
    expect(isMaskSolidAt(m, -1, 0)).toBe(false);
    expect(isMaskSolidAt(m, 2, 0)).toBe(false);
    expect(isMaskSolidAt(m, 0, -1)).toBe(false);
    expect(isMaskSolidAt(m, 0, 2)).toBe(false);
  });

  test('eroded: solid only with all four neighbours solid', () => {
    const m = createMaskShape(['###', '###', '###']);
    expect(isMaskSolidAt(m, 1, 1, true)).toBe(true);
    expect(isMaskSolidAt(m, 0, 1, true)).toBe(false);
    expect(isMaskSolidAt(m, 1, 0, true)).toBe(false);
    expect(isMaskSolidAt(m, 2, 2, true)).toBe(false);
    expect(isMaskSolidAt(m, 2, 2)).toBe(true);
  });

  test('short rows are padded clear; only # is solid', () => {
    const m = createMaskShape(['#', 'x#.']);
    expect(m.w).toBe(3);
    expect(isMaskSolidAt(m, 0, 0)).toBe(true);
    expect(isMaskSolidAt(m, 1, 0)).toBe(false);
    expect(isMaskSolidAt(m, 0, 1)).toBe(false);
    expect(isMaskSolidAt(m, 1, 1)).toBe(true);
  });

  test('a row wider than 32 px spans several words', () => {
    const row = `${'.'.repeat(31)}##${'.'.repeat(30)}.#`;
    const m = createMaskShape([row, '#'.repeat(65)]);
    expect(m.w).toBe(65);
    expect(m.words.length).toBe(6);
    expect(isMaskSolidAt(m, 30, 0)).toBe(false);
    expect(isMaskSolidAt(m, 31, 0)).toBe(true);
    expect(isMaskSolidAt(m, 32, 0)).toBe(true);
    expect(isMaskSolidAt(m, 33, 0)).toBe(false);
    expect(isMaskSolidAt(m, 63, 0)).toBe(false);
    expect(isMaskSolidAt(m, 64, 0)).toBe(true);
    // Bit 31 of a word is the sign bit of a signed 32-bit value.
    expect(isMaskSolidAt(m, 31, 1)).toBe(true);
    expect(isMaskSolidAt(m, 32, 1, true)).toBe(false);
    const three = createMaskShape(['#'.repeat(65), '#'.repeat(65), '#'.repeat(65)]);
    expect(isMaskSolidAt(three, 31, 1, true)).toBe(true);
    expect(isMaskSolidAt(three, 32, 1, true)).toBe(true);
    expect(isMaskSolidAt(three, 64, 1, true)).toBe(false);
  });

  test('a plain object with number[] words is a MaskShape, signed words included', () => {
    // Column 31 set: 1 << 31 is negative as a signed 32-bit number.
    const m: MaskShape = { x: 0, y: 0, w: 32, h: 1, words: [1 << 31] };
    expect(isMaskSolidAt(m, 31, 0)).toBe(true);
    expect(isMaskSolidAt(m, 30, 0)).toBe(false);
  });

  test('Uint32Array words read the same as number[] words', () => {
    const rows = ['#..#', '.##.'];
    const built = createMaskShape(rows);
    const typed: MaskShape = { x: 0, y: 0, w: 4, h: 2, words: new Uint32Array([0b1001, 0b0110]) };
    const plain: MaskShape = { x: 0, y: 0, w: 4, h: 2, words: [0b1001, 0b0110] };
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        expect(isMaskSolidAt(typed, c, r)).toBe(isMaskSolidAt(built, c, r));
        expect(isMaskSolidAt(plain, c, r)).toBe(isMaskSolidAt(built, c, r));
      }
    }
    const p = pose(0, 0, 0, 0, 0, 1);
    expect(maskOverlapsBox(typed, p, 3.5, 0.5, 0.2, 0.2)).toBe(true);
    expect(maskOverlapsBox(typed, p, 1.5, 0.5, 0.2, 0.2)).toBe(false);
  });
});

describe('maskBoundsInto', () => {
  const rect = (): Rect => ({ x: 0, y: 0, width: 0, height: 0 });

  test('unturned: the bounds, offset from the pivot and scaled by unit', () => {
    // Bounds 4x2 px at frame (3, 5); the pivot at frame (1, 1).
    const m = createMaskShape(['####', '####'], 3, 5);
    const p = pose(100, 200, 1, 1, 0, 2);
    const out = rect();
    expect(maskBoundsInto(m, p, out)).toBe(out);
    expect(out.x).toBeCloseTo(104, 9);
    expect(out.y).toBeCloseTo(208, 9);
    expect(out.width).toBeCloseTo(8, 9);
    expect(out.height).toBeCloseTo(4, 9);
  });

  test('a quarter turn swaps the extents and carries the offset round the pivot', () => {
    const m = createMaskShape(['####', '####'], 3, 5);
    const p = pose(100, 200, 1, 1, Math.PI / 2, 2);
    const out = maskBoundsInto(m, p, rect());
    // Local (2..6, 4..6) px from the pivot; turned, x' = -y and y' = x.
    expect(out.x).toBeCloseTo(100 - 12, 9);
    expect(out.y).toBeCloseTo(200 + 4, 9);
    expect(out.width).toBeCloseTo(4, 9);
    expect(out.height).toBeCloseTo(8, 9);
  });

  test('an eighth turn gives the bounding box of the turned rectangle', () => {
    const m = createMaskShape(['##', '##']);
    const p = pose(0, 0, 1, 1, Math.PI / 4, 1);
    const out = maskBoundsInto(m, p, rect());
    const half = Math.SQRT2;
    expect(out.x).toBeCloseTo(-half, 9);
    expect(out.y).toBeCloseTo(-half, 9);
    expect(out.width).toBeCloseTo(2 * half, 9);
    expect(out.height).toBeCloseTo(2 * half, 9);
  });

  test('the bounds contain every solid cell corner of a turned, offset mask', () => {
    const m = createMaskShape(['#..', '.#.', '..#', '###'], 2, -1);
    const p = pose(7, -3, 0.5, 2.5, 0.7, 1.5);
    const b = maskBoundsInto(m, p, rect());
    for (let r = m.y; r <= m.y + m.h; r++) {
      for (let c = m.x; c <= m.x + m.w; c++) {
        const lx = c - p.px;
        const ly = r - p.py;
        const wx = p.x + (lx * p.cos - ly * p.sin) * p.unit;
        const wy = p.y + (lx * p.sin + ly * p.cos) * p.unit;
        expect(wx).toBeGreaterThanOrEqual(b.x - 1e-9);
        expect(wx).toBeLessThanOrEqual(b.x + b.width + 1e-9);
        expect(wy).toBeGreaterThanOrEqual(b.y - 1e-9);
        expect(wy).toBeLessThanOrEqual(b.y + b.height + 1e-9);
      }
    }
  });

  test('maskBounds returns a fresh rect with the same values', () => {
    const m = createMaskShape(['####', '####'], 3, 5);
    const p = pose(100, 200, 1, 1, 0.3, 2);
    const a = maskBounds(m, p);
    const b = maskBounds(m, p);
    expect(a).not.toBe(b);
    expect(a).toEqual(maskBoundsInto(m, p, rect()));
  });
});

describe('maskOverlapsBox with an offset mask', () => {
  test('the bounds offset moves the art away from the pivot', () => {
    // One solid px at frame (10, 10); the pivot at the frame's origin.
    const m = createMaskShape(['#'], 10, 10);
    const p = pose(0, 0, 0, 0, 0, 1);
    expect(maskOverlapsBox(m, p, 10.5, 10.5, 0.1, 0.1)).toBe(true);
    expect(maskOverlapsBox(m, p, 0.5, 0.5, 0.1, 0.1)).toBe(false);
  });

  test('erode defaults to false', () => {
    const m = createMaskShape(['#']);
    const p = pose(0, 0, 0, 0, 0, 1);
    expect(maskOverlapsBox(m, p, 0.5, 0.5, 0.1, 0.1)).toBe(true);
    expect(maskOverlapsBox(m, p, 0.5, 0.5, 0.1, 0.1, true)).toBe(false);
  });

  test('a multi-word mask is hit past column 32', () => {
    const m = createMaskShape([`${'.'.repeat(40)}#`]);
    const p = pose(0, 0, 0, 0, 0, 1);
    expect(maskOverlapsBox(m, p, 40.5, 0.5, 0.2, 0.2)).toBe(true);
    expect(maskOverlapsBox(m, p, 8.5, 0.5, 0.2, 0.2)).toBe(false);
    expect(maskOverlapsBox(m, p, 39.5, 0.5, 0.2, 0.2)).toBe(false);
    expect(rayVsMask(m, p, 0, 0.5, 1, 0, 100)).toBeCloseTo(40, 9);
  });
});

describe('maskOverlapsCircle', () => {
  // One solid px, 1 world unit, occupying the world square (0..1, 0..1).
  const dot = createMaskShape(['#']);
  const p1 = pose(0, 0, 0, 0, 0, 1);

  test('a circle over a solid pixel hits; one clear of it misses', () => {
    expect(maskOverlapsCircle(dot, p1, 0.5, 0.5, 0.1)).toBe(true);
    expect(maskOverlapsCircle(dot, p1, 3, 0.5, 0.5)).toBe(false);
    expect(maskOverlapsCircle(dot, p1, 1.4, 0.5, 0.5)).toBe(true);
  });

  test('touching an edge is not overlapping', () => {
    expect(maskOverlapsCircle(dot, p1, 2, 0.5, 1)).toBe(false);
    expect(maskOverlapsCircle(dot, p1, 0.5, -1, 1)).toBe(false);
    expect(maskOverlapsCircle(dot, p1, 2 - 1e-6, 0.5, 1)).toBe(true);
  });

  test('a corner is rounded: the box of the circle reaches it, the circle does not', () => {
    // Centre (1.8, 1.8), radius 1: the bounding box overlaps the pixel, the
    // corner (1, 1) is 1.13 away.
    expect(maskOverlapsCircle(dot, p1, 1.8, 1.8, 1)).toBe(false);
    expect(maskOverlapsBox(dot, p1, 1.8, 1.8, 1, 1)).toBe(true);
    expect(maskOverlapsCircle(dot, p1, 1.7, 1.7, 1)).toBe(true);
  });

  test('a zero radius hits only strictly inside a pixel', () => {
    expect(maskOverlapsCircle(dot, p1, 0.5, 0.5, 0)).toBe(true);
    expect(maskOverlapsCircle(dot, p1, 1, 0.5, 0)).toBe(false);
    expect(maskOverlapsCircle(dot, p1, 1.5, 0.5, 0)).toBe(false);
  });

  test('a circle in the gap between hull and wing misses; a wider one hits', () => {
    const x = colX(W, 4.5);
    const y = rowY(W, 3.5);
    // The gap is 3 px = 6 units wide; the centre is 3 units from either side.
    expect(maskOverlapsCircle(WINGED, W, x, y, 2.9)).toBe(false);
    expect(maskOverlapsCircle(WINGED, W, x, y, 3)).toBe(false);
    expect(maskOverlapsCircle(WINGED, W, x, y, 3.1)).toBe(true);
  });

  test('the radius is scaled by the unit', () => {
    const p = pose(0, 0, 0, 0, 0, 4);
    // The pixel covers (0..4, 0..4).
    expect(maskOverlapsCircle(dot, p, 5.5, 2, 1)).toBe(false);
    expect(maskOverlapsCircle(dot, p, 5.5, 2, 2)).toBe(true);
  });

  test('a turned mask is hit where its art is', () => {
    const bar = createMaskShape(['#####']);
    const p = pose(0, 0, 2.5, 0.5, Math.PI / 2);
    expect(maskOverlapsCircle(bar, p, 0, -2 * UNIT, 0.4)).toBe(true);
    expect(maskOverlapsCircle(bar, p, 2 * UNIT, 0, 0.4)).toBe(false);
  });

  test('an eighth-turned pixel is exact where a box test would be generous', () => {
    // A 1 px diamond about the origin, its tips at distance sqrt(2)/2 on the axes.
    const p = pose(0, 0, 0.5, 0.5, Math.PI / 4, 1);
    // Beside the diamond's upper-right edge: the edge is 0.5 from the origin.
    const d = 0.5 + 0.2;
    const cx = d * Math.SQRT1_2;
    const cy = -d * Math.SQRT1_2;
    expect(maskOverlapsCircle(dot, p, cx, cy, 0.15)).toBe(false);
    expect(maskOverlapsCircle(dot, p, cx, cy, 0.25)).toBe(true);
  });
});

describe('maskOverlapsMask', () => {
  const block = createMaskShape(['##', '##']);
  const at = (x: number, y: number, turn = 0, unit = 1): MaskPose => pose(x, y, 0, 0, turn, unit);

  test('unturned: overlapping solid pixels hit; apart they miss', () => {
    expect(maskOverlapsMask(block, at(0, 0), block, at(1, 1))).toBe(true);
    expect(maskOverlapsMask(block, at(0, 0), block, at(1.999, 0))).toBe(true);
    expect(maskOverlapsMask(block, at(0, 0), block, at(5, 0))).toBe(false);
  });

  test('touching is not overlapping', () => {
    expect(maskOverlapsMask(block, at(0, 0), block, at(2, 0))).toBe(false);
    expect(maskOverlapsMask(block, at(0, 0), block, at(0, -2))).toBe(false);
    expect(maskOverlapsMask(block, at(0, 0), block, at(2, 2))).toBe(false);
  });

  test('overlapping bounds with no solid pixel in common miss', () => {
    const upper = createMaskShape(['##', '..']);
    const lower = createMaskShape(['..', '##']);
    expect(maskOverlapsMask(upper, at(0, 0), lower, at(0, 0))).toBe(false);
    expect(maskOverlapsMask(upper, at(0, 0), lower, at(0, -0.5))).toBe(true);
  });

  test('a mask passes through the gap between hull and wing', () => {
    // A 1 px wide, 3 px tall shot: 2 units wide in a 6 unit gap.
    const shot = createMaskShape(['#', '#', '#']);
    for (let r = -5; r <= 12; r++) {
      const s = pose(colX(W, 4.5), rowY(W, r), 0.5, 1.5);
      expect(maskOverlapsMask(shot, s, WINGED, W)).toBe(false);
      expect(maskOverlapsMask(WINGED, W, shot, s)).toBe(false);
    }
    // Moved over the wing it hits.
    const onWing = pose(colX(W, 6.5), rowY(W, 3), 0.5, 1.5);
    expect(maskOverlapsMask(shot, onWing, WINGED, W)).toBe(true);
    expect(maskOverlapsMask(WINGED, W, shot, onWing)).toBe(true);
  });

  test('a turned mask is hit where its art is', () => {
    // Upright after a quarter turn: it occupies x -1..1, y -5..5 (unit 2).
    const bar = createMaskShape(['#####']);
    const upright = pose(0, 0, 2.5, 0.5, Math.PI / 2);
    const probe = createMaskShape(['#']);
    const probeAt = (x: number, y: number): MaskPose => pose(x, y, 0.5, 0.5, 0, 1);
    expect(maskOverlapsMask(bar, upright, probe, probeAt(0, -4))).toBe(true);
    expect(maskOverlapsMask(probe, probeAt(0, -4), bar, upright)).toBe(true);
    expect(maskOverlapsMask(bar, upright, probe, probeAt(4, 0))).toBe(false);
    expect(maskOverlapsMask(probe, probeAt(4, 0), bar, upright)).toBe(false);
  });

  test('turned pixels are tested as turned squares, not by their bounding boxes', () => {
    // A 1 px diamond about the origin: its edge is 0.5 from the origin along the
    // diagonal, while its bounding box reaches 0.707 on both axes.
    const dot = createMaskShape(['#']);
    const diamond = pose(0, 0, 0.5, 0.5, Math.PI / 4, 1);
    const probe = createMaskShape(['#']);
    // A 0.1 square centred on the diagonal, inside the bounding box's corner.
    const near = pose(0.6, -0.6, 0.5, 0.5, 0, 0.1);
    expect(maskOverlapsMask(dot, diamond, probe, near)).toBe(false);
    expect(maskOverlapsMask(probe, near, dot, diamond)).toBe(false);
    const inside = pose(0.3, -0.3, 0.5, 0.5, 0, 0.1);
    expect(maskOverlapsMask(dot, diamond, probe, inside)).toBe(true);
    expect(maskOverlapsMask(probe, inside, dot, diamond)).toBe(true);
  });

  test('both turned by the same angle behave as unturned in their own frame', () => {
    const turn = 0.6;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    // B sits `d` along the shared turned x axis from A.
    const along = (d: number): MaskPose => at(d * c, d * s, turn);
    expect(maskOverlapsMask(block, at(0, 0, turn), block, along(1.9))).toBe(true);
    expect(maskOverlapsMask(block, at(0, 0, turn), block, along(2.1))).toBe(false);
  });

  test('differing units: each mask is scaled by its own', () => {
    // A: one px of 8 units, covering (0..8, 0..8). B: 2x2 px of 1 unit.
    const big = createMaskShape(['#']);
    const bigPose = at(0, 0, 0, 8);
    expect(maskOverlapsMask(big, bigPose, block, at(7, 3))).toBe(true);
    expect(maskOverlapsMask(block, at(7, 3), big, bigPose)).toBe(true);
    expect(maskOverlapsMask(big, bigPose, block, at(8, 3))).toBe(false);
    expect(maskOverlapsMask(block, at(8, 3), big, bigPose)).toBe(false);
    expect(maskOverlapsMask(big, bigPose, block, at(3, 3))).toBe(true);
    expect(maskOverlapsMask(block, at(3, 3), big, bigPose)).toBe(true);
  });

  test('a fine mask inside a hole of a coarse one misses', () => {
    const ring = createMaskShape(['###', '#.#', '###']);
    const ringPose = at(0, 0, 0, 10);
    // The hole is (10..20, 10..20); a 4x4 unit block inside it.
    const fine = createMaskShape(['##', '##']);
    expect(maskOverlapsMask(ring, ringPose, fine, at(13, 13, 0, 2))).toBe(false);
    expect(maskOverlapsMask(fine, at(13, 13, 0, 2), ring, ringPose)).toBe(false);
    expect(maskOverlapsMask(ring, ringPose, fine, at(17, 13, 0, 2))).toBe(true);
    expect(maskOverlapsMask(fine, at(17, 13, 0, 2), ring, ringPose)).toBe(true);
  });

  test('offset bounds and multi-word rows', () => {
    const wide = createMaskShape([`${'.'.repeat(40)}#`], 100, 50);
    const widePose = at(0, 0);
    // The one solid px is at frame (140, 50).
    const probe = createMaskShape(['#']);
    expect(maskOverlapsMask(wide, widePose, probe, at(140.5, 50.5))).toBe(true);
    expect(maskOverlapsMask(probe, at(140.5, 50.5), wide, widePose)).toBe(true);
    expect(maskOverlapsMask(wide, widePose, probe, at(120.5, 50.5))).toBe(false);
    expect(maskOverlapsMask(probe, at(120.5, 50.5), wide, widePose)).toBe(false);
  });

  test('agrees with a brute-force polygon test over random poses', () => {
    const a = createMaskShape(['#..#', '.##.', '#..#']);
    const b = createMaskShape(['.#.', '###', '.#.', '.#.'], 1, 2);
    let seed = 12345;
    const rnd = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    let hits = 0;
    for (let i = 0; i < 400; i++) {
      const pa = pose(rnd() * 6 - 3, rnd() * 6 - 3, 2, 1.5, rnd() * 7, 0.5 + rnd() * 2);
      const pb = pose(rnd() * 6 - 3, rnd() * 6 - 3, 2.5, 4, rnd() * 7, 0.5 + rnd() * 2);
      const want = bruteMaskVsMask(a, pa, b, pb);
      if (want) hits++;
      expect(maskOverlapsMask(a, pa, b, pb)).toBe(want);
      expect(maskOverlapsMask(b, pb, a, pa)).toBe(want);
    }
    // The sample exercises both outcomes.
    expect(hits).toBeGreaterThan(40);
    expect(hits).toBeLessThan(360);
  });
});

describe('maskStripStop', () => {
  const t = createMaskShape(['#####', '..#..', '..#..', '..#..']);
  const p = pose(50, 50, 2.5, 1.5);

  test('a beam from the right stops at the far edge of the nearest pixel', () => {
    const row0 = rowY(p, 0.5);
    expect(maskStripStop(t, p, 0, row0 - 0.5, 100, row0 + 0.5, -1, 0)).toBeCloseTo(colX(p, 5), 9);
  });

  test('a downward beam stops at the top of the first pixel', () => {
    const stem = colX(p, 2.5);
    expect(maskStripStop(t, p, stem - 1, 0, stem + 1, 80, 0, 1)).toBeCloseTo(rowY(p, 0), 9);
  });

  test('only pixels inside the rect count', () => {
    const stem = colX(p, 2.5);
    // A rect below the bar sees the stem only.
    const y0 = rowY(p, 2);
    expect(maskStripStop(t, p, stem - 1, y0, stem + 1, 80, 0, 1)).toBeCloseTo(y0, 9);
    // A rect whose edge only touches the stem sees nothing.
    expect(Number.isNaN(maskStripStop(t, p, colX(p, 3), y0, colX(p, 4), 80, 0, 1))).toBe(true);
  });
});

describe('rayVsMask', () => {
  const t = createMaskShape(['#####', '..#..', '..#..', '..#..']);
  const p = pose(50, 50, 2.5, 1.5);

  test('a hit beyond len reads -1', () => {
    const stem = colX(p, 2.5);
    const dist = 80 - rowY(p, 4);
    expect(rayVsMask(t, p, stem, 80, 0, -1, dist - 0.5)).toBe(-1);
    expect(rayVsMask(t, p, stem, 80, 0, -1, dist + 0.5)).toBeCloseTo(dist, 9);
  });

  test('a diagonal ray walks the grid to the first solid pixel', () => {
    // From below-left of the stem, up and right at 45 degrees, into the stem's
    // left side at row 2.
    const ox = colX(p, 0.5);
    const oy = rowY(p, 4);
    const d = Math.SQRT1_2;
    const hit = rayVsMask(t, p, ox, oy, d, -d, 100);
    // The stem's left edge is 1.5 px = 3 units to the right.
    expect(hit).toBeCloseTo(3 * Math.SQRT2, 9);
  });

  test('a ray through the notch beside the stem reaches the bar', () => {
    const x = colX(p, 0.5);
    expect(rayVsMask(t, p, x, 80, 0, -1, 100)).toBeCloseTo(80 - rowY(p, 1), 9);
  });
});

type Pt = { x: number; y: number };

function cellCorners(p: MaskPose, c: number, r: number): Pt[] {
  const corners: Pt[] = [];
  for (const [dc, dr] of [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ] as const) {
    const lx = c + dc - p.px;
    const ly = r + dr - p.py;
    corners.push({
      x: p.x + (lx * p.cos - ly * p.sin) * p.unit,
      y: p.y + (lx * p.sin + ly * p.cos) * p.unit,
    });
  }
  return corners;
}

/** Separating-axis test of two convex quads, strict (touching is apart). */
function quadsOverlap(a: Pt[], b: Pt[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < 4; i++) {
      const p0 = poly[i]!;
      const p1 = poly[(i + 1) % 4]!;
      const nx = p1.y - p0.y;
      const ny = p0.x - p1.x;
      let aMin = Number.POSITIVE_INFINITY;
      let aMax = Number.NEGATIVE_INFINITY;
      let bMin = Number.POSITIVE_INFINITY;
      let bMax = Number.NEGATIVE_INFINITY;
      for (const q of a) {
        const d = q.x * nx + q.y * ny;
        aMin = Math.min(aMin, d);
        aMax = Math.max(aMax, d);
      }
      for (const q of b) {
        const d = q.x * nx + q.y * ny;
        bMin = Math.min(bMin, d);
        bMax = Math.max(bMax, d);
      }
      if (aMax <= bMin || bMax <= aMin) return false;
    }
  }
  return true;
}

function bruteMaskVsMask(a: MaskShape, pa: MaskPose, b: MaskShape, pb: MaskPose): boolean {
  for (let ra = a.y; ra < a.y + a.h; ra++) {
    for (let ca = a.x; ca < a.x + a.w; ca++) {
      if (!isMaskSolidAt(a, ca, ra)) continue;
      const qa = cellCorners(pa, ca, ra);
      for (let rb = b.y; rb < b.y + b.h; rb++) {
        for (let cb = b.x; cb < b.x + b.w; cb++) {
          if (isMaskSolidAt(b, cb, rb) && quadsOverlap(qa, cellCorners(pb, cb, rb))) return true;
        }
      }
    }
  }
  return false;
}
