import { describe, expect, test } from 'bun:test';
import type { PathResult } from '../src/astar.js';
import { findPath, octileDistance } from '../src/astar.js';
import type { Grid } from '../src/grid.js';
import { createGrid, setCost, setWalkable } from '../src/grid.js';
import { findPathJPS } from '../src/jps.js';

/**
 * #122 — `findPath` / `findPathJPS` keep their search scratch (g scores,
 * came-from links, generation stamps, open-set heap) per `Grid` object and reuse
 * it on every later search of that grid. A repeat search must construct no
 * typed array; results must not depend on whether the scratch is fresh or reused.
 */

const N = 64;

/** Endpoints the tests below search between; they and their cardinal neighbours stay open. */
const ENDPOINTS: readonly [number, number][] = [
  [0, 0],
  [N - 1, N - 1],
  [1, 2],
  [N - 4, N - 3],
  [5, 7],
  [N - 9, N - 2],
];
const CROSS: readonly [number, number][] = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// A plain multiplicative hash lines up into diagonal walls on a 64-wide grid; this mixer scatters.
function mix(i: number): number {
  let h = Math.imul(i ^ (i >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 64x64, ~20% blocked, deterministic. */
function hashedGrid(): Grid {
  const data = new Uint8Array(N * N).fill(1);
  for (let i = 0; i < data.length; i++) if (mix(i) % 5 === 0) data[i] = 0;
  for (const [x, y] of ENDPOINTS) {
    for (const [dx, dy] of CROSS) {
      const px = x + dx;
      const py = y + dy;
      if (px >= 0 && py >= 0 && px < N && py < N) data[py * N + px] = 1;
    }
  }
  return createGrid({ width: N, height: N, data });
}

/** A fresh `Grid` object over a copy of the current cell data — never seen by the scratch cache. */
function freshCopy(grid: Grid): Grid {
  return createGrid({ width: grid.width, height: grid.height, data: grid.data.slice() });
}

type TypedArrayName = 'Float64Array' | 'Int32Array' | 'Uint8Array' | 'Uint32Array';
const TYPED_ARRAYS: readonly TypedArrayName[] = [
  'Float64Array',
  'Int32Array',
  'Uint8Array',
  'Uint32Array',
];

function trapConstructor<K extends TypedArrayName>(name: K, onConstruct: () => void): () => void {
  const original = globalThis[name];
  globalThis[name] = new Proxy(original, {
    construct(target, args, newTarget) {
      onConstruct();
      return Reflect.construct(target, args, newTarget);
    },
  });
  return () => {
    globalThis[name] = original;
  };
}

/** Runs `fn` and returns how many typed arrays it constructed through the global constructors. */
function countTypedArrayConstructions(fn: () => void): number {
  let count = 0;
  const restore = TYPED_ARRAYS.map((name) => trapConstructor(name, () => count++));
  try {
    fn();
  } finally {
    for (const r of restore) r();
  }
  return count;
}

/** 32 of the 50 pairs below route on the fixture; the rest return null on both grids alike. */
function hashPair(k: number): [number, number, number, number] {
  const h = mix(1000 + k);
  return [h & 63, (h >>> 6) & 63, (h >>> 12) & 63, (h >>> 18) & 63];
}

describe('search scratch reuse per Grid (#122)', () => {
  test('a repeat findPath on the same grid constructs no typed array', () => {
    const grid = hashedGrid();
    expect(findPath(grid, 0, 0, N - 1, N - 1)).not.toBeNull();

    const repeat = countTypedArrayConstructions(() => {
      expect(findPath(grid, 1, 2, N - 4, N - 3)).not.toBeNull();
    });
    expect(repeat).toBe(0);

    // Not vacuous: a never-seen grid object inside the same trap window does construct.
    const fresh = countTypedArrayConstructions(() => {
      expect(findPath(freshCopy(grid), 1, 2, N - 4, N - 3)).not.toBeNull();
    });
    expect(fresh).toBeGreaterThan(0);
  });

  test('a repeat findPathJPS on the same grid constructs no typed array', () => {
    const grid = hashedGrid();
    expect(findPathJPS(grid, 0, 0, N - 1, N - 1)).not.toBeNull();

    const repeat = countTypedArrayConstructions(() => {
      expect(findPathJPS(grid, 1, 2, N - 4, N - 3)).not.toBeNull();
    });
    expect(repeat).toBe(0);

    const fresh = countTypedArrayConstructions(() => {
      expect(findPathJPS(freshCopy(grid), 1, 2, N - 4, N - 3)).not.toBeNull();
    });
    expect(fresh).toBeGreaterThan(0);
  });

  test('reused scratch gives results identical to a fresh grid, across edits and weighting', () => {
    const grid = hashedGrid();
    const pairs = 50;
    for (let k = 0; k < pairs; k++) {
      if (k === pairs / 2) {
        setWalkable(grid, 10, 10, false);
        setWalkable(grid, 11, 10, false);
        setWalkable(grid, 30, 31, true);
        // Any cost above 1 makes findPathJPS delegate to weighted A* on the same scratch.
        setCost(grid, 20, 20, 3);
      }
      if (k === pairs / 2 + 10) setCost(grid, 20, 20, 1);

      const [sx, sy, ex, ey] = hashPair(k);
      expect(findPath(grid, sx, sy, ex, ey, { diagonal: true })).toEqual(
        findPath(freshCopy(grid), sx, sy, ex, ey, { diagonal: true }),
      );
      expect(findPath(grid, sx, sy, ex, ey, { diagonal: false })).toEqual(
        findPath(freshCopy(grid), sx, sy, ex, ey, { diagonal: false }),
      );
      expect(findPathJPS(grid, sx, sy, ex, ey)).toEqual(
        findPathJPS(freshCopy(grid), sx, sy, ex, ey),
      );
    }
  });

  test('a heuristic that re-enters findPath on the same grid leaves both searches correct', () => {
    const grid = hashedGrid();
    let inner: PathResult | null | undefined;
    const heuristic = (ax: number, ay: number, bx: number, by: number): number => {
      if (inner === undefined) inner = findPath(grid, 5, 7, N - 9, N - 2);
      return octileDistance(ax, ay, bx, by);
    };
    const outer = findPath(grid, 0, 0, N - 1, N - 1, { heuristic });
    expect(inner).toBeDefined();
    expect(inner).toEqual(findPath(freshCopy(grid), 5, 7, N - 9, N - 2));
    expect(outer).toEqual(findPath(freshCopy(grid), 0, 0, N - 1, N - 1));
  });

  test('a heuristic that re-enters findPathJPS on the same grid leaves both searches correct', () => {
    const grid = hashedGrid();
    let inner: PathResult | null | undefined;
    const heuristic = (ax: number, ay: number, bx: number, by: number): number => {
      if (inner === undefined) inner = findPathJPS(grid, 5, 7, N - 9, N - 2);
      return octileDistance(ax, ay, bx, by);
    };
    const outer = findPathJPS(grid, 0, 0, N - 1, N - 1, { heuristic });
    expect(inner).toBeDefined();
    expect(inner).toEqual(findPathJPS(freshCopy(grid), 5, 7, N - 9, N - 2));
    expect(outer).toEqual(findPathJPS(freshCopy(grid), 0, 0, N - 1, N - 1));
  });

  test('a throwing heuristic does not lock the scratch', () => {
    const grid = hashedGrid();
    const boom = (): number => {
      throw new Error('boom');
    };
    expect(() => findPath(grid, 0, 0, N - 1, N - 1, { heuristic: boom })).toThrow('boom');
    expect(() => findPathJPS(grid, 0, 0, N - 1, N - 1, { heuristic: boom })).toThrow('boom');

    expect(findPath(grid, 0, 0, N - 1, N - 1)).not.toBeNull();
    const astar = countTypedArrayConstructions(() => {
      expect(findPath(grid, 1, 2, N - 4, N - 3)).not.toBeNull();
    });
    expect(astar).toBe(0);

    expect(findPathJPS(grid, 0, 0, N - 1, N - 1)).not.toBeNull();
    const jps = countTypedArrayConstructions(() => {
      expect(findPathJPS(grid, 1, 2, N - 4, N - 3)).not.toBeNull();
    });
    expect(jps).toBe(0);
  });
});
