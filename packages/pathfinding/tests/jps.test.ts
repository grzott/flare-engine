import { describe, expect, test } from 'bun:test';
import { findPath } from '../src/astar.js';
import { createGrid, type Grid, setCost, setWalkable } from '../src/grid.js';
import { findPathJPS } from '../src/jps.js';

describe('findPathJPS', () => {
  test('trivial same-cell path', () => {
    const g = createGrid({ width: 3, height: 3 });
    const result = findPathJPS(g, 1, 1, 1, 1);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual([{ x: 1, y: 1 }]);
    expect(result!.cost).toBe(0);
  });

  test('returns null when start is blocked', () => {
    const g = createGrid({ width: 3, height: 3 });
    setWalkable(g, 0, 0, false);
    expect(findPathJPS(g, 0, 0, 2, 2)).toBeNull();
  });

  test('returns null when end is blocked', () => {
    const g = createGrid({ width: 3, height: 3 });
    setWalkable(g, 2, 2, false);
    expect(findPathJPS(g, 0, 0, 2, 2)).toBeNull();
  });

  test('straight path in open grid', () => {
    const g = createGrid({ width: 5, height: 5 });
    const result = findPathJPS(g, 0, 0, 4, 0);
    expect(result).not.toBeNull();
    expect(result!.path[0]).toEqual({ x: 0, y: 0 });
    expect(result!.path[result!.path.length - 1]).toEqual({ x: 4, y: 0 });
  });

  test('diagonal path', () => {
    const g = createGrid({ width: 5, height: 5 });
    const result = findPathJPS(g, 0, 0, 4, 4);
    expect(result).not.toBeNull();
    expect(result!.path[0]).toEqual({ x: 0, y: 0 });
    expect(result!.path[result!.path.length - 1]).toEqual({ x: 4, y: 4 });
    // All intermediate steps should be diagonal
    for (let i = 1; i < result!.path.length; i++) {
      const dx = Math.abs(result!.path[i]!.x - result!.path[i - 1]!.x);
      const dy = Math.abs(result!.path[i]!.y - result!.path[i - 1]!.y);
      expect(dx).toBeLessThanOrEqual(1);
      expect(dy).toBeLessThanOrEqual(1);
    }
  });

  test('returns null when no path exists', () => {
    const g = createGrid({ width: 5, height: 5 });
    for (let x = 0; x < 5; x++) setWalkable(g, x, 2, false);
    expect(findPathJPS(g, 2, 0, 2, 4)).toBeNull();
  });

  test('navigates around obstacle', () => {
    const g = createGrid({ width: 5, height: 5 });
    for (let x = 0; x < 4; x++) setWalkable(g, x, 2, false);
    const result = findPathJPS(g, 0, 0, 0, 4);
    expect(result).not.toBeNull();
    expect(result!.path[result!.path.length - 1]).toEqual({ x: 0, y: 4 });
  });

  test('JPS finds same-length path as A* on uniform grid', () => {
    const g = createGrid({ width: 10, height: 10 });
    // Create a small maze
    setWalkable(g, 3, 0, false);
    setWalkable(g, 3, 1, false);
    setWalkable(g, 3, 2, false);
    setWalkable(g, 3, 3, false);
    setWalkable(g, 7, 4, false);
    setWalkable(g, 7, 5, false);
    setWalkable(g, 7, 6, false);

    const astarResult = findPath(g, 0, 0, 9, 9);
    const jpsResult = findPathJPS(g, 0, 0, 9, 9);

    expect(astarResult).not.toBeNull();
    expect(jpsResult).not.toBeNull();
    // Both follow the same corner rule, so both find an optimal path of the same cost.
    expect(jpsResult!.cost).toBeCloseTo(astarResult!.cost, 9);
  });

  test('JPS explores fewer nodes than A* on open grid', () => {
    const g = createGrid({ width: 20, height: 20 });
    const astarResult = findPath(g, 0, 0, 19, 19);
    const jpsResult = findPathJPS(g, 0, 0, 19, 19);

    expect(astarResult).not.toBeNull();
    expect(jpsResult).not.toBeNull();
    // JPS should explore significantly fewer nodes on an open grid
    expect(jpsResult!.explored).toBeLessThan(astarResult!.explored);
  });

  test('respects maxIterations', () => {
    const g = createGrid({ width: 50, height: 50 });
    // JPS explores very few nodes on open grids, so use maxIterations=1
    const result = findPathJPS(g, 0, 0, 49, 49, { maxIterations: 1 });
    expect(result).toBeNull();
  });

  test('interpolated path has no gaps', () => {
    const g = createGrid({ width: 10, height: 10 });
    setWalkable(g, 5, 0, false);
    setWalkable(g, 5, 1, false);
    setWalkable(g, 5, 2, false);
    const result = findPathJPS(g, 0, 0, 9, 5);
    expect(result).not.toBeNull();
    // Every consecutive pair should differ by at most 1 in each axis
    for (let i = 1; i < result!.path.length; i++) {
      const dx = Math.abs(result!.path[i]!.x - result!.path[i - 1]!.x);
      const dy = Math.abs(result!.path[i]!.y - result!.path[i - 1]!.y);
      expect(dx).toBeLessThanOrEqual(1);
      expect(dy).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// #507 (was OSS-B18) — one corner rule for both searches: a diagonal step needs
// both of its cardinal neighbours walkable. Before #507, `findPathJPS` stepped
// diagonally past a wall's tip, and switched rules whenever any tile on the grid
// cost more than 1 (it then delegates to `findPath`).
// ---------------------------------------------------------------------------

type Pt = { x: number; y: number };

function walkable(grid: Grid, x: number, y: number): boolean {
  return (
    x >= 0 && y >= 0 && x < grid.width && y < grid.height && grid.data[y * grid.width + x]! > 0
  );
}

/** Every step moves one cell onto a walkable cell, no diagonal squeezes a corner, and the step lengths sum to `cost`. */
function expectLegalPath(grid: Grid, path: readonly Pt[], cost: number, from: Pt, to: Pt): void {
  expect(path[0]).toEqual(from);
  expect(path[path.length - 1]).toEqual(to);
  let sum = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    expect(Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)).toBe(true);
    expect(walkable(grid, b.x, b.y)).toBe(true);
    if (dx !== 0 && dy !== 0) {
      expect(walkable(grid, a.x + dx, a.y) && walkable(grid, a.x, a.y + dy)).toBe(true);
      sum += Math.SQRT2;
    } else {
      sum += 1;
    }
  }
  expect(cost).toBeCloseTo(sum, 9);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('corner cutting — one rule for findPath and findPathJPS (#507)', () => {
  // . X .      start (0,0), goal (1,1); both cardinal neighbours of the
  // X . .      diagonal step are blocked, so the step would squeeze a corner.
  // . . .
  const cornerGrid = () => {
    const data = new Uint8Array(9).fill(1);
    data[1 * 3 + 0] = 0; // (0,1)
    data[0 * 3 + 1] = 0; // (1,0)
    return { width: 3, height: 3, data };
  };

  test('both refuse the corner cut and report no path', () => {
    expect(findPath(cornerGrid(), 0, 0, 1, 1)).toBeNull();
    expect(findPathJPS(cornerGrid(), 0, 0, 1, 1)).toBeNull();
  });

  test('JPS does not step past a single blocked cardinal neighbour', () => {
    // (1,0) is a wall, so the diagonal (0,0) -> (1,1) would pass its corner: the route goes (0,0) -> (0,1) -> (1,1).
    const g = createGrid({ width: 3, height: 3 });
    setWalkable(g, 1, 0, false);
    const jps = findPathJPS(g, 0, 0, 1, 1);
    const astar = findPath(g, 0, 0, 1, 1);
    expect(jps).not.toBeNull();
    expect(astar).not.toBeNull();
    expect(jps!.cost).toBeCloseTo(2, 9);
    expect(jps!.cost).toBeCloseTo(astar!.cost, 9);
    expectLegalPath(g, jps!.path, jps!.cost, { x: 0, y: 0 }, { x: 1, y: 1 });
  });

  test('the issue probe prints one cost for all three calls', () => {
    const grid = createGrid({ width: 16, height: 16 });
    for (let y = 0; y < 12; y++) setWalkable(grid, 8, y, false);
    const astar = findPath(grid, 1, 1, 14, 14);
    const jps = findPathJPS(grid, 1, 1, 14, 14);
    expect(astar).not.toBeNull();
    expect(jps).not.toBeNull();
    expect(jps!.cost).toBeCloseTo(astar!.cost, 9);
    expectLegalPath(grid, jps!.path, jps!.cost, { x: 1, y: 1 }, { x: 14, y: 14 });
    setCost(grid, 0, 15, 2); // one weighted tile, off the route: JPS delegates to findPath
    const delegated = findPathJPS(grid, 1, 1, 14, 14);
    expect(delegated).not.toBeNull();
    expect(delegated!.cost).toBeCloseTo(astar!.cost, 9);
  });

  test('on random uniform grids JPS matches A* cost and never cuts a corner', () => {
    const rnd = mulberry32(507);
    let searches = 0;
    let found = 0;
    for (let n = 0; n < 300; n++) {
      const width = 6 + Math.floor(rnd() * 15);
      const height = 6 + Math.floor(rnd() * 15);
      const density = 0.1 + Math.floor(rnd() * 4) * 0.1;
      const grid = createGrid({ width, height });
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) if (rnd() < density) setWalkable(grid, x, y, false);
      }
      for (let k = 0; k < 4; k++) {
        const from = { x: Math.floor(rnd() * width), y: Math.floor(rnd() * height) };
        const to = { x: Math.floor(rnd() * width), y: Math.floor(rnd() * height) };
        setWalkable(grid, from.x, from.y, true);
        setWalkable(grid, to.x, to.y, true);
        const astar = findPath(grid, from.x, from.y, to.x, to.y);
        const jps = findPathJPS(grid, from.x, from.y, to.x, to.y);
        searches++;
        expect(jps === null).toBe(astar === null);
        if (jps === null || astar === null) continue;
        found++;
        expect(jps.cost).toBeCloseTo(astar.cost, 9);
        expectLegalPath(grid, jps.path, jps.cost, from, to);
      }
    }
    expect(searches).toBe(1200);
    expect(found).toBeGreaterThan(600);
  });
});

// ---------------------------------------------------------------------------
// F039 — JPS is only valid on uniform-cost grids. When any tile costs more
// than 1 the call must delegate to weighted A* (diagonal moves) instead of
// walking straight through the expensive tile and reporting a cost-1 total.
// ---------------------------------------------------------------------------

describe('weighted grids — delegation to A* (F039)', () => {
  test('detours around an expensive tile and reports the detour cost', () => {
    const g = createGrid({ width: 5, height: 5 });
    setCost(g, 2, 2, 100);
    const result = findPathJPS(g, 0, 2, 4, 2);
    expect(result).not.toBeNull();
    for (const p of result!.path) {
      expect(p.x === 2 && p.y === 2).toBe(false);
    }
    // (0,2) → (1,2) → (2,3) → (3,2) → (4,2): two straight + two diagonal steps.
    expect(result!.cost).toBeCloseTo(2 + 2 * Math.SQRT2, 6);
    const astar = findPath(g, 0, 2, 4, 2, { diagonal: true });
    expect(astar).not.toBeNull();
    expect(result!.cost).toBeCloseTo(astar!.cost, 9);
    expect(result!.path).toEqual(astar!.path);
  });

  test('forwards maxIterations to the delegate', () => {
    const g = createGrid({ width: 5, height: 5 });
    setCost(g, 2, 2, 100);
    expect(findPathJPS(g, 0, 2, 4, 2, { maxIterations: 25 })).not.toBeNull();
    expect(findPathJPS(g, 0, 2, 4, 2, { maxIterations: 1 })).toBeNull();
  });
});
