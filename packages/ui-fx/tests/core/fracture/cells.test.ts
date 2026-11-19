import { describe, expect, test } from 'bun:test';
import { cellGridFor } from '../../../src/core/fracture/cells';

describe('cellGridFor', () => {
  test('keeps the cell when the grid already fits', () => {
    expect(cellGridFor(320, 200, 8, 3000)).toEqual({ cols: 40, rows: 25, cell: 8 });
  });

  test('rounds a partial cell up to a whole column or row', () => {
    expect(cellGridFor(321, 201, 8, 3000)).toEqual({ cols: 41, rows: 26, cell: 8 });
  });

  test('a 360x64 element at 3x with cell 4 grows the cell until it fits 3,000', () => {
    const grid = cellGridFor(360 * 3, 64 * 3, 4, 3000);
    expect(grid.cell).toBeGreaterThan(4);
    expect(grid.cols * grid.rows).toBeLessThanOrEqual(3000);
    expect(grid.cols).toBe(Math.ceil(1080 / grid.cell));
    expect(grid.rows).toBe(Math.ceil(192 / grid.cell));
    // The cell before the one chosen would not have fitted.
    const before = grid.cell - 1;
    expect(Math.ceil(1080 / before) * Math.ceil(192 / before)).toBeGreaterThan(3000);
  });

  test('fits a full-screen capture at 3x', () => {
    const grid = cellGridFor(1080, 1920, 1, 3000);
    expect(grid.cols * grid.rows).toBeLessThanOrEqual(3000);
  });

  test('a cap of 1 gives a single cell', () => {
    const grid = cellGridFor(100, 50, 4, 1);
    expect(grid.cols).toBe(1);
    expect(grid.rows).toBe(1);
  });

  test('rejects sizes, cells and caps it cannot lay out', () => {
    expect(() => cellGridFor(0, 100, 4, 3000)).toThrow(RangeError);
    expect(() => cellGridFor(100, Number.NaN, 4, 3000)).toThrow(RangeError);
    expect(() => cellGridFor(100, 100, 0, 3000)).toThrow(RangeError);
    expect(() => cellGridFor(100, 100, 4, 0)).toThrow(RangeError);
    expect(() => cellGridFor(100, 100, 4, 2.5)).toThrow(RangeError);
  });
});
