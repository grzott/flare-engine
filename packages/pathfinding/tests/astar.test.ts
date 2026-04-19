import { describe, expect, test } from 'bun:test';
import {
  chebyshevDistance,
  euclideanDistance,
  findPath,
  manhattanDistance,
  octileDistance,
} from '../src/astar.js';
import { createGrid, setCost, setWalkable } from '../src/grid.js';

// ─── Heuristics ──────────────────────────────────────────────────

describe('heuristics', () => {
  test('manhattan distance', () => {
    expect(manhattanDistance(0, 0, 3, 4)).toBe(7);
    expect(manhattanDistance(1, 1, 1, 1)).toBe(0);
  });

  test('octile distance', () => {
    expect(octileDistance(0, 0, 1, 1)).toBeCloseTo(Math.SQRT2, 10);
    expect(octileDistance(0, 0, 3, 0)).toBe(3);
  });

  test('chebyshev distance', () => {
    expect(chebyshevDistance(0, 0, 3, 4)).toBe(4);
    expect(chebyshevDistance(0, 0, 5, 2)).toBe(5);
  });

  test('euclidean distance', () => {
    expect(euclideanDistance(0, 0, 3, 4)).toBe(5);
  });
});

// ─── findPath ────────────────────────────────────────────────────

describe('findPath', () => {
  test('trivial same-cell path', () => {
    const g = createGrid({ width: 3, height: 3 });
    const result = findPath(g, 1, 1, 1, 1);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual([{ x: 1, y: 1 }]);
    expect(result!.cost).toBe(0);
  });

  test('straight horizontal path (4-dir)', () => {
    const g = createGrid({ width: 5, height: 1 });
    const result = findPath(g, 0, 0, 4, 0, { diagonal: false });
    expect(result).not.toBeNull();
    expect(result!.path.length).toBe(5);
    expect(result!.path[0]).toEqual({ x: 0, y: 0 });
    expect(result!.path[4]).toEqual({ x: 4, y: 0 });
    expect(result!.cost).toBe(4);
  });

  test('diagonal path', () => {
    const g = createGrid({ width: 3, height: 3 });
    const result = findPath(g, 0, 0, 2, 2, { diagonal: true });
    expect(result).not.toBeNull();
    expect(result!.path[0]).toEqual({ x: 0, y: 0 });
    expect(result!.path[result!.path.length - 1]).toEqual({ x: 2, y: 2 });
    // Diagonal path should be shorter than 5 steps (Manhattan would be 4)
    expect(result!.path.length).toBeLessThanOrEqual(3);
  });

  test('returns null when start is blocked', () => {
    const g = createGrid({ width: 3, height: 3 });
    setWalkable(g, 0, 0, false);
    expect(findPath(g, 0, 0, 2, 2)).toBeNull();
  });

  test('returns null when end is blocked', () => {
    const g = createGrid({ width: 3, height: 3 });
    setWalkable(g, 2, 2, false);
    expect(findPath(g, 0, 0, 2, 2)).toBeNull();
  });

  test('returns null when no path exists', () => {
    // Wall across the middle
    const g = createGrid({ width: 5, height: 5 });
    for (let x = 0; x < 5; x++) setWalkable(g, x, 2, false);
    expect(findPath(g, 2, 0, 2, 4)).toBeNull();
  });

  test('navigates around a wall', () => {
    // 5x5 grid, wall at row 2 except (4,2)
    const g = createGrid({ width: 5, height: 5 });
    for (let x = 0; x < 4; x++) setWalkable(g, x, 2, false);
    const result = findPath(g, 0, 0, 0, 4, { diagonal: true });
    expect(result).not.toBeNull();
    expect(result!.path[result!.path.length - 1]).toEqual({ x: 0, y: 4 });
  });

  test('weighted costs affect path choice', () => {
    // 3x1 grid with expensive middle
    const g = createGrid({ width: 3, height: 3 });
    setCost(g, 1, 1, 100);
    const result = findPath(g, 0, 0, 2, 2, { diagonal: true });
    expect(result).not.toBeNull();
    // Path should avoid the expensive center
    const goesThrough11 = result!.path.some((p) => p.x === 1 && p.y === 1);
    expect(goesThrough11).toBe(false);
  });

  test('respects maxIterations', () => {
    const g = createGrid({ width: 100, height: 100 });
    const result = findPath(g, 0, 0, 99, 99, { maxIterations: 5 });
    expect(result).toBeNull();
  });

  test('4-directional prevents diagonal movement', () => {
    const g = createGrid({ width: 3, height: 3 });
    const result = findPath(g, 0, 0, 2, 2, { diagonal: false });
    expect(result).not.toBeNull();
    // Every step should differ by exactly 1 in either x or y, not both
    for (let i = 1; i < result!.path.length; i++) {
      const dx = Math.abs(result!.path[i]!.x - result!.path[i - 1]!.x);
      const dy = Math.abs(result!.path[i]!.y - result!.path[i - 1]!.y);
      expect(dx + dy).toBe(1);
    }
    expect(result!.cost).toBe(4);
  });

  test('no corner-cutting through walls', () => {
    // 3x3 grid with walls at (1,0) and (0,1) — diagonal from (0,0) to (1,1) should be blocked
    const g = createGrid({ width: 3, height: 3 });
    setWalkable(g, 1, 0, false);
    setWalkable(g, 0, 1, false);
    const result = findPath(g, 0, 0, 1, 1, { diagonal: true });
    // Should be null because both cardinal directions from (0,0) are blocked
    expect(result).toBeNull();
  });

  test('custom heuristic', () => {
    const g = createGrid({ width: 5, height: 5 });
    let heuristicCalled = false;
    const result = findPath(g, 0, 0, 4, 4, {
      heuristic: (ax, ay, bx, by) => {
        heuristicCalled = true;
        return Math.abs(ax - bx) + Math.abs(ay - by);
      },
    });
    expect(heuristicCalled).toBe(true);
    expect(result).not.toBeNull();
  });

  test('large grid path exists', () => {
    const g = createGrid({ width: 50, height: 50 });
    const result = findPath(g, 0, 0, 49, 49);
    expect(result).not.toBeNull();
    expect(result!.path[0]).toEqual({ x: 0, y: 0 });
    expect(result!.path[result!.path.length - 1]).toEqual({ x: 49, y: 49 });
  });
});
