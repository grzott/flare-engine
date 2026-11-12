import type { Vec2 } from '@flare-engine/math';

/**
 * Minimal structural type for a solid tile position in grid coordinates.
 * `TileCollider[]` from `@flare-engine/tilemap` is structurally assignable here
 * so callers can pass `extractColliders(map)` directly — no tilemap dep needed.
 */
export interface SolidTile {
  readonly row: number;
  readonly col: number;
}

/**
 * How `isBlockedAABB` treats cells outside the grid.
 * `'solid'` — the map edge is a wall; any box that leaves the map is blocked.
 * `'open'` — cells outside the grid are empty, so a body can walk off the map;
 * use it for seams between adjacent region maps.
 */
export type SolidGridOutside = 'solid' | 'open';

export interface SolidGridOptions {
  /** Defaults to `'solid'`. */
  readonly outside?: SolidGridOutside;
}

/**
 * Precomputed solid-tile lookup used by `isBlockedAABB` and `moveAndSlideInto`.
 * `solid` has `width * height` cells indexed `row * width + col`; non-zero means
 * solid. Build once per map load via `buildSolidGrid`.
 */
export interface SolidGrid {
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  readonly solid: Uint8Array;
  readonly outside: SolidGridOutside;
}

/**
 * Build a `SolidGrid` from a list of solid tile positions.
 * Input is structurally typed (`readonly SolidTile[]`) so the caller does not
 * need to import `@flare-engine/tilemap` — physics stays tilemap-free.
 */
export function buildSolidGrid(
  width: number,
  height: number,
  tileSize: number,
  tiles: readonly SolidTile[],
  options?: SolidGridOptions,
): SolidGrid {
  const solid = new Uint8Array(width * height);
  for (const t of tiles) {
    solid[t.row * width + t.col] = 1;
  }
  return { width, height, tileSize, solid, outside: options?.outside ?? 'solid' };
}

/**
 * Half-open boundary constant: the AABB is treated as [min, max) so a box
 * whose max edge lands exactly on a tile boundary does NOT overlap that tile.
 */
const EDGE = 1e-4;

/**
 * Returns `true` when an axis-aligned box centered at (`x`, `y`) with
 * half-extents (`halfW`, `halfH`) overlaps a solid tile. Leaving the map
 * blocks only when the grid was built with `outside: 'solid'` (the default);
 * with `'open'` the out-of-grid cells are empty and only the in-grid cells the
 * box overlaps are tested. Uses half-open EDGE semantics on max edges.
 */
export function isBlockedAABB(
  grid: SolidGrid,
  x: number,
  y: number,
  halfW: number,
  halfH: number,
): boolean {
  const ts = grid.tileSize;
  let minCol = Math.floor((x - halfW) / ts);
  let maxCol = Math.floor((x + halfW - EDGE) / ts);
  let minRow = Math.floor((y - halfH) / ts);
  let maxRow = Math.floor((y + halfH - EDGE) / ts);
  if (minCol < 0 || minRow < 0 || maxCol >= grid.width || maxRow >= grid.height) {
    if (grid.outside === 'solid') return true;
    // Clamp to the in-grid cells; a box fully outside yields an empty range.
    if (minCol < 0) minCol = 0;
    if (minRow < 0) minRow = 0;
    if (maxCol >= grid.width) maxCol = grid.width - 1;
    if (maxRow >= grid.height) maxRow = grid.height - 1;
  }
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (grid.solid[row * grid.width + col] !== 0) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Whether the cell at (`col`, `row`) is solid. Coordinates that name no cell
 * (out of range, or not an integer) follow the grid's own `outside` rule, like
 * `isBlockedAABB` at the map edge: solid on an `outside: 'solid'` grid, empty
 * on an `'open'` one. Zero-alloc.
 */
export function isSolidAt(grid: SolidGrid, col: number, row: number): boolean {
  if (!isCell(grid, col, row)) return grid.outside === 'solid';
  return grid.solid[row * grid.width + col] !== 0;
}

/**
 * Mark the cell at (`col`, `row`) solid or empty, for a door or a breakable
 * wall. Returns `true` when the cell was written, `false` (and writes nothing)
 * when the coordinates are out of range or not integers. Zero-alloc.
 */
export function setSolidAt(grid: SolidGrid, col: number, row: number, solid: boolean): boolean {
  if (!isCell(grid, col, row)) return false;
  grid.solid[row * grid.width + col] = solid ? 1 : 0;
  return true;
}

function isCell(grid: SolidGrid, col: number, row: number): boolean {
  return (
    Number.isInteger(col) &&
    Number.isInteger(row) &&
    col >= 0 &&
    col < grid.width &&
    row >= 0 &&
    row < grid.height
  );
}

/**
 * Axis-separated slide movement. Attempts to move by (`dx`, `dy`); each axis
 * is applied independently so a blocked diagonal input slides along the wall.
 * The y-check uses the already-updated x position.
 * Zero-alloc: writes result into the provided `out` Vec2 and returns it.
 */
export function moveAndSlideInto(
  grid: SolidGrid,
  x: number,
  y: number,
  dx: number,
  dy: number,
  halfW: number,
  halfH: number,
  out: Vec2,
): Vec2 {
  let nx = x;
  let ny = y;
  if (dx !== 0 && !isBlockedAABB(grid, nx + dx, ny, halfW, halfH)) nx += dx;
  if (dy !== 0 && !isBlockedAABB(grid, nx, ny + dy, halfW, halfH)) ny += dy;
  out.x = nx;
  out.y = ny;
  return out;
}
