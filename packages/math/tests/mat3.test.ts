import { describe, expect, it } from 'bun:test';
import { Mat3, Transform2D, approxEquals } from '../src/index.js';

function expectMat3Close(a: Float32Array, b: Float32Array, eps = 1e-5) {
  expect(a.length).toBe(9);
  expect(b.length).toBe(9);
  for (let i = 0; i < 9; i++) {
    expect(approxEquals(a[i]!, b[i]!, eps)).toBe(true);
  }
}

describe('Mat3.create', () => {
  it('creates identity', () => {
    const m = Mat3.create();
    expect(m[0]).toBe(1);
    expect(m[1]).toBe(0);
    expect(m[2]).toBe(0);
    expect(m[3]).toBe(0);
    expect(m[4]).toBe(1);
    expect(m[5]).toBe(0);
    expect(m[6]).toBe(0);
    expect(m[7]).toBe(0);
    expect(m[8]).toBe(1);
  });
});

describe('Mat3.identity', () => {
  it('resets to identity', () => {
    const m = new Float32Array([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    Mat3.identity(m);
    expectMat3Close(m, Mat3.create());
  });
});

describe('Mat3.multiply', () => {
  it('identity * identity = identity', () => {
    const id = Mat3.create();
    expectMat3Close(Mat3.multiply(id, id), id);
  });
  it('identity * M = M', () => {
    const id = Mat3.create();
    const t = Mat3.translate(5, 10);
    expectMat3Close(Mat3.multiply(id, t), t);
  });
  it('writes into out param', () => {
    const out = new Float32Array(9);
    const id = Mat3.create();
    const result = Mat3.multiply(id, id, out);
    expect(result).toBe(out);
  });
});

describe('Mat3.translate', () => {
  it('creates translation matrix', () => {
    const m = Mat3.translate(5, 10);
    expect(m[6]).toBe(5);
    expect(m[7]).toBe(10);
    expect(m[0]).toBe(1);
    expect(m[4]).toBe(1);
  });
});

describe('Mat3.rotate', () => {
  it('creates rotation matrix', () => {
    const m = Mat3.rotate(Math.PI / 2);
    expect(approxEquals(m[0]!, 0)).toBe(true);
    expect(approxEquals(m[1]!, 1)).toBe(true);
    expect(approxEquals(m[3]!, -1)).toBe(true);
    expect(approxEquals(m[4]!, 0)).toBe(true);
  });
  it('zero rotation is identity', () => {
    const m = Mat3.rotate(0);
    expectMat3Close(m, Mat3.create());
  });
});

describe('Mat3.scale', () => {
  it('creates scale matrix', () => {
    const m = Mat3.scale(2, 3);
    expect(m[0]).toBe(2);
    expect(m[4]).toBe(3);
    expect(m[8]).toBe(1);
  });
});

describe('Mat3.invert', () => {
  it('inverts identity', () => {
    const id = Mat3.create();
    const inv = Mat3.invert(id);
    expect(inv).not.toBeNull();
    expectMat3Close(inv!, id);
  });
  it('inverts translation', () => {
    const m = Mat3.translate(5, 10);
    const inv = Mat3.invert(m)!;
    expect(inv).not.toBeNull();
    expectMat3Close(Mat3.multiply(m, inv), Mat3.create());
  });
  it('inverts rotation', () => {
    const m = Mat3.rotate(1.2);
    const inv = Mat3.invert(m)!;
    expectMat3Close(Mat3.multiply(m, inv), Mat3.create());
  });
  it('returns null for singular matrix', () => {
    const m = new Float32Array(9); // all zeros
    expect(Mat3.invert(m)).toBeNull();
  });
  it('writes into out param', () => {
    const out = new Float32Array(9);
    const result = Mat3.invert(Mat3.create(), out);
    expect(result).toBe(out);
  });
});

describe('Mat3.fromTransform', () => {
  it('identity transform yields identity matrix', () => {
    const t = Transform2D.identity();
    expectMat3Close(Mat3.fromTransform(t), Mat3.create());
  });
  it('translation only', () => {
    const t = Transform2D.create(5, 10);
    const m = Mat3.fromTransform(t);
    expect(m[6]).toBeCloseTo(5);
    expect(m[7]).toBeCloseTo(10);
  });
  it('round-trip with localToWorld', () => {
    const t = Transform2D.create(10, 20, 0.5, 2, 3);
    const m = Mat3.fromTransform(t);
    // Transform point (1,1) with the matrix
    const x = 1,
      y = 1;
    const wx = m[0]! * x + m[3]! * y + m[6]!;
    const wy = m[1]! * x + m[4]! * y + m[7]!;
    const expected = Transform2D.localToWorld(t, { x: 1, y: 1 });
    expect(approxEquals(wx, expected.x)).toBe(true);
    expect(approxEquals(wy, expected.y)).toBe(true);
  });
});
