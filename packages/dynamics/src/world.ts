/** The rigid-body world: gravity integration + a sequential-impulse contact
 *  solver (Box2D-lite structure) with Coulomb friction and Baumgarte
 *  de-penetration, plus a restitution term for bounce.
 *
 *  Modeled as a plain object + free functions (no class) to match the house
 *  style. The pool lives in a module-level `WeakMap` so `World` keeps its
 *  frozen three-field public shape — one lookup per `step`, not per body. */

import type { Vec2 } from '@flare-engine/math';
import type { Body } from './body.js';
import { isStatic, writeAabb, writeBoxNormals, writeBoxVertices } from './body.js';
import { collideInto } from './manifold.js';
import { createPool, ensureBodyCapacity, ensureManifoldCapacity, type SolverPool } from './pool.js';

export interface WorldOptions {
  /** Acceleration applied to every dynamic body each step (px/s²). */
  gravity?: Vec2;
  /** Sequential-impulse iterations per step. More = stiffer stacks. */
  iterations?: number;
}

export interface World {
  bodies: Body[];
  gravity: Vec2;
  iterations: number;
}

const BAUMGARTE = 0.2;
const PENETRATION_SLOP = 0.5;

const pools = new WeakMap<World, SolverPool>();

export function createWorld(opts: WorldOptions = {}): World {
  const world: World = {
    bodies: [],
    gravity: opts.gravity ? { x: opts.gravity.x, y: opts.gravity.y } : { x: 0, y: 1800 },
    iterations: opts.iterations ?? 10,
  };
  pools.set(world, createPool());
  return world;
}

export function addBody(world: World, body: Body): Body {
  world.bodies.push(body);
  return body;
}

/** Relative velocity at a contact projected onto (dx, dy). The vector never
 *  escapes — its only use is a dot product, so it collapses to two scalars. */
function relativeVelocityAlong(
  a: Body,
  b: Body,
  raX: number,
  raY: number,
  rbX: number,
  rbY: number,
  dx: number,
  dy: number,
): number {
  const vax = a.velocity.x - a.angularVelocity * raY;
  const vay = a.velocity.y + a.angularVelocity * raX;
  const vbx = b.velocity.x - b.angularVelocity * rbY;
  const vby = b.velocity.y + b.angularVelocity * rbX;
  return (vbx - vax) * dx + (vby - vay) * dy;
}

function applyImpulse(body: Body, ix: number, iy: number, rx: number, ry: number): void {
  if (body.invMass === 0) return;
  body.velocity.x += ix * body.invMass;
  body.velocity.y += iy * body.invMass;
  body.angularVelocity += body.invInertia * (rx * iy - ry * ix);
}

/** Writes every body's world-space vertices, outward normals, and AABB into
 *  `pool`, once per step, so the broadphase pair loop never recomputes them. */
function writeGeometry(pool: SolverPool, bodies: Body[]): void {
  ensureBodyCapacity(pool, bodies.length);
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!;
    const vOffset = i * 8;
    const aOffset = i * 4;
    writeBoxVertices(b, pool.verts, vOffset);
    writeBoxNormals(pool.verts, vOffset, b.position.x, b.position.y, pool.normals, vOffset);
    writeAabb(pool.verts, vOffset, pool.aabbs, aOffset);
  }
}

/** Broadphase (precomputed-AABB reject) + narrowphase (OBB manifold),
 *  writing surviving contacts into `pool.manifolds[0..manifoldCount)`. */
function collectManifolds(pool: SolverPool, bodies: Body[]): void {
  pool.manifoldCount = 0;
  const aabbs = pool.aabbs;
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]!;
    const aOff = i * 4;
    const aMinX = aabbs[aOff]!;
    const aMinY = aabbs[aOff + 1]!;
    const aMaxX = aabbs[aOff + 2]!;
    const aMaxY = aabbs[aOff + 3]!;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]!;
      if (isStatic(a) && isStatic(b)) continue;
      const bOff = j * 4;
      const bMinX = aabbs[bOff]!;
      const bMinY = aabbs[bOff + 1]!;
      const bMaxX = aabbs[bOff + 2]!;
      const bMaxY = aabbs[bOff + 3]!;
      if (aMaxX < bMinX || aMinX > bMaxX || aMaxY < bMinY || aMinY > bMaxY) continue;
      ensureManifoldCapacity(pool, pool.manifoldCount + 1);
      const m = pool.manifolds[pool.manifoldCount]!;
      if (collideInto(a, b, pool.verts, pool.normals, i, j, m)) pool.manifoldCount++;
    }
  }
}

/** Derives per-point solver mass terms and the velocity/position bias for
 *  every live manifold, writing them onto the manifold's own contact points. */
function prepare(pool: SolverPool, gravity: Vec2, dt: number): void {
  const restThreshold = Math.hypot(gravity.x, gravity.y) * dt;
  for (let mi = 0; mi < pool.manifoldCount; mi++) {
    const m = pool.manifolds[mi]!;
    const { a, b } = m;
    const normalX = m.normalX;
    const normalY = m.normalY;
    const tangentX = m.tangentX;
    const tangentY = m.tangentY;
    const restitution = Math.min(a.restitution, b.restitution);

    for (let pi = 0; pi < m.pointCount; pi++) {
      const cp = m.points[pi]!;
      const raX = cp.x - a.position.x;
      const raY = cp.y - a.position.y;
      const rbX = cp.x - b.position.x;
      const rbY = cp.y - b.position.y;

      const rnA = raX * normalY - raY * normalX;
      const rnB = rbX * normalY - rbY * normalX;
      const kNormal = a.invMass + b.invMass + a.invInertia * rnA * rnA + b.invInertia * rnB * rnB;

      const rtA = raX * tangentY - raY * tangentX;
      const rtB = rbX * tangentY - rbY * tangentX;
      const kTangent = a.invMass + b.invMass + a.invInertia * rtA * rtA + b.invInertia * rtB * rtB;

      const vn = relativeVelocityAlong(a, b, raX, raY, rbX, rbY, normalX, normalY);
      const restitutionBias = vn < -restThreshold ? -restitution * vn : 0;
      const baumgarte = (BAUMGARTE / dt) * Math.max(0, cp.penetration - PENETRATION_SLOP);

      cp.raX = raX;
      cp.raY = raY;
      cp.rbX = rbX;
      cp.rbY = rbY;
      cp.massNormal = kNormal > 0 ? 1 / kNormal : 0;
      cp.massTangent = kTangent > 0 ? 1 / kTangent : 0;
      cp.bias = restitutionBias + baumgarte;
    }
  }
}

/** One sequential-impulse sweep over every live manifold's contact points. */
function solve(pool: SolverPool): void {
  for (let mi = 0; mi < pool.manifoldCount; mi++) {
    const m = pool.manifolds[mi]!;
    const { a, b, friction } = m;
    const normalX = m.normalX;
    const normalY = m.normalY;
    const tangentX = m.tangentX;
    const tangentY = m.tangentY;

    for (let pi = 0; pi < m.pointCount; pi++) {
      const cp = m.points[pi]!;
      const raX = cp.raX;
      const raY = cp.raY;
      const rbX = cp.rbX;
      const rbY = cp.rbY;

      // Normal impulse (clamped >= 0 so contacts push, never pull).
      const vn = relativeVelocityAlong(a, b, raX, raY, rbX, rbY, normalX, normalY);
      let dPn = cp.massNormal * (-vn + cp.bias);
      const newNormal = Math.max(cp.normalImpulse + dPn, 0);
      dPn = newNormal - cp.normalImpulse;
      cp.normalImpulse = newNormal;
      const pnX = normalX * dPn;
      const pnY = normalY * dPn;
      applyImpulse(a, -pnX, -pnY, raX, raY);
      applyImpulse(b, pnX, pnY, rbX, rbY);

      // Friction impulse (clamped to the Coulomb cone mu*Pn).
      const vt = relativeVelocityAlong(a, b, raX, raY, rbX, rbY, tangentX, tangentY);
      let dPt = cp.massTangent * -vt;
      const maxPt = friction * cp.normalImpulse;
      const newTangent = Math.max(-maxPt, Math.min(maxPt, cp.tangentImpulse + dPt));
      dPt = newTangent - cp.tangentImpulse;
      cp.tangentImpulse = newTangent;
      const ptX = tangentX * dPt;
      const ptY = tangentY * dPt;
      applyImpulse(a, -ptX, -ptY, raX, raY);
      applyImpulse(b, ptX, ptY, rbX, rbY);
    }
  }
}

/** Advance the world by `dt` seconds (fixed steps recommended).
 *
 *  Resting contacts settle to a stable *position* but retain a small, bounded
 *  velocity oscillation at the penetration-slop equilibrium — a sequential-
 *  impulse solver with Baumgarte bias and no sleeping does not converge
 *  velocity to exactly zero at rest, only the position does. This is
 *  inherent to the algorithm, not a bug; sleeping and damping are
 *  deliberately out of scope for v1. A consumer needing pixel-exact
 *  stillness should clamp small resting velocities at its own layer. */
export function step(world: World, dt: number): void {
  if (dt <= 0) return;
  // `World` is a public interface with plain fields, so a consumer can hand
  // back a structurally valid value that never went through `createWorld`
  // (spread copy, `structuredClone`, state round-tripping) and is therefore
  // absent from `pools`. Lazily adopt it instead of crashing on a missing
  // entry; steady-state callers (worlds from `createWorld`) never pay this
  // branch since their pool is already registered.
  let pool = pools.get(world);
  if (!pool) {
    pool = createPool();
    pools.set(world, pool);
  }
  const { bodies } = world;

  // 1. Integrate velocities (apply gravity to dynamic bodies).
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]!;
    if (isStatic(body)) continue;
    body.velocity.x += world.gravity.x * dt;
    body.velocity.y += world.gravity.y * dt;
  }

  // 2. Broadphase (precomputed AABB reject) + narrowphase (OBB manifold).
  writeGeometry(pool, bodies);
  collectManifolds(pool, bodies);

  // 3. Solve velocity constraints.
  prepare(pool, world.gravity, dt);
  for (let iter = 0; iter < world.iterations; iter++) {
    solve(pool);
  }

  // 4. Integrate positions.
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]!;
    if (isStatic(body)) continue;
    body.position.x += body.velocity.x * dt;
    body.position.y += body.velocity.y * dt;
    body.angle += body.angularVelocity * dt;
  }
}
