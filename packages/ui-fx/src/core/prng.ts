/** A seeded stream of uniform draws. `s` is the whole state, one int32, so it copies as a number. */
export interface PrngStream {
  s: number;
}

// One stream per concern, so drawing more values for one (say, more shard sites) never shifts the
// values another gets from the same seed.
const SALTS = {
  sites: 0x9e3779b9,
  velocity: 0x85ebca6b,
  timing: 0xc2b2ae35,
  noise: 0x27d4eb2f,
} as const;

/** A stream for one concern of a seed. The same seed and concern always give the same draws. */
export function createStream(
  seed: number,
  concern: 'sites' | 'velocity' | 'timing' | 'noise',
): PrngStream {
  return { s: (seed ^ SALTS[concern]) | 0 };
}

/** The next draw in [0, 1), advancing the stream (mulberry32). */
export function nextUnit(st: PrngStream): number {
  st.s = (st.s + 0x6d2b79f5) | 0;
  let t = Math.imul(st.s ^ (st.s >>> 15), 1 | st.s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
