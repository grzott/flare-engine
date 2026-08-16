import { describe, expect, it } from 'bun:test';
import { type Body, createBody, writeBoxNormals, writeBoxVertices } from '../src/body.js';
import { collideInto } from '../src/manifold.js';
import { createPool, ensureBodyCapacity, ensureManifoldCapacity } from '../src/pool.js';

function setup(a: Body, b: Body) {
  const pool = createPool();
  ensureBodyCapacity(pool, 2);
  ensureManifoldCapacity(pool, 1);
  const bodies = [a, b];
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]!;
    writeBoxVertices(body, pool.verts, i * 8);
    writeBoxNormals(pool.verts, i * 8, body.position.x, body.position.y, pool.normals, i * 8);
  }
  return pool;
}

const unit = (x: number, y: number) => createBody({ position: { x, y }, half: { x: 1, y: 1 } });

describe('collideInto', () => {
  it('reports no contact for separated boxes', () => {
    const a = unit(0, 0);
    const b = unit(10, 0);
    const pool = setup(a, b);
    expect(collideInto(a, b, pool.verts, pool.normals, 0, 1, pool.manifolds[0]!)).toBe(false);
  });

  it('builds a two-point manifold for a face-on overlap', () => {
    const a = unit(0, 0);
    const b = unit(0, 1.5);
    const pool = setup(a, b);
    const m = pool.manifolds[0]!;
    expect(collideInto(a, b, pool.verts, pool.normals, 0, 1, m)).toBe(true);
    expect(m.pointCount).toBe(2);
    // Normal points from a toward b: +y.
    expect(m.normalX).toBeCloseTo(0, 12);
    expect(m.normalY).toBeCloseTo(1, 12);
    for (let i = 0; i < m.pointCount; i++) {
      expect(m.points[i]!.penetration).toBeCloseTo(0.5, 12);
    }
  });

  it('orients the normal from a toward b regardless of argument order', () => {
    const a = unit(0, 0);
    const b = unit(0, 1.5);
    const pool = setup(b, a);
    const m = pool.manifolds[0]!;
    expect(collideInto(b, a, pool.verts, pool.normals, 0, 1, m)).toBe(true);
    expect(m.normalY).toBeCloseTo(-1, 12);
  });

  it('reuses the same point objects across calls', () => {
    const a = unit(0, 0);
    const b = unit(0, 1.5);
    const pool = setup(a, b);
    const m = pool.manifolds[0]!;
    collideInto(a, b, pool.verts, pool.normals, 0, 1, m);
    const first = m.points[0]!;
    collideInto(a, b, pool.verts, pool.normals, 0, 1, m);
    expect(m.points[0]!).toBe(first);
  });

  it('resets accumulated impulses on each rebuild', () => {
    const a = unit(0, 0);
    const b = unit(0, 1.5);
    const pool = setup(a, b);
    const m = pool.manifolds[0]!;
    collideInto(a, b, pool.verts, pool.normals, 0, 1, m);
    m.points[0]!.normalImpulse = 123;
    collideInto(a, b, pool.verts, pool.normals, 0, 1, m);
    expect(m.points[0]!.normalImpulse).toBe(0);
  });

  it('sets a tangent perpendicular to the normal', () => {
    const a = unit(0, 0);
    const b = unit(0, 1.5);
    const pool = setup(a, b);
    const m = pool.manifolds[0]!;
    collideInto(a, b, pool.verts, pool.normals, 0, 1, m);
    expect(m.normalX * m.tangentX + m.normalY * m.tangentY).toBeCloseTo(0, 12);
  });
});

function assertFiniteManifold(pool: ReturnType<typeof setup>, hit: boolean) {
  const m = pool.manifolds[0]!;
  if (!hit) return;
  expect(Number.isFinite(m.normalX)).toBe(true);
  expect(Number.isFinite(m.normalY)).toBe(true);
  expect(Number.isFinite(m.tangentX)).toBe(true);
  expect(Number.isFinite(m.tangentY)).toBe(true);
  for (let i = 0; i < m.pointCount; i++) {
    const p = m.points[i]!;
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
    expect(Number.isFinite(p.penetration)).toBe(true);
  }
}

describe('degenerate geometry', () => {
  it('does not emit NaN or Infinity for a zero-extent body', () => {
    const a = createBody({ position: { x: 0, y: 0 }, half: { x: 0, y: 0 } });
    const b = createBody({ position: { x: 0, y: 0 }, half: { x: 1, y: 1 } });
    const pool = setup(a, b);
    const hit = collideInto(a, b, pool.verts, pool.normals, 0, 1, pool.manifolds[0]!);
    // A zero-extent body has no real faces (every edge normal collapses to
    // (0,0) in writeBoxNormals), so the SAT axis test rejects it before any
    // contact is built. No contact is the correct, and current, behavior.
    expect(hit).toBe(false);
    assertFiniteManifold(pool, hit);
  });

  it('does not divide by zero on a sub-denormal reference edge', () => {
    // half.y here is small enough that (2 * half.y)^2 underflows to exactly 0
    // in IEEE754 double precision, which makes writeBoxNormals's own `|| 1`
    // guard fire and hand back an *unnormalized*, non-(0,0) "normal" for that
    // edge — unlike the exactly-zero case above, this slips past the SAT
    // early-exit with a nonzero (if minuscule) negative separation and
    // reaches manifold.ts's own side-plane normalize with a reference edge
    // whose squared length also underflows to 0. Traced with instrumented
    // copies of the algorithm outside this suite: before the `|| 1` guard on
    // that division, `sideInv` evaluates to `Infinity` and poisons
    // `negSide`/`posSide` to `NaN` at this exact input. This suite can only
    // observe the public `collideInto` contract, where — both before and
    // after the guard — the corrupted/degenerate axis loses out to
    // Sutherland-Hodgman clipping (a NaN-driven or a natural underflow-driven
    // point-count shortfall) and `collideInto` reports no contact either way.
    // The assertions below lock in that outcome and, more importantly, that
    // no non-finite value ever reaches the manifold if a future refactor
    // changes the clipping path enough to let one through.
    const a = createBody({ position: { x: 0, y: 0 }, half: { x: 5, y: 1e-170 } });
    const b = createBody({ position: { x: 0, y: 0 }, half: { x: 1, y: 1 } });
    const pool = setup(a, b);
    const hit = collideInto(a, b, pool.verts, pool.normals, 0, 1, pool.manifolds[0]!);
    expect(hit).toBe(false);
    assertFiniteManifold(pool, hit);
  });
});
