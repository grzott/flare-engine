import { cellKey, cellMax, cellMin } from './cells.js';
import type { Shape } from './shape.js';

// CollisionWorld's broadphase: the same uniform grid as SpatialIndex, but it
// links the world's entries directly and, inside each cell, keeps them grouped
// by (layer, mask). A step can then reject a whole group with one layer/mask
// test — no lookup per candidate, and no walk through bodies that cannot pair
// with the one it is querying from. Internal — not exported from the package.

/** Per-entity collision data stored in the world, with its grid bookkeeping. */
export interface CollisionEntry {
  readonly entity: number;
  shape: Shape;
  x: number;
  y: number;
  isTrigger: boolean;
  layer: number;
  mask: number;
  // Bounding rect of `shape` at (x, y), as last handed to the grid.
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  // Clamped cell range the entry is linked into. NaN when a bound is NaN —
  // such an entry is linked nowhere and never compares equal, so it relinks.
  cxMin: number;
  cxMax: number;
  cyMin: number;
  cyMax: number;
  /** How many leading slots of `cells` / `groups` / `at` are live. */
  cellCount: number;
  /**
   * The cells the entry is linked into, column by column: slot
   * `(cx - cxMin) * rows + (cy - cyMin)`, rows = cyMax - cyMin + 1.
   * Grown, never reallocated.
   */
  readonly cells: GridCell[];
  /** The group holding the entry in `cells[i]`. */
  readonly groups: CellGroup[];
  /** The entry's position in `groups[i].items`. */
  readonly at: number[];
  stamp: number;
}

/**
 * The entries of one cell that share a `layer` and a `mask`. Every entry of a
 * group passes or fails the layer/mask test against a given body together, so
 * the test is made once per group and is exact — there is nothing cached about
 * a group that a removal or a re-add could leave out of date.
 */
export interface CellGroup {
  layer: number;
  mask: number;
  /** Position in the owning cell's `groups`. */
  index: number;
  readonly items: CollisionEntry[];
}

export interface GridCell {
  readonly cx: number;
  readonly cy: number;
  /** Non-empty groups only. */
  readonly groups: CellGroup[];
}

export interface CollisionGrid {
  // Packed cell key → cell. Named as SpatialIndex names its own map: the
  // cell-walk tests bound both through the same private field.
  readonly _cells: Map<number, GridCell>;
  /** Emptied groups, reused so a body entering a cell allocates nothing once warm. */
  readonly freeGroups: CellGroup[];
  /** Monotone stamp source for duplicate suppression across cells. */
  gen: number;
  /** Number of entries placed and not yet removed. */
  size: number;
}

export function createCollisionGrid(): CollisionGrid {
  return { _cells: new Map(), freeGroups: [], gen: 0, size: 0 };
}

function groupFor(grid: CollisionGrid, cell: GridCell, layer: number, mask: number): CellGroup {
  const groups = cell.groups;
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]!;
    if (group.layer === layer && group.mask === mask) return group;
  }
  let group = grid.freeGroups.pop();
  if (group === undefined) {
    group = { layer, mask, index: groups.length, items: [] };
  } else {
    group.layer = layer;
    group.mask = mask;
    group.index = groups.length;
  }
  groups.push(group);
  return group;
}

function link(grid: CollisionGrid, e: CollisionEntry): void {
  const { cxMin, cxMax, cyMin, cyMax } = e;
  let n = 0;
  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cy = cyMin; cy <= cyMax; cy++) {
      const k = cellKey(cx, cy);
      let cell = grid._cells.get(k);
      if (cell === undefined) {
        cell = { cx, cy, groups: [] };
        grid._cells.set(k, cell);
      }
      const group = groupFor(grid, cell, e.layer, e.mask);
      e.cells[n] = cell;
      e.groups[n] = group;
      e.at[n] = group.items.length;
      n++;
      group.items.push(e);
    }
  }
  e.cellCount = n;
}

/**
 * Take an entry out of every cell it is linked into. O(1) per cell: the last
 * entry of the group takes the vacated position, and its own record of where
 * it sits in that cell is corrected to match. A group left empty leaves its
 * cell the same way and goes back to the free list.
 *
 * `layer` and `mask` decide which group holds an entry, so they may only be
 * rewritten while it is unlinked; follow with `gridRelink`.
 */
export function gridUnlink(grid: CollisionGrid, e: CollisionEntry): void {
  for (let n = 0; n < e.cellCount; n++) {
    const cell = e.cells[n]!;
    const group = e.groups[n]!;
    const items = group.items;
    const last = items.pop()!;
    if (last !== e) {
      const i = e.at[n]!;
      items[i] = last;
      last.at[(cell.cx - last.cxMin) * (last.cyMax - last.cyMin + 1) + (cell.cy - last.cyMin)] = i;
    } else if (items.length === 0) {
      const lastGroup = cell.groups.pop()!;
      if (lastGroup !== group) {
        cell.groups[group.index] = lastGroup;
        lastGroup.index = group.index;
      }
      grid.freeGroups.push(group);
    }
  }
  e.cellCount = 0;
}

function setBounds(
  e: CollisionEntry,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): void {
  e.minX = minX;
  e.minY = minY;
  e.maxX = maxX;
  e.maxY = maxY;
  e.cxMin = cellMin(minX);
  e.cxMax = cellMax(maxX);
  e.cyMin = cellMin(minY);
  e.cyMax = cellMax(maxY);
}

/** Link a new entry at the given bounds. */
export function gridInsert(
  grid: CollisionGrid,
  e: CollisionEntry,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): void {
  grid.size++;
  setBounds(e, minX, minY, maxX, maxY);
  link(grid, e);
}

/** Link an entry `gridUnlink` took out, at the given bounds. */
export function gridRelink(
  grid: CollisionGrid,
  e: CollisionEntry,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): void {
  setBounds(e, minX, minY, maxX, maxY);
  link(grid, e);
}

/** Move an entry whose layer and mask are unchanged. Touches no bucket while it stays in the same cells. */
export function gridMove(
  grid: CollisionGrid,
  e: CollisionEntry,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): void {
  const cxMin = cellMin(minX);
  const cxMax = cellMax(maxX);
  const cyMin = cellMin(minY);
  const cyMax = cellMax(maxY);
  if (cxMin === e.cxMin && cxMax === e.cxMax && cyMin === e.cyMin && cyMax === e.cyMax) {
    e.minX = minX;
    e.minY = minY;
    e.maxX = maxX;
    e.maxY = maxY;
    return;
  }
  gridUnlink(grid, e);
  setBounds(e, minX, minY, maxX, maxY);
  link(grid, e);
}

export function gridRemove(grid: CollisionGrid, e: CollisionEntry): void {
  gridUnlink(grid, e);
  grid.size--;
}

export function gridClear(grid: CollisionGrid): void {
  grid._cells.clear();
  grid.freeGroups.length = 0;
  grid.size = 0;
}

/** Append every entry whose bounds overlap the rect to `out`, each once. Order is unspecified. */
export function gridQuery(
  grid: CollisionGrid,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  out: CollisionEntry[],
): void {
  const gen = ++grid.gen;
  const cxMin = cellMin(minX);
  const cxMax = cellMax(maxX);
  const cyMin = cellMin(minY);
  const cyMax = cellMax(maxY);
  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cy = cyMin; cy <= cyMax; cy++) {
      const cell = grid._cells.get(cellKey(cx, cy));
      if (cell === undefined) continue;
      const groups = cell.groups;
      for (let g = 0; g < groups.length; g++) {
        const items = groups[g]!.items;
        for (let i = 0; i < items.length; i++) {
          const e = items[i]!;
          if (e.stamp === gen) continue;
          e.stamp = gen;
          if (e.maxX > minX && e.minX < maxX && e.maxY > minY && e.minY < maxY) out.push(e);
        }
      }
    }
  }
}
