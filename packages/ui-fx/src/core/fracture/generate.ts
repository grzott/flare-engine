import type { FragmentSpec } from '../presets';
import { createStream } from '../prng';
import { cachedFracture, storeFracture } from './cache';
import { cellGridFor } from './cells';
import { gridDimsFor, gridPolygons, latticePoints } from './grid';
import { radialGlassPolygons } from './radial-glass';
import { trianglePolygons } from './triangles';
import type { FractureCache, FractureMesh, FracturePolygons } from './types';

/** The `'cells'` cap (the default of `disintegrate`); the cell grows until the grid fits it. */
const MAX_CELLS = 3000;

const _measure = { x: 0, y: 0, area: 0 };

/** Area and area centroid of the `n` vertices from `start`, into `_measure`. */
function measurePiece(vertices: Float32Array, start: number, n: number): void {
  // Measured relative to the first vertex, so a small piece far from the origin loses no digits.
  const x0 = vertices[start * 2]!;
  const y0 = vertices[start * 2 + 1]!;
  let twice = 0;
  let sumX = 0;
  let sumY = 0;
  let meanX = 0;
  let meanY = 0;
  for (let k = 0; k < n; k++) {
    const a = (start + k) * 2;
    const b = (start + ((k + 1) % n)) * 2;
    const ax = vertices[a]! - x0;
    const ay = vertices[a + 1]! - y0;
    const bx = vertices[b]! - x0;
    const by = vertices[b + 1]! - y0;
    const cross = ax * by - bx * ay;
    twice += cross;
    sumX += (ax + bx) * cross;
    sumY += (ay + by) * cross;
    meanX += ax;
    meanY += ay;
  }
  _measure.area = Math.abs(twice) / 2;
  if (twice !== 0) {
    _measure.x = x0 + sumX / (3 * twice);
    _measure.y = y0 + sumY / (3 * twice);
  } else {
    // A piece with no area has no area centroid; its vertex mean stands in.
    _measure.x = x0 + meanX / n;
    _measure.y = y0 + meanY / n;
  }
}

/**
 * Shrink every piece about its centroid, each axis by the factor that pulls the vertex furthest
 * out on that axis in by `insetX` or `insetY`. Scaling an axis keeps a convex piece convex and a
 * rectangle a rectangle, and moves each side of a rectangle in by exactly the inset.
 */
function shrinkPieces(polygons: FracturePolygons, insetX: number, insetY: number): void {
  const { count, vertexStart, vertices } = polygons;
  for (let i = 0; i < count; i++) {
    const start = vertexStart[i]!;
    const end = vertexStart[i + 1]!;
    measurePiece(vertices, start, end - start);
    const cx = _measure.x;
    const cy = _measure.y;
    let reachX = 0;
    let reachY = 0;
    for (let v = start; v < end; v++) {
      reachX = Math.max(reachX, Math.abs(vertices[v * 2]! - cx));
      reachY = Math.max(reachY, Math.abs(vertices[v * 2 + 1]! - cy));
    }
    // A piece narrower than the gap collapses onto its centroid.
    const scaleX = reachX > insetX ? 1 - insetX / reachX : 0;
    const scaleY = reachY > insetY ? 1 - insetY / reachY : 0;
    for (let v = start; v < end; v++) {
      vertices[v * 2] = cx + (vertices[v * 2]! - cx) * scaleX;
      vertices[v * 2 + 1] = cy + (vertices[v * 2 + 1]! - cy) * scaleY;
    }
  }
}

function meshOf(polygons: FracturePolygons, rectangular: boolean): FractureMesh {
  const { count, vertexStart, vertices } = polygons;
  const centroids = new Float32Array(count * 2);
  const areas = new Float32Array(count);
  const bounds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const start = vertexStart[i]!;
    const end = vertexStart[i + 1]!;
    measurePiece(vertices, start, end - start);
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let v = start; v < end; v++) {
      const x = vertices[v * 2]!;
      const y = vertices[v * 2 + 1]!;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    // Clamped because rounding to Float32 can put the centroid of a sliver just outside it.
    centroids[i * 2] = Math.min(maxX, Math.max(minX, _measure.x));
    centroids[i * 2 + 1] = Math.min(maxY, Math.max(minY, _measure.y));
    areas[i] = _measure.area;
    bounds[i * 4] = minX;
    bounds[i * 4 + 1] = minY;
    bounds[i * 4 + 2] = maxX;
    bounds[i * 4 + 3] = maxY;
  }
  return { count, vertexStart, vertices, centroids, areas, bounds, rectangular };
}

/**
 * Break a `widthPx` by `heightPx` element into the convex pieces `spec` describes. With `gap 0`
 * the pieces tile the element exactly; a gap leaves that many pixels between neighbouring
 * rectangles, and at most that many between other shapes.
 *
 * - `'grid'`, `'jittered-grid'` and `'triangles'` give at most `count` pieces, near-square for
 *   the element's aspect. Jitter moves interior grid points by up to `jitter` of a quarter cell.
 * - `'radial-glass'` breaks around `focus`. There is no press point here, so `'press'` is the
 *   centre; pass the press point as `{ x, y }` to break around it.
 * - `'cells'` gives `cell`-pixel rectangles, the cell growing until there are at most 3,000.
 *
 * `'grid'` and `'cells'` do not use the seed. `distribution`, `deviation`, `anisotropy`,
 * `rotation` and `subdivide` are not read.
 *
 * The shape depends on the element's aspect rounded to 2 decimal places, not on its exact size,
 * so with a `cache` every size of one aspect shares a mesh. A gapped or `'cells'` mesh is sized
 * in pixels and is shared only at the same size. A cached mesh is the same object on every call:
 * do not write to it.
 *
 * Throws a `RangeError` for a size that is not positive and finite.
 */
export function generateFracture(
  spec: FragmentSpec,
  widthPx: number,
  heightPx: number,
  cache?: FractureCache,
): FractureMesh {
  if (!(widthPx > 0 && heightPx > 0 && Number.isFinite(widthPx) && Number.isFinite(heightPx))) {
    throw new RangeError(
      `generateFracture: size must be positive and finite, got ${widthPx} x ${heightPx}`,
    );
  }
  const { pattern, count, seed, gap } = spec;
  const jitter = Math.min(1, Math.max(0, spec.jitter));
  const focusX = typeof spec.focus === 'string' ? 0.5 : spec.focus.x;
  const focusY = typeof spec.focus === 'string' ? 0.5 : spec.focus.y;
  const aspect = Math.max(0.01, Math.round((widthPx / heightPx) * 100) / 100);

  let key = '';
  if (cache !== undefined) {
    const sized = pattern === 'cells' || gap > 0 ? `${widthPx}x${heightPx}` : '';
    key = `${pattern}|${count}|${spec.cell}|${seed}|${jitter}|${focusX},${focusY}|${gap}|${aspect}|${sized}`;
    const hit = cachedFracture(cache, key);
    if (hit !== undefined) return hit;
  }

  let polygons: FracturePolygons;
  if (pattern === 'radial-glass') {
    polygons = radialGlassPolygons(count, focusX, focusY, aspect, jitter, seed);
  } else if (pattern === 'cells') {
    const { cols, rows } = cellGridFor(widthPx, heightPx, spec.cell, MAX_CELLS);
    polygons = gridPolygons(cols, rows, latticePoints(cols, rows, 0, null));
  } else if (pattern === 'grid') {
    const { cols, rows } = gridDimsFor(count, aspect);
    polygons = gridPolygons(cols, rows, latticePoints(cols, rows, 0, null));
  } else {
    const stream = createStream(seed, 'sites');
    const { cols, rows } = gridDimsFor(pattern === 'triangles' ? count / 2 : count, aspect);
    const points = latticePoints(cols, rows, jitter, stream);
    polygons =
      pattern === 'triangles'
        ? trianglePolygons(cols, rows, points, stream)
        : gridPolygons(cols, rows, points);
  }

  if (gap > 0) shrinkPieces(polygons, gap / 2 / widthPx, gap / 2 / heightPx);
  const mesh = meshOf(polygons, pattern === 'grid' || pattern === 'cells');
  if (cache !== undefined) storeFracture(cache, key, mesh);
  return mesh;
}
