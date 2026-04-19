/**
 * Grid data structure for tile-based pathfinding.
 * Uses a flat Uint8Array: 0 = blocked, 1+ = walkable (value = movement cost).
 */

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export interface GridConfig {
  width: number;
  height: number;
  /** Pre-filled grid data. Length must equal width * height. */
  data?: Uint8Array;
  /** Default cost for all cells when `data` is not provided. 0 = blocked, 1+ = walkable cost. Default 1. */
  defaultCost?: number;
}

export function createGrid(config: GridConfig): Grid {
  const { width, height, defaultCost = 1 } = config;
  if (width <= 0 || height <= 0) {
    throw new RangeError('Grid dimensions must be positive');
  }
  const w = width | 0;
  const h = height | 0;
  let data: Uint8Array;
  if (config.data) {
    if (config.data.length !== w * h) {
      throw new RangeError(`Grid data length ${config.data.length} does not match ${w}x${h}`);
    }
    data = config.data;
  } else {
    data = new Uint8Array(w * h);
    if (defaultCost > 0) {
      data.fill(defaultCost);
    }
  }
  return { width: w, height: h, data };
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function isWalkable(grid: Grid, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return false;
  return grid.data[(y | 0) * grid.width + (x | 0)]! > 0;
}

export function getCost(grid: Grid, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return 0;
  return grid.data[(y | 0) * grid.width + (x | 0)]!;
}

export function setWalkable(grid: Grid, x: number, y: number, walkable: boolean): void {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return;
  grid.data[(y | 0) * grid.width + (x | 0)] = walkable ? 1 : 0;
}

export function setCost(grid: Grid, x: number, y: number, cost: number): void {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return;
  grid.data[(y | 0) * grid.width + (x | 0)] = cost > 255 ? 255 : cost < 0 ? 0 : cost | 0;
}
