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

  it('inserting an item already in the index replaces its bounds', () => {
    const idx = new SpatialIndex<string>();
    const first = { x: 0, y: 0, width: 10, height: 10 };
    const second = { x: 500, y: 500, width: 10, height: 10 };
    idx.insert('a', first);
    idx.insert('a', second);

    expect(idx.size).toBe(1);
    expect(idx.query(first)).toEqual([]);
    expect(idx.query(second)).toEqual(['a']);

    expect(idx.remove('a')).toBe(true);
    expect(idx.size).toBe(0);
    expect(idx.query(first)).toEqual([]);
    expect(idx.query(second)).toEqual([]);
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

describe('SpatialIndex update and bucket bookkeeping (#579)', () => {
  type Box = { x: number; y: number; width: number; height: number };

  function overlaps(a: Box, b: Box): boolean {
    return (
      a.x + a.width > b.x && a.x < b.x + b.width && a.y + a.height > b.y && a.y < b.y + b.height
    );
  }

  // mulberry32 — a seeded stream, so a failure reproduces.
  function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function countCellLookups(idx: SpatialIndex<number>, fn: () => void): number {
    const cells = (idx as unknown as { _cells: Map<number, unknown[]> })._cells;
    const realGet = cells.get.bind(cells);
    let calls = 0;
    cells.get = ((key: number) => {
      calls++;
      return realGet(key);
    }) as typeof cells.get;
    try {
      fn();
    } finally {
      cells.get = realGet;
    }
    return calls;
  }

  it('an update inside the same cells refreshes the bounds queries test against', () => {
    const idx = new SpatialIndex<number>();
    idx.insert(1, { x: 2, y: 2, width: 8, height: 8 });
    idx.insert(2, { x: 40, y: 40, width: 8, height: 8 });

    // Both rects sit in cell (0, 0); the move never leaves it.
    idx.update(1, { x: 30, y: 30, width: 8, height: 8 });

    expect(idx.query({ x: 0, y: 0, width: 12, height: 12 })).toEqual([]);
    expect(idx.query({ x: 28, y: 28, width: 4, height: 4 })).toEqual([1]);
    expect(idx.query({ x: 0, y: 0, width: 64, height: 64 }).sort()).toEqual([1, 2]);
    expect(idx.size).toBe(2);
  });

  it('an update inside the same cells does not touch the buckets', () => {
    const idx = new SpatialIndex<number>();
    // Spans cells (0..1, 0..1).
    idx.insert(1, { x: 50, y: 50, width: 30, height: 30 });

    const same = countCellLookups(idx, () => {
      idx.update(1, { x: 40, y: 45, width: 60, height: 50 });
    });
    expect(same).toBe(0);

    const crossing = countCellLookups(idx, () => {
      idx.update(1, { x: 70, y: 70, width: 10, height: 10 });
    });
    expect(crossing).toBeGreaterThan(0);
    expect(idx.query({ x: 0, y: 0, width: 64, height: 64 })).toEqual([]);
    expect(idx.query({ x: 64, y: 64, width: 64, height: 64 })).toEqual([1]);
  });

  it('an update that crosses cells leaves the old cells and enters the new ones', () => {
    const idx = new SpatialIndex<number>();
    idx.insert(1, { x: 10, y: 10, width: 10, height: 10 });
    idx.insert(2, { x: 20, y: 20, width: 10, height: 10 });

    idx.update(1, { x: 200, y: -200, width: 10, height: 10 });
    expect(idx.query({ x: 0, y: 0, width: 64, height: 64 })).toEqual([2]);
    expect(idx.query({ x: 190, y: -210, width: 30, height: 30 })).toEqual([1]);

    // Grow across a 3x3 block of cells, then shrink back into one of them.
    idx.update(1, { x: -10, y: -10, width: 140, height: 140 });
    expect(idx.query({ x: 100, y: 100, width: 5, height: 5 })).toEqual([1]);
    expect(idx.query({ x: -5, y: 100, width: 2, height: 2 })).toEqual([1]);
    idx.update(1, { x: 70, y: 70, width: 5, height: 5 });
    expect(idx.query({ x: 100, y: 100, width: 5, height: 5 })).toEqual([]);
    expect(idx.query({ x: -5, y: 100, width: 2, height: 2 })).toEqual([]);
    expect(idx.query({ x: 64, y: 64, width: 64, height: 64 })).toEqual([1]);
  });

  it('a crowded bucket stays consistent through removals and moves out of it', () => {
    const idx = new SpatialIndex<number>();
    const N = 200;
    for (let i = 0; i < N; i++) {
      idx.insert(i, { x: (i % 20) * 3, y: Math.floor(i / 20) * 6, width: 2, height: 2 });
    }
    const cell = { x: 0, y: 0, width: 64, height: 64 };
    expect(idx.query(cell).length).toBe(N);

    // Remove from the front, the middle and the back of the bucket.
    const removed = new Set([0, 1, 97, 98, 99, 198, 199]);
    for (const id of removed) expect(idx.remove(id)).toBe(true);
    // Move every third survivor into the next cell over.
    const moved = new Set<number>();
    for (let i = 0; i < N; i += 3) {
      if (removed.has(i)) continue;
      idx.update(i, { x: 70 + (i % 20), y: 5, width: 2, height: 2 });
      moved.add(i);
    }

    const expectedHere: number[] = [];
    for (let i = 0; i < N; i++) if (!removed.has(i) && !moved.has(i)) expectedHere.push(i);
    expect(idx.query(cell).sort((a, b) => a - b)).toEqual(expectedHere);
    expect(idx.query({ x: 64, y: 0, width: 64, height: 64 }).sort((a, b) => a - b)).toEqual(
      [...moved].sort((a, b) => a - b),
    );
    expect(idx.size).toBe(N - removed.size);

    // Every survivor can still be removed exactly once.
    for (let i = 0; i < N; i++) expect(idx.remove(i)).toBe(!removed.has(i));
    expect(idx.size).toBe(0);
    expect(idx.query({ x: -1000, y: -1000, width: 2000, height: 2000 })).toEqual([]);
  });

  it('matches a brute-force overlap check across random inserts, updates and removals', () => {
    const next = rng(0x5ca1ab1e);
    const idx = new SpatialIndex<number>();
    const model = new Map<number, Box>();
    const IDS = 120;

    const randomBox = (): Box => {
      // Mostly small boxes, some spanning several cells, around the origin so
      // negative cells and the zero boundary are exercised.
      const big = next() < 0.15;
      return {
        x: next() * 600 - 300,
        y: next() * 600 - 300,
        width: big ? next() * 250 : next() * 20,
        height: big ? next() * 250 : next() * 20,
      };
    };

    for (let op = 0; op < 6000; op++) {
      const id = Math.floor(next() * IDS);
      const roll = next();
      if (roll < 0.25) {
        const box = randomBox();
        idx.insert(id, box);
        model.set(id, box);
      } else if (roll < 0.7) {
        const prev = model.get(id);
        // Half the updates are small nudges that mostly stay in the same cells.
        const box =
          prev !== undefined && next() < 0.5
            ? { ...prev, x: prev.x + next() * 6 - 3, y: prev.y + next() * 6 - 3 }
            : randomBox();
        idx.update(id, box);
        if (prev !== undefined) model.set(id, box);
      } else if (roll < 0.85) {
        expect(idx.remove(id)).toBe(model.delete(id));
      }

      if (op % 7 === 0) {
        const q = randomBox();
        const got = idx.query(q).sort((a, b) => a - b);
        const want: number[] = [];
        for (const [k, box] of model) if (overlaps(box, q)) want.push(k);
        expect(got).toEqual(want.sort((a, b) => a - b));
      }
      expect(idx.size).toBe(model.size);
    }

    const everything = idx.query({ x: -1000, y: -1000, width: 2000, height: 2000 });
    expect(everything.sort((a, b) => a - b)).toEqual([...model.keys()].sort((a, b) => a - b));
  });

  it('non-finite updates terminate and the item is found again once finite', () => {
    const idx = new SpatialIndex<number>();
    idx.insert(1, { x: 5, y: 5, width: 10, height: 10 });
    idx.insert(2, { x: 6, y: 6, width: 10, height: 10 });
    const near = { x: 0, y: 0, width: 20, height: 20 };

    idx.update(1, { x: Number.NaN, y: 5, width: 10, height: 10 });
    expect(idx.query(near)).toEqual([2]);
    // A second NaN update must not unlink what the first one never linked.
    idx.update(1, { x: Number.NaN, y: Number.NaN, width: 10, height: 10 });
    expect(idx.query(near)).toEqual([2]);
    idx.update(1, { x: 5, y: 5, width: 10, height: 10 });
    expect(idx.query(near).sort()).toEqual([1, 2]);

    idx.update(1, { x: Number.NEGATIVE_INFINITY, y: 5, width: 10, height: 10 });
    idx.update(1, { x: Number.NEGATIVE_INFINITY, y: 6, width: 10, height: 10 });
    expect(idx.query(near)).toEqual([2]);
    idx.update(1, { x: 5, y: 5, width: 10, height: 10 });
    expect(idx.query(near).sort()).toEqual([1, 2]);

    expect(idx.remove(1)).toBe(true);
    expect(idx.remove(2)).toBe(true);
    expect(idx.query(near)).toEqual([]);
  });

  it('clear drops every item and the index is usable again', () => {
    const idx = new SpatialIndex<number>();
    for (let i = 0; i < 10; i++) idx.insert(i, { x: i, y: i, width: 100, height: 100 });
    idx.clear();
    expect(idx.size).toBe(0);
    idx.insert(3, { x: 0, y: 0, width: 10, height: 10 });
    idx.update(3, { x: 2, y: 2, width: 10, height: 10 });
    expect(idx.query({ x: 0, y: 0, width: 200, height: 200 })).toEqual([3]);
  });
});
