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

  // Characterization tests: pin behaviour the grid implementation must preserve.

  it('query returns each matching item exactly once even when it spans many cells', () => {
    const idx = new SpatialIndex<number>();
    // Large entry that spans multiple grid cells (e.g. 200×200 at CELL_SIZE=64 → 3×3 cells).
    idx.insert(1, { x: 0, y: 0, width: 200, height: 200 });
    const hits = idx.query({ x: 0, y: 0, width: 200, height: 200 });
    expect(hits.filter((h) => h === 1).length).toBe(1);
  });

  it('handles entries at negative coordinates', () => {
    const idx = new SpatialIndex<string>();
    idx.insert('neg', { x: -100, y: -100, width: 20, height: 20 });
    const hits = idx.query({ x: -110, y: -110, width: 30, height: 30 });
    expect(hits).toContain('neg');
    expect(hits.length).toBe(1);
  });

  it('handles entries straddling zero', () => {
    const idx = new SpatialIndex<string>();
    idx.insert('straddle', { x: -10, y: -10, width: 20, height: 20 });
    // Query wholly positive — overlaps the positive half of the entry.
    const hits = idx.query({ x: 0, y: 0, width: 5, height: 5 });
    expect(hits).toContain('straddle');
    // Query at positive coords far away — no overlap.
    const miss = idx.query({ x: 20, y: 0, width: 5, height: 5 });
    expect(miss).not.toContain('straddle');
  });

  it('handles entries and queries far from origin (±1e6)', () => {
    const idx = new SpatialIndex<number>();
    idx.insert(1, { x: 1e6, y: 1e6, width: 10, height: 10 });
    idx.insert(2, { x: -1e6, y: -1e6, width: 10, height: 10 });

    const hitsPos = idx.query({ x: 1e6 + 2, y: 1e6 + 2, width: 6, height: 6 });
    expect(hitsPos).toContain(1);
    expect(hitsPos).not.toContain(2);

    const hitsNeg = idx.query({ x: -1e6 - 8, y: -1e6 - 8, width: 10, height: 10 });
    expect(hitsNeg).toContain(2);
    expect(hitsNeg).not.toContain(1);
  });

  // F036 — an infinite bound made the cell-range loop unbounded (`for (cx =
  // cxMin; cx <= cxMax; cx++)` never exits once cxMax is Infinity). A real
  // `Number.POSITIVE_INFINITY` bound hangs the JS thread forever, so it cannot
  // be called directly in a test. Instead, patch the private cell map's `get`
  // with an iteration counter that throws once a query needs an unreasonable
  // number of cell lookups — a bounded, deterministic stand-in for "did not
  // terminate" that fails fast instead of hanging the test run.
  describe('unbounded extents (F036)', () => {
    // No real, in-range query ever needs this many cell lookups.
    const BUDGET = 200_000;

    function withCellLookupBudget<TReturn>(
      idx: SpatialIndex<unknown>,
      fn: () => TReturn,
    ): { result: TReturn; calls: number } {
      const cells = (idx as unknown as { _cells: Map<number, unknown[]> })._cells;
      const realGet = cells.get.bind(cells);
      let calls = 0;
      cells.get = ((key: number) => {
        if (++calls > BUDGET) {
          throw new Error(`cell walk exceeded ${BUDGET} lookups without terminating`);
        }
        return realGet(key);
      }) as typeof cells.get;
      try {
        return { result: fn(), calls };
      } finally {
        cells.get = realGet;
      }
    }

    it('a query with an infinite extent terminates within a bounded cell walk', () => {
      const idx = new SpatialIndex<number>();
      idx.insert(1, { x: 0, y: 0, width: 10, height: 10 });

      const { result, calls } = withCellLookupBudget(idx, () =>
        idx.query({ x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 10 }),
      );

      expect(calls).toBeLessThan(BUDGET);
      expect(result).toContain(1);
    });

    it('inserting an item at an infinite coordinate does not hang or grow a bucket without bound', () => {
      const idx = new SpatialIndex<number>();

      const { calls } = withCellLookupBudget(idx, () => {
        idx.insert(1, { x: Number.POSITIVE_INFINITY, y: 0, width: 10, height: 10 });
        return idx.size;
      });

      expect(calls).toBeLessThan(BUDGET);
      expect(idx.size).toBe(1);
    });

    it('updating an item to an infinite coordinate and back does not hang', () => {
      const idx = new SpatialIndex<number>();
      idx.insert(1, { x: 0, y: 0, width: 10, height: 10 });

      const { calls } = withCellLookupBudget(idx, () => {
        idx.update(1, {
          x: Number.POSITIVE_INFINITY,
          y: Number.POSITIVE_INFINITY,
          width: 10,
          height: 10,
        });
        idx.update(1, { x: 5, y: 5, width: 10, height: 10 });
      });

      expect(calls).toBeLessThan(BUDGET);
      expect(idx.query({ x: 0, y: 0, width: 20, height: 20 })).toContain(1);
    });

    it('a query with a NaN extent still runs zero iterations (unchanged behaviour)', () => {
      const idx = new SpatialIndex<number>();
      idx.insert(1, { x: 0, y: 0, width: 10, height: 10 });

      // dx=0, maxDist=Infinity → 0 * Infinity = NaN, the degenerate-direction
      // case CollisionWorld.raycast's bounding box produces for a vertical ray.
      const hits = idx.query({ x: Number.NaN, y: 0, width: Number.NaN, height: 10 });
      expect(hits).toEqual([]);
    });
  });

  it('touching edge exactly at a cell boundary is non-overlapping', () => {
    const idx = new SpatialIndex<number>();
    // Entry A: [0, 64] — its right edge is exactly at the cell-0/cell-1 boundary.
    idx.insert(1, { x: 0, y: 0, width: 64, height: 10 });
    // Entry B starts exactly at that boundary.
    idx.insert(2, { x: 64, y: 0, width: 10, height: 10 });

    // Query starting at 64 — entry 1 (maxX=64) must NOT be returned (64 > 64 is false).
    const hitsAtBoundary = idx.query({ x: 64, y: 0, width: 10, height: 10 });
    expect(hitsAtBoundary).not.toContain(1);
    expect(hitsAtBoundary).toContain(2);

    // Query ending at 64 — entry 2 (minX=64) must NOT be returned (64 < 64 is false).
    const hitsBeforeBoundary = idx.query({ x: 54, y: 0, width: 10, height: 10 });
    expect(hitsBeforeBoundary).toContain(1);
    expect(hitsBeforeBoundary).not.toContain(2);
  });
});
