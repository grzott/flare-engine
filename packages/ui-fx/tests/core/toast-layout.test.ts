import { describe, expect, test } from 'bun:test';
import type { RectLike } from '../../src/core/placement';
import { layoutToastStackInto, type ToastStackOptions } from '../../src/core/toast-layout';

const VIEWPORT: RectLike = { x: 0, y: 0, width: 400, height: 800 };

const options = (overrides: Partial<ToastStackOptions> = {}): ToastStackOptions => ({
  position: 'bottom',
  gap: 14,
  offset: 16,
  visible: 3,
  ...overrides,
});

describe('layoutToastStackInto', () => {
  test('bottom stacks upward from viewport.height - offset - height', () => {
    const heights = new Float32Array([40, 40, 40, 40]);
    const out = new Float32Array(4);
    const visible = layoutToastStackInto(heights, 4, VIEWPORT, options(), out);
    expect(visible).toBe(3);
    expect(out[0]).toBe(800 - 16 - 40);
    expect(out[1]).toBe(800 - 16 - 40 - 54);
    expect(out[2]).toBe(800 - 16 - 40 - 108);
  });

  test('a toast beyond the visible count sits behind the last visible one', () => {
    const heights = new Float32Array([40, 40, 40, 40, 60]);
    const out = new Float32Array(5);
    layoutToastStackInto(heights, 5, VIEWPORT, options(), out);
    expect(out[3]).toBe(out[2]!);
    // A taller one keeps the same bottom edge.
    expect(out[4]).toBe(out[2]! - 20);

    layoutToastStackInto(heights, 5, VIEWPORT, options({ position: 'top' }), out);
    expect(out[3]).toBe(out[2]!);
    expect(out[4]).toBe(out[2]!);
  });

  test('top stacks downward from the offset', () => {
    const heights = new Float32Array([40, 60, 20]);
    const out = new Float32Array(3);
    const visible = layoutToastStackInto(heights, 3, VIEWPORT, options({ position: 'top' }), out);
    expect(visible).toBe(3);
    expect(Array.from(out)).toEqual([16, 70, 144]);
  });

  test('bottom uses each height', () => {
    const heights = new Float32Array([40, 60, 20]);
    const out = new Float32Array(3);
    layoutToastStackInto(heights, 3, VIEWPORT, options(), out);
    expect(Array.from(out)).toEqual([744, 670, 636]);
  });

  test('left and right positions give the same y as their plain edge', () => {
    const heights = new Float32Array([40, 60, 20]);
    const plain = new Float32Array(3);
    const out = new Float32Array(3);
    for (const edge of ['top', 'bottom'] as const) {
      layoutToastStackInto(heights, 3, VIEWPORT, options({ position: edge }), plain);
      for (const side of ['left', 'right'] as const) {
        const o = options({ position: `${edge}-${side}` });
        expect(layoutToastStackInto(heights, 3, VIEWPORT, o, out)).toBe(3);
        expect(Array.from(out)).toEqual(Array.from(plain));
      }
    }
  });

  test('a count below visible returns the count and leaves the rest of out alone', () => {
    const heights = new Float32Array([40, 40, 40, 40]);
    const out = new Float32Array([-1, -1, -1, -1]);
    expect(layoutToastStackInto(heights, 2, VIEWPORT, options(), out)).toBe(2);
    expect(Array.from(out)).toEqual([744, 690, -1, -1]);
    expect(layoutToastStackInto(heights, 0, VIEWPORT, options(), out)).toBe(0);
    expect(Array.from(out)).toEqual([744, 690, -1, -1]);
  });

  test('a non-zero viewport origin offsets both edges', () => {
    const viewport: RectLike = { x: 20, y: 100, width: 300, height: 500 };
    const heights = new Float32Array([40, 40]);
    const out = new Float32Array(2);
    layoutToastStackInto(heights, 2, viewport, options({ position: 'top' }), out);
    expect(Array.from(out)).toEqual([116, 170]);
    layoutToastStackInto(heights, 2, viewport, options(), out);
    expect(Array.from(out)).toEqual([544, 490]);
  });

  test('visible 0 shows nothing and parks every toast in the first slot', () => {
    const heights = new Float32Array([40, 40]);
    const out = new Float32Array(2);
    expect(layoutToastStackInto(heights, 2, VIEWPORT, options({ visible: 0 }), out)).toBe(0);
    expect(Array.from(out)).toEqual([744, 744]);
  });

  test('throws when count exceeds either buffer', () => {
    const o = options();
    expect(() =>
      layoutToastStackInto(new Float32Array(2), 3, VIEWPORT, o, new Float32Array(3)),
    ).toThrow(RangeError);
    expect(() =>
      layoutToastStackInto(new Float32Array(3), 3, VIEWPORT, o, new Float32Array(2)),
    ).toThrow(RangeError);
  });
});
