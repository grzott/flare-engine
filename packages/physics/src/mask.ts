import type { Rect } from '@flare-engine/math';

/**
 * A pixel mask: the bounds of its solid region inside a sprite frame, in frame
 * px from the frame's top-left corner, and its rows as 32-bit words —
 * `Math.ceil(w / 32)` per row, top row first. Bit `c & 31` of word `c >>> 5`
 * holds column `c` of the bounds; a set bit is solid. `x` / `y` are the offset
 * that lets a mask sit anywhere relative to its pose's pivot.
 *
 * It is not a member of the `Shape` union and `CollisionWorld` does not take
 * one: keep a box collider for the broadphase and refine its pairs with the
 * `mask…` functions.
 */
export interface MaskShape {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly words: ArrayLike<number>;
}

/**
 * Where a mask is in the world: the entity's position (`x`, `y`), the cosine
 * and sine of its turn (radians, clockwise with y down, as a sprite is turned
 * about its anchor), the pivot (`px`, `py`) in frame px — the point of the
 * frame that sits on the position — and `unit`, world units per px (above 0).
 */
export interface MaskPose {
  x: number;
  y: number;
  cos: number;
  sin: number;
  px: number;
  py: number;
  unit: number;
}

/** An unturned pose at the origin: pivot at the frame's corner, 1 unit per px. */
export function createMaskPose(): MaskPose {
  return { x: 0, y: 0, cos: 1, sin: 0, px: 0, py: 0, unit: 1 };
}

/**
 * Build a mask from rows of text, top row first: `#` is solid, any other
 * character clear. The bounds are the whole drawing — as wide as the longest
 * row — placed at (`x`, `y`) in the frame. Allocates; call at load.
 */
export function createMaskShape(rows: readonly string[], x = 0, y = 0): MaskShape {
  let w = 0;
  for (const row of rows) w = Math.max(w, row.length);
  const stride = (w + 31) >>> 5;
  const words = new Uint32Array(rows.length * stride);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '#') words[r * stride + (c >>> 5)]! |= 1 << (c & 31);
    }
  }
  return { x, y, w, h: rows.length, words };
}

function has(m: MaskShape, col: number, row: number): boolean {
  const cx = col - m.x;
  const cy = row - m.y;
  if (cx < 0 || cy < 0 || cx >= m.w || cy >= m.h) return false;
  const word = m.words[cy * ((m.w + 31) >>> 5) + (cx >>> 5)] ?? 0;
  return ((word >>> (cx & 31)) & 1) === 1;
}

/**
 * Whether the pixel at frame column `col`, row `row` (integers) is solid;
 * outside the bounds nothing is. With `erode`, solid only when its four
 * neighbours are solid too: the mask eroded by 1 px. Zero-alloc.
 */
export function isMaskSolidAt(m: MaskShape, col: number, row: number, erode = false): boolean {
  if (!has(m, col, row)) return false;
  if (!erode) return true;
  return (
    has(m, col - 1, row) && has(m, col + 1, row) && has(m, col, row - 1) && has(m, col, row + 1)
  );
}

/** The frame px of a world point, by the inverse turn. */
const LOCAL = { x: 0, y: 0 };
function toLocal(p: MaskPose, wx: number, wy: number): void {
  const dx = wx - p.x;
  const dy = wy - p.y;
  LOCAL.x = (dx * p.cos + dy * p.sin) / p.unit + p.px;
  LOCAL.y = (-dx * p.sin + dy * p.cos) / p.unit + p.py;
}

/**
 * The world bounding box of a posed mask's bounds rectangle: for a turned mask,
 * the axis-aligned box around the turned rectangle. It bounds every solid pixel
 * but is not shrunk to them. Zero-alloc — writes `out` and returns it.
 */
export function maskBoundsInto(m: MaskShape, p: MaskPose, out: Rect): Rect {
  const lx = m.x + m.w / 2 - p.px;
  const ly = m.y + m.h / 2 - p.py;
  const ac = Math.abs(p.cos);
  const as = Math.abs(p.sin);
  const hw = ((m.w * ac + m.h * as) / 2) * p.unit;
  const hh = ((m.w * as + m.h * ac) / 2) * p.unit;
  out.x = p.x + (lx * p.cos - ly * p.sin) * p.unit - hw;
  out.y = p.y + (lx * p.sin + ly * p.cos) * p.unit - hh;
  out.width = hw * 2;
  out.height = hh * 2;
  return out;
}

/** Allocating twin of `maskBoundsInto`. */
export function maskBounds(m: MaskShape, p: MaskPose): Rect {
  return maskBoundsInto(m, p, { x: 0, y: 0, width: 0, height: 0 });
}

/**
 * Whether a world box, centre (`cx`, `cy`) and half extents (`hw`, `hh`),
 * overlaps a solid pixel. Touching an edge is not overlapping. `erode` tests
 * the mask eroded by 1 px.
 *
 * The box is axis-aligned in the world, so against a turned mask it is tested
 * by its bounding box in the mask's frame: exact for a turn that is a multiple
 * of a quarter, generous by the box's corners for any other. Zero-alloc.
 */
export function maskOverlapsBox(
  m: MaskShape,
  p: MaskPose,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  erode = false,
): boolean {
  toLocal(p, cx, cy);
  const ac = Math.abs(p.cos);
  const as = Math.abs(p.sin);
  const lhw = (hw * ac + hh * as) / p.unit;
  const lhh = (hw * as + hh * ac) / p.unit;
  const x0 = LOCAL.x - lhw;
  const x1 = LOCAL.x + lhw;
  const y0 = LOCAL.y - lhh;
  const y1 = LOCAL.y + lhh;
  const c0 = Math.max(m.x, Math.floor(x0));
  const c1 = Math.min(m.x + m.w - 1, Math.ceil(x1) - 1);
  const r0 = Math.max(m.y, Math.floor(y0));
  const r1 = Math.min(m.y + m.h - 1, Math.ceil(y1) - 1);
  for (let r = r0; r <= r1; r++) {
    if (!(r < y1 && r + 1 > y0)) continue;
    for (let c = c0; c <= c1; c++) {
      if (c < x1 && c + 1 > x0 && isMaskSolidAt(m, c, r, erode)) return true;
    }
  }
  return false;
}

/** The most samples one sweep takes, so a runaway segment cannot stall a frame. */
const SWEEP_MAX = 256;

/**
 * Whether a box swept from (`x0`, `y0`) to (`x1`, `y1`) overlaps a solid pixel
 * anywhere along the segment, so a fast body cannot skip a 1 px feature. It is
 * `maskOverlapsBox` sampled along the segment, both ends included: samples are
 * at most half a px apart, and at most the box's smaller non-zero half extent.
 * A sweep is capped at 257 samples; a segment too long for that spacing is
 * sampled more coarsely and can miss. Zero-alloc.
 */
export function maskOverlapsSweptBox(
  m: MaskShape,
  p: MaskPose,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  hw: number,
  hh: number,
): boolean {
  const len = Math.hypot(x1 - x0, y1 - y0);
  let step = 0.5 * p.unit;
  if (hw > 0 && hw < step) step = hw;
  if (hh > 0 && hh < step) step = hh;
  const n = Math.min(SWEEP_MAX, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 1 : i / n;
    if (maskOverlapsBox(m, p, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, hw, hh)) return true;
  }
  return false;
}

/**
 * Whether a world circle overlaps a solid pixel. The circle is taken into the
 * mask's frame, where it is still a circle, and tested against each pixel's
 * square, so the result is exact at any turn. Strict, like `shapeOverlap`:
 * touching is not overlapping, and a zero radius hits only strictly inside a
 * pixel. Zero-alloc.
 */
export function maskOverlapsCircle(
  m: MaskShape,
  p: MaskPose,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  toLocal(p, cx, cy);
  const lx = LOCAL.x;
  const ly = LOCAL.y;
  const lr = radius / p.unit;
  const rr = lr * lr;
  const c0 = Math.max(m.x, Math.floor(lx - lr));
  const c1 = Math.min(m.x + m.w - 1, Math.ceil(lx + lr) - 1);
  const r0 = Math.max(m.y, Math.floor(ly - lr));
  const r1 = Math.min(m.y + m.h - 1, Math.ceil(ly + lr) - 1);
  for (let r = r0; r <= r1; r++) {
    const dy = ly < r ? r - ly : ly > r + 1 ? ly - r - 1 : 0;
    for (let c = c0; c <= c1; c++) {
      if (!has(m, c, r)) continue;
      const dx = lx < c ? c - lx : lx > c + 1 ? lx - c - 1 : 0;
      const dd = dx * dx + dy * dy;
      if (dd > 0 ? dd < rr : lr > 0 || (lx > c && lx < c + 1 && ly > r && ly < r + 1)) return true;
    }
  }
  return false;
}

const BOUNDS: Rect = { x: 0, y: 0, width: 0, height: 0 };

/**
 * Whether a solid pixel of `a` overlaps a solid pixel of `b`. Each pose may be
 * turned and scaled independently. Every solid pixel of one mask inside the
 * other's world bounds is taken into the other's frame as a turned square and
 * tested against the solid pixels there by separating axes, so pixels are
 * compared as the squares they are, not by bounding boxes: exact up to
 * floating-point rounding. Touching is not overlapping; for masks at different
 * turns a contact within rounding of touching can read either way.
 *
 * Cost grows with the pixels of both masks inside the overlap of their bounds
 * — this is the narrow phase for a pair a box broadphase already passed.
 * Zero-alloc.
 */
export function maskOverlapsMask(a: MaskShape, pa: MaskPose, b: MaskShape, pb: MaskPose): boolean {
  // Walk the mask with fewer pixels; the result is the same either way.
  return a.w * a.h <= b.w * b.h ? pixelsOverlap(a, pa, b, pb) : pixelsOverlap(b, pb, a, pa);
}

function pixelsOverlap(a: MaskShape, pa: MaskPose, b: MaskShape, pb: MaskPose): boolean {
  // The pixels of `a` that can reach `b`: those under b's world bounds, taken
  // into a's frame as a bounding box.
  maskBoundsInto(b, pb, BOUNDS);
  const bhw = BOUNDS.width / 2;
  const bhh = BOUNDS.height / 2;
  toLocal(pa, BOUNDS.x + bhw, BOUNDS.y + bhh);
  const lhw = (bhw * Math.abs(pa.cos) + bhh * Math.abs(pa.sin)) / pa.unit;
  const lhh = (bhw * Math.abs(pa.sin) + bhh * Math.abs(pa.cos)) / pa.unit;
  const c0 = Math.max(a.x, Math.floor(LOCAL.x - lhw));
  const c1 = Math.min(a.x + a.w - 1, Math.ceil(LOCAL.x + lhw) - 1);
  const r0 = Math.max(a.y, Math.floor(LOCAL.y - lhh));
  const r1 = Math.min(a.y + a.h - 1, Math.ceil(LOCAL.y + lhh) - 1);
  if (c0 > c1 || r0 > r1) return false;

  // a's frame to b's: a turn by the difference of the two turns, scaled by the
  // ratio of the units, about the two pivots.
  const k = pa.unit / pb.unit;
  const cosR = pa.cos * pb.cos + pa.sin * pb.sin;
  const sinR = pa.sin * pb.cos - pa.cos * pb.sin;
  const mc = cosR * k;
  const ms = sinR * k;
  toLocal(pb, pa.x, pa.y);
  const tx = LOCAL.x - (mc * pa.px - ms * pa.py);
  const ty = LOCAL.y - (ms * pa.px + mc * pa.py);
  // An a pixel in b's frame is a square of half side `half` turned by R; a b
  // pixel is an unturned unit square. `ext` is the reach of the turned square
  // on b's axes plus the b pixel's half; `own` the same on the square's axes.
  const half = k / 2;
  const spread = Math.abs(cosR) + Math.abs(sinR);
  const ext = half * spread + 0.5;
  const own = half + 0.5 * spread;
  const bc0 = b.x;
  const bc1 = b.x + b.w - 1;
  const br0 = b.y;
  const br1 = b.y + b.h - 1;

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!has(a, c, r)) continue;
      const bx = tx + mc * (c + 0.5) - ms * (r + 0.5);
      const by = ty + ms * (c + 0.5) + mc * (r + 0.5);
      const q0 = Math.max(bc0, Math.floor(bx - ext));
      const q1 = Math.min(bc1, Math.ceil(bx + ext) - 1);
      const s0 = Math.max(br0, Math.floor(by - ext));
      const s1 = Math.min(br1, Math.ceil(by + ext) - 1);
      for (let s = s0; s <= s1; s++) {
        const dy = s + 0.5 - by;
        if (!(Math.abs(dy) < ext)) continue;
        for (let q = q0; q <= q1; q++) {
          const dx = q + 0.5 - bx;
          if (
            Math.abs(dx) < ext &&
            Math.abs(dx * cosR + dy * sinR) < own &&
            Math.abs(dy * cosR - dx * sinR) < own &&
            has(b, q, s)
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * The distance along a world ray from (`ox`, `oy`), unit direction (`dx`,
 * `dy`), to the first solid pixel it enters, at most `len`; `0` when it starts
 * inside one; `-1` when it meets none. A grid walk over the mask's pixels in
 * its own frame, so the distance is exact at any turn. Zero-alloc.
 *
 * Unlike `rayVsShapeInto` it reports a distance only — no point, no normal —
 * and a ray starting inside a solid pixel reads `0` rather than its exit.
 */
export function rayVsMask(
  m: MaskShape,
  p: MaskPose,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  len: number,
): number {
  toLocal(p, ox, oy);
  const lx = LOCAL.x;
  const ly = LOCAL.y;
  const ldx = dx * p.cos + dy * p.sin;
  const ldy = -dx * p.sin + dy * p.cos;
  // Clip to the mask's bounds: the slab test, in px along the ray.
  let t0 = 0;
  let t1 = len / p.unit;
  if (ldx === 0) {
    if (lx < m.x || lx >= m.x + m.w) return -1;
  } else {
    const ta = (m.x - lx) / ldx;
    const tb = (m.x + m.w - lx) / ldx;
    t0 = Math.max(t0, Math.min(ta, tb));
    t1 = Math.min(t1, Math.max(ta, tb));
  }
  if (ldy === 0) {
    if (ly < m.y || ly >= m.y + m.h) return -1;
  } else {
    const ta = (m.y - ly) / ldy;
    const tb = (m.y + m.h - ly) / ldy;
    t0 = Math.max(t0, Math.min(ta, tb));
    t1 = Math.min(t1, Math.max(ta, tb));
  }
  if (t0 > t1) return -1;
  // Step into the first pixel a hair, so a ray starting on an edge is in the pixel ahead.
  const sx = lx + ldx * t0;
  const sy = ly + ldy * t0;
  let c = Math.min(m.x + m.w - 1, Math.max(m.x, Math.floor(sx + ldx * 1e-9)));
  let r = Math.min(m.y + m.h - 1, Math.max(m.y, Math.floor(sy + ldy * 1e-9)));
  const stepC = ldx > 0 ? 1 : -1;
  const stepR = ldy > 0 ? 1 : -1;
  const dtC = ldx === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / ldx);
  const dtR = ldy === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / ldy);
  let nextC = ldx === 0 ? Number.POSITIVE_INFINITY : t0 + ((ldx > 0 ? c + 1 : c) - sx) / ldx;
  let nextR = ldy === 0 ? Number.POSITIVE_INFINITY : t0 + ((ldy > 0 ? r + 1 : r) - sy) / ldy;
  let t = t0;
  const cells = m.w + m.h + 2;
  for (let i = 0; i < cells && t <= t1; i++) {
    if (has(m, c, r)) return t * p.unit;
    if (nextC < nextR) {
      t = nextC;
      nextC += dtC;
      c += stepC;
    } else {
      t = nextR;
      nextR += dtR;
      r += stepR;
    }
    if (c < m.x || c >= m.x + m.w || r < m.y || r >= m.y + m.h) return -1;
  }
  return -1;
}

/**
 * Where a beam filling the world rect [`x0`, `x1`] × [`y0`, `y1`] and
 * travelling along one axis — (`dirX`, `dirY`) is one of (0, -1), (0, 1),
 * (1, 0) and (-1, 0) — first meets the mask: the near edge of the nearest
 * solid pixel that overlaps the rect, as a world coordinate on the beam's
 * axis. `NaN` when no solid pixel overlaps it. A turned pixel counts by its
 * bounding box. Visits every pixel of the mask. Zero-alloc.
 */
export function maskStripStop(
  m: MaskShape,
  p: MaskPose,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  dirX: number,
  dirY: number,
): number {
  let stop = Number.NaN;
  const u = p.unit;
  // A pixel's bounding box is square at any turn.
  const h = ((Math.abs(p.cos) + Math.abs(p.sin)) * u) / 2;
  const far = dirY < 0 || (dirY === 0 && dirX < 0);
  for (let r = m.y; r < m.y + m.h; r++) {
    for (let c = m.x; c < m.x + m.w; c++) {
      if (!has(m, c, r)) continue;
      const lx = c + 0.5 - p.px;
      const ly = r + 0.5 - p.py;
      const wx = p.x + (lx * p.cos - ly * p.sin) * u;
      const wy = p.y + (lx * p.sin + ly * p.cos) * u;
      if (!(wx - h < x1 && wx + h > x0 && wy - h < y1 && wy + h > y0)) continue;
      const edge = dirY < 0 ? wy + h : dirY > 0 ? wy - h : dirX > 0 ? wx - h : wx + h;
      if (Number.isNaN(stop)) stop = edge;
      else stop = far ? Math.max(stop, edge) : Math.min(stop, edge);
    }
  }
  return stop;
}
