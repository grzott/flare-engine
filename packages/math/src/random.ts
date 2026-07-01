import type { Rect } from './rect.js';
import type { Vec2 } from './vec2.js';

/** Seeded PRNG using mulberry32 algorithm. */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns an integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }
}

/** Returns a random float in [min, max). */
export function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Returns a random integer in [min, max] (inclusive). */
export function randomInt(min: number, max: number): number {
  return Math.floor(randomFloat(min, max + 1));
}

/** Returns a random Vec2 within a rect. */
export function randomVec2InRect(r: Rect): Vec2 {
  return {
    x: r.x + Math.random() * r.width,
    y: r.y + Math.random() * r.height,
  };
}

/** Returns a random point inside a circle (uniform distribution). */
export function randomPointInCircle(cx: number, cy: number, radius: number): Vec2 {
  // Use sqrt for uniform distribution
  const r = radius * Math.sqrt(Math.random());
  const angle = Math.random() * Math.PI * 2;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

/** Fisher-Yates shuffle (in-place). Returns the array. */
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = array[i]!;
    array[i] = array[j]!;
    array[j] = tmp;
  }
  return array;
}

/** Returns a random element from the array. */
export function choose<T>(array: readonly T[]): T | undefined {
  if (array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Picks an index from a weight array using a cumulative walk.
 * `roll01` must be in [0, 1); returns 0 for an empty or all-zero array.
 */
export function weightedIndex(weights: readonly number[], roll01: number): number {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i] ?? 0;
  if (total <= 0) return 0;
  const target = roll01 * total;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i] ?? 0;
    if (target < acc) return i;
  }
  return weights.length - 1;
}

/**
 * Picks an index from `items` using a per-item weight accessor.
 * `roll01` must be in [0, 1); returns 0 for an empty or all-zero-weight array.
 */
export function weightedIndexBy<T>(
  items: readonly T[],
  weight: (item: T) => number,
  roll01: number,
): number {
  let total = 0;
  for (let i = 0; i < items.length; i++) total += weight(items[i] as T);
  if (total <= 0) return 0;
  const target = roll01 * total;
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    acc += weight(items[i] as T);
    if (target < acc) return i;
  }
  return items.length - 1;
}

/**
 * Picks an item from `items` using a per-item weight accessor.
 * Returns `undefined` for an empty array; returns the last item on float-edge.
 */
export function weightedPick<T>(
  items: readonly T[],
  weight: (item: T) => number,
  roll01: number,
): T | undefined {
  if (items.length === 0) return undefined;
  return items[weightedIndexBy(items, weight, roll01)];
}

/**
 * 32-bit avalanche finalizer (lowbias32). Mixes `seed` so that adjacent seeds
 * decorrelate into different output values. Returns an unsigned 32-bit integer.
 *
 * Constants from https://nullprogram.com/blog/2018/07/31/ (lowbias32).
 */
export function hashU32(seed: number): number {
  let h = (seed | 0) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Deterministically maps `seed` to an index in [0, count).
 * Single-entry pools short-circuit to 0. Uses `hashU32` to decorrelate
 * adjacent seeds before the modulo.
 */
export function seededIndex(seed: number, count: number): number {
  if (count <= 1) return 0;
  return hashU32(seed) % count;
}
