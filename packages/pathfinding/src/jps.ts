/**
 * Jump Point Search — an optimization over A* for uniform-cost grids.
 * JPS pruning is only correct when every walkable tile costs 1, so a grid with
 * any tile cost above 1 is delegated to weighted A* (`findPath`, diagonal moves)
 * after one linear scan of `grid.data`.
 *
 * JPS prunes symmetric paths by "jumping" along directions until hitting
 * a wall, the goal, or a forced neighbor.
 */

import type { PathResult } from './astar.js';
import { findPath, octileDistance } from './astar.js';
import type { Grid } from './grid.js';
import { isWalkable } from './grid.js';

// ─── Binary min-heap (duplicated from astar for tree-shakeability) ─

interface Heap {
  f: Float64Array;
  idx: Int32Array;
  size: number;
}

function heapCreate(capacity: number): Heap {
  return {
    f: new Float64Array(capacity),
    idx: new Int32Array(capacity),
    size: 0,
  };
}

/**
 * Double the heap's backing arrays.
 *
 * Typed arrays do not throw on an out-of-range write — the store is silently
 * dropped — so without this a push past capacity increments `size`, writes
 * nothing, and every later comparison reads `undefined`. The open set then
 * degrades without any error, and the search returns a valid-looking but
 * non-optimal path. Growth is amortized O(1): allocation happens only when
 * capacity is reached, never per push.
 */
function heapGrow(h: Heap): void {
  const next = h.f.length === 0 ? 16 : h.f.length * 2;
  const f = new Float64Array(next);
  f.set(h.f);
  const idx = new Int32Array(next);
  idx.set(h.idx);
  h.f = f;
  h.idx = idx;
}

function heapPush(h: Heap, f: number, nodeIdx: number): void {
  if (h.size === h.f.length) heapGrow(h);
  let i = h.size++;
  h.f[i] = f;
  h.idx[i] = nodeIdx;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (h.f[parent]! <= h.f[i]!) break;
    const tf = h.f[parent]!;
    const ti = h.idx[parent]!;
    h.f[parent] = h.f[i]!;
    h.idx[parent] = h.idx[i]!;
    h.f[i] = tf;
    h.idx[i] = ti;
    i = parent;
  }
}

function heapPop(h: Heap): number {
  const result = h.idx[0]!;
  h.size--;
  if (h.size > 0) {
    h.f[0] = h.f[h.size]!;
    h.idx[0] = h.idx[h.size]!;
    let i = 0;
    for (;;) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < h.size && h.f[left]! < h.f[smallest]!) smallest = left;
      if (right < h.size && h.f[right]! < h.f[smallest]!) smallest = right;
      if (smallest === i) break;
      const tf = h.f[i]!;
      const ti = h.idx[i]!;
      h.f[i] = h.f[smallest]!;
      h.idx[i] = h.idx[smallest]!;
      h.f[smallest] = tf;
      h.idx[smallest] = ti;
      i = smallest;
    }
  }
  return result;
}

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
  const total = w * h;
  const maxIter = options?.maxIterations ?? total;
  const heuristic = options?.heuristic ?? octileDistance;

  const g = new Float64Array(total);
  g.fill(Number.POSITIVE_INFINITY);
  const closed = new Uint8Array(total);
  const cameFrom = new Int32Array(total);
  cameFrom.fill(-1);

  const startIdx = sy * w + sx;
  const endIdx = ey * w + ex;
  g[startIdx] = 0;

  const heap = heapCreate(Math.min(total, 4096));
  heapPush(heap, heuristic(sx, sy, ex, ey), startIdx);

  let explored = 0;

  while (heap.size > 0 && explored < maxIter) {
    const currentIdx = heapPop(heap);
    if (currentIdx === endIdx) {
      return buildPath(cameFrom, w, currentIdx, g[currentIdx]!, explored);
    }
    if (closed[currentIdx]) continue;
    closed[currentIdx] = 1;
    explored++;

    const cx = currentIdx % w;
    const cy = (currentIdx / w) | 0;

    const neighbors = identifySuccessors(grid, cx, cy, cameFrom, w, h, ex, ey);
    for (let i = 0; i < neighbors.length; i += 2) {
      const nx = neighbors[i]!;
      const ny = neighbors[i + 1]!;
      const nIdx = ny * w + nx;
      if (closed[nIdx]) continue;

      const dx = Math.abs(nx - cx);
      const dy = Math.abs(ny - cy);
      const diag = Math.min(dx, dy);
      const straight = Math.abs(dx - dy);
      const dist = diag * SQRT2 + straight;
      const tentativeG = g[currentIdx]! + dist;
      if (tentativeG < g[nIdx]!) {
        g[nIdx] = tentativeG;
        cameFrom[nIdx] = currentIdx;
        heapPush(heap, tentativeG + heuristic(nx, ny, ex, ey), nIdx);
      }
    }
  }

  return null;
}

function identifySuccessors(
  grid: Grid,
  cx: number,
  cy: number,
  cameFrom: Int32Array,
  w: number,
  h: number,
  ex: number,
  ey: number,
): number[] {
  const results: number[] = [];
  const parentIdx = cameFrom[cy * w + cx]!;

  if (parentIdx === -1) {
    // Start node: explore all 8 directions
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const jp = jump(grid, cx, cy, dx, dy, w, h, ex, ey);
        if (jp !== -1) {
          results.push(jp % w, (jp / w) | 0);
        }
      }
    }
  } else {
    const px = parentIdx % w;
    const py = (parentIdx / w) | 0;
    const dx = clampDir(cx - px);
    const dy = clampDir(cy - py);

    if (dx !== 0 && dy !== 0) {
      // Diagonal move: check straight and diagonal successors
      if (isWalkable(grid, cx, cy + dy)) {
        const jp = jump(grid, cx, cy, 0, dy, w, h, ex, ey);
        if (jp !== -1) results.push(jp % w, (jp / w) | 0);
      }
      if (isWalkable(grid, cx + dx, cy)) {
        const jp = jump(grid, cx, cy, dx, 0, w, h, ex, ey);
        if (jp !== -1) results.push(jp % w, (jp / w) | 0);
      }
      if (isWalkable(grid, cx + dx, cy + dy)) {
        const jp = jump(grid, cx, cy, dx, dy, w, h, ex, ey);
        if (jp !== -1) results.push(jp % w, (jp / w) | 0);
      }
      // Forced neighbors
      if (!isWalkable(grid, cx - dx, cy) && isWalkable(grid, cx - dx, cy + dy)) {
        const jp = jump(grid, cx, cy, -dx, dy, w, h, ex, ey);
        if (jp !== -1) results.push(jp % w, (jp / w) | 0);
      }
      if (!isWalkable(grid, cx, cy - dy) && isWalkable(grid, cx + dx, cy - dy)) {
        const jp = jump(grid, cx, cy, dx, -dy, w, h, ex, ey);
        if (jp !== -1) results.push(jp % w, (jp / w) | 0);
      }
    } else if (dx !== 0) {
      // Horizontal move
      if (isWalkable(grid, cx + dx, cy)) {
        const jp = jump(grid, cx, cy, dx, 0, w, h, ex, ey);
        if (jp !== -1) results.push(jp % w, (jp / w) | 0);
      }
      if (!isWalkable(grid, cx, cy + 1) && isWalkable(grid, cx + dx, cy + 1)) {
        const jp = jump(grid, cx, cy, dx, 1, w, h, ex, ey);
        if (jp !== -1) results.push(jp % w, (jp / w) | 0);
      }
      if (!isWalkable(grid, cx, cy - 1) && isWalkable(grid, cx + dx, cy - 1)) {
        const jp = jump(grid, cx, cy, dx, -1, w, h, ex, ey);
        if (jp !== -1) results.push(jp % w, (jp / w) | 0);
      }
    } else {
      // Vertical move
      if (isWalkable(grid, cx, cy + dy)) {
        const jp = jump(grid, cx, cy, 0, dy, w, h, ex, ey);
        if (jp !== -1) results.push(jp % w, (jp / w) | 0);
      }
      if (!isWalkable(grid, cx + 1, cy) && isWalkable(grid, cx + 1, cy + dy)) {
        const jp = jump(grid, cx, cy, 1, dy, w, h, ex, ey);
        if (jp !== -1) results.push(jp % w, (jp / w) | 0);
      }
      if (!isWalkable(grid, cx - 1, cy) && isWalkable(grid, cx - 1, cy + dy)) {
        const jp = jump(grid, cx, cy, -1, dy, w, h, ex, ey);
        if (jp !== -1) results.push(jp % w, (jp / w) | 0);
      }
    }
  }

  return results;
}

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
  const nx = cx + dx;
  const ny = cy + dy;

  if (!isWalkable(grid, nx, ny)) return -1;
  if (nx === ex && ny === ey) return ny * w + nx;

  // Forced neighbor check
  if (dx !== 0 && dy !== 0) {
    // Diagonal
    if (
      (!isWalkable(grid, nx - dx, ny) && isWalkable(grid, nx - dx, ny + dy)) ||
      (!isWalkable(grid, nx, ny - dy) && isWalkable(grid, nx + dx, ny - dy))
    ) {
      return ny * w + nx;
    }
    // Recurse in cardinal directions
    if (jump(grid, nx, ny, dx, 0, w, h, ex, ey) !== -1) return ny * w + nx;
    if (jump(grid, nx, ny, 0, dy, w, h, ex, ey) !== -1) return ny * w + nx;
  } else if (dx !== 0) {
    // Horizontal
    if (
      (!isWalkable(grid, nx, ny + 1) && isWalkable(grid, nx + dx, ny + 1)) ||
      (!isWalkable(grid, nx, ny - 1) && isWalkable(grid, nx + dx, ny - 1))
    ) {
      return ny * w + nx;
    }
  } else {
    // Vertical
    if (
      (!isWalkable(grid, nx + 1, ny) && isWalkable(grid, nx + 1, ny + dy)) ||
      (!isWalkable(grid, nx - 1, ny) && isWalkable(grid, nx - 1, ny + dy))
    ) {
      return ny * w + nx;
    }
  }

  // Keep jumping (iterative for cardinal, recursive for diagonal via identifySuccessors)
  return jump(grid, nx, ny, dx, dy, w, h, ex, ey);
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
