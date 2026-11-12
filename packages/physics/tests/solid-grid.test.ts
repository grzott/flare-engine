import { describe, expect, test } from 'bun:test';
import {
  buildSolidGrid,
  isBlockedAABB,
  isSolidAt,
  moveAndSlideInto,
  type SolidGrid,
  type SolidTile,
  setSolidAt,
} from '../src/solid-grid.js';

// 10×10 grid, 16px tiles
const W = 10;
const H = 10;
const TS = 16;

function makeGrid(solidTiles: SolidTile[]): SolidGrid {
  return buildSolidGrid(W, H, TS, solidTiles);
}

function countSolid(grid: SolidGrid): number {
  let n = 0;
  for (let i = 0; i < grid.solid.length; i++) n += grid.solid[i]!;
  return n;
}

describe('buildSolidGrid', () => {
  test('solid is a Uint8Array of width * height cells', () => {
    const grid = makeGrid([]);
    expect(grid.solid).toBeInstanceOf(Uint8Array);
    expect(grid.solid.length).toBe(W * H);
    expect(countSolid(grid)).toBe(0);
    expect(grid.width).toBe(W);
    expect(grid.height).toBe(H);
    expect(grid.tileSize).toBe(TS);
  });

  test('a tile at (row, col) sets solid[row*width+col]', () => {
    const grid = makeGrid([{ row: 3, col: 5 }]);
    expect(grid.solid[3 * W + 5]).toBe(1);
    expect(countSolid(grid)).toBe(1);
  });

  test('multiple tiles produce correct entries', () => {
    const grid = makeGrid([
      { row: 0, col: 0 },
      { row: 9, col: 9 },
    ]);
    expect(grid.solid[0]).toBe(1);
    expect(grid.solid[9 * W + 9]).toBe(1);
    expect(countSolid(grid)).toBe(2);
  });

  test('a tile listed twice is still one solid cell', () => {
    const grid = makeGrid([
      { row: 1, col: 1 },
      { row: 1, col: 1 },
    ]);
    expect(grid.solid[1 * W + 1]).toBe(1);
    expect(countSolid(grid)).toBe(1);
  });

  test('accepts objects with extra fields (structural: TileCollider-shaped)', () => {
    // TileCollider has x, y, shape, gid in addition to row/col.
    // Passing them as readonly SolidTile[] must typecheck and work correctly.
    const extendedTiles: Array<SolidTile & { x: number; y: number; shape: string; gid: number }> = [
      { row: 2, col: 4, x: 72, y: 40, shape: 'AABB', gid: 7 },
    ];

    const grid = buildSolidGrid(W, H, TS, extendedTiles);
    expect(grid.solid[2 * W + 4]).toBe(1);
    expect(countSolid(grid)).toBe(1);
  });

  test('outside defaults to solid and stores open when requested', () => {
    expect(makeGrid([]).outside).toBe('solid');
    expect(buildSolidGrid(W, H, TS, [], { outside: 'open' }).outside).toBe('open');
  });
});

describe('isBlockedAABB on an open grid', () => {
  const openGrid = (tiles: SolidTile[]) => buildSolidGrid(W, H, TS, tiles, { outside: 'open' });

  test('out-of-map left/top/right/bottom return false', () => {
    const grid = openGrid([]);
    expect(isBlockedAABB(grid, 4, 8, 8, 4)).toBe(false);
    expect(isBlockedAABB(grid, 8, 4, 4, 8)).toBe(false);
    expect(isBlockedAABB(grid, 158, 8, 8, 4)).toBe(false);
    expect(isBlockedAABB(grid, 8, 158, 4, 8)).toBe(false);
  });

  test('box fully outside the grid returns false', () => {
    const grid = openGrid([{ row: 0, col: 0 }]);
    expect(isBlockedAABB(grid, -40, 8, 4, 4)).toBe(false);
  });

  test('box straddling the edge over a solid edge tile returns true', () => {
    const grid = openGrid([{ row: 0, col: 0 }]);
    expect(isBlockedAABB(grid, 4, 8, 8, 4)).toBe(true);
  });

  test('box straddling the edge over an empty edge tile returns false', () => {
    const grid = openGrid([{ row: 0, col: 1 }]);
    expect(isBlockedAABB(grid, 4, 8, 8, 4)).toBe(false);
  });
});

describe('isBlockedAABB', () => {
  const solidAt = (row: number, col: number) => makeGrid([{ row, col }]);

  test('free cell returns false', () => {
    const grid = makeGrid([]);
    // center of tile (0,0): x=8, y=8, halfW/halfH=4 (box fully inside tile 0,0 which is empty)
    expect(isBlockedAABB(grid, 8, 8, 4, 4)).toBe(false);
  });

  test('box overlapping a solid tile returns true', () => {
    const grid = solidAt(0, 0);
    // box centered at (8, 8), half-extents 4 — sits inside tile (0,0)
    expect(isBlockedAABB(grid, 8, 8, 4, 4)).toBe(true);
  });

  test('out-of-map left (minCol < 0) returns true', () => {
    const grid = makeGrid([]);
    // x - halfW < 0  → minCol < 0
    expect(isBlockedAABB(grid, 4, 8, 8, 4)).toBe(true);
  });

  test('out-of-map top (minRow < 0) returns true', () => {
    const grid = makeGrid([]);
    expect(isBlockedAABB(grid, 8, 4, 4, 8)).toBe(true);
  });

  test('out-of-map right (maxCol >= width) returns true', () => {
    const grid = makeGrid([]);
    // x + halfW - EDGE pushes maxCol past W-1
    // W*TS = 160; x=158, halfW=8 → x+halfW-EDGE = 165.9999 → floor/TS = 10 >= 10
    expect(isBlockedAABB(grid, 158, 8, 8, 4)).toBe(true);
  });

  test('out-of-map bottom (maxRow >= height) returns true', () => {
    const grid = makeGrid([]);
    expect(isBlockedAABB(grid, 8, 158, 4, 8)).toBe(true);
  });

  test('HALF-OPEN boundary: max edge exactly on solid tile boundary does NOT block', () => {
    // Solid tile at col=1, which starts at x=16.
    // Box right edge = x + halfW.  With EDGE semantics: maxCol = floor((x+halfW-1e-4)/TS).
    // If x + halfW == 16 exactly → (16 - 1e-4)/16 = 0.999... → floor = 0 → col 0 (empty) → NOT blocked.
    const grid = solidAt(0, 1);
    const halfW = 4;
    // x such that x + halfW == 16 exactly → x = 12
    expect(isBlockedAABB(grid, 12, 8, halfW, 4)).toBe(false);
  });

  test('box whose right edge is 1px INTO solid tile is blocked', () => {
    // x + halfW = 17 > 16 → maxCol = floor((17-EDGE)/16) = floor(1.0...) = 1 → blocked
    const grid = solidAt(0, 1);
    const halfW = 5;
    // x = 12, halfW = 5 → x+halfW = 17
    expect(isBlockedAABB(grid, 12, 8, halfW, 4)).toBe(true);
  });
});

describe('moveAndSlideInto', () => {
  const halfW = 4;
  const halfH = 4;

  test('unobstructed move applies both axes', () => {
    const grid = makeGrid([]);
    const out = { x: 0, y: 0 };
    // start at center of tile (0,0), move +8,+8 — still in free space
    moveAndSlideInto(grid, 8, 8, 8, 8, halfW, halfH, out);
    expect(out.x).toBe(16);
    expect(out.y).toBe(16);
  });

  test('blocked x with free y: x unchanged, y applied (slides along wall)', () => {
    // solid wall at col=1 (x=16..31).  Start at x=8 (tile 0), try dx=+16 which would land center at 24 → inside col=1.
    const grid = makeGrid([{ row: 0, col: 1 }]);
    const out = { x: 0, y: 0 };
    moveAndSlideInto(grid, 8, 8, 16, 0, halfW, halfH, out);
    expect(out.x).toBe(8); // x blocked
    expect(out.y).toBe(8); // y unchanged (dy=0)
  });

  test('free x with blocked y: y unchanged, x applied', () => {
    const grid = makeGrid([{ row: 1, col: 0 }]);
    const out = { x: 0, y: 0 };
    // solid tile row=1 (y=16..31). Start at (8,8), dx=8 (free), dy=+16 (into row 1).
    moveAndSlideInto(grid, 8, 8, 8, 16, halfW, halfH, out);
    expect(out.x).toBe(16); // x applied
    expect(out.y).toBe(8); // y blocked
  });

  test('y-check uses the POST-x position (nx)', () => {
    // Construct a scenario where the y-check result differs between using original x vs updated nx.
    // solid tile at col=1 (x=16..31), row=1 (y=16..31)
    // Start: x=8, y=8. dx=+8 → nx=16 (now at col=1 boundary, still x+halfW=20 → col=1 overlap!)
    // Actually let's use: solid at (row=1, col=1). dx shifts into col=1 x-region.
    // dy +8 → ny=16 → would hit row=1 if checked from nx=16 (halfW=4: 12..19 spans col=0 and 1).
    // But from original x=8 (halfW=4: 4..12), col range = 0 only → would NOT detect col=1 block.
    // So with y using nx the result differs from y using original x when the tile is at col=1, row=1.
    const grid = makeGrid([{ row: 1, col: 1 }]);
    const out = { x: 0, y: 0 };
    // Start (8,8), dx=+8 → nx=16, halfW=4 → x-range [12,20) → maxCol = floor(19.9999/16)=1 → col=1.
    // x move: isBlockedAABB(grid, 16, 8, 4, 4) → row=0 (y 4..11), col 1 (x 12..19) → solid(1,1)? row=0 ≠ 1 → false → nx=16.
    // y move: isBlockedAABB(grid, 16, 16, 4, 4) using nx=16 → row range [12/16=0..19.9999/16=1] → row 1 → col 1 → BLOCKED → ny=8.
    // If y used original x=8 instead: isBlockedAABB(grid, 8, 16, 4, 4) → col range [4..11] → col 0 → no solid → ny=16.
    moveAndSlideInto(grid, 8, 8, 8, 8, halfW, halfH, out);
    expect(out.x).toBe(16); // x applied (tile at row=1 not involved)
    expect(out.y).toBe(8); // y blocked because y-check uses nx=16 which now spans col=1 where row=1 is solid
  });

  test('out is the same object passed in (aliasing)', () => {
    const grid = makeGrid([]);
    const pos = { x: 8, y: 8 };
    const result = moveAndSlideInto(grid, pos.x, pos.y, 4, 4, halfW, halfH, pos);
    expect(result).toBe(pos);
    expect(pos.x).toBe(12);
    expect(pos.y).toBe(12);
  });

  test('returns out', () => {
    const grid = makeGrid([]);
    const out = { x: 0, y: 0 };
    const result = moveAndSlideInto(grid, 8, 8, 4, 4, halfW, halfH, out);
    expect(result).toBe(out);
  });

  test('dx === 0 leaves x untouched', () => {
    const grid = makeGrid([]);
    const out = { x: 0, y: 0 };
    moveAndSlideInto(grid, 8, 8, 0, 4, halfW, halfH, out);
    expect(out.x).toBe(8);
    expect(out.y).toBe(12);
  });

  test('dy === 0 leaves y untouched', () => {
    const grid = makeGrid([]);
    const out = { x: 0, y: 0 };
    moveAndSlideInto(grid, 8, 8, 4, 0, halfW, halfH, out);
    expect(out.x).toBe(12);
    expect(out.y).toBe(8);
  });

  test('a body can leave an open grid', () => {
    const grid = buildSolidGrid(W, H, TS, [], { outside: 'open' });
    const out = { x: 0, y: 0 };
    moveAndSlideInto(grid, 8, 8, -16, 0, halfW, halfH, out);
    expect(out.x).toBe(-8);
    expect(out.y).toBe(8);
  });

  test('the default grid still blocks leaving the map', () => {
    const grid = makeGrid([]);
    const out = { x: 0, y: 0 };
    moveAndSlideInto(grid, 8, 8, -16, 0, halfW, halfH, out);
    expect(out.x).toBe(8);
    expect(out.y).toBe(8);
  });
});

describe('setSolidAt', () => {
  test('writes 1 for true and 0 for false at row * width + col, returning true', () => {
    const grid = makeGrid([]);
    expect(setSolidAt(grid, 5, 3, true)).toBe(true);
    expect(grid.solid[3 * W + 5]).toBe(1);
    expect(countSolid(grid)).toBe(1);

    expect(setSolidAt(grid, 5, 3, false)).toBe(true);
    expect(grid.solid[3 * W + 5]).toBe(0);
    expect(countSolid(grid)).toBe(0);
  });

  test('reaches the four corner cells', () => {
    const grid = makeGrid([]);
    expect(setSolidAt(grid, 0, 0, true)).toBe(true);
    expect(setSolidAt(grid, W - 1, 0, true)).toBe(true);
    expect(setSolidAt(grid, 0, H - 1, true)).toBe(true);
    expect(setSolidAt(grid, W - 1, H - 1, true)).toBe(true);
    expect(grid.solid[0]).toBe(1);
    expect(grid.solid[W - 1]).toBe(1);
    expect(grid.solid[(H - 1) * W]).toBe(1);
    expect(grid.solid[H * W - 1]).toBe(1);
    expect(countSolid(grid)).toBe(4);
  });

  test('out-of-range or non-integer coordinates return false and leave every cell unchanged', () => {
    const tiles = [
      { row: 0, col: 0 },
      { row: 4, col: 9 },
      { row: 5, col: 0 },
    ];
    for (const outside of ['solid', 'open'] as const) {
      const grid = buildSolidGrid(W, H, TS, tiles, { outside });
      const before = Array.from(grid.solid);
      const rejected: ReadonlyArray<readonly [number, number]> = [
        [-1, 0],
        [0, -1],
        [W, 0],
        [0, H],
        // col = W on row 4 would alias to (row 5, col 0) through a raw index.
        [W, 4],
        [-1, 5],
        [0.5, 0],
        // 0.5 * W is a whole number, so a raw index would hit (row 0, col 5).
        [0, 0.5],
        [Number.NaN, 0],
        [0, Number.NaN],
        [Number.POSITIVE_INFINITY, 0],
      ];
      for (const [col, row] of rejected) {
        expect(setSolidAt(grid, col, row, true)).toBe(false);
        expect(setSolidAt(grid, col, row, false)).toBe(false);
      }
      expect(Array.from(grid.solid)).toEqual(before);
    }
  });

  test('a cell opened by setSolidAt stops blocking isBlockedAABB and moveAndSlideInto', () => {
    const grid = makeGrid([{ row: 0, col: 1 }]);
    const out = { x: 0, y: 0 };

    expect(isBlockedAABB(grid, 24, 8, 4, 4)).toBe(true);
    moveAndSlideInto(grid, 8, 8, 16, 0, 4, 4, out);
    expect(out.x).toBe(8);

    expect(setSolidAt(grid, 1, 0, false)).toBe(true);

    expect(isBlockedAABB(grid, 24, 8, 4, 4)).toBe(false);
    moveAndSlideInto(grid, 8, 8, 16, 0, 4, 4, out);
    expect(out.x).toBe(24);
    expect(out.y).toBe(8);
  });

  test('a cell closed by setSolidAt starts blocking', () => {
    const grid = makeGrid([]);
    expect(isBlockedAABB(grid, 24, 8, 4, 4)).toBe(false);
    setSolidAt(grid, 1, 0, true);
    expect(isBlockedAABB(grid, 24, 8, 4, 4)).toBe(true);
  });
});

describe('isSolidAt', () => {
  test('reads the cell at (col, row), not (row, col)', () => {
    const grid = makeGrid([{ row: 3, col: 5 }]);
    expect(isSolidAt(grid, 5, 3)).toBe(true);
    expect(isSolidAt(grid, 3, 5)).toBe(false);
    expect(isSolidAt(grid, 0, 0)).toBe(false);
  });

  test('reads back what setSolidAt wrote', () => {
    const grid = makeGrid([]);
    setSolidAt(grid, 2, 7, true);
    expect(isSolidAt(grid, 2, 7)).toBe(true);
    setSolidAt(grid, 2, 7, false);
    expect(isSolidAt(grid, 2, 7)).toBe(false);
  });

  test('treats any non-zero cell as solid, like isBlockedAABB', () => {
    const grid = makeGrid([]);
    grid.solid[4 * W + 4] = 7;
    expect(isSolidAt(grid, 4, 4)).toBe(true);
  });

  test("outside the grid is solid on an outside: 'solid' grid", () => {
    const grid = makeGrid([]);
    expect(isSolidAt(grid, -1, 0)).toBe(true);
    expect(isSolidAt(grid, 0, -1)).toBe(true);
    expect(isSolidAt(grid, W, 0)).toBe(true);
    expect(isSolidAt(grid, 0, H)).toBe(true);
    expect(isSolidAt(grid, 0.5, 0)).toBe(true);
    expect(isSolidAt(grid, Number.NaN, 0)).toBe(true);
  });

  test("outside the grid is empty on an outside: 'open' grid", () => {
    // Row 5 col 0 is solid: col = W on row 4 must not alias onto it.
    const grid = buildSolidGrid(W, H, TS, [{ row: 5, col: 0 }], { outside: 'open' });
    expect(isSolidAt(grid, -1, 0)).toBe(false);
    expect(isSolidAt(grid, 0, -1)).toBe(false);
    expect(isSolidAt(grid, W, 4)).toBe(false);
    expect(isSolidAt(grid, 0, H)).toBe(false);
    expect(isSolidAt(grid, 0, 5.5)).toBe(false);
    expect(isSolidAt(grid, Number.NaN, 0)).toBe(false);
    expect(isSolidAt(grid, 0, 5)).toBe(true);
  });
});
