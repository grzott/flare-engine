import { describe, expect, test } from 'bun:test';
import { createScalarField, decideTurn } from '../src/index.js';

// Strided field total via cell-center sample grid.
const fieldTotal = (f: ReturnType<typeof createScalarField>): number => {
  let s = 0;
  for (let y = 0; y < f.h; y += f.cell) {
    for (let x = 0; x < f.w; x += f.cell) s += f.sample(x, y);
  }
  return s;
};

describe('ScalarField', () => {
  test('deposit then sample reads back positive at the splat', () => {
    const f = createScalarField(120, 80, 4);
    expect(f.sample(40, 40)).toBe(0);
    f.deposit(40, 40, 5);
    expect(f.sample(40, 40)).toBeGreaterThan(0);
  });

  test('step decays a spike toward zero over time', () => {
    const f = createScalarField(120, 80, 4);
    f.deposit(60, 40, 10);
    const before = f.sample(60, 40);
    for (let i = 0; i < 30; i++) f.step(0.4, 0.92, Number.POSITIVE_INFINITY);
    expect(f.sample(60, 40)).toBeLessThan(before);
  });

  test('pure diffuse (decayRate=1) conserves total mass within 2%', () => {
    const f = createScalarField(160, 120, 4);
    f.deposit(80, 60, 100);
    const total0 = fieldTotal(f);
    for (let i = 0; i < 20; i++) f.step(1, 1, Number.POSITIVE_INFINITY);
    const total1 = fieldTotal(f);
    expect(Math.abs(total1 - total0)).toBeLessThan(total0 * 0.02);
  });

  test('erode multiplies a region toward zero', () => {
    const f = createScalarField(120, 80, 4);
    f.deposit(40, 40, 10);
    expect(f.sample(40, 40)).toBeGreaterThan(0);
    f.erode(40, 40, 10, 0);
    expect(f.sample(40, 40)).toBe(0);
  });

  test('step clamps cells to maxVal', () => {
    const f = createScalarField(120, 80, 4);
    for (let i = 0; i < 50; i++) f.deposit(40, 40, 10);
    f.step(0, 1, 1);
    expect(f.sample(40, 40)).toBeLessThanOrEqual(1.0001);
  });

  test('decideTurn follows the brightest sensor', () => {
    expect(decideTurn(1, 9, 1, 0)).toBe(0); // center brightest → straight
    expect(decideTurn(1, 5, 9, 0)).toBe(1); // right brightest → turn right
    expect(decideTurn(9, 5, 1, 0)).toBe(-1); // left brightest → turn left
    expect(decideTurn(9, 1, 9, 0.2)).toBe(-1); // symmetric dip, rand<0.5 → left
  });

  test('gradient points from low toward high field value', () => {
    const f = createScalarField(200, 200, 4);
    const cx = 120;
    const cy = 80;
    for (let k = 0; k < 20; k++) f.deposit(cx, cy, 10);

    const out = { x: 0, y: 0 };
    // One cell to the left: gradient(cx-cell) samples (cx) and (cx-2*cell);
    // (cx) is bright → x component is positive (points right toward the deposit).
    f.gradient(cx - f.cell, cy, out);
    expect(out.x).toBeGreaterThan(0);

    // One cell above: gradient(cy-cell) samples (cy) and (cy-2*cell);
    // (cy) is bright → y component is positive (points down toward the deposit).
    f.gradient(cx, cy - f.cell, out);
    expect(out.y).toBeGreaterThan(0);
  });

  test('edge modes differ: clamp vs toroidal at wrapped boundary', () => {
    const size = 80;
    const cell = 4;
    const tField = createScalarField(size, size, cell, 'toroidal');
    const cField = createScalarField(size, size, cell, 'clamp');

    // Deposit at x=0 (leftmost col). Toroidal wraps: sampling just inside the right edge
    // (with fractional gx≈19.5) reads xb=wrap(20)=col 0 and "sees" the deposit.
    // Clamp: xb=clamp(20,19)=col 19 which is zero → reads nothing.
    tField.deposit(0, size / 2, 100);
    cField.deposit(0, size / 2, 100);

    // probX = size - 0.1 → gx ≈ 19.475, x0=19, fx≈0.475, xa=19, xb=wrap(20)=0 (toro) or 19 (clamp).
    const probX = size - 0.1;
    const probY = size / 2;
    const tVal = tField.sample(probX, probY);
    const cVal = cField.sample(probX, probY);

    // Toroidal wraps and reads a positive value; clamp does not wrap so reads zero.
    expect(tVal).toBeGreaterThan(0);
    expect(cVal).toBe(0);
  });
});
