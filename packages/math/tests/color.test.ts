import { describe, expect, it } from 'bun:test';
import { Color, approxEquals } from '../src/index.js';

describe('Color constants', () => {
  it('WHITE', () => expect(Color.WHITE).toEqual({ r: 1, g: 1, b: 1, a: 1 }));
  it('BLACK', () => expect(Color.BLACK).toEqual({ r: 0, g: 0, b: 0, a: 1 }));
  it('TRANSPARENT', () => expect(Color.TRANSPARENT).toEqual({ r: 0, g: 0, b: 0, a: 0 }));
});

describe('Color.create', () => {
  it('defaults to black opaque', () => {
    expect(Color.create()).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
  it('custom values', () => {
    expect(Color.create(0.5, 0.6, 0.7, 0.8)).toEqual({
      r: 0.5,
      g: 0.6,
      b: 0.7,
      a: 0.8,
    });
  });
});

describe('Color.fromHex', () => {
  it('#RRGGBB', () => {
    const c = Color.fromHex('#ff8000');
    expect(approxEquals(c.r, 1, 0.01)).toBe(true);
    expect(approxEquals(c.g, 0.502, 0.01)).toBe(true);
    expect(approxEquals(c.b, 0, 0.01)).toBe(true);
    expect(c.a).toBe(1);
  });
  it('#RRGGBBAA', () => {
    const c = Color.fromHex('#ff000080');
    expect(approxEquals(c.r, 1, 0.01)).toBe(true);
    expect(approxEquals(c.a, 0.502, 0.01)).toBe(true);
  });
  it('#RGB shorthand', () => {
    const c = Color.fromHex('#f00');
    expect(approxEquals(c.r, 1, 0.01)).toBe(true);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0);
  });
  it('#RGBA shorthand', () => {
    const c = Color.fromHex('#f008');
    expect(approxEquals(c.r, 1, 0.01)).toBe(true);
    expect(approxEquals(c.a, 0.533, 0.01)).toBe(true);
  });
  it('without hash prefix', () => {
    const c = Color.fromHex('ffffff');
    expect(approxEquals(c.r, 1, 0.01)).toBe(true);
  });
});

describe('Color.toHex', () => {
  it('white', () => expect(Color.toHex(Color.WHITE)).toBe('#ffffff'));
  it('black', () => expect(Color.toHex(Color.BLACK)).toBe('#000000'));
  it('includes alpha when < 1', () => {
    const hex = Color.toHex({ r: 1, g: 0, b: 0, a: 0.5 });
    expect(hex).toBe('#ff000080');
  });
  it('round-trip', () => {
    const hex = '#3a7bc8';
    expect(Color.toHex(Color.fromHex(hex))).toBe(hex);
  });
});

describe('Color.lerp', () => {
  it('t=0 returns a', () => {
    const c = Color.lerp(Color.BLACK, Color.WHITE, 0);
    expect(c).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
  it('t=1 returns b', () => {
    const c = Color.lerp(Color.BLACK, Color.WHITE, 1);
    expect(c).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });
  it('t=0.5 returns midpoint', () => {
    const c = Color.lerp(Color.BLACK, Color.WHITE, 0.5);
    expect(approxEquals(c.r, 0.5)).toBe(true);
    expect(approxEquals(c.g, 0.5)).toBe(true);
    expect(approxEquals(c.b, 0.5)).toBe(true);
  });
});

describe('Color.multiply', () => {
  it('white * color = color', () => {
    const c = { r: 0.5, g: 0.6, b: 0.7, a: 0.8 };
    const result = Color.multiply(Color.WHITE, c);
    expect(approxEquals(result.r, 0.5)).toBe(true);
    expect(approxEquals(result.g, 0.6)).toBe(true);
    expect(approxEquals(result.b, 0.7)).toBe(true);
    expect(approxEquals(result.a, 0.8)).toBe(true);
  });
  it('black * anything = black', () => {
    const result = Color.multiply(Color.BLACK, Color.WHITE);
    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });
});

describe('Color.toSkColor', () => {
  it('opaque red = 0xFFFF0000', () => {
    expect(Color.toSkColor({ r: 1, g: 0, b: 0, a: 1 })).toBe(0xffff0000);
  });
  it('opaque green = 0xFF00FF00', () => {
    expect(Color.toSkColor({ r: 0, g: 1, b: 0, a: 1 })).toBe(0xff00ff00);
  });
  it('opaque blue = 0xFF0000FF', () => {
    expect(Color.toSkColor({ r: 0, g: 0, b: 1, a: 1 })).toBe(0xff0000ff);
  });
  it('transparent black = 0x00000000', () => {
    expect(Color.toSkColor({ r: 0, g: 0, b: 0, a: 0 })).toBe(0x00000000);
  });
  it('semi-transparent white = 0x80FFFFFF', () => {
    const result = Color.toSkColor({ r: 1, g: 1, b: 1, a: 128 / 255 });
    expect(result).toBe(0x80ffffff);
  });
  it('clamps out-of-range components', () => {
    const result = Color.toSkColor({ r: 2, g: -1, b: 0.5, a: 1 });
    // r clamped to 1 → 0xFF, g clamped to 0 → 0x00, b → 0x80, a → 0xFF
    const expected = Color.toSkColor({ r: 1, g: 0, b: 0.5, a: 1 });
    expect(result).toBe(expected);
  });
});
