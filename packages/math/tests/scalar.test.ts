import { describe, expect, it } from 'bun:test';
import {
  approxEquals,
  clamp,
  degToRad,
  inverseLerp,
  lerp,
  map,
  pingPong,
  radToDeg,
  sign,
  smoothStep,
  wrap,
} from '../src/index.js';

describe('clamp', () => {
  it('clamps below min', () => expect(clamp(-5, 0, 10)).toBe(0));
  it('clamps above max', () => expect(clamp(15, 0, 10)).toBe(10));
  it('returns value in range', () => expect(clamp(5, 0, 10)).toBe(5));
  it('handles min === max', () => expect(clamp(5, 3, 3)).toBe(3));
  it('handles NaN', () => expect(clamp(Number.NaN, 0, 10)).toBeNaN());
  it('handles Infinity', () => expect(clamp(Number.POSITIVE_INFINITY, 0, 10)).toBe(10));
  it('handles -Infinity', () => expect(clamp(Number.NEGATIVE_INFINITY, 0, 10)).toBe(0));
});

describe('lerp', () => {
  it('t=0 returns a', () => expect(lerp(10, 20, 0)).toBe(10));
  it('t=1 returns b', () => expect(lerp(10, 20, 1)).toBe(20));
  it('t=0.5 returns midpoint', () => expect(lerp(10, 20, 0.5)).toBe(15));
  it('extrapolates beyond 1', () => expect(lerp(0, 10, 2)).toBe(20));
  it('extrapolates below 0', () => expect(lerp(0, 10, -1)).toBe(-10));
  it('handles equal a b', () => expect(lerp(5, 5, 0.5)).toBe(5));
});

describe('inverseLerp', () => {
  it('returns 0 at a', () => expect(inverseLerp(10, 20, 10)).toBe(0));
  it('returns 1 at b', () => expect(inverseLerp(10, 20, 20)).toBe(1));
  it('returns 0.5 at midpoint', () => expect(inverseLerp(10, 20, 15)).toBe(0.5));
  it('returns 0 when a === b', () => expect(inverseLerp(5, 5, 5)).toBe(0));
  it('handles value outside range', () => expect(inverseLerp(0, 10, 20)).toBe(2));
});

describe('map', () => {
  it('maps between ranges', () => expect(map(5, 0, 10, 0, 100)).toBe(50));
  it('maps to inverted range', () => expect(map(0, 0, 10, 100, 0)).toBe(100));
  it('maps outside input range', () => expect(map(20, 0, 10, 0, 100)).toBe(200));
});

describe('degToRad', () => {
  it('converts 0', () => expect(degToRad(0)).toBe(0));
  it('converts 180', () => expect(approxEquals(degToRad(180), Math.PI)).toBe(true));
  it('converts 360', () => expect(approxEquals(degToRad(360), Math.PI * 2)).toBe(true));
  it('converts negative', () => expect(approxEquals(degToRad(-90), -Math.PI / 2)).toBe(true));
});

describe('radToDeg', () => {
  it('converts 0', () => expect(radToDeg(0)).toBe(0));
  it('converts PI', () => expect(approxEquals(radToDeg(Math.PI), 180)).toBe(true));
  it('converts 2PI', () => expect(approxEquals(radToDeg(Math.PI * 2), 360)).toBe(true));
});

describe('approxEquals', () => {
  it('equal values', () => expect(approxEquals(1, 1)).toBe(true));
  it('within epsilon', () => expect(approxEquals(1, 1 + 1e-7)).toBe(true));
  it('outside epsilon', () => expect(approxEquals(1, 1.001)).toBe(false));
  it('custom epsilon', () => expect(approxEquals(1, 1.01, 0.1)).toBe(true));
  it('NaN is not approx equal to NaN', () =>
    expect(approxEquals(Number.NaN, Number.NaN)).toBe(false));
  it('Infinity equals Infinity', () =>
    expect(approxEquals(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(false));
});

describe('wrap', () => {
  it('wraps above max', () => expect(wrap(11, 0, 10)).toBe(1));
  it('wraps below min', () => expect(wrap(-1, 0, 10)).toBe(9));
  it('returns value in range', () => expect(wrap(5, 0, 10)).toBe(5));
  it('wraps at exactly max', () => expect(wrap(10, 0, 10)).toBe(0));
  it('handles zero range', () => expect(wrap(5, 3, 3)).toBe(3));
  it('wraps negative range properly', () => expect(wrap(370, 0, 360)).toBe(10));
});

describe('pingPong', () => {
  it('t=0 returns 0', () => expect(pingPong(0, 5)).toBe(0));
  it('t=length returns length', () => expect(pingPong(5, 5)).toBe(5));
  it('t=2*length returns 0', () => expect(approxEquals(pingPong(10, 5), 0)).toBe(true));
  it('t=1.5*length returns half', () => expect(approxEquals(pingPong(7.5, 5), 2.5)).toBe(true));
  it('handles zero length', () => expect(pingPong(5, 0)).toBe(0));
  it('handles negative t', () => expect(pingPong(-3, 5)).toBe(3));
});

describe('smoothStep', () => {
  it('returns 0 below edge0', () => expect(smoothStep(0, 1, -1)).toBe(0));
  it('returns 1 above edge1', () => expect(smoothStep(0, 1, 2)).toBe(1));
  it('returns 0.5 at midpoint', () => expect(smoothStep(0, 1, 0.5)).toBe(0.5));
  it('returns 0 at edge0', () => expect(smoothStep(0, 1, 0)).toBe(0));
  it('returns 1 at edge1', () => expect(smoothStep(0, 1, 1)).toBe(1));
  it('handles edge0 === edge1 below', () => expect(smoothStep(5, 5, 4)).toBe(0));
  it('handles edge0 === edge1 at', () => expect(smoothStep(5, 5, 5)).toBe(1));
});

describe('sign', () => {
  it('positive', () => expect(sign(5)).toBe(1));
  it('negative', () => expect(sign(-5)).toBe(-1));
  it('zero', () => expect(sign(0)).toBe(0));
  it('NaN returns 0', () => expect(sign(Number.NaN)).toBe(0));
  it('Infinity', () => expect(sign(Number.POSITIVE_INFINITY)).toBe(1));
  it('-Infinity', () => expect(sign(Number.NEGATIVE_INFINITY)).toBe(-1));
});
