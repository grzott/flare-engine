import { describe, expect, test } from 'bun:test';
import { Color } from '@flare-engine/math';
import { hexToArgb } from '../src/util/hex';

describe('Color.fromHex', () => {
  test('#FF0000 yields r=1 g=0 b=0 a=1', () => {
    const result = Color.fromHex('#FF0000');
    expect(result.r).toBe(1);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
    expect(result.a).toBe(1);
  });

  test('#80c040 yields correct channels', () => {
    const result = Color.fromHex('#80c040');
    expect(result.r).toBeCloseTo(0x80 / 255, 10);
    expect(result.g).toBeCloseTo(0xc0 / 255, 10);
    expect(result.b).toBeCloseTo(0x40 / 255, 10);
    expect(result.a).toBe(1);
  });

  test('alpha override via spread preserves rgb and sets a', () => {
    const base = Color.fromHex('#80c040');
    const result = { ...base, a: 0.5 };
    expect(result.r).toBeCloseTo(0x80 / 255, 10);
    expect(result.g).toBeCloseTo(0xc0 / 255, 10);
    expect(result.b).toBeCloseTo(0x40 / 255, 10);
    expect(result.a).toBe(0.5);
  });
});

describe('Color.toSkColor', () => {
  test('#FF0000 yields 0xffff0000', () => {
    const argb = Color.toSkColor(Color.fromHex('#FF0000'));
    expect(argb >>> 0).toBe(0xffff0000);
  });

  test('#000000 yields 0xff000000', () => {
    const argb = Color.toSkColor(Color.fromHex('#000000'));
    expect(argb >>> 0).toBe(0xff000000);
  });

  test('#ffffff yields 0xffffffff', () => {
    const argb = Color.toSkColor(Color.fromHex('#ffffff'));
    expect(argb >>> 0).toBe(0xffffffff);
  });
});

describe('hexToArgb util — single source of truth', () => {
  test('#FF0000 yields 0xffff0000', () => {
    expect(hexToArgb('#FF0000') >>> 0).toBe(0xffff0000);
  });

  test('#C9A24A (gold) round-trips to 0xffc9a24a', () => {
    expect(hexToArgb('#C9A24A') >>> 0).toBe(0xffc9a24a);
  });

  test('#3A0F5C (violetDark) round-trips to 0xff3a0f5c', () => {
    expect(hexToArgb('#3A0F5C') >>> 0).toBe(0xff3a0f5c);
  });
});
