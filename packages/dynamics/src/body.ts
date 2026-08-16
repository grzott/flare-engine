/** A rigid body: an oriented box (OBB) with linear + angular state.
 *
 *  Boxes only. Mass properties are derived from the box extents; a body with
 *  `invMass === 0` is static (floor / walls). */

import type { Vec2 } from '@flare-engine/math';

export interface Body {
  /** Center of mass, world space. */
  position: Vec2;
  /** Linear velocity. */
  velocity: Vec2;
  /** Orientation in radians. */
  angle: number;
  /** Angular velocity in radians/second. */
  angularVelocity: number;
  /** Half-extents (half width, half height) in the body's local frame. */
  half: Vec2;
  /** 1 / mass. `0` marks a static (immovable, infinite-mass) body. */
  invMass: number;
  /** 1 / rotational inertia. `0` locks rotation (all static bodies). */
  invInertia: number;
  /** Bounciness in [0, 1]. */
  restitution: number;
  /** Coulomb friction coefficient (≈0 slippery … ≈1 grippy). */
  friction: number;
}

export interface BodyOptions {
  position: Vec2;
  half: Vec2;
  /** Uniform density; drives both mass and rotational inertia. Ignored when `static`. */
  density?: number;
  velocity?: Vec2;
  angle?: number;
  angularVelocity?: number;
  restitution?: number;
  friction?: number;
  /** Static bodies have infinite mass and never move. */
  static?: boolean;
}

export function createBody(opts: BodyOptions): Body {
  const half = opts.half;
  const density = opts.density ?? 1;

  let invMass = 0;
  let invInertia = 0;
  if (!opts.static) {
    const w = half.x * 2;
    const h = half.y * 2;
    const mass = density * w * h;
    // Solid-rectangle inertia about its center: m·(w² + h²) / 12.
    const inertia = (mass * (w * w + h * h)) / 12;
    invMass = mass > 0 ? 1 / mass : 0;
    invInertia = inertia > 0 ? 1 / inertia : 0;
  }

  return {
    position: { x: opts.position.x, y: opts.position.y },
    velocity: opts.velocity ? { x: opts.velocity.x, y: opts.velocity.y } : { x: 0, y: 0 },
    angle: opts.angle ?? 0,
    angularVelocity: opts.angularVelocity ?? 0,
    half: { x: half.x, y: half.y },
    invMass,
    invInertia,
    restitution: opts.restitution ?? 0.2,
    friction: opts.friction ?? 0.4,
  };
}

export function isStatic(b: Body): boolean {
  return b.invMass === 0;
}

/** The four world-space corners of `b`, written as x,y pairs at `offset`. */
export function writeBoxVertices(b: Body, out: Float64Array, offset: number): void {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  const hx = b.half.x;
  const hy = b.half.y;
  const px = b.position.x;
  const py = b.position.y;
  let o = offset;
  for (let i = 0; i < 4; i++) {
    const lx = i === 0 || i === 3 ? -hx : hx;
    const ly = i === 0 || i === 1 ? -hy : hy;
    out[o] = px + (lx * c - ly * s);
    out[o + 1] = py + (lx * s + ly * c);
    o += 2;
  }
}

/** Outward face normals, one per edge `i → i+1`, guaranteed to point away
 *  from `(cx, cy)` regardless of winding or the frame's y-direction. Reads
 *  four already-written corners from `verts` at `vOffset`. */
export function writeBoxNormals(
  verts: Float64Array,
  vOffset: number,
  cx: number,
  cy: number,
  out: Float64Array,
  offset: number,
): void {
  let o = offset;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const ax = verts[vOffset + i * 2]!;
    const ay = verts[vOffset + i * 2 + 1]!;
    const bx = verts[vOffset + j * 2]!;
    const by = verts[vOffset + j * 2 + 1]!;
    const ex = bx - ax;
    const ey = by - ay;
    const l = Math.sqrt(ex * ex + ey * ey) || 1;
    let nx = ey / l;
    let ny = -ex / l;
    const midX = (ax + bx) / 2 - cx;
    const midY = (ay + by) / 2 - cy;
    if (nx * midX + ny * midY < 0) {
      nx = -nx;
      ny = -ny;
    }
    out[o] = nx;
    out[o + 1] = ny;
    o += 2;
  }
}

/** World-space axis-aligned bounds of four already-written corners, written
 *  as `minX, minY, maxX, maxY` at `offset`. Does not recompute vertices. */
export function writeAabb(
  verts: Float64Array,
  vOffset: number,
  out: Float64Array,
  offset: number,
): void {
  const x0 = verts[vOffset]!;
  const y0 = verts[vOffset + 1]!;
  let minX = x0;
  let minY = y0;
  let maxX = x0;
  let maxY = y0;
  for (let i = 1; i < 4; i++) {
    const x = verts[vOffset + i * 2]!;
    const y = verts[vOffset + i * 2 + 1]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  out[offset] = minX;
  out[offset + 1] = minY;
  out[offset + 2] = maxX;
  out[offset + 3] = maxY;
}
