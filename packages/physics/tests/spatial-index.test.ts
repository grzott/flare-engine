import { describe, expect, it } from 'bun:test';
import { SpatialIndex } from '../src/spatial-index.js';

describe('SpatialIndex', () => {
  it('starts empty', () => {
    const idx = new SpatialIndex<number>();
    expect(idx.size).toBe(0);
  });

  it('inserts and queries items', () => {
    const idx = new SpatialIndex<string>();
    idx.insert('a', { x: 0, y: 0, width: 10, height: 10 });
    idx.insert('b', { x: 20, y: 20, width: 10, height: 10 });

    const hits = idx.query({ x: 5, y: 5, width: 10, height: 10 });
    expect(hits).toContain('a');
    expect(hits).not.toContain('b');
  });

  it('returns all overlapping items', () => {
    const idx = new SpatialIndex<number>();
    idx.insert(1, { x: 0, y: 0, width: 10, height: 10 });
    idx.insert(2, { x: 5, y: 5, width: 10, height: 10 });
    idx.insert(3, { x: 100, y: 100, width: 10, height: 10 });

    const hits = idx.query({ x: 0, y: 0, width: 20, height: 20 });
    expect(hits).toContain(1);
    expect(hits).toContain(2);
    expect(hits).not.toContain(3);
  });

  it('removes items', () => {
    const idx = new SpatialIndex<string>();
    idx.insert('a', { x: 0, y: 0, width: 10, height: 10 });
    idx.insert('b', { x: 5, y: 5, width: 10, height: 10 });

    expect(idx.remove('a')).toBe(true);
    expect(idx.size).toBe(1);
    expect(idx.query({ x: 0, y: 0, width: 20, height: 20 })).toEqual(['b']);
  });

  it('returns false when removing non-existent item', () => {
    const idx = new SpatialIndex<number>();
    expect(idx.remove(42)).toBe(false);
  });

  it('updates item bounds', () => {
    const idx = new SpatialIndex<string>();
    idx.insert('a', { x: 0, y: 0, width: 10, height: 10 });

    // Before update — overlaps near origin
    expect(idx.query({ x: 0, y: 0, width: 5, height: 5 })).toContain('a');

    // Move far away
    idx.update('a', { x: 100, y: 100, width: 10, height: 10 });
    expect(idx.query({ x: 0, y: 0, width: 5, height: 5 })).toEqual([]);
    expect(idx.query({ x: 100, y: 100, width: 5, height: 5 })).toContain('a');
  });

  it('clears all items', () => {
    const idx = new SpatialIndex<number>();
    idx.insert(1, { x: 0, y: 0, width: 10, height: 10 });
    idx.insert(2, { x: 5, y: 5, width: 10, height: 10 });
    idx.clear();
    expect(idx.size).toBe(0);
    expect(idx.query({ x: 0, y: 0, width: 100, height: 100 })).toEqual([]);
  });

  it('appends to provided result array', () => {
    const idx = new SpatialIndex<number>();
    idx.insert(1, { x: 0, y: 0, width: 10, height: 10 });
    const existing = [99];
    const result = idx.query({ x: 0, y: 0, width: 5, height: 5 }, existing);
    expect(result).toBe(existing);
    expect(result).toEqual([99, 1]);
  });

  it('handles non-overlapping query', () => {
    const idx = new SpatialIndex<number>();
    idx.insert(1, { x: 0, y: 0, width: 10, height: 10 });
    expect(idx.query({ x: 50, y: 50, width: 5, height: 5 })).toEqual([]);
  });

  it('handles touching edges (non-overlapping)', () => {
    const idx = new SpatialIndex<number>();
    idx.insert(1, { x: 0, y: 0, width: 10, height: 10 });
    // Query starts right at the edge of the item
    expect(idx.query({ x: 10, y: 0, width: 5, height: 5 })).toEqual([]);
  });
});
