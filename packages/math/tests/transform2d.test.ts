import { describe, expect, it } from 'bun:test';
import { approxEquals, Transform2D, Vec2 } from '../src/index.js';

describe('Transform2D.identity', () => {
  it('creates identity', () => {
    const t = Transform2D.identity();
    expect(t.position).toEqual({ x: 0, y: 0 });
    expect(t.rotation).toBe(0);
    expect(t.scale).toEqual({ x: 1, y: 1 });
  });
});

describe('Transform2D.create', () => {
  it('creates with defaults', () => {
    const t = Transform2D.create();
    expect(t.position).toEqual({ x: 0, y: 0 });
    expect(t.rotation).toBe(0);
    expect(t.scale).toEqual({ x: 1, y: 1 });
  });
  it('creates with values', () => {
    const t = Transform2D.create(10, 20, Math.PI, 2, 3);
    expect(t.position).toEqual({ x: 10, y: 20 });
    expect(t.rotation).toBe(Math.PI);
    expect(t.scale).toEqual({ x: 2, y: 3 });
  });
});

describe('Transform2D.localToWorld', () => {
  it('identity does nothing', () => {
    const t = Transform2D.identity();
    const p = Transform2D.localToWorld(t, { x: 5, y: 3 });
    expect(Vec2.equals(p, { x: 5, y: 3 })).toBe(true);
  });
  it('translation only', () => {
    const t = Transform2D.create(10, 20);
    const p = Transform2D.localToWorld(t, { x: 1, y: 2 });
    expect(Vec2.equals(p, { x: 11, y: 22 })).toBe(true);
  });
  it('scale only', () => {
    const t = Transform2D.create(0, 0, 0, 2, 3);
    const p = Transform2D.localToWorld(t, { x: 4, y: 5 });
    expect(Vec2.equals(p, { x: 8, y: 15 })).toBe(true);
  });
  it('rotation only (90 deg)', () => {
    const t = Transform2D.create(0, 0, Math.PI / 2);
    const p = Transform2D.localToWorld(t, { x: 1, y: 0 });
    expect(Vec2.equals(p, { x: 0, y: 1 })).toBe(true);
  });
  it('combined transform', () => {
    const t = Transform2D.create(10, 10, Math.PI / 2, 2, 2);
    const p = Transform2D.localToWorld(t, { x: 1, y: 0 });
    expect(Vec2.equals(p, { x: 10, y: 12 })).toBe(true);
  });
});

describe('Transform2D.worldToLocal', () => {
  it('identity does nothing', () => {
    const t = Transform2D.identity();
    const p = Transform2D.worldToLocal(t, { x: 5, y: 3 });
    expect(Vec2.equals(p, { x: 5, y: 3 })).toBe(true);
  });
  it('inverse of localToWorld', () => {
    const t = Transform2D.create(10, 20, 0.5, 2, 3);
    const local = { x: 3, y: 4 };
    const world = Transform2D.localToWorld(t, local);
    const back = Transform2D.worldToLocal(t, world);
    expect(approxEquals(back.x, local.x)).toBe(true);
    expect(approxEquals(back.y, local.y)).toBe(true);
  });
  it('handles zero scale', () => {
    const t = Transform2D.create(0, 0, 0, 0, 0);
    const p = Transform2D.worldToLocal(t, { x: 5, y: 5 });
    expect(p).toEqual({ x: 0, y: 0 });
  });
});

describe('Transform2D.clone', () => {
  it('creates independent copy', () => {
    const t = Transform2D.create(1, 2, 0.5, 3, 4);
    const c = Transform2D.clone(t);
    expect(c.position).toEqual(t.position);
    expect(c.rotation).toBe(t.rotation);
    expect(c.scale).toEqual(t.scale);
    c.position.x = 99;
    expect(t.position.x).toBe(1);
  });
});
