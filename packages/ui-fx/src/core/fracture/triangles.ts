import { nextUnit, type PrngStream } from '../prng';
import type { FracturePolygons } from './types';

/**
 * Two triangles per grid cell, each cell split along a diagonal the stream picks. `points` are
 * the grid's corner points, as `latticePoints` lays them out.
 */
export function trianglePolygons(
  cols: number,
  rows: number,
  points: Float32Array,
  stream: PrngStream,
): FracturePolygons {
  const count = cols * rows * 2;
  const vertexStart = new Uint32Array(count + 1);
  const vertices = new Float32Array(count * 6);
  let o = 0;
  let piece = 0;
  const push = (a: number, b: number, c: number): void => {
    vertices[o++] = points[a]!;
    vertices[o++] = points[a + 1]!;
    vertices[o++] = points[b]!;
    vertices[o++] = points[b + 1]!;
    vertices[o++] = points[c]!;
    vertices[o++] = points[c + 1]!;
    vertexStart[++piece] = o / 2;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const topLeft = (r * (cols + 1) + c) * 2;
      const topRight = topLeft + 2;
      const bottomLeft = topLeft + (cols + 1) * 2;
      const bottomRight = bottomLeft + 2;
      if (nextUnit(stream) < 0.5) {
        push(topLeft, topRight, bottomRight);
        push(topLeft, bottomRight, bottomLeft);
      } else {
        push(topLeft, topRight, bottomLeft);
        push(topRight, bottomRight, bottomLeft);
      }
    }
  }
  return { count, vertexStart, vertices };
}
