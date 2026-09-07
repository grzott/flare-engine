import { describe, expect, test } from 'bun:test';
import { findPath } from '../src/astar.js';
import { createGrid, setCost, setWalkable } from '../src/grid.js';
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
    // JPS permits corner-cutting through walls (classic JPS behavior); A* blocks it.
    // JPS's path may therefore be shorter, but never longer than A*'s.
    expect(jpsResult!.cost).toBeLessThanOrEqual(astarResult!.cost + 1e-6);
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
// OSS-B18 — A* and JPS disagree about corner cutting, and the divergence is
// pinned here rather than left to prose: `findPath` refuses a diagonal whose
// two shared cardinal neighbours are both blocked, `findPathJPS` allows it.
// Swapping one for the other to gain speed silently changes movement rules.
// This test documents current behaviour; it is NOT an endorsement of either
// rule, and the JPS corner rules are deliberately not rewritten here.
// ---------------------------------------------------------------------------

describe('corner cutting — A* vs JPS divergence (B18)', () => {
  // . X .      start (0,0), goal (1,1); both cardinal neighbours of the
  // X . .      diagonal step are blocked, so the step squeezes a corner.
  // . . .
  const cornerGrid = () => {
    const data = new Uint8Array(9).fill(1);
    data[1 * 3 + 0] = 0; // (0,1)
    data[0 * 3 + 1] = 0; // (1,0)
    return { width: 3, height: 3, data };
  };

  test('A* refuses the corner cut and reports no path', () => {
    expect(findPath(cornerGrid(), 0, 0, 1, 1)).toBeNull();
  });

  test('JPS permits the corner cut and returns the diagonal', () => {
    const result = findPathJPS(cornerGrid(), 0, 0, 1, 1);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
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
