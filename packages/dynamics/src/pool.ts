/** Per-world scratch: contact manifolds and the flat vertex/normal/AABB
 *  buffers `world.ts` writes body geometry into each step. Growth doubles
 *  capacity and rebuilds arrays from scratch — pool contents are fully
 *  rewritten every step, so nothing needs to be copied forward. */

import type { Body } from './body.js';

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
    normalX: 0,
    normalY: 0,
    tangentX: 0,
    tangentY: 0,
    friction: 0,
    pointCount: 0,
    points: [createManifoldPoint(), createManifoldPoint()],
  };
}

export function createPool(): SolverPool {
  return {
    manifolds: [],
    manifoldCount: 0,
    verts: new Float64Array(0),
    normals: new Float64Array(0),
    aabbs: new Float64Array(0),
    capacityBodies: 0,
  };
}

/** Grows the per-body geometry buffers to hold at least `count` bodies (8
 *  doubles per body for verts/normals, 4 for the AABB). No-op if already
 *  large enough. */
export function ensureBodyCapacity(pool: SolverPool, count: number): void {
  if (count <= pool.capacityBodies) return;
  let cap = pool.capacityBodies === 0 ? 8 : pool.capacityBodies;
  while (cap < count) cap *= 2;
  pool.verts = new Float64Array(cap * 8);
  pool.normals = new Float64Array(cap * 8);
  pool.aabbs = new Float64Array(cap * 4);
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
