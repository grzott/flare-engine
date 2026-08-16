/** OBB-OBB collision: separating-axis test + reference/incident face clipping,
 *  building a 1-2 point contact manifold with per-point penetration depth.
 *
 *  Ported from a prototype implementation onto flat `Float64Array` body geometry
 *  and a pooled `Manifold`/`ManifoldPoint` — no per-call allocation.
 *  The algorithm is the standard 2D clipping manifold (reference face → incident
 *  face → Sutherland-Hodgman side-plane clip), stable for stacked / tumbling boxes. */

import { Vec2 } from '@flare-engine/math';
import type { Body } from './body.js';
import type { Manifold } from './pool.js';

// Module-level scratch — collideInto is called every step (broad-phase pairs
// × narrow-phase), so nothing here may allocate.
const faceScratch = new Int32Array(1);
const clipScratch = new Float64Array(4);
const normalScratch: Vec2 = { x: 0, y: 0 };
const tangentScratch: Vec2 = { x: 0, y: 0 };

/** Index (0-3) of the vertex of the box at `offset` with greatest support
 *  along direction `(dx, dy)`. */
function supportIndex(verts: Float64Array, offset: number, dx: number, dy: number): number {
  let bestDot = Number.NEGATIVE_INFINITY;
  let best = 0;
  for (let i = 0; i < 4; i++) {
    const x = verts[offset + i * 2]!;
    const y = verts[offset + i * 2 + 1]!;
    const d = x * dx + y * dy;
    if (d > bestDot) {
      bestDot = d;
      best = i;
    }
  }
  return best;
}

/** Max separation of the box at `otherOffset` from the faces of the box at
 *  `selfOffset`. Positive → a gap exists on some axis (no overlap); negative
 *  → the least-penetrating axis. Writes the winning face index into
 *  `faceScratch[0]`. */
function leastPenetration(
  verts: Float64Array,
  normals: Float64Array,
  selfOffset: number,
  otherOffset: number,
): number {
  let best = Number.NEGATIVE_INFINITY;
  let bestFace = 0;
  for (let i = 0; i < 4; i++) {
    const nx = normals[selfOffset + i * 2]!;
    const ny = normals[selfOffset + i * 2 + 1]!;
    const vx = verts[selfOffset + i * 2]!;
    const vy = verts[selfOffset + i * 2 + 1]!;
    const si = supportIndex(verts, otherOffset, -nx, -ny);
    const sx = verts[otherOffset + si * 2]!;
    const sy = verts[otherOffset + si * 2 + 1]!;
    const sep = nx * (sx - vx) + ny * (sy - vy);
    if (sep > best) {
      best = sep;
      bestFace = i;
    }
  }
  faceScratch[0] = bestFace;
  return best;
}

/** Bias toward keeping the current reference face for solver coherence. */
function biasGreaterThan(a: number, b: number): boolean {
  return a >= b * 0.95 + a * 0.01;
}

/** Index (0-3) of the incident box's face whose normal is most anti-parallel
 *  to the reference normal. */
function incidentFaceIndex(
  refNx: number,
  refNy: number,
  incNormals: Float64Array,
  incOffset: number,
): number {
  let minDot = Number.POSITIVE_INFINITY;
  let index = 0;
  for (let i = 0; i < 4; i++) {
    const nx = incNormals[incOffset + i * 2]!;
    const ny = incNormals[incOffset + i * 2 + 1]!;
    const d = refNx * nx + refNy * ny;
    if (d < minDot) {
      minDot = d;
      index = i;
    }
  }
  return index;
}

/** Clips segment `(ax,ay)-(bx,by)` to the halfspace `dot(n, p) <= c`. Writes
 *  0-2 surviving points into `clipScratch` and returns the count. */
function clip(
  nx: number,
  ny: number,
  c: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  let count = 0;
  const d1 = nx * ax + ny * ay - c;
  const d2 = nx * bx + ny * by - c;
  if (d1 <= 0) {
    clipScratch[count * 2] = ax;
    clipScratch[count * 2 + 1] = ay;
    count++;
  }
  if (d2 <= 0) {
    clipScratch[count * 2] = bx;
    clipScratch[count * 2 + 1] = by;
    count++;
  }
  if (d1 * d2 < 0) {
    const t = d1 / (d1 - d2);
    clipScratch[count * 2] = ax + (bx - ax) * t;
    clipScratch[count * 2 + 1] = ay + (by - ay) * t;
    count++;
  }
  return count;
}

/** Builds a contact manifold for boxes `a` (index `ai`) and `b` (index `bi`)
 *  into `out`, reading pre-written geometry from `verts`/`normals` (8 doubles
 *  per body). Returns `false` — leaving `out` untouched — when the boxes do
 *  not overlap. */
export function collideInto(
  a: Body,
  b: Body,
  verts: Float64Array,
  normals: Float64Array,
  ai: number,
  bi: number,
  out: Manifold,
): boolean {
  const aOff = ai * 8;
  const bOff = bi * 8;

  const sepA = leastPenetration(verts, normals, aOff, bOff);
  if (sepA >= 0) return false;
  const faceA = faceScratch[0]!;

  const sepB = leastPenetration(verts, normals, bOff, aOff);
  if (sepB >= 0) return false;
  const faceB = faceScratch[0]!;

  const refIsA = biasGreaterThan(sepA, sepB);
  const refOffset = refIsA ? aOff : bOff;
  const incOffset = refIsA ? bOff : aOff;
  const refIndex = refIsA ? faceA : faceB;

  const refNx = normals[refOffset + refIndex * 2]!;
  const refNy = normals[refOffset + refIndex * 2 + 1]!;
  const refJ = (refIndex + 1) % 4;
  const v1x = verts[refOffset + refIndex * 2]!;
  const v1y = verts[refOffset + refIndex * 2 + 1]!;
  const v2x = verts[refOffset + refJ * 2]!;
  const v2y = verts[refOffset + refJ * 2 + 1]!;

  const incIndex = incidentFaceIndex(refNx, refNy, normals, incOffset);
  const incJ = (incIndex + 1) % 4;
  const iax = verts[incOffset + incIndex * 2]!;
  const iay = verts[incOffset + incIndex * 2 + 1]!;
  const ibx = verts[incOffset + incJ * 2]!;
  const iby = verts[incOffset + incJ * 2 + 1]!;

  // Tangent along the reference face; its two end-planes form the clip slab.
  // `|| 1` guards a degenerate (zero- or near-zero-extent) reference edge the
  // same way `writeBoxNormals` already does for the identical computation —
  // without it, a squared-length underflow makes this a division by zero.
  let sideX = v2x - v1x;
  let sideY = v2y - v1y;
  const sideInv = 1 / (Math.sqrt(sideX * sideX + sideY * sideY) || 1);
  sideX *= sideInv;
  sideY *= sideInv;
  const negSide = -(sideX * v1x + sideY * v1y);
  const posSide = sideX * v2x + sideY * v2y;

  let count = clip(-sideX, -sideY, negSide, iax, iay, ibx, iby);
  if (count < 2) return false;
  const c0x = clipScratch[0]!;
  const c0y = clipScratch[1]!;
  const c1x = clipScratch[2]!;
  const c1y = clipScratch[3]!;

  count = clip(sideX, sideY, posSide, c0x, c0y, c1x, c1y);
  if (count < 2) return false;
  const p0x = clipScratch[0]!;
  const p0y = clipScratch[1]!;
  const p1x = clipScratch[2]!;
  const p1y = clipScratch[3]!;

  const refC = refNx * v1x + refNy * v1y;

  let written = 0;
  const sep0 = refNx * p0x + refNy * p0y - refC;
  if (sep0 <= 0) {
    const point = out.points[written]!;
    point.x = p0x;
    point.y = p0y;
    point.penetration = -sep0;
    point.normalImpulse = 0;
    point.tangentImpulse = 0;
    written++;
  }
  const sep1 = refNx * p1x + refNy * p1y - refC;
  if (sep1 <= 0) {
    const point = out.points[written]!;
    point.x = p1x;
    point.y = p1y;
    point.penetration = -sep1;
    point.normalImpulse = 0;
    point.tangentImpulse = 0;
    written++;
  }
  if (written === 0) return false;

  // Manifold normal must point a → b; refNormal points off the reference
  // box, which is b when we flipped, so negate in that case.
  const normalX = refIsA ? refNx : -refNx;
  const normalY = refIsA ? refNy : -refNy;

  out.a = a;
  out.b = b;
  out.normalX = normalX;
  out.normalY = normalY;
  normalScratch.x = normalX;
  normalScratch.y = normalY;
  Vec2.perp(normalScratch, tangentScratch);
  out.tangentX = tangentScratch.x;
  out.tangentY = tangentScratch.y;
  out.friction = Math.sqrt(a.friction * b.friction);
  out.pointCount = written;
  return true;
}
