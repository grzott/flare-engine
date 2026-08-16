import { describe, expect, it } from 'bun:test';
import { createBody, isStatic, writeAabb, writeBoxNormals, writeBoxVertices } from '../src/body.js';

describe('createBody', () => {
  it('derives mass and inertia from extents and density', () => {
    const b = createBody({ position: { x: 0, y: 0 }, half: { x: 2, y: 1 }, density: 1 });
    // mass = density * w * h = 1 * 4 * 2 = 8; inertia = m*(w^2+h^2)/12 = 8*20/12
    expect(b.invMass).toBeCloseTo(1 / 8, 12);
    expect(b.invInertia).toBeCloseTo(1 / ((8 * 20) / 12), 12);
  });

  it('marks static bodies with zero inverse mass and inertia', () => {
    const b = createBody({ position: { x: 0, y: 0 }, half: { x: 5, y: 5 }, static: true });
    expect(b.invMass).toBe(0);
    expect(b.invInertia).toBe(0);
    expect(isStatic(b)).toBe(true);
  });

  it('copies input vectors instead of aliasing them', () => {
    const position = { x: 3, y: 4 };
    const velocity = { x: 1, y: 2 };
    const b = createBody({ position, half: { x: 1, y: 1 }, velocity });
    position.x = 99;
    velocity.x = 99;
    expect(b.position.x).toBe(3);
    expect(b.velocity.x).toBe(1);
  });

  it('exposes position and velocity as writable fields', () => {
    const b = createBody({ position: { x: 0, y: 0 }, half: { x: 1, y: 1 } });
    b.position.y = 42;
    b.velocity.y = -7;
    expect(b.position.y).toBe(42);
    expect(b.velocity.y).toBe(-7);
  });
});

describe('geometry writers', () => {
  it('writes axis-aligned corners for an unrotated box', () => {
    const b = createBody({ position: { x: 10, y: 20 }, half: { x: 2, y: 3 } });
    const verts = new Float64Array(8);
    writeBoxVertices(b, verts, 0);
    expect(Array.from(verts)).toEqual([8, 17, 12, 17, 12, 23, 8, 23]);
  });

  it('writes unit-length normals pointing away from the center', () => {
    const b = createBody({ position: { x: 0, y: 0 }, half: { x: 1, y: 1 } });
    const verts = new Float64Array(8);
    const normals = new Float64Array(8);
    writeBoxVertices(b, verts, 0);
    writeBoxNormals(verts, 0, 0, 0, normals, 0);
    for (let i = 0; i < 4; i++) {
      const nx = normals[i * 2]!;
      const ny = normals[i * 2 + 1]!;
      expect(Math.sqrt(nx * nx + ny * ny)).toBeCloseTo(1, 12);
      const j = (i + 1) % 4;
      const mx = (verts[i * 2]! + verts[j * 2]!) / 2;
      const my = (verts[i * 2 + 1]! + verts[j * 2 + 1]!) / 2;
      expect(nx * mx + ny * my).toBeGreaterThan(0);
    }
  });

  it('writes bounds that contain a rotated box', () => {
    const b = createBody({ position: { x: 0, y: 0 }, half: { x: 1, y: 1 }, angle: Math.PI / 4 });
    const verts = new Float64Array(8);
    const aabb = new Float64Array(4);
    writeBoxVertices(b, verts, 0);
    writeAabb(verts, 0, aabb, 0);
    const r = Math.SQRT2;
    expect(aabb[0]).toBeCloseTo(-r, 12);
    expect(aabb[1]).toBeCloseTo(-r, 12);
    expect(aabb[2]).toBeCloseTo(r, 12);
    expect(aabb[3]).toBeCloseTo(r, 12);
  });

  it('writes at an offset without touching earlier slots', () => {
    const b = createBody({ position: { x: 100, y: 200 }, half: { x: 1, y: 1 } });
    const verts = new Float64Array(16);
    verts.fill(-7, 0, 8);
    writeBoxVertices(b, verts, 8);
    expect(Array.from(verts.subarray(0, 8))).toEqual(new Array(8).fill(-7));
    expect(verts[8]).toBe(99);
    expect(verts[9]).toBe(199);
  });
});
