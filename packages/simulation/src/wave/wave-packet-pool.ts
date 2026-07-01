// RipplePool — a small fixed pool of expanding transverse wavefronts (analytic wave PACKETS, not a
// raw PDE: more controllable, unconditionally stable, and exactly the "ripples of gravitational
// waves radiating outward, spreading out and weakening" that the physics literature describes).
// Each emitted front is a localized ring of a few crests that travels outward at `speed`, attenuates
// as it spreads (≈1/√r), and decays over its `life`. ZERO engine/DOM imports — pure TS,
// allocation-free (fixed arrays, no per-call allocation). Bun-testable in isolation.

const TWO_PI = Math.PI * 2;
const PACKET_WIDTH = 1.3; // spatial extent of a front, in wavelengths (≈2-3 visible crests)
const ATTEN = 320; // px scale of the 1/√(1+R/ATTEN) spreading attenuation
const LIFE_CUTOFF = 5; // retire a front after age > life × this (its envelope is then ~0)

export interface RipplePool {
  readonly capacity: number;
  /** Live wavefront count. */
  readonly count: number;
  /** Emit an expanding wavefront from (x,y) born at sim time `now`. Overwrites the oldest slot
   *  when full so a long run never starves. */
  emit(
    x: number,
    y: number,
    now: number,
    amp: number,
    speed: number,
    wavelength: number,
    life: number,
  ): void;
  /** Summed transverse height (px, signed) at (x,y) from all live fronts at time `now`. */
  heightAt(x: number, y: number, now: number): number;
  /** Retire spent wavefronts (call once/frame). */
  prune(now: number): void;
  /** Drop all wavefronts (e.g. on resize). */
  clear(): void;
}

export function createRipplePool(capacity: number): RipplePool {
  const cap = Math.max(1, Math.floor(capacity));
  const ox = new Float32Array(cap);
  const oy = new Float32Array(cap);
  const t0 = new Float32Array(cap);
  const amp = new Float32Array(cap);
  const speed = new Float32Array(cap);
  const wavelength = new Float32Array(cap);
  const life = new Float32Array(cap);
  const active = new Uint8Array(cap);
  let live = 0;

  const freeSlot = (): number => {
    for (let i = 0; i < cap; i++) if (active[i] === 0) return i;
    // None free — reuse the oldest (smallest t0).
    let oldest = 0;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < cap; i++) {
      const t = t0[i] ?? 0;
      if (t < best) {
        best = t;
        oldest = i;
      }
    }
    return oldest;
  };

  return {
    capacity: cap,
    get count() {
      return live;
    },

    emit(x, y, now, a, sp, wl, lf) {
      const i = freeSlot();
      if (active[i] === 0) live++;
      ox[i] = x;
      oy[i] = y;
      t0[i] = now;
      amp[i] = a;
      speed[i] = sp;
      wavelength[i] = Math.max(1, wl);
      life[i] = Math.max(0.01, lf);
      active[i] = 1;
    },

    heightAt(x, y, now) {
      let h = 0;
      for (let i = 0; i < cap; i++) {
        if (active[i] === 0) continue;
        const age = now - (t0[i] ?? 0);
        if (age < 0) continue;
        const wl = wavelength[i] ?? 1;
        const R = (speed[i] ?? 0) * age; // current ring radius
        const dx = x - (ox[i] ?? 0);
        const dy = y - (oy[i] ?? 0);
        const d = Math.sqrt(dx * dx + dy * dy);
        const front = d - R; // 0 exactly on the ring
        const width = wl * PACKET_WIDTH;
        const env = Math.exp(-(front * front) / (2 * width * width)); // localized packet
        if (env < 1e-3) continue;
        const tdecay = Math.exp(-age / (life[i] ?? 1));
        const sdecay = 1 / Math.sqrt(1 + R / ATTEN); // weakens as it spreads
        const k = TWO_PI / wl;
        h += (amp[i] ?? 0) * env * tdecay * sdecay * Math.cos(k * front);
      }
      return h;
    },

    prune(now) {
      for (let i = 0; i < cap; i++) {
        if (active[i] === 0) continue;
        if (now - (t0[i] ?? 0) > (life[i] ?? 1) * LIFE_CUTOFF) {
          active[i] = 0;
          live--;
        }
      }
    },

    clear() {
      active.fill(0);
      live = 0;
    },
  };
}
