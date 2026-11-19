/**
 * Convex pieces of an element, in coordinates normalised to 0..1 of its box. Piece `i` owns
 * vertices `vertexStart[i]` up to `vertexStart[i + 1]`, stored as x, y pairs in `vertices`.
 * `centroids` holds an x, y pair per piece, `areas` a fraction of the box per piece, and `bounds`
 * minX, minY, maxX, maxY per piece. `rectangular` is true when every piece is an axis-aligned
 * rectangle.
 *
 * A mesh that came from a cache is shared: read it, never write to it.
 */
export interface FractureMesh {
  count: number;
  vertexStart: Uint32Array;
  vertices: Float32Array;
  centroids: Float32Array;
  areas: Float32Array;
  bounds: Float32Array;
  rectangular: boolean;
}

/**
 * Where each piece sits in a shard atlas of `atlasW` by `atlasH` pixels. `rects` holds x, y, w, h
 * per piece, in whole atlas pixels; `scale` is atlas pixels per element pixel.
 */
export interface ShardPacking {
  atlasW: number;
  atlasH: number;
  scale: number;
  rects: Float32Array;
}

/** Meshes by generation key, least recently used first. Made by `createFractureCache`. */
export interface FractureCache {
  capacity: number;
  entries: Map<string, FractureMesh>;
}

/** Polygons as a pattern emits them, before the gap and the per-piece measurements. */
export interface FracturePolygons {
  count: number;
  vertexStart: Uint32Array;
  vertices: Float32Array;
}
