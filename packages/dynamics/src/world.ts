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
import {
  createPool,
  ensureBodyCapacity,
  ensureManifoldCapacity,
  type SleepOptions,
  type SolverPool,
} from './pool.js';

export interface WorldOptions {
  /** Acceleration applied to every dynamic body each step (px/s²). */
  gravity?: Vec2;
  /** Sequential-impulse iterations per step. More = stiffer stacks. */
  iterations?: number;
  /** Opt-in per-body sleeping; off when absent. See `step` and `isSleeping`. */
  sleep?: SleepOptions;
}

export interface World {
  bodies: Body[];
  gravity: Vec2;
  iterations: number;
}

export interface StepUntilOptions {
  /** Time budget in ms, compared against `now()` after every step. */
  budgetMs: number;
  /** Step cap per call (integer >= 1). */
  maxSteps?: number;
  /** Polled after each step; `true` ends the call with `complete: true`. */
  done?: () => boolean;
  /** Clock in ms. Default `performance.now`, else `Date.now`; inject for deterministic tests. */
  now?: () => number;
}

export interface StepUntilResult {
  /** Steps taken by this call, always >= 1. */
  steps: number;
  /** `true` when `done()` ended the call; `false` for `maxSteps` or the budget. */
  complete: boolean;
}

const BAUMGARTE = 0.2;
const PENETRATION_SLOP = 0.5;

const pools = new WeakMap<World, SolverPool>();

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function copySleepOptions(sleep: SleepOptions): SleepOptions {
  const { linearThreshold, angularThreshold, steps } = sleep;
  if (!Number.isFinite(linearThreshold) || linearThreshold < 0) {
    throw new RangeError(
      `createWorld: sleep.linearThreshold must be a finite number >= 0, got ${linearThreshold}`,
    );
  }
  if (!Number.isFinite(angularThreshold) || angularThreshold < 0) {
    throw new RangeError(
      `createWorld: sleep.angularThreshold must be a finite number >= 0, got ${angularThreshold}`,
    );
  }
  if (!Number.isInteger(steps) || steps < 1) {
    throw new RangeError(`createWorld: sleep.steps must be an integer >= 1, got ${steps}`);
  }
  return { linearThreshold, angularThreshold, steps };
}

/** Throws `RangeError` when `opts.sleep` has a negative or non-finite
 *  threshold or a `steps` that is not an integer >= 1. */
export function createWorld(opts: WorldOptions = {}): World {
  const world: World = {
    bodies: [],
    gravity: opts.gravity ? { x: opts.gravity.x, y: opts.gravity.y } : { x: 0, y: 1800 },
    iterations: opts.iterations ?? 10,
  };
  pools.set(world, createPool(opts.sleep ? copySleepOptions(opts.sleep) : null));
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

function applyImpulse(
  body: Body,
  invMass: number,
  invInertia: number,
  ix: number,
  iy: number,
  rx: number,
  ry: number,
): void {
  if (invMass === 0) return;
  body.velocity.x += ix * invMass;
  body.velocity.y += iy * invMass;
  body.angularVelocity += invInertia * (rx * iy - ry * ix);
}

/** Binds every slot to the body now at its index, resetting a slot whose body
 *  changed (awake, counter 0), then wakes any sleeper the consumer wrote to:
 *  a non-zero velocity (sleepers are held at exactly 0) or a position/angle
 *  that differs from the snapshot taken at sleep. */
function syncSleepSlots(pool: SolverPool, bodies: Body[]): void {
  const { sleepOwner, asleep, sleepCounter, sleepSnapshot } = pool;
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]!;
    if (sleepOwner[i] !== body) {
      sleepOwner[i] = body;
      asleep[i] = 0;
      sleepCounter[i] = 0;
      continue;
    }
    if (asleep[i] === 0) continue;
    const s = i * 3;
    if (
      body.velocity.x !== 0 ||
      body.velocity.y !== 0 ||
      body.angularVelocity !== 0 ||
      body.position.x !== sleepSnapshot[s] ||
      body.position.y !== sleepSnapshot[s + 1] ||
      body.angle !== sleepSnapshot[s + 2]
    ) {
      asleep[i] = 0;
      sleepCounter[i] = 0;
    }
  }
}

/** Writes every body's world-space vertices, outward normals, and AABB into
 *  `pool`, once per step, so the broadphase pair loop never recomputes them. */
function writeGeometry(pool: SolverPool, bodies: Body[]): void {
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
 *  writing surviving contacts into `pool.manifolds[0..manifoldCount)`. A pair
 *  whose two bodies are each static or asleep is skipped. */
function collectManifolds(pool: SolverPool, bodies: Body[]): void {
  pool.manifoldCount = 0;
  const { aabbs, asleep } = pool;
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]!;
    const aResting = isStatic(a) || asleep[i] === 1;
    const aOff = i * 4;
    const aMinX = aabbs[aOff]!;
    const aMinY = aabbs[aOff + 1]!;
    const aMaxX = aabbs[aOff + 2]!;
    const aMaxY = aabbs[aOff + 3]!;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]!;
      if (aResting && (isStatic(b) || asleep[j] === 1)) continue;
      const bOff = j * 4;
      const bMinX = aabbs[bOff]!;
      const bMinY = aabbs[bOff + 1]!;
      const bMaxX = aabbs[bOff + 2]!;
      const bMaxY = aabbs[bOff + 3]!;
      if (aMaxX < bMinX || aMinX > bMaxX || aMaxY < bMinY || aMinY > bMaxY) continue;
      ensureManifoldCapacity(pool, pool.manifoldCount + 1);
      const m = pool.manifolds[pool.manifoldCount]!;
      if (collideInto(a, b, pool.verts, pool.normals, i, j, m)) {
        m.ai = i;
        m.bi = j;
        pool.manifoldCount++;
      }
    }
  }
}

/** Wakes a sleeper touched by an awake body that was moving on the previous
 *  step (sleep counter 0), giving it this step's gravity so it continues as
 *  if it had been awake for the integration. A sleeper touched only by a
 *  settling body stays asleep. Pairs of two resting bodies never reach here,
 *  so a manifold with one sleeper always has an awake dynamic partner. */
function wakeByContact(pool: SolverPool, gravity: Vec2, dt: number): void {
  const { asleep, sleepCounter } = pool;
  for (let mi = 0; mi < pool.manifoldCount; mi++) {
    const m = pool.manifolds[mi]!;
    const aAsleep = asleep[m.ai] === 1;
    if (aAsleep === (asleep[m.bi] === 1)) continue;
    const sleeperIdx = aAsleep ? m.ai : m.bi;
    const awakeIdx = aAsleep ? m.bi : m.ai;
    if (sleepCounter[awakeIdx] !== 0) continue;
    asleep[sleeperIdx] = 0;
    sleepCounter[sleeperIdx] = 0;
    const sleeper = aAsleep ? m.a : m.b;
    sleeper.velocity.x += gravity.x * dt;
    sleeper.velocity.y += gravity.y * dt;
  }
}

/** Derives per-point solver mass terms and the velocity/position bias for
 *  every live manifold, writing them onto the manifold's own contact points. */
function prepare(pool: SolverPool, gravity: Vec2, dt: number): void {
  const restThreshold = Math.hypot(gravity.x, gravity.y) * dt;
  const { asleep } = pool;
  for (let mi = 0; mi < pool.manifoldCount; mi++) {
    const m = pool.manifolds[mi]!;
    const { a, b } = m;
    const aAsleep = asleep[m.ai] === 1;
    const bAsleep = asleep[m.bi] === 1;
    const aInvMass = aAsleep ? 0 : a.invMass;
    const aInvInertia = aAsleep ? 0 : a.invInertia;
    const bInvMass = bAsleep ? 0 : b.invMass;
    const bInvInertia = bAsleep ? 0 : b.invInertia;
    m.aInvMass = aInvMass;
    m.aInvInertia = aInvInertia;
    m.bInvMass = bInvMass;
    m.bInvInertia = bInvInertia;
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
      const kNormal = aInvMass + bInvMass + aInvInertia * rnA * rnA + bInvInertia * rnB * rnB;

      const rtA = raX * tangentY - raY * tangentX;
      const rtB = rbX * tangentY - rbY * tangentX;
      const kTangent = aInvMass + bInvMass + aInvInertia * rtA * rtA + bInvInertia * rtB * rtB;

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
    const { a, b, friction, aInvMass, aInvInertia, bInvMass, bInvInertia } = m;
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
      applyImpulse(a, aInvMass, aInvInertia, -pnX, -pnY, raX, raY);
      applyImpulse(b, bInvMass, bInvInertia, pnX, pnY, rbX, rbY);

      // Friction impulse (clamped to the Coulomb cone mu*Pn).
      const vt = relativeVelocityAlong(a, b, raX, raY, rbX, rbY, tangentX, tangentY);
      let dPt = cp.massTangent * -vt;
      const maxPt = friction * cp.normalImpulse;
      const newTangent = Math.max(-maxPt, Math.min(maxPt, cp.tangentImpulse + dPt));
      dPt = newTangent - cp.tangentImpulse;
      cp.tangentImpulse = newTangent;
      const ptX = tangentX * dPt;
      const ptY = tangentY * dPt;
      applyImpulse(a, aInvMass, aInvInertia, -ptX, -ptY, raX, raY);
      applyImpulse(b, bInvMass, bInvInertia, ptX, ptY, rbX, rbY);
    }
  }
}

/** Puts every awake dynamic body that stayed under both thresholds for
 *  `sleep.steps` consecutive steps to sleep: velocities zeroed, flag set,
 *  position/angle snapshotted for the write-wake check. */
function updateSleep(pool: SolverPool, sleep: SleepOptions, bodies: Body[]): void {
  const { asleep, sleepCounter, sleepSnapshot } = pool;
  const linear2 = sleep.linearThreshold * sleep.linearThreshold;
  const angular2 = sleep.angularThreshold * sleep.angularThreshold;
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]!;
    if (isStatic(body) || asleep[i] === 1) continue;
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const w = body.angularVelocity;
    if (vx * vx + vy * vy < linear2 && w * w < angular2) {
      const count = sleepCounter[i]! + 1;
      sleepCounter[i] = count;
      if (count < sleep.steps) continue;
      body.velocity.x = 0;
      body.velocity.y = 0;
      body.angularVelocity = 0;
      asleep[i] = 1;
      const s = i * 3;
      sleepSnapshot[s] = body.position.x;
      sleepSnapshot[s + 1] = body.position.y;
      sleepSnapshot[s + 2] = body.angle;
    } else {
      sleepCounter[i] = 0;
    }
  }
}

/** Advance the world by `dt` seconds (fixed steps recommended).
 *
 *  By default (no `WorldOptions.sleep`) resting contacts settle to a stable
 *  *position* but retain a small, bounded velocity oscillation at the
 *  penetration-slop equilibrium — a sequential-impulse solver with Baumgarte
 *  bias does not converge velocity to exactly zero at rest, only the position
 *  does. `WorldOptions.sleep` opts into per-body sleeping: a dynamic body
 *  under both thresholds for `steps` consecutive steps has its velocities
 *  zeroed and is skipped by integration and by pair tests against other
 *  resting bodies until an awake body touches it, the consumer writes its
 *  velocity, position or angle, or `wakeBody` is called. There are no
 *  islands, so a woken stack wakes one level per step, and a sleeper does not
 *  follow a static body that is moved under it. Damping stays out of scope.
 *
 *  A world that never went through `createWorld` (a spread copy or a
 *  `structuredClone`) is adopted on its first `step` with sleeping off. */
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
  ensureBodyCapacity(pool, bodies.length);
  const { sleep, asleep } = pool;

  // 0. Bind sleep slots to the bodies at their indices; wake written sleepers.
  if (sleep !== null) syncSleepSlots(pool, bodies);

  // 1. Integrate velocities (apply gravity to awake dynamic bodies).
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]!;
    if (isStatic(body) || asleep[i] === 1) continue;
    body.velocity.x += world.gravity.x * dt;
    body.velocity.y += world.gravity.y * dt;
  }

  // 2. Broadphase (precomputed AABB reject) + narrowphase (OBB manifold).
  writeGeometry(pool, bodies);
  collectManifolds(pool, bodies);
  if (sleep !== null) wakeByContact(pool, world.gravity, dt);

  // 3. Solve velocity constraints.
  prepare(pool, world.gravity, dt);
  for (let iter = 0; iter < world.iterations; iter++) {
    solve(pool);
  }

  // 4. Integrate positions.
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]!;
    if (isStatic(body) || asleep[i] === 1) continue;
    body.position.x += body.velocity.x * dt;
    body.position.y += body.velocity.y * dt;
    body.angle += body.angularVelocity * dt;
  }

  // 5. Put settled bodies to sleep.
  if (sleep !== null) updateSleep(pool, sleep, bodies);
}

/** `true` when `body` is asleep in `world`. `false` when the world has
 *  sleeping off or never went through `createWorld`, when `body` is not in
 *  `world.bodies`, or when its slot has not been bound to it by a `step` yet.
 *  O(n) in `world.bodies.length` (an `indexOf`); poll it per body, not per
 *  contact. */
export function isSleeping(world: World, body: Body): boolean {
  const pool = pools.get(world);
  if (!pool || pool.sleep === null) return false;
  const i = world.bodies.indexOf(body);
  if (i < 0 || pool.sleepOwner[i] !== body) return false;
  return pool.asleep[i] === 1;
}

/** `true` when every dynamic body in `world.bodies` is asleep — vacuously
 *  true with no dynamic bodies, `false` with sleeping off and at least one.
 *  The bake stop rule for `stepUntil`: `done: () => isAtRest(world)`. */
export function isAtRest(world: World): boolean {
  const pool = pools.get(world);
  const { bodies } = world;
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]!;
    if (isStatic(body)) continue;
    if (!pool || pool.sleep === null || pool.sleepOwner[i] !== body || pool.asleep[i] !== 1) {
      return false;
    }
  }
  return true;
}

/** Wakes `body` if it is asleep in `world` (flag cleared, counter 0, its
 *  velocities stay 0); the next `step` integrates it again. No-op otherwise,
 *  including with sleeping off or a body not in `world.bodies`. Use it for a
 *  sleeper whose support was removed from `world.bodies` or moved — nothing
 *  else wakes it. */
export function wakeBody(world: World, body: Body): void {
  const pool = pools.get(world);
  if (!pool || pool.sleep === null) return;
  const i = world.bodies.indexOf(body);
  if (i < 0 || pool.sleepOwner[i] !== body || pool.asleep[i] !== 1) return;
  pool.asleep[i] = 0;
  pool.sleepCounter[i] = 0;
}

/** Repeats `step(world, dt)` until, checked in this order after each step,
 *  `done()` returns true (`complete: true`), `steps >= maxSteps`, or
 *  `now() - start >= budgetMs` (both `complete: false`). Always takes at least
 *  one step, so a zero budget still makes progress. Writes `out` and returns it;
 *  the zero-alloc per-frame form of `stepUntil`. Throws `RangeError` for a
 *  non-finite or non-positive `dt`, a negative or non-finite `budgetMs`, or a
 *  `maxSteps` that is not an integer >= 1. */
export function stepUntilInto(
  world: World,
  dt: number,
  opts: StepUntilOptions,
  out: StepUntilResult,
): StepUntilResult {
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new RangeError(`stepUntil: dt must be a finite number > 0, got ${dt}`);
  }
  const { budgetMs, maxSteps, done } = opts;
  if (!Number.isFinite(budgetMs) || budgetMs < 0) {
    throw new RangeError(`stepUntil: budgetMs must be a finite number >= 0, got ${budgetMs}`);
  }
  if (maxSteps !== undefined && (!Number.isInteger(maxSteps) || maxSteps < 1)) {
    throw new RangeError(`stepUntil: maxSteps must be an integer >= 1, got ${maxSteps}`);
  }
  const now = opts.now ?? nowMs;
  const start = now();
  let steps = 0;
  let complete = false;
  for (;;) {
    step(world, dt);
    steps++;
    if (done?.()) {
      complete = true;
      break;
    }
    if (maxSteps !== undefined && steps >= maxSteps) break;
    if (now() - start >= budgetMs) break;
  }
  out.steps = steps;
  out.complete = complete;
  return out;
}

/** Allocating form of `stepUntilInto`; see it for the stop rules. */
export function stepUntil(world: World, dt: number, opts: StepUntilOptions): StepUntilResult {
  return stepUntilInto(world, dt, opts, { steps: 0, complete: false });
}
