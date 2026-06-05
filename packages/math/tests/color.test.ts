import { describe, expect, it } from 'bun:test';
import { Color, type Oklab, approxEquals } from '../src/index.js';

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

describe('Color.toOklab', () => {
  it('red reference vector', () => {
    const lab = Color.toOklab({ r: 1, g: 0, b: 0, a: 1 });
    expect(lab.L).toBeCloseTo(0.627955, 4);
    expect(lab.a).toBeCloseTo(0.224863, 4);
    expect(lab.b).toBeCloseTo(0.125846, 4);
  });

  it('green reference vector', () => {
    const lab = Color.toOklab({ r: 0, g: 1, b: 0, a: 1 });
    expect(lab.L).toBeCloseTo(0.86644, 4);
    expect(lab.a).toBeCloseTo(-0.233888, 4);
    expect(lab.b).toBeCloseTo(0.179499, 4);
  });

  it('blue reference vector', () => {
    const lab = Color.toOklab({ r: 0, g: 0, b: 1, a: 1 });
    expect(lab.L).toBeCloseTo(0.452014, 4);
    expect(lab.a).toBeCloseTo(-0.032457, 4);
    expect(lab.b).toBeCloseTo(-0.311528, 4);
  });

  it('white → L≈1, a≈0, b≈0', () => {
    const lab = Color.toOklab(Color.WHITE);
    expect(lab.L).toBeCloseTo(1, 4);
    expect(lab.a).toBeCloseTo(0, 4);
    expect(lab.b).toBeCloseTo(0, 4);
  });

  it('ignores input alpha', () => {
    const lab1 = Color.toOklab({ r: 0.5, g: 0.3, b: 0.8, a: 1 });
    const lab2 = Color.toOklab({ r: 0.5, g: 0.3, b: 0.8, a: 0.5 });
    expect(lab1.L).toBeCloseTo(lab2.L, 10);
    expect(lab1.a).toBeCloseTo(lab2.a, 10);
    expect(lab1.b).toBeCloseTo(lab2.b, 10);
  });
});

describe('Color.toOklch', () => {
  it('red reference vector', () => {
    const lch = Color.toOklch({ r: 1, g: 0, b: 0, a: 1 });
    expect(lch.L).toBeCloseTo(0.62796, 4);
    expect(lch.C).toBeCloseTo(0.25768, 4);
    expect(lch.h).toBeCloseTo(29.234, 3);
  });

  it('achromatic gray → h = 0 (guard)', () => {
    const lch = Color.toOklch({ r: 0.5, g: 0.5, b: 0.5, a: 1 });
    expect(lch.h).toBe(0);
  });

  it('white → h = 0', () => {
    expect(Color.toOklch(Color.WHITE).h).toBe(0);
  });

  it('black → h = 0', () => {
    expect(Color.toOklch(Color.BLACK).h).toBe(0);
  });
});

describe('Color.fromOklab round-trip', () => {
  const samples: Color[] = [
    Color.WHITE,
    { r: 1, g: 0, b: 0, a: 1 },
    { r: 0.5, g: 0.5, b: 0.5, a: 1 },
    Color.fromHex('#C9A24A'),
  ];

  for (const orig of samples) {
    it(`round-trips ${Color.toHex(orig)}`, () => {
      const rt = Color.fromOklab(Color.toOklab(orig));
      expect(rt.r).toBeCloseTo(orig.r, 5);
      expect(rt.g).toBeCloseTo(orig.g, 5);
      expect(rt.b).toBeCloseTo(orig.b, 5);
    });
  }

  it('default alpha = 1', () => {
    expect(Color.fromOklab(Color.toOklab(Color.WHITE)).a).toBe(1);
  });

  it('honors explicit alpha', () => {
    expect(Color.fromOklab(Color.toOklab(Color.WHITE), 0.5).a).toBe(0.5);
  });

  it('out-of-gamut input clamps channels to [0,1] with no NaN', () => {
    const c = Color.fromOklab({ L: 0.7, a: 0.3, b: 0 });
    expect(Number.isFinite(c.r)).toBe(true);
    expect(Number.isFinite(c.g)).toBe(true);
    expect(Number.isFinite(c.b)).toBe(true);
    expect(c.r).toBeGreaterThanOrEqual(0);
    expect(c.r).toBeLessThanOrEqual(1);
    expect(c.g).toBeGreaterThanOrEqual(0);
    expect(c.g).toBeLessThanOrEqual(1);
    expect(c.b).toBeGreaterThanOrEqual(0);
    expect(c.b).toBeLessThanOrEqual(1);
  });
});

describe('Color.fromOklch', () => {
  it('round-trips red via OKLCH', () => {
    const red: Color = { r: 1, g: 0, b: 0, a: 1 };
    const rt = Color.fromOklch(Color.toOklch(red));
    expect(rt.r).toBeCloseTo(red.r, 4);
    expect(rt.g).toBeCloseTo(red.g, 4);
    expect(rt.b).toBeCloseTo(red.b, 4);
  });

  it('hue wrap: h=-30 and h=330 produce same color', () => {
    const lch = Color.toOklch({ r: 1, g: 0, b: 0, a: 1 });
    const C = lch.C;
    const L = lch.L;
    const a = Color.fromOklch({ L, C, h: -30 });
    const b = Color.fromOklch({ L, C, h: 330 });
    expect(a.r).toBeCloseTo(b.r, 10);
    expect(a.g).toBeCloseTo(b.g, 10);
    expect(a.b).toBeCloseTo(b.b, 10);
  });

  it('hue wrap: h=390 and h=30 produce same color', () => {
    const lch = Color.toOklch({ r: 1, g: 0, b: 0, a: 1 });
    const C = lch.C;
    const L = lch.L;
    const a = Color.fromOklch({ L, C, h: 390 });
    const b = Color.fromOklch({ L, C, h: 30 });
    expect(a.r).toBeCloseTo(b.r, 10);
    expect(a.g).toBeCloseTo(b.g, 10);
    expect(a.b).toBeCloseTo(b.b, 10);
  });

  it('default alpha = 1', () => {
    expect(Color.fromOklch({ L: 0.5, C: 0.1, h: 180 }).a).toBe(1);
  });

  it('honors explicit alpha', () => {
    expect(Color.fromOklch({ L: 0.5, C: 0.1, h: 180 }, 0.75).a).toBe(0.75);
  });
});

describe('Color.relativeLuminance', () => {
  it('white = 1', () => {
    expect(Color.relativeLuminance(Color.WHITE)).toBeCloseTo(1, 5);
  });

  it('black = 0', () => {
    expect(Color.relativeLuminance(Color.BLACK)).toBeCloseTo(0, 5);
  });

  it('mid-gray (.5,.5,.5) ≈ 0.21404', () => {
    expect(Color.relativeLuminance({ r: 0.5, g: 0.5, b: 0.5, a: 1 })).toBeCloseTo(0.21404, 4);
  });
});

describe('Color.contrastRatio', () => {
  it('white vs black = 21', () => {
    expect(Color.contrastRatio(Color.WHITE, Color.BLACK)).toBeCloseTo(21, 5);
  });

  it('same color = 1', () => {
    const c: Color = { r: 0.4, g: 0.2, b: 0.8, a: 1 };
    expect(Color.contrastRatio(c, c)).toBeCloseTo(1, 10);
  });

  it('order-independent (a,b) === (b,a)', () => {
    const a: Color = { r: 0.8, g: 0.2, b: 0.1, a: 1 };
    const b: Color = { r: 0.1, g: 0.4, b: 0.9, a: 1 };
    expect(Color.contrastRatio(a, b)).toBeCloseTo(Color.contrastRatio(b, a), 10);
  });
});

describe('Color.deltaEOk', () => {
  it('white vs black = 1', () => {
    expect(Color.deltaEOk(Color.WHITE, Color.BLACK)).toBeCloseTo(1, 5);
  });

  it('same color = 0', () => {
    const c: Color = { r: 0.5, g: 0.3, b: 0.7, a: 1 };
    expect(Color.deltaEOk(c, c)).toBeCloseTo(0, 10);
  });

  it('agrees with deltaEOkLab on pre-converted points', () => {
    const a: Color = { r: 0.8, g: 0.2, b: 0.1, a: 1 };
    const b: Color = { r: 0.1, g: 0.4, b: 0.9, a: 1 };
    const viaColors = Color.deltaEOk(a, b);
    const viaLab = Color.deltaEOkLab(Color.toOklab(a), Color.toOklab(b));
    expect(viaColors).toBeCloseTo(viaLab, 10);
  });
});

describe('Color.deltaEOkLab', () => {
  it('identical points = 0', () => {
    const lab: Oklab = { L: 0.5, a: 0.1, b: -0.1 };
    expect(Color.deltaEOkLab(lab, lab)).toBe(0);
  });

  it('computes Euclidean distance', () => {
    const a: Oklab = { L: 0, a: 0, b: 0 };
    const b: Oklab = { L: 1, a: 0, b: 0 };
    expect(Color.deltaEOkLab(a, b)).toBeCloseTo(1, 10);
  });
});
