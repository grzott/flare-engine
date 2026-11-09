/**
 * A* pathfinding on a Grid. Supports 4-directional and 8-directional movement
 * with weighted costs. Uses a binary min-heap for the open set.
 */

import type { Grid } from './grid.js';
import { isWalkable } from './grid.js';
import { heapPop, heapPush } from './heap.js';
import { acquireScratch, releaseScratch } from './scratch.js';

export interface PathResult {
  /** Grid coordinates from start to end, inclusive. */
  path: { x: number; y: number }[];
  /** Total movement cost. */
  cost: number;
  /** Number of nodes explored. */
  explored: number;
}

export interface PathOptions {
  /** Allow diagonal movement. Default: true. */
  diagonal?: boolean;
  /** Custom heuristic. Default: octile distance (diagonal) or Manhattan (4-dir). */
  heuristic?: (ax: number, ay: number, bx: number, by: number) => number;
  /** Max nodes to explore before giving up. Default: width * height. */
  maxIterations?: number;
}

// ─── Heuristics ──────────────────────────────────────────────────

const SQRT2 = Math.SQRT2;

export function manhattanDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function octileDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx > dy ? dx + (SQRT2 - 1) * dy : dy + (SQRT2 - 1) * dx;
}

export function chebyshevDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function euclideanDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Neighbors (pre-computed offsets) ────────────────────────────

// 4-directional: N, E, S, W
const DIR4_X = [0, 1, 0, -1];
const DIR4_Y = [-1, 0, 1, 0];

// 8-directional: N, NE, E, SE, S, SW, W, NW
const DIR8_X = [0, 1, 1, 1, 0, -1, -1, -1];
const DIR8_Y = [-1, -1, 0, 1, 1, 1, 0, -1];
const DIR8_COST = [1, SQRT2, 1, SQRT2, 1, SQRT2, 1, SQRT2];

// ─── A* ──────────────────────────────────────────────────────────

export function findPath(
  grid: Grid,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  options?: PathOptions,
): PathResult | null {
  const sx = startX | 0;
  const sy = startY | 0;
  const ex = endX | 0;
  const ey = endY | 0;

  // Quick rejects
  if (!isWalkable(grid, sx, sy) || !isWalkable(grid, ex, ey)) return null;
  if (sx === ex && sy === ey) return { path: [{ x: sx, y: sy }], cost: 0, explored: 0 };

  const diagonal = options?.diagonal !== false;
  const maxIter = options?.maxIterations ?? grid.width * grid.height;
  const heuristic = options?.heuristic ?? (diagonal ? octileDistance : manhattanDistance);

  const w = grid.width;
  const startIdx = sy * w + sx;
  const endIdx = ey * w + ex;

  // Per-grid scratch: a cell stamped `openMark` has a valid g / cameFrom for this
  // search, `closedMark` means settled, any lower stamp reads as g = +Infinity.
  const scratch = acquireScratch(grid);
  const { g, cameFrom, stamp, heap } = scratch;
  const openMark = scratch.open;
  const closedMark = openMark + 1;

  stamp[startIdx] = openMark;
  g[startIdx] = 0;
  cameFrom[startIdx] = -1;

  const dirX = diagonal ? DIR8_X : DIR4_X;
  const dirY = diagonal ? DIR8_Y : DIR4_Y;
  const dirCost = diagonal ? DIR8_COST : null;
  const dirCount = dirX.length;

  let explored = 0;

  try {
    heapPush(heap, heuristic(sx, sy, ex, ey), startIdx);

    while (heap.size > 0 && explored < maxIter) {
      const currentIdx = heapPop(heap);
      if (currentIdx === endIdx) {
        return reconstructPath(cameFrom, w, currentIdx, g[currentIdx]!, explored);
      }
      if (stamp[currentIdx] === closedMark) continue;
      stamp[currentIdx] = closedMark;
      explored++;

      const cx = currentIdx % w;
      const cy = (currentIdx / w) | 0;
      const currentG = g[currentIdx]!;

      for (let d = 0; d < dirCount; d++) {
        const nx = cx + dirX[d]!;
        const ny = cy + dirY[d]!;
        if (nx < 0 || ny < 0 || nx >= w || ny >= grid.height) continue;

        const nIdx = ny * w + nx;
        const nStamp = stamp[nIdx]!;
        if (nStamp === closedMark) continue;

        const tileCost = grid.data[nIdx]!;
        if (tileCost === 0) continue;

        // For diagonal movement, check that both cardinal neighbors are walkable (corner-cutting)
        if (diagonal && d & 1) {
          const dx = dirX[d]!;
          const dy = dirY[d]!;
          if (!isWalkable(grid, cx + dx, cy) || !isWalkable(grid, cx, cy + dy)) continue;
        }

        const moveCost = dirCost ? dirCost[d]! * tileCost : tileCost;
        const tentativeG = currentG + moveCost;

        if (nStamp !== openMark || tentativeG < g[nIdx]!) {
          g[nIdx] = tentativeG;
          cameFrom[nIdx] = currentIdx;
          stamp[nIdx] = openMark;
          const f = tentativeG + heuristic(nx, ny, ex, ey);
          heapPush(heap, f, nIdx);
        }
      }
    }

    return null;
  } finally {
    releaseScratch(scratch);
  }
}

function reconstructPath(
  cameFrom: Int32Array,
  w: number,
  endIdx: number,
  cost: number,
  explored: number,
): PathResult {
  const path: { x: number; y: number }[] = [];
  let idx = endIdx;
  while (idx !== -1) {
    path.push({ x: idx % w, y: (idx / w) | 0 });
    idx = cameFrom[idx]!;
  }
  path.reverse();
  return { path, cost, explored };
}
