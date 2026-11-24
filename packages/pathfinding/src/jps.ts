/**
 * Jump Point Search — an optimization over A* for uniform-cost grids.
 * JPS pruning is only correct when every walkable tile costs 1, so a grid with
 * any tile cost above 1 is delegated to weighted A* (`findPath`, diagonal moves)
 * after one linear scan of `grid.data`.
 *
 * JPS prunes symmetric paths by "jumping" along directions until hitting
 * a wall, the goal, or a forced neighbor. It follows `findPath`'s corner rule
 * (no diagonal step past a wall's corner), using JPS's no-corner-cutting variant.
 */

import type { PathResult } from './astar.js';
import { findPath, octileDistance } from './astar.js';
import type { Grid } from './grid.js';
import { isWalkable } from './grid.js';
import { heapPop, heapPush } from './heap.js';
import { acquireScratch, releaseScratch } from './scratch.js';

// ─── JPS ─────────────────────────────────────────────────────────

const SQRT2 = Math.SQRT2;

// One pass per call, never per node: JPS pruning assumes every walkable tile costs 1.
function hasWeightedCost(grid: Grid): boolean {
  const data = grid.data;
  for (let i = 0; i < data.length; i++) {
    if (data[i]! > 1) return true;
  }
  return false;
}

export interface JpsOptions {
  /** Max nodes to explore before giving up. Default: width * height. */
  maxIterations?: number;
  /** Custom heuristic. Default: octile distance. */
  heuristic?: (ax: number, ay: number, bx: number, by: number) => number;
}

/**
 * Jump Point Search between two cells, 8-directional. Same corner rule as
 * `findPath`: a diagonal step is taken only when both cardinal neighbours it
 * passes are walkable, so a path never squeezes past a wall's corner. On a
 * uniform-cost grid it returns a path of the same cost as `findPath`, exploring
 * fewer nodes; a grid with any tile cost above 1 is delegated to `findPath`.
 */
export function findPathJPS(
  grid: Grid,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  options?: JpsOptions,
): PathResult | null {
  const sx = startX | 0;
  const sy = startY | 0;
  const ex = endX | 0;
  const ey = endY | 0;

  if (!isWalkable(grid, sx, sy) || !isWalkable(grid, ex, ey)) return null;
  if (sx === ex && sy === ey) return { path: [{ x: sx, y: sy }], cost: 0, explored: 0 };
  if (hasWeightedCost(grid)) {
    return findPath(grid, sx, sy, ex, ey, { ...options, diagonal: true });
  }

  const w = grid.width;
  const h = grid.height;
  const maxIter = options?.maxIterations ?? w * h;
  const heuristic = options?.heuristic ?? octileDistance;

  const startIdx = sy * w + sx;
  const endIdx = ey * w + ex;

  // Per-grid scratch: a cell stamped `openMark` has a valid g / cameFrom for this
  // search, `closedMark` means settled, any lower stamp reads as g = +Infinity.
  const scratch = acquireScratch(grid);
  const { g, cameFrom, stamp, heap, succ } = scratch;
  const openMark = scratch.open;
  const closedMark = openMark + 1;

  stamp[startIdx] = openMark;
  g[startIdx] = 0;
  cameFrom[startIdx] = -1;

  let explored = 0;

  try {
    heapPush(heap, heuristic(sx, sy, ex, ey), startIdx);

    while (heap.size > 0 && explored < maxIter) {
      const currentIdx = heapPop(heap);
      if (currentIdx === endIdx) {
        return buildPath(cameFrom, w, currentIdx, g[currentIdx]!, explored);
      }
      if (stamp[currentIdx] === closedMark) continue;
      stamp[currentIdx] = closedMark;
      explored++;

      const cx = currentIdx % w;
      const cy = (currentIdx / w) | 0;

      const count = identifySuccessors(grid, cx, cy, cameFrom, w, h, ex, ey, succ);
      for (let i = 0; i < count; i++) {
        const nIdx = succ[i]!;
        const nx = nIdx % w;
        const ny = (nIdx / w) | 0;
        const nStamp = stamp[nIdx]!;
        if (nStamp === closedMark) continue;

        const dx = Math.abs(nx - cx);
        const dy = Math.abs(ny - cy);
        const diag = Math.min(dx, dy);
        const straight = Math.abs(dx - dy);
        const dist = diag * SQRT2 + straight;
        const tentativeG = g[currentIdx]! + dist;
        if (nStamp !== openMark || tentativeG < g[nIdx]!) {
          g[nIdx] = tentativeG;
          cameFrom[nIdx] = currentIdx;
          stamp[nIdx] = openMark;
          heapPush(heap, tentativeG + heuristic(nx, ny, ex, ey), nIdx);
        }
      }
    }

    return null;
  } finally {
    releaseScratch(scratch);
  }
}

/**
 * Writes the cell index of each jump point reachable from (cx, cy) into `out`
 * and returns how many. At most one per direction tried — 8 from the start
 * node, 3 after a diagonal move, 5 after a cardinal one — so `out` needs 8 slots.
 *
 * The pruning rules are JPS's no-corner-cutting variant (Harabor and Grastien,
 * 2014): a diagonal neighbour is tried only when both of its cardinal neighbours
 * are walkable, a diagonal move has no forced neighbours, and after a cardinal
 * move the forced neighbours are the sides that opened up beside this cell
 * (blocked beside the previous one), each with the diagonal towards it.
 */
function identifySuccessors(
  grid: Grid,
  cx: number,
  cy: number,
  cameFrom: Int32Array,
  w: number,
  h: number,
  ex: number,
  ey: number,
  out: Int32Array,
): number {
  let n = 0;
  const parentIdx = cameFrom[cy * w + cx]!;

  if (parentIdx === -1) {
    // Start node: explore all 8 directions (jump refuses a diagonal past a corner)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const jp = jump(grid, cx, cy, dx, dy, w, h, ex, ey);
        if (jp !== -1) out[n++] = jp;
      }
    }
    return n;
  }

  const px = parentIdx % w;
  const py = (parentIdx / w) | 0;
  const dx = clampDir(cx - px);
  const dy = clampDir(cy - py);

  if (dx !== 0 && dy !== 0) {
    // Diagonal move: the two cardinal components, then the diagonal itself
    const openY = isWalkable(grid, cx, cy + dy);
    const openX = isWalkable(grid, cx + dx, cy);
    n = tryJump(grid, cx, cy, 0, dy, openY, w, h, ex, ey, out, n);
    n = tryJump(grid, cx, cy, dx, 0, openX, w, h, ex, ey, out, n);
    n = tryJump(grid, cx, cy, dx, dy, openX && openY, w, h, ex, ey, out, n);
  } else if (dx !== 0) {
    // Horizontal move: ahead, plus each side that opened up here (walkable beside
    // this cell, blocked beside the previous one) and the diagonal towards it
    const ahead = isWalkable(grid, cx + dx, cy);
    const down = isWalkable(grid, cx, cy + 1) && !isWalkable(grid, cx - dx, cy + 1);
    const up = isWalkable(grid, cx, cy - 1) && !isWalkable(grid, cx - dx, cy - 1);
    n = tryJump(grid, cx, cy, dx, 0, ahead, w, h, ex, ey, out, n);
    n = tryJump(grid, cx, cy, 0, 1, down, w, h, ex, ey, out, n);
    n = tryJump(grid, cx, cy, dx, 1, ahead && down, w, h, ex, ey, out, n);
    n = tryJump(grid, cx, cy, 0, -1, up, w, h, ex, ey, out, n);
    n = tryJump(grid, cx, cy, dx, -1, ahead && up, w, h, ex, ey, out, n);
  } else {
    // Vertical move: the same, with the axes swapped
    const ahead = isWalkable(grid, cx, cy + dy);
    const right = isWalkable(grid, cx + 1, cy) && !isWalkable(grid, cx + 1, cy - dy);
    const left = isWalkable(grid, cx - 1, cy) && !isWalkable(grid, cx - 1, cy - dy);
    n = tryJump(grid, cx, cy, 0, dy, ahead, w, h, ex, ey, out, n);
    n = tryJump(grid, cx, cy, 1, 0, right, w, h, ex, ey, out, n);
    n = tryJump(grid, cx, cy, 1, dy, ahead && right, w, h, ex, ey, out, n);
    n = tryJump(grid, cx, cy, -1, 0, left, w, h, ex, ey, out, n);
    n = tryJump(grid, cx, cy, -1, dy, ahead && left, w, h, ex, ey, out, n);
  }

  return n;
}

function tryJump(
  grid: Grid,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  open: boolean,
  w: number,
  h: number,
  ex: number,
  ey: number,
  out: Int32Array,
  n: number,
): number {
  if (!open) return n;
  const jp = jump(grid, cx, cy, dx, dy, w, h, ex, ey);
  if (jp !== -1) out[n++] = jp;
  return n;
}

/**
 * Scans from (cx, cy) in direction (dx, dy) and returns the index of the first
 * jump point, or -1. A diagonal step is taken only when both cardinal
 * neighbours it passes are walkable, so the scan never squeezes a corner.
 * On a cardinal ray a cell is a jump point when a perpendicular neighbour opens
 * up beside it that was blocked beside the previous cell; a diagonal ray stops
 * where one of its two cardinal probes finds a jump point.
 */
function jump(
  grid: Grid,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  w: number,
  h: number,
  ex: number,
  ey: number,
): number {
  // One loop iteration per cell along the ray, so a long open corridor costs no
  // stack depth; only a diagonal ray calls back in, for its two cardinal probes
  // (which loop themselves), so the depth never exceeds two frames.
  let nx = cx;
  let ny = cy;
  for (;;) {
    if (dx !== 0 && dy !== 0) {
      if (!isWalkable(grid, nx + dx, ny) || !isWalkable(grid, nx, ny + dy)) return -1;
    }
    nx += dx;
    ny += dy;

    if (!isWalkable(grid, nx, ny)) return -1;
    if (nx === ex && ny === ey) return ny * w + nx;

    if (dx !== 0 && dy !== 0) {
      // Diagonal: probe the cardinal directions
      if (jump(grid, nx, ny, dx, 0, w, h, ex, ey) !== -1) return ny * w + nx;
      if (jump(grid, nx, ny, 0, dy, w, h, ex, ey) !== -1) return ny * w + nx;
    } else if (dx !== 0) {
      // Horizontal: a row above or below opens up here
      if (
        (isWalkable(grid, nx, ny + 1) && !isWalkable(grid, nx - dx, ny + 1)) ||
        (isWalkable(grid, nx, ny - 1) && !isWalkable(grid, nx - dx, ny - 1))
      ) {
        return ny * w + nx;
      }
    } else {
      // Vertical: a column to the right or left opens up here
      if (
        (isWalkable(grid, nx + 1, ny) && !isWalkable(grid, nx + 1, ny - dy)) ||
        (isWalkable(grid, nx - 1, ny) && !isWalkable(grid, nx - 1, ny - dy))
      ) {
        return ny * w + nx;
      }
    }
  }
}

function clampDir(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

function buildPath(
  cameFrom: Int32Array,
  w: number,
  endIdx: number,
  cost: number,
  explored: number,
): PathResult {
  // JPS produces jump points — we interpolate the full path
  const jumpPoints: number[] = [];
  let idx = endIdx;
  while (idx !== -1) {
    jumpPoints.push(idx);
    idx = cameFrom[idx]!;
  }
  jumpPoints.reverse();

  const path: { x: number; y: number }[] = [];
  for (let i = 0; i < jumpPoints.length; i++) {
    const jpIdx = jumpPoints[i]!;
    const jx = jpIdx % w;
    const jy = (jpIdx / w) | 0;
    if (i === 0) {
      path.push({ x: jx, y: jy });
    } else {
      const prev = path[path.length - 1]!;
      // Interpolate from prev to current jump point
      let cx = prev.x;
      let cy = prev.y;
      while (cx !== jx || cy !== jy) {
        if (cx < jx) cx++;
        else if (cx > jx) cx--;
        if (cy < jy) cy++;
        else if (cy > jy) cy--;
        path.push({ x: cx, y: cy });
      }
    }
  }

  return { path, cost, explored };
}
