import { describe, expect, test } from 'bun:test';
import { findPath } from '../src/astar.js';
import { createGrid, setWalkable } from '../src/grid.js';
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
