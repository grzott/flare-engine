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
 * Precomputed flat-index Set of solid tile positions used by `isBlockedAABB`
 * and `moveAndSlideInto`. Build once per map load via `buildSolidGrid`.
 */
export interface SolidGrid {
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  readonly solid: Set<number>;
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
): SolidGrid {
  const solid = new Set<number>();
  for (const t of tiles) {
    solid.add(t.row * width + t.col);
  }
  return { width, height, tileSize, solid };
}

/**
 * Half-open boundary constant: the AABB is treated as [min, max) so a box
 * whose max edge lands exactly on a tile boundary does NOT overlap that tile.
 */
const EDGE = 1e-4;

/**
 * Returns `true` when an axis-aligned box centered at (`x`, `y`) with
 * half-extents (`halfW`, `halfH`) overlaps a solid tile or lies outside the
 * map boundary. Uses half-open EDGE semantics on max edges.
 */
export function isBlockedAABB(
  grid: SolidGrid,
  x: number,
  y: number,
  halfW: number,
  halfH: number,
): boolean {
  const ts = grid.tileSize;
  const minCol = Math.floor((x - halfW) / ts);
  const maxCol = Math.floor((x + halfW - EDGE) / ts);
  const minRow = Math.floor((y - halfH) / ts);
  const maxRow = Math.floor((y + halfH - EDGE) / ts);
  if (minCol < 0 || minRow < 0 || maxCol >= grid.width || maxRow >= grid.height) {
    return true;
  }
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (grid.solid.has(row * grid.width + col)) {
        return true;
      }
    }
  }
  return false;
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
