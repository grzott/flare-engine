import { describe, expect, test } from 'bun:test';
import { resolveLayout } from '../src/layout.js';

describe('resolveLayout', () => {
  test('returns an empty array for zero children', () => {
    expect(resolveLayout({ width: 100, height: 100, direction: 'row' }, [])).toEqual([]);
  });

  test('row with fixed basis, no gap, starts at 0,0', () => {
    const rects = resolveLayout({ width: 300, height: 50, direction: 'row' }, [
      { basis: 100 },
      { basis: 100 },
      { basis: 100 },
    ]);
    expect(rects.map((r) => r.x)).toEqual([0, 100, 200]);
    expect(rects.every((r) => r.y === 0)).toBe(true);
    expect(rects.every((r) => r.height === 50)).toBe(true);
  });

  test('column with padding offsets the first rect', () => {
    const rects = resolveLayout(
      {
        width: 100,
        height: 300,
        direction: 'column',
        padding: { top: 10, left: 20, right: 0, bottom: 0 },
      },
      [{ basis: 50 }, { basis: 50 }],
    );
    const first = rects[0];
    const second = rects[1];
    if (!first || !second) throw new Error('expected two rects');
    expect(first.y).toBe(10);
    expect(first.x).toBe(20);
    expect(second.y).toBe(60);
  });

  test('gap spaces children along the main axis', () => {
    const rects = resolveLayout({ width: 300, height: 50, direction: 'row', gap: 10 }, [
      { basis: 50 },
      { basis: 50 },
      { basis: 50 },
    ]);
    expect(rects.map((r) => r.x)).toEqual([0, 60, 120]);
  });

  test('grow distributes leftover space proportionally', () => {
    const rects = resolveLayout({ width: 300, height: 50, direction: 'row' }, [
      { basis: 50, grow: 1 },
      { basis: 50, grow: 2 },
    ]);
    // leftover = 300 - 100 = 200; first gets 50 + 200*1/3 ≈ 116.67, second 50 + 200*2/3 ≈ 183.33
    const first = rects[0];
    const second = rects[1];
    if (!first || !second) throw new Error('expected two rects');
    expect(first.width).toBeCloseTo(116.667, 1);
    expect(second.width).toBeCloseTo(183.333, 1);
    expect(first.width + second.width).toBeCloseTo(300, 5);
  });

  test('justifyContent: center offsets by half the free space', () => {
    const rects = resolveLayout(
      { width: 300, height: 50, direction: 'row', justifyContent: 'center' },
      [{ basis: 100 }],
    );
    const first = rects[0];
    if (!first) throw new Error('expected rect');
    expect(first.x).toBe(100);
  });

  test('justifyContent: space-between spreads to the edges', () => {
    const rects = resolveLayout(
      { width: 300, height: 50, direction: 'row', justifyContent: 'space-between' },
      [{ basis: 50 }, { basis: 50 }, { basis: 50 }],
    );
    expect(rects.map((r) => r.x)).toEqual([0, 125, 250]);
  });

  test('alignItems: stretch fills the cross axis', () => {
    const rects = resolveLayout(
      { width: 300, height: 50, direction: 'row', alignItems: 'stretch' },
      [{ basis: 100 }],
    );
    const first = rects[0];
    if (!first) throw new Error('expected rect');
    expect(first.height).toBe(50);
  });

  test('alignItems: center centers children with explicit crossSize', () => {
    const rects = resolveLayout(
      { width: 300, height: 50, direction: 'row', alignItems: 'center' },
      [{ basis: 100, crossSize: 20 }],
    );
    const first = rects[0];
    if (!first) throw new Error('expected rect');
    expect(first.y).toBe(15);
    expect(first.height).toBe(20);
  });

  test('column direction uses height as the main axis', () => {
    const rects = resolveLayout({ width: 100, height: 300, direction: 'column' }, [
      { basis: 100 },
      { basis: 100 },
      { basis: 100 },
    ]);
    expect(rects.map((r) => r.y)).toEqual([0, 100, 200]);
    expect(rects.every((r) => r.x === 0)).toBe(true);
    expect(rects.every((r) => r.width === 100)).toBe(true);
  });

  test('padding reduces the available cross axis for stretch', () => {
    const rects = resolveLayout(
      {
        width: 300,
        height: 100,
        direction: 'row',
        padding: { top: 10, bottom: 10, left: 0, right: 0 },
      },
      [{ basis: 100 }],
    );
    const first = rects[0];
    if (!first) throw new Error('expected rect');
    expect(first.height).toBe(80);
    expect(first.y).toBe(10);
  });

  test('justifyContent: space-evenly splits free space into n+1 gaps', () => {
    const rects = resolveLayout(
      { width: 400, height: 50, direction: 'row', justifyContent: 'space-evenly' },
      [{ basis: 100 }, { basis: 100 }],
    );
    // free = 200, gap = 200/3 ≈ 66.67
    const a = rects[0];
    const b = rects[1];
    if (!a || !b) throw new Error('expected two rects');
    expect(a.x).toBeCloseTo(66.667, 1);
    expect(b.x).toBeCloseTo(233.333, 1);
  });
});
