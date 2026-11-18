import { catmullRomInto } from '@flare-engine/math';
import type { PathSpec } from '../presets';
import { parseSvgPath } from './svg';

/**
 * A path compiled for constant-speed travel. `segs` holds `segCount` cubics of 8 numbers each
 * (p0, c1, c2, p3). `lut` holds the cumulative length at every sample: `segCount * samplesPerSeg
 * + 1` entries, the first 0 and the last `total`, with entry `s * samplesPerSeg + k` at parameter
 * `k / samplesPerSeg` of segment `s`.
 */
export interface ArcTable {
  segs: Float32Array;
  segCount: number;
  samplesPerSeg: number;
  lut: Float32Array;
  total: number;
}

/** A point on a path and `angleDeg`, the rotation that aligns +x with the tangent there. */
export interface PathPose {
  x: number;
  y: number;
  angleDeg: number;
}

const _third = { x: 0, y: 0 };
const _twoThirds = { x: 0, y: 0 };

/** Points joined by a Catmull-Rom spline, as one cubic per gap. */
function pointsToCubics(points: readonly number[], curviness: number): number[] {
  if (points.length < 4 || points.length % 2 !== 0) {
    throw new RangeError(
      `buildArcTable: points needs at least two x, y pairs, got ${points.length} numbers`,
    );
  }
  if (!Number.isFinite(curviness) || curviness < 0) {
    throw new RangeError(`buildArcTable: curviness must be a finite number >= 0, got ${curviness}`);
  }
  const count = points.length / 2;
  const out: number[] = [];
  for (let i = 0; i < count - 1; i++) {
    // The end points stand in for the neighbours the first and last gap do not have.
    const before = Math.max(i - 1, 0) * 2;
    const after = Math.min(i + 2, count - 1) * 2;
    const ax = points[before]!;
    const ay = points[before + 1]!;
    const p1x = points[i * 2]!;
    const p1y = points[i * 2 + 1]!;
    const p2x = points[i * 2 + 2]!;
    const p2y = points[i * 2 + 3]!;
    const bx = points[after]!;
    const by = points[after + 1]!;
    catmullRomInto(ax, ay, p1x, p1y, p2x, p2y, bx, by, 1 / 3, _third);
    catmullRomInto(ax, ay, p1x, p1y, p2x, p2y, bx, by, 2 / 3, _twoThirds);
    // A cubic is fixed by its ends and its values at 1/3 and 2/3; solving the Bernstein form for
    // the handles gives the Bezier that traces the same spline segment.
    const c1x = (18 * _third.x - 9 * _twoThirds.x - 5 * p1x + 2 * p2x) / 6;
    const c1y = (18 * _third.y - 9 * _twoThirds.y - 5 * p1y + 2 * p2y) / 6;
    const c2x = (18 * _twoThirds.x - 9 * _third.x - 5 * p2x + 2 * p1x) / 6;
    const c2y = (18 * _twoThirds.y - 9 * _third.y - 5 * p2y + 2 * p1y) / 6;
    out.push(
      p1x,
      p1y,
      p1x + (c1x - p1x) * curviness,
      p1y + (c1y - p1y) * curviness,
      p2x + (c2x - p2x) * curviness,
      p2y + (c2y - p2y) * curviness,
      p2x,
      p2y,
    );
  }
  return out;
}

/**
 * Compile a path into its cubics and a cumulative-length table of `samplesPerSeg` chords per
 * cubic. `points` are joined by a uniform Catmull-Rom spline; `curviness` (default 1) scales its
 * handles, so 0 gives straight lines between the points and values above 1 a looser curve.
 *
 * Throws a `RangeError` for a path with no segments, a `cubic` list that is not groups of 8, a
 * `points` list that is not at least two pairs, a coordinate or curviness that is not finite, a
 * negative curviness, SVG data `parseSvgPath` rejects, or a `samplesPerSeg` that is not an
 * integer of at least 1.
 */
export function buildArcTable(p: PathSpec, samplesPerSeg = 32): ArcTable {
  if (!Number.isInteger(samplesPerSeg) || samplesPerSeg < 1) {
    throw new RangeError(
      `buildArcTable: samplesPerSeg must be an integer >= 1, got ${samplesPerSeg}`,
    );
  }
  let cubics: readonly number[];
  if ('cubic' in p) cubics = p.cubic;
  else if ('points' in p) cubics = pointsToCubics(p.points, p.curviness ?? 1);
  else cubics = parseSvgPath(p.svg);

  if (cubics.length === 0 || cubics.length % 8 !== 0) {
    throw new RangeError(
      `buildArcTable: a path needs at least one cubic of 8 numbers, got ${cubics.length} numbers`,
    );
  }
  for (let i = 0; i < cubics.length; i++) {
    if (!Number.isFinite(cubics[i]!)) {
      throw new RangeError(
        `buildArcTable: path coordinates must be finite, got ${cubics[i]} at index ${i}`,
      );
    }
  }

  const segs = Float32Array.from(cubics);
  const segCount = segs.length / 8;
  const lut = new Float32Array(segCount * samplesPerSeg + 1);
  let length = 0;
  for (let s = 0; s < segCount; s++) {
    const o = s * 8;
    const p0x = segs[o]!;
    const p0y = segs[o + 1]!;
    const c1x = segs[o + 2]!;
    const c1y = segs[o + 3]!;
    const c2x = segs[o + 4]!;
    const c2y = segs[o + 5]!;
    const p3x = segs[o + 6]!;
    const p3y = segs[o + 7]!;
    let prevX = p0x;
    let prevY = p0y;
    for (let k = 1; k <= samplesPerSeg; k++) {
      const t = k / samplesPerSeg;
      const v = 1 - t;
      const a = v * v * v;
      const b = 3 * v * v * t;
      const c = 3 * v * t * t;
      const d = t * t * t;
      const x = a * p0x + b * c1x + c * c2x + d * p3x;
      const y = a * p0y + b * c1y + c * c2y + d * p3y;
      length += Math.hypot(x - prevX, y - prevY);
      lut[s * samplesPerSeg + k] = length;
      prevX = x;
      prevY = y;
    }
  }
  // Read back so `total` is the Float32 value the lookup compares distances against.
  return { segs, segCount, samplesPerSeg, lut, total: lut[lut.length - 1]! };
}

/**
 * The pose `distance` along the path, writing into `out`. A distance below 0 or above
 * `tbl.total` continues in a straight line along the tangent at that end, keeping its angle.
 * `angleDeg` is atan2(dy, dx) in degrees, with screen y pointing down: 0° heads +x, 90° heads
 * down. A path of zero length stays on its point at 0°.
 */
export function pathPoseAtInto(tbl: ArcTable, distance: number, out: PathPose): PathPose {
  'worklet';
  const segs = tbl.segs;
  const lut = tbl.lut;
  const samples = tbl.samplesPerSeg;
  const total = tbl.total;

  let seg = 0;
  let t = 0;
  // Signed distance to travel beyond the end of the path, along its tangent.
  let beyond = 0;
  if (distance <= 0) {
    // Zero-length segments have no tangent to leave along; start from the first real one.
    while (seg < tbl.segCount - 1 && lut[(seg + 1) * samples]! <= 0) seg++;
    beyond = distance;
  } else if (distance >= total) {
    seg = tbl.segCount - 1;
    while (seg > 0 && lut[seg * samples]! >= total) seg--;
    t = 1;
    beyond = distance - total;
  } else {
    // Keeps lut[lo] <= distance < lut[hi], so the span divided by below is never 0.
    let lo = 0;
    let hi = lut.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (lut[mid]! <= distance) lo = mid;
      else hi = mid;
    }
    const from = lut[lo]!;
    seg = Math.floor(lo / samples);
    t = (lo - seg * samples + (distance - from) / (lut[lo + 1]! - from)) / samples;
  }

  const o = seg * 8;
  const p0x = segs[o]!;
  const p0y = segs[o + 1]!;
  const c1x = segs[o + 2]!;
  const c1y = segs[o + 3]!;
  const c2x = segs[o + 4]!;
  const c2y = segs[o + 5]!;
  const p3x = segs[o + 6]!;
  const p3y = segs[o + 7]!;
  const v = 1 - t;
  const x = v * v * v * p0x + 3 * v * v * t * c1x + 3 * v * t * t * c2x + t * t * t * p3x;
  const y = v * v * v * p0y + 3 * v * v * t * c1y + 3 * v * t * t * c2y + t * t * t * p3y;

  let dx = v * v * (c1x - p0x) + 2 * v * t * (c2x - c1x) + t * t * (p3x - c2x);
  let dy = v * v * (c1y - p0y) + 2 * v * t * (c2y - c1y) + t * t * (p3y - c2y);
  if (dx === 0 && dy === 0) {
    // The derivative vanishes where a handle sits on its end point. The direction the curve
    // leaves in is then towards the next distinct control point.
    if (t < 0.5) {
      dx = c2x - p0x;
      dy = c2y - p0y;
    } else {
      dx = p3x - c1x;
      dy = p3y - c1y;
    }
    if (dx === 0 && dy === 0) {
      dx = p3x - p0x;
      dy = p3y - p0y;
    }
  }

  const speed = Math.sqrt(dx * dx + dy * dy);
  if (speed === 0) {
    out.x = x;
    out.y = y;
    out.angleDeg = 0;
    return out;
  }
  out.x = x + (dx / speed) * beyond;
  out.y = y + (dy / speed) * beyond;
  out.angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return out;
}
