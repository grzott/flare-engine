import { nextUnit, type PrngStream } from '../prng';
import type { FracturePolygons } from './types';

/**
 * Columns and rows for at most `count` near-square cells on an element of the given aspect
 * (width over height). The grid never has more cells than `count`; it has fewer when `count`
 * does not divide into the rows.
 */
export function gridDimsFor(count: number, aspect: number): { cols: number; rows: number } {
  const n = Math.max(1, Math.floor(count));
  const rows = Math.min(n, Math.max(1, Math.round(Math.sqrt(n / aspect))));
  return { cols: Math.floor(n / rows), rows };
}

/**
 * The `(cols + 1) * (rows + 1)` corner points of a grid over the unit square, row by row. With a
 * stream, each interior point moves by up to `jitter` of a quarter cell on each axis; border
 * points stay where they are.
 *
 * A quarter cell is the furthest a point can go with every cell still convex: a corner stays on
 * its own side of the diagonal between its two neighbours only while none of the three travels
 * further than that.
 */
export function latticePoints(
  cols: number,
  rows: number,
  jitter: number,
  stream: PrngStream | null,
): Float32Array {
  const points = new Float32Array((cols + 1) * (rows + 1) * 2);
  const reachX = (jitter * 0.5) / cols;
  const reachY = (jitter * 0.5) / rows;
  let o = 0;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      let x = c / cols;
      let y = r / rows;
      if (stream !== null && c > 0 && c < cols && r > 0 && r < rows) {
        x += (nextUnit(stream) - 0.5) * reachX;
        y += (nextUnit(stream) - 0.5) * reachY;
      }
      points[o++] = x;
      points[o++] = y;
    }
  }
  return points;
}

/** One quad per grid cell, row by row, each wound top-left, top-right, bottom-right, bottom-left. */
export function gridPolygons(cols: number, rows: number, points: Float32Array): FracturePolygons {
  const count = cols * rows;
  const vertexStart = new Uint32Array(count + 1);
  const vertices = new Float32Array(count * 8);
  let o = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const topLeft = (r * (cols + 1) + c) * 2;
      const bottomLeft = topLeft + (cols + 1) * 2;
      vertices[o++] = points[topLeft]!;
      vertices[o++] = points[topLeft + 1]!;
      vertices[o++] = points[topLeft + 2]!;
      vertices[o++] = points[topLeft + 3]!;
      vertices[o++] = points[bottomLeft + 2]!;
      vertices[o++] = points[bottomLeft + 3]!;
      vertices[o++] = points[bottomLeft]!;
      vertices[o++] = points[bottomLeft + 1]!;
      vertexStart[r * cols + c + 1] = o / 2;
    }
  }
  return { count, vertexStart, vertices };
}
