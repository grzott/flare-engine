import { describe, expect, it } from 'bun:test';
import { Vec2, vec2 } from '../src/index.js';

describe('vec2 factory', () => {
  it('creates with defaults', () => {
    const v = vec2();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });
  it('creates with values', () => {
    const v = vec2(3, 4);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
  });
});

describe('Vec2.zero/one/up/down/left/right', () => {
  it('zero', () => expect(Vec2.zero()).toEqual({ x: 0, y: 0 }));
  it('one', () => expect(Vec2.one()).toEqual({ x: 1, y: 1 }));
  it('up', () => expect(Vec2.up()).toEqual({ x: 0, y: -1 }));
  it('down', () => expect(Vec2.down()).toEqual({ x: 0, y: 1 }));
  it('left', () => expect(Vec2.left()).toEqual({ x: -1, y: 0 }));
  it('right', () => expect(Vec2.right()).toEqual({ x: 1, y: 0 }));
});

describe('Vec2.add', () => {
  it('adds two vectors', () => {
    expect(Vec2.add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
  });
  it('writes into out param', () => {
    const out = vec2();
    const result = Vec2.add({ x: 1, y: 2 }, { x: 3, y: 4 }, out);
    expect(result).toBe(out);
    expect(out).toEqual({ x: 4, y: 6 });
  });
});

describe('Vec2.sub', () => {
  it('subtracts', () => {
    expect(Vec2.sub({ x: 5, y: 7 }, { x: 2, y: 3 })).toEqual({ x: 3, y: 4 });
  });
  it('writes into out param', () => {
    const out = vec2();
    Vec2.sub({ x: 5, y: 7 }, { x: 2, y: 3 }, out);
    expect(out).toEqual({ x: 3, y: 4 });
  });
});

describe('Vec2.scale', () => {
  it('scales vector', () => {
    expect(Vec2.scale({ x: 2, y: 3 }, 3)).toEqual({ x: 6, y: 9 });
  });
  it('scale by 0', () => {
    expect(Vec2.scale({ x: 5, y: 5 }, 0)).toEqual({ x: 0, y: 0 });
  });
  it('writes into out param', () => {
    const out = vec2();
    Vec2.scale({ x: 2, y: 3 }, 2, out);
    expect(out).toEqual({ x: 4, y: 6 });
  });
});

describe('Vec2.normalize', () => {
  it('normalizes non-zero vector', () => {
    const n = Vec2.normalize({ x: 3, y: 4 });
    expect(Math.abs(Vec2.length(n) - 1)).toBeLessThan(1e-6);
  });
  it('returns zero for zero vector', () => {
    expect(Vec2.normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
  it('writes into out param', () => {
    const out = vec2();
    Vec2.normalize({ x: 0, y: 5 }, out);
    expect(out).toEqual({ x: 0, y: 1 });
  });
});

describe('Vec2.dot', () => {
  it('perpendicular = 0', () => {
    expect(Vec2.dot({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
  });
  it('parallel = product of lengths', () => {
    expect(Vec2.dot({ x: 3, y: 0 }, { x: 5, y: 0 })).toBe(15);
  });
  it('antiparallel = negative', () => {
    expect(Vec2.dot({ x: 1, y: 0 }, { x: -1, y: 0 })).toBe(-1);
  });
});

describe('Vec2.cross', () => {
  it('parallel = 0', () => {
    expect(Vec2.cross({ x: 1, y: 0 }, { x: 2, y: 0 })).toBe(0);
  });
  it('perpendicular = area', () => {
    expect(Vec2.cross({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1);
  });
});

describe('Vec2.lerp', () => {
  it('t=0 returns a', () => {
    expect(Vec2.lerp({ x: 0, y: 0 }, { x: 10, y: 10 }, 0)).toEqual({
      x: 0,
      y: 0,
    });
  });
  it('t=1 returns b', () => {
    expect(Vec2.lerp({ x: 0, y: 0 }, { x: 10, y: 10 }, 1)).toEqual({
      x: 10,
      y: 10,
    });
  });
  it('t=0.5 returns midpoint', () => {
    expect(Vec2.lerp({ x: 0, y: 0 }, { x: 10, y: 10 }, 0.5)).toEqual({
      x: 5,
      y: 5,
    });
  });
});

describe('Vec2.slerp', () => {
  it('t=0 returns a', () => {
    const a = { x: 1, y: 0 };
    const b = { x: 0, y: 1 };
    const r = Vec2.slerp(a, b, 0);
    expect(Vec2.equals(r, a)).toBe(true);
  });
  it('t=1 returns b', () => {
    const a = { x: 1, y: 0 };
    const b = { x: 0, y: 1 };
    const r = Vec2.slerp(a, b, 1);
    expect(Vec2.equals(r, b)).toBe(true);
  });
  it('midpoint has unit length for unit inputs', () => {
    const r = Vec2.slerp({ x: 1, y: 0 }, { x: 0, y: 1 }, 0.5);
    expect(Math.abs(Vec2.length(r) - 1)).toBeLessThan(1e-6);
  });
  it('collinear vectors fall back to lerp', () => {
    const a = { x: 1, y: 0 };
    const b = { x: 1, y: 0 };
    const r = Vec2.slerp(a, b, 0.5);
    expect(Vec2.equals(r, a)).toBe(true);
  });
});

describe('Vec2.distance / distanceSq', () => {
  it('distance between (0,0) and (3,4)', () => {
    expect(Vec2.distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
  it('distanceSq', () => {
    expect(Vec2.distanceSq({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
  });
  it('distance to self is 0', () => {
    expect(Vec2.distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe('Vec2.length / lengthSq', () => {
  it('length of (3,4) is 5', () => {
    expect(Vec2.length({ x: 3, y: 4 })).toBe(5);
  });
  it('lengthSq of (3,4) is 25', () => {
    expect(Vec2.lengthSq({ x: 3, y: 4 })).toBe(25);
  });
  it('zero vector has 0 length', () => {
    expect(Vec2.length({ x: 0, y: 0 })).toBe(0);
  });
});

describe('Vec2.angle', () => {
  it('right is 0', () => {
    expect(Vec2.angle({ x: 1, y: 0 })).toBe(0);
  });
  it('up is -PI/2', () => {
    expect(Vec2.angle({ x: 0, y: -1 })).toBeCloseTo(-Math.PI / 2);
  });
  it('left is PI', () => {
    expect(Vec2.angle({ x: -1, y: 0 })).toBeCloseTo(Math.PI);
  });
});

describe('Vec2.rotate', () => {
  it('rotate right by PI/2 gives up (screen coords)', () => {
    const r = Vec2.rotate({ x: 1, y: 0 }, -Math.PI / 2);
    expect(Vec2.equals(r, { x: 0, y: -1 })).toBe(true);
  });
  it('rotate by 0 is identity', () => {
    const v = { x: 3, y: 4 };
    expect(Vec2.equals(Vec2.rotate(v, 0), v)).toBe(true);
  });
  it('rotate by 2PI is identity', () => {
    const v = { x: 3, y: 4 };
    expect(Vec2.equals(Vec2.rotate(v, Math.PI * 2), v)).toBe(true);
  });
});

describe('Vec2.equals', () => {
  it('same vectors equal', () => {
    expect(Vec2.equals({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
  });
  it('different vectors not equal', () => {
    expect(Vec2.equals({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
  });
  it('within epsilon', () => {
    expect(Vec2.equals({ x: 1, y: 2 }, { x: 1 + 1e-7, y: 2 - 1e-7 })).toBe(true);
  });
});

describe('Vec2.clone', () => {
  it('creates independent copy', () => {
    const a = { x: 1, y: 2 };
    const b = Vec2.clone(a);
    expect(b).toEqual(a);
    b.x = 99;
    expect(a.x).toBe(1);
  });
});

describe('Vec2.clampLength', () => {
  it('shortens long vector', () => {
    const r = Vec2.clampLength({ x: 6, y: 8 }, 5);
    expect(Math.abs(Vec2.length(r) - 5)).toBeLessThan(1e-6);
  });
  it('does not change short vector', () => {
    const r = Vec2.clampLength({ x: 1, y: 0 }, 5);
    expect(r).toEqual({ x: 1, y: 0 });
  });
  it('writes into out param', () => {
    const out = vec2();
    Vec2.clampLength({ x: 6, y: 8 }, 5, out);
    expect(Math.abs(Vec2.length(out) - 5)).toBeLessThan(1e-6);
  });
});

describe('Vec2.normalizeOut', () => {
  it('axis-aligned vector scaled to speed', () => {
    const out = vec2();
    const result = Vec2.normalizeOut(0, 3, 5, out);
    expect(result).toBe(out);
    expect(out.x).toBe(0);
    expect(out.y).toBe(5);
  });
  it('diagonal vector preserves direction with magnitude == speed', () => {
    const out = vec2();
    Vec2.normalizeOut(3, 4, 10, out);
    expect(out.x).toBeCloseTo(6);
    expect(out.y).toBeCloseTo(8);
  });
  it('zero vector writes zeros and does not produce NaN', () => {
    const out = vec2();
    Vec2.normalizeOut(0, 0, 5, out);
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
    expect(Number.isNaN(out.x)).toBe(false);
    expect(Number.isNaN(out.y)).toBe(false);
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.y)).toBe(true);
  });
});
