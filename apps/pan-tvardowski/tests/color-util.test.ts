import { describe, expect, test } from 'bun:test';
import { hexToRgba01 } from '../src/visual-spec/color-util';

describe('hexToRgba01', () => {
  test('#FF0000 yields r=1 g=0 b=0 a=1', () => {
    const result = hexToRgba01('#FF0000');
    expect(result.r).toBe(1);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
    expect(result.a).toBe(1);
  });

  test('#80c040 with alpha 0.5 yields correct channels and alpha', () => {
    const result = hexToRgba01('#80c040', 0.5);
    expect(result.r).toBeCloseTo(0x80 / 255, 10);
    expect(result.g).toBeCloseTo(0xc0 / 255, 10);
    expect(result.b).toBeCloseTo(0x40 / 255, 10);
    expect(result.a).toBe(0.5);
  });
});
