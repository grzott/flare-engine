import { describe, expect, it } from 'bun:test';
import { normalizeDirection } from './direction';

describe('normalizeDirection', () => {
  it('scales to requested speed', () => {
    const out = { x: 0, y: 0 };
    normalizeDirection(3, 4, 10, out);
    expect(out.x).toBeCloseTo(6);
    expect(out.y).toBeCloseTo(8);
  });

  it('writes zero for zero-length input', () => {
    const out = { x: 9, y: 9 };
    normalizeDirection(0, 0, 50, out);
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
  });

  it('reuses the provided out object (no allocation)', () => {
    const out = { x: 0, y: 0 };
    const result = normalizeDirection(1, 0, 5, out);
    expect(result).toBe(out);
    expect(result.x).toBe(5);
    expect(result.y).toBe(0);
  });

  it('handles negative components', () => {
    const out = { x: 0, y: 0 };
    normalizeDirection(-3, -4, 5, out);
    expect(out.x).toBeCloseTo(-3);
    expect(out.y).toBeCloseTo(-4);
  });
});
