/** Per-world scratch: contact manifolds, the flat vertex/normal/AABB buffers
 *  `world.ts` writes body geometry into each step, and the per-slot sleep
 *  state. Growth doubles capacity and rebuilds arrays from scratch — geometry
 *  is fully rewritten every step, so it is not copied forward; the sleep
 *  arrays are, since a sleeper must survive a body being added. */

import type { Body } from './body.js';

export interface SleepOptions {
  /** Linear speed below which a body counts as resting (same units as `velocity`, px/s). */
  linearThreshold: number;
  /** Angular speed below which a body counts as resting (rad/s). */
  angularThreshold: number;
  /** Consecutive under-threshold steps before a body is put to sleep (integer >= 1). */
  steps: number;
}

export interface ManifoldPoint {
  x: number;
  y: number;
  penetration: number;
  normalImpulse: number;
  tangentImpulse: number;
  raX: number;
  raY: number;
  rbX: number;
  rbY: number;
  massNormal: number;
  massTangent: number;
  bias: number;
}

export interface Manifold {
  a: Body;
  b: Body;
  /** Slot indices of `a` / `b` in `world.bodies`, for the sleep arrays. */
  ai: number;
  bi: number;
  /** Effective inverse mass / inertia the solver uses: 0 for a sleeping
   *  body (it acts as infinite mass), the body's own values otherwise. */
  aInvMass: number;
  aInvInertia: number;
  bInvMass: number;
  bInvInertia: number;
  normalX: number;
  normalY: number;
  tangentX: number;
  tangentY: number;
  friction: number;
  pointCount: number;
  points: ManifoldPoint[];
}

export interface SolverPool {
  manifolds: Manifold[];
  manifoldCount: number;
  verts: Float64Array;
  normals: Float64Array;
  aabbs: Float64Array;
  capacityBodies: number;
  /** `null` when sleeping is off; then `asleep` stays all-zero and the hot
   *  loops that read it unconditionally take their sleep-off path. */
  sleep: SleepOptions | null;
  /** Consecutive under-threshold steps per slot. */
  sleepCounter: Int32Array;
  /** 1 when the slot's body is asleep. */
  asleep: Uint8Array;
  /** position.x, position.y, angle per slot, taken when it fell asleep. */
  sleepSnapshot: Float64Array;
  /** The body each slot's sleep state belongs to; a mismatch resets the slot. */
  sleepOwner: (Body | undefined)[];
}

function createManifoldPoint(): ManifoldPoint {
  return {
    x: 0,
    y: 0,
    penetration: 0,
    normalImpulse: 0,
    tangentImpulse: 0,
    raX: 0,
    raY: 0,
    rbX: 0,
    rbY: 0,
    massNormal: 0,
    massTangent: 0,
    bias: 0,
  };
}

function createManifold(): Manifold {
  return {
    a: undefined as unknown as Body,
    b: undefined as unknown as Body,
    ai: 0,
    bi: 0,
    aInvMass: 0,
    aInvInertia: 0,
    bInvMass: 0,
    bInvInertia: 0,
    normalX: 0,
    normalY: 0,
    tangentX: 0,
    tangentY: 0,
    friction: 0,
    pointCount: 0,
    points: [createManifoldPoint(), createManifoldPoint()],
  };
}

export function createPool(sleep: SleepOptions | null = null): SolverPool {
  return {
    manifolds: [],
    manifoldCount: 0,
    verts: new Float64Array(0),
    normals: new Float64Array(0),
    aabbs: new Float64Array(0),
    capacityBodies: 0,
    sleep,
    sleepCounter: new Int32Array(0),
    asleep: new Uint8Array(0),
    sleepSnapshot: new Float64Array(0),
    sleepOwner: [],
  };
}

/** Grows the per-body buffers to hold at least `count` bodies (8 doubles per
 *  body for verts/normals, 4 for the AABB, 3 for the sleep snapshot). No-op
 *  if already large enough. */
export function ensureBodyCapacity(pool: SolverPool, count: number): void {
  if (count <= pool.capacityBodies) return;
  let cap = pool.capacityBodies === 0 ? 8 : pool.capacityBodies;
  while (cap < count) cap *= 2;
  pool.verts = new Float64Array(cap * 8);
  pool.normals = new Float64Array(cap * 8);
  pool.aabbs = new Float64Array(cap * 4);
  const sleepCounter = new Int32Array(cap);
  sleepCounter.set(pool.sleepCounter);
  pool.sleepCounter = sleepCounter;
  const asleep = new Uint8Array(cap);
  asleep.set(pool.asleep);
  pool.asleep = asleep;
  const sleepSnapshot = new Float64Array(cap * 3);
  sleepSnapshot.set(pool.sleepSnapshot);
  pool.sleepSnapshot = sleepSnapshot;
  while (pool.sleepOwner.length < cap) pool.sleepOwner.push(undefined);
  pool.capacityBodies = cap;
}

/** Grows `pool.manifolds` to hold at least `count` entries, appending
 *  fully-formed `Manifold` objects (each with two pre-created points).
 *  Never truncates — manifolds past `manifoldCount` simply go unused, which
 *  is what keeps the steady state allocation-free. */
export function ensureManifoldCapacity(pool: SolverPool, count: number): void {
  while (pool.manifolds.length < count) {
    pool.manifolds.push(createManifold());
  }
}
