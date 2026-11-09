/**
 * Per-`Grid` search scratch shared by `findPath` and `findPathJPS`.
 *
 * A search needs a g score, a came-from link and an open/closed mark per cell.
 * Instead of allocating and filling those on every call, one scratch is kept per
 * `Grid` object in a WeakMap and reused; generation stamps make a per-call fill
 * unnecessary. Module-private to the package: not exported from `index.ts`.
 */

import type { Grid } from './grid.js';
import type { Heap } from './heap.js';
import { heapCreate } from './heap.js';

export interface SearchScratch {
  /** `width * height` the arrays were sized for; a mismatch means the scratch is stale. */
  readonly total: number;
  /** g score per cell; valid only when `stamp[i] >= open`. */
  readonly g: Float64Array;
  /** Predecessor cell index per cell; valid only when `stamp[i] >= open`. */
  readonly cameFrom: Int32Array;
  /**
   * Generation stamp per cell. `open` marks a cell touched (g / cameFrom valid)
   * by the current search, `open + 1` marks it closed; anything lower is a
   * leftover from an earlier search and reads as untouched. 0 is "never touched".
   */
  readonly stamp: Uint32Array;
  /** Stamp value of the current search's open mark; always even, starts at 2. */
  open: number;
  /** Open-set heap; grown on demand and kept at the grown size. */
  readonly heap: Heap;
  /** Set while a search holds this scratch, so a re-entrant search takes its own. */
  inUse: boolean;
}

// `open + 1` must fit a Uint32; `open` is always even, so this is the last usable value.
const MAX_OPEN = 0xfffffffe;

const scratches = new WeakMap<Grid, SearchScratch>();

function createScratch(total: number): SearchScratch {
  return {
    total,
    g: new Float64Array(total),
    cameFrom: new Int32Array(total),
    stamp: new Uint32Array(total),
    open: 0,
    heap: heapCreate(Math.min(total, 4096)),
    inUse: false,
  };
}

/**
 * Hand out the scratch for `grid`, ready for a new search: generation advanced
 * (every cell reads as untouched), heap emptied, start cell untouched too — the
 * caller stamps it.
 *
 * A grid whose stored scratch is already in use (a heuristic re-entered a
 * search on the same grid) gets a fresh temporary scratch that is not stored.
 */
export function acquireScratch(grid: Grid): SearchScratch {
  const total = grid.width * grid.height;
  let s = scratches.get(grid);
  if (s === undefined || s.total !== total) {
    s = createScratch(total);
    scratches.set(grid, s);
  } else if (s.inUse) {
    s = createScratch(total);
  }
  s.inUse = true;
  s.heap.size = 0;
  if (s.open >= MAX_OPEN) {
    // Wrap: clear every stamp so no stale value can equal a reused generation.
    s.stamp.fill(0);
    s.open = 2;
  } else {
    s.open += 2;
  }
  return s;
}

export function releaseScratch(s: SearchScratch): void {
  s.inUse = false;
}
