import type { CanvasKit } from 'canvaskit-wasm';

/** The buffers one `drawAtlas` call reads. Sprite `i` is at `i * 4` in `srcs` and `xforms`. */
export interface AtlasPool {
  /** Each sprite's source rect in the atlas image: left, top, right, bottom, in image pixels. */
  srcs: Float32Array;
  /** Each sprite's RSXform: scos, ssin, tx, ty. A sprite at zero scale draws nothing. */
  xforms: Float32Array;
  /** Each sprite's colour as an ARGB integer, multiplied into the sprite. */
  colors: Uint32Array;
}

const MIN_TIER = 64;

const pools = new WeakMap<CanvasKit, Map<number, AtlasPool>>();

/**
 * The atlas buffers for up to `capacity` sprites. They are allocated once per capacity tier, a
 * power of two from 64 up, and every later call for that tier gets the same arrays: a run
 * allocates none, and a frame none either.
 *
 * The arrays hold the whole tier, which `drawAtlas` draws in one call, so sprites a run does not
 * use have to sit at zero scale. A new pool is all zero scale and untinted. Runs of one tier
 * share it, which is safe only because each fills it and draws it in one go.
 */
export function createAtlasPool(kit: CanvasKit, capacity: number): AtlasPool {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new RangeError(`createAtlasPool: capacity must be a positive integer, got ${capacity}`);
  }
  let tier = MIN_TIER;
  while (tier < capacity) tier *= 2;

  let tiers = pools.get(kit);
  if (tiers === undefined) {
    tiers = new Map();
    pools.set(kit, tiers);
  }
  let pool = tiers.get(tier);
  if (pool === undefined) {
    pool = {
      srcs: new Float32Array(tier * 4),
      xforms: new Float32Array(tier * 4),
      colors: new Uint32Array(tier).fill(0xffffffff),
    };
    tiers.set(tier, pool);
  }
  return pool;
}
