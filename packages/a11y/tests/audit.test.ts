import { describe, expect, test } from 'bun:test';
import { Color } from '@flare-engine/math';
import { auditColors, contrastRatio, deltaE, isDistinguishable, wcagLevel } from '../src/audit.js';

const BLACK = Color.BLACK;
const WHITE = Color.WHITE;

describe('contrastRatio', () => {
  test('black vs white = 21:1 (exact)', () => {
    expect(contrastRatio(BLACK, WHITE)).toBe(21);
  });

  test('is order-independent', () => {
    const fg = Color.fromHex('#767676');
    const bg = Color.WHITE;
    expect(contrastRatio(fg, bg)).toBeCloseTo(contrastRatio(bg, fg), 10);
  });

  test('same color vs itself = 1:1', () => {
    expect(contrastRatio(WHITE, WHITE)).toBe(1);
    expect(contrastRatio(BLACK, BLACK)).toBe(1);
  });

  test('#767676 vs white ≈ 4.54 (just above AA threshold)', () => {
    const gray = Color.fromHex('#767676');
    expect(contrastRatio(gray, WHITE)).toBeCloseTo(4.54, 1);
  });

  test('delegates to Color.contrastRatio', () => {
    const a = Color.fromHex('#1a1a2e');
    const b = Color.fromHex('#e0e0ff');
    expect(contrastRatio(a, b)).toBeCloseTo(Color.contrastRatio(a, b), 10);
  });
});

describe('wcagLevel — normal text', () => {
  test('ratio 1.0 → fail', () => {
    expect(wcagLevel(1.0)).toBe('fail');
  });

  test('ratio 4.499 → fail (boundary)', () => {
    expect(wcagLevel(4.499)).toBe('fail');
  });

  test('ratio 4.5 → AA (inclusive boundary)', () => {
    expect(wcagLevel(4.5)).toBe('AA');
  });

  test('ratio 6.9 → AA', () => {
    expect(wcagLevel(6.9)).toBe('AA');
  });

  test('ratio 7.0 → AAA (inclusive boundary)', () => {
    expect(wcagLevel(7.0)).toBe('AAA');
  });

  test('ratio 21 → AAA', () => {
    expect(wcagLevel(21)).toBe('AAA');
  });

  test('black vs white passes AAA', () => {
    expect(wcagLevel(contrastRatio(BLACK, WHITE))).toBe('AAA');
  });
});

describe('wcagLevel — large text', () => {
  test('ratio 2.99 → fail', () => {
    expect(wcagLevel(2.99, true)).toBe('fail');
  });

  test('ratio 3.0 → AA (inclusive boundary)', () => {
    expect(wcagLevel(3.0, true)).toBe('AA');
  });

  test('ratio 4.499 → AA (still below large-text AAA threshold)', () => {
    expect(wcagLevel(4.499, true)).toBe('AA');
  });

  test('ratio 4.5 → AAA (inclusive boundary for large text)', () => {
    expect(wcagLevel(4.5, true)).toBe('AAA');
  });

  test('ratio 21 → AAA', () => {
    expect(wcagLevel(21, true)).toBe('AAA');
  });
});

describe('deltaE', () => {
  test('same color → 0', () => {
    expect(deltaE(BLACK, BLACK)).toBe(0);
    expect(deltaE(WHITE, WHITE)).toBe(0);
  });

  test('black vs white ≈ 1.0 (full OKLab L range, near-zero a,b)', () => {
    expect(deltaE(BLACK, WHITE)).toBeCloseTo(1.0, 1);
  });

  test('is order-independent', () => {
    const a = Color.fromHex('#ff0000');
    const b = Color.fromHex('#0000ff');
    expect(deltaE(a, b)).toBeCloseTo(deltaE(b, a), 10);
  });

  test('delegates to Color.deltaEOk', () => {
    const a = Color.fromHex('#ff6600');
    const b = Color.fromHex('#0066ff');
    expect(deltaE(a, b)).toBeCloseTo(Color.deltaEOk(a, b), 10);
  });
});

describe('isDistinguishable', () => {
  test('same color → false at threshold 0.1', () => {
    expect(isDistinguishable(WHITE, WHITE)).toBe(false);
    expect(isDistinguishable(BLACK, BLACK)).toBe(false);
  });

  test('black vs white → true at any reasonable threshold', () => {
    expect(isDistinguishable(BLACK, WHITE)).toBe(true);
    expect(isDistinguishable(BLACK, WHITE, 0.5)).toBe(true);
    expect(isDistinguishable(BLACK, WHITE, 0.99)).toBe(true);
  });

  test('near-identical greys → false at 0.1, true at 0.001', () => {
    const a = Color.fromHex('#808080');
    const b = Color.fromHex('#818181');
    expect(isDistinguishable(a, b, 0.1)).toBe(false);
    expect(isDistinguishable(a, b, 0.001)).toBe(true);
  });

  test('default threshold is 0.1', () => {
    const a = Color.fromHex('#ff0000');
    const b = Color.fromHex('#0000ff');
    const de = deltaE(a, b);
    expect(isDistinguishable(a, b)).toBe(de >= 0.1);
  });
});

describe('auditColors', () => {
  test('black vs white → AAA contrast, ΔE ≈ 1, distinguishable', () => {
    const result = auditColors(BLACK, WHITE);
    expect(result.contrastRatio).toBe(21);
    expect(result.wcagLevel).toBe('AAA');
    expect(result.deltaE).toBeCloseTo(1.0, 1);
    expect(result.distinguishable).toBe(true);
  });

  test('same color → fail contrast, ΔE = 0, not distinguishable', () => {
    const result = auditColors(WHITE, WHITE);
    expect(result.contrastRatio).toBe(1);
    expect(result.wcagLevel).toBe('fail');
    expect(result.deltaE).toBe(0);
    expect(result.distinguishable).toBe(false);
  });

  test('largeText option changes wcagLevel threshold', () => {
    const gray = Color.fromHex('#767676');
    const normalResult = auditColors(gray, WHITE);
    const largeResult = auditColors(gray, WHITE, { largeText: true });
    expect(normalResult.wcagLevel).toBe('AA');
    expect(largeResult.wcagLevel).toBe('AAA');
  });

  test('custom deltaEThreshold changes distinguishable flag', () => {
    const a = Color.fromHex('#808080');
    const b = Color.fromHex('#818181');
    const tight = auditColors(a, b, { deltaEThreshold: 0.001 });
    const loose = auditColors(a, b, { deltaEThreshold: 0.1 });
    expect(tight.distinguishable).toBe(true);
    expect(loose.distinguishable).toBe(false);
  });

  test('ΔE and contrast ratio are independent dimensions', () => {
    const nearBlack = Color.fromHex('#000001');
    const nearWhite = Color.fromHex('#fffffe');
    const result = auditColors(nearBlack, nearWhite);
    expect(result.wcagLevel).toBe('AAA');
    expect(result.distinguishable).toBe(true);
    expect(result.deltaE).toBeGreaterThan(0.5);
  });
});
