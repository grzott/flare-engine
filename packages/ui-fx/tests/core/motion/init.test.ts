import { describe, expect, test } from 'bun:test';
import type { Vec2Out } from '../../../src/core/conventions';
import { generateFracture } from '../../../src/core/fracture/generate';
import type { FractureMesh } from '../../../src/core/fracture/types';
import { initFragmentsInto, packPhysicsInto } from '../../../src/core/motion/init';
import {
  A0,
  ADRAG,
  CX,
  DELAY,
  DEPTH,
  DRAG,
  FADE_START,
  FRAG_STRIDE,
  GX,
  GY,
  HX,
  HY,
  LIFE,
  MASS,
  OMEGA,
  OMEGA0,
  OP0,
  OP1,
  PHYS_LEN,
  REVERSE_MODE,
  SC0,
  SC1,
  SRC,
  TOTAL,
  VX,
  VY,
  VZ,
  ZETA,
} from '../../../src/core/motion/layout';
import {
  type DisintegratePreset,
  disintegrate,
  type FragmentPresetOptions,
  type ShatterPreset,
  shatter,
} from '../../../src/core/presets';

const W = 300;
const H = 300;

type Options = FragmentPresetOptions<ShatterPreset>;

/** A 6×6 grid thrown from the centre, with every random term off unless `over` turns it on. */
const calm = (over: Options = {}): ShatterPreset =>
  shatter({
    ...over,
    fragment: { pattern: 'grid', count: 36, ...over.fragment },
    forces: over.forces ?? [{ origin: 'center' }],
    release: { timingRandomness: 0, ...over.release },
    physics: { randomness: 0, massVariance: 0, ...over.physics },
    life: { lifetimeVariance: 0, ...over.life },
  });

interface Built {
  mesh: FractureMesh;
  state: Float32Array;
  count: number;
}

const build = (
  p: ShatterPreset | DisintegratePreset,
  press: Vec2Out | null = null,
  w = W,
  h = H,
): Built => {
  const mesh = generateFracture(p.fragment, w, h);
  const state = new Float32Array(mesh.count * FRAG_STRIDE);
  return { mesh, state, count: initFragmentsInto(mesh, p, w, h, press, state) };
};

const at = (b: Built, i: number, slot: number): number => b.state[i * FRAG_STRIDE + slot]!;

describe('initFragmentsInto', () => {
  test('returns the piece count and fills 12 floats per piece', () => {
    const b = build(shatter());
    expect(b.count).toBe(b.mesh.count);
    expect(b.count).toBeGreaterThan(0);
    for (const value of b.state) expect(Number.isFinite(value)).toBe(true);
  });

  test('home is the centroid in pixels, unrotated, and SRC is the piece index', () => {
    const b = build(shatter(), null, 320, 200);
    for (let i = 0; i < b.count; i++) {
      expect(at(b, i, HX)).toBeCloseTo(b.mesh.centroids[i * 2]! * 320, 3);
      expect(at(b, i, HY)).toBeCloseTo(b.mesh.centroids[i * 2 + 1]! * 200, 3);
      expect(at(b, i, A0)).toBe(0);
      expect(at(b, i, SRC)).toBe(i);
      expect(at(b, i, CX)).toBe(0);
    }
  });

  test('a radial force throws pieces away from its origin, equally fast at equal distance', () => {
    const b = build(calm());
    const byDistance = new Map<string, number>();
    for (let i = 0; i < b.count; i++) {
      const dx = at(b, i, HX) - W / 2;
      const dy = at(b, i, HY) - H / 2;
      const vx = at(b, i, VX);
      const vy = at(b, i, VY);
      expect(vx * dx + vy * dy).toBeGreaterThan(0);
      // v0 is parallel to d.
      expect(Math.abs(vx * dy - vy * dx)).toBeLessThan(1e-2);
      const key = Math.hypot(dx, dy).toFixed(3);
      const speed = Math.hypot(vx, vy);
      const known = byDistance.get(key);
      if (known === undefined) byDistance.set(key, speed);
      else expect(speed).toBeCloseTo(known, 3);
    }
    // A 6×6 grid has 6 distinct centre distances, so pieces did share a distance.
    expect(byDistance.size).toBe(6);
  });

  test('linear falloff slows pieces farther from the origin, down to 0 at the radius', () => {
    const near = build(calm({ forces: [{ origin: 'center', radius: 1.5, strength: 900 }] }));
    const speeds: [number, number][] = [];
    for (let i = 0; i < near.count; i++) {
      const dist = Math.hypot(at(near, i, HX) - W / 2, at(near, i, HY) - H / 2);
      const speed = Math.hypot(at(near, i, VX), at(near, i, VY));
      expect(speed).toBeCloseTo(900 * (1 - dist / (1.5 * Math.hypot(W, H))), 2);
      speeds.push([dist, speed]);
    }
    speeds.sort((a, b) => a[0] - b[0]);
    expect(speeds[0]![1]).toBeGreaterThan(speeds[speeds.length - 1]![1]);

    const tiny = build(calm({ forces: [{ origin: 'center', radius: 0.01 }] }));
    for (let i = 0; i < tiny.count; i++) {
      expect(Math.hypot(at(tiny, i, VX), at(tiny, i, VY))).toBe(0);
    }
  });

  test("falloff 'none' gives every piece the full strength", () => {
    const b = build(calm({ forces: [{ origin: 'center', falloff: 'none', strength: 500 }] }));
    for (let i = 0; i < b.count; i++) {
      expect(Math.hypot(at(b, i, VX), at(b, i, VY))).toBeCloseTo(500, 2);
    }
  });

  test('smoothstep and inverse-square falloffs decrease with distance and stay in 0..1', () => {
    for (const falloff of ['smoothstep', 'inverse-square'] as const) {
      const b = build(calm({ forces: [{ origin: 'center', falloff, radius: 0.5, strength: 1 }] }));
      const speeds: [number, number][] = [];
      for (let i = 0; i < b.count; i++) {
        speeds.push([
          Math.hypot(at(b, i, HX) - W / 2, at(b, i, HY) - H / 2),
          Math.hypot(at(b, i, VX), at(b, i, VY)),
        ]);
      }
      speeds.sort((a, b2) => a[0] - b2[0]);
      for (let n = 1; n < speeds.length; n++) {
        expect(speeds[n]![1]).toBeLessThanOrEqual(speeds[n - 1]![1] + 1e-6);
        expect(speeds[n]![1]).toBeLessThanOrEqual(1);
        expect(speeds[n]![1]).toBeGreaterThanOrEqual(0);
      }
      expect(speeds[0]![1]).toBeGreaterThan(speeds[speeds.length - 1]![1]);
    }
  });

  test('implode and a negative strength both pull toward the origin', () => {
    const pulls = [
      calm({ forces: [{ origin: 'center', kind: 'implode' }] }),
      calm({ forces: [{ origin: 'center', strength: -900 }] }),
    ];
    for (const p of pulls) {
      const b = build(p);
      for (let i = 0; i < b.count; i++) {
        const dot = at(b, i, VX) * (at(b, i, HX) - W / 2) + at(b, i, VY) * (at(b, i, HY) - H / 2);
        expect(dot).toBeLessThan(0);
      }
    }
  });

  test('a directional force throws every piece along its angle', () => {
    const b = build(
      calm({ forces: [{ origin: 'center', kind: 'directional', angle: 90, falloff: 'none' }] }),
    );
    for (let i = 0; i < b.count; i++) {
      expect(at(b, i, VX)).toBeCloseTo(900, 2);
      expect(at(b, i, VY)).toBeCloseTo(0, 2);
    }
  });

  test('a vortex throws pieces clockwise around its origin', () => {
    const b = build(calm({ forces: [{ origin: 'center', kind: 'vortex' }] }));
    for (let i = 0; i < b.count; i++) {
      const dx = at(b, i, HX) - W / 2;
      const dy = at(b, i, HY) - H / 2;
      expect(Math.abs(at(b, i, VX) * dx + at(b, i, VY) * dy)).toBeLessThan(1e-2);
      // Screen y points down, so a positive cross product is clockwise on screen.
      expect(dx * at(b, i, VY) - dy * at(b, i, VX)).toBeGreaterThan(0);
    }
  });

  test('two forces add, and no force leaves every piece at rest', () => {
    const one = build(calm({ forces: [{ origin: 'center' }] }));
    const push = build(
      calm({ forces: [{ origin: 'center', kind: 'directional', angle: 90, falloff: 'none' }] }),
    );
    const both = build(
      calm({
        forces: [
          { origin: 'center' },
          { origin: 'center', kind: 'directional', angle: 90, falloff: 'none' },
        ],
      }),
    );
    const none = build(calm({ forces: [] }));
    for (let i = 0; i < both.count; i++) {
      expect(at(both, i, VX)).toBeCloseTo(at(one, i, VX) + at(push, i, VX), 2);
      expect(at(both, i, VY)).toBeCloseTo(at(one, i, VY) + at(push, i, VY), 2);
      expect(at(none, i, VX)).toBe(0);
      expect(at(none, i, VY)).toBe(0);
    }
  });

  test('a piece sitting on the origin of a radial force gets no push from it', () => {
    // 9 pieces: the middle one's centroid is the centre.
    const b = build(calm({ fragment: { pattern: 'grid', count: 9 } }));
    expect(b.count).toBe(9);
    expect(at(b, 4, VX)).toBe(0);
    expect(at(b, 4, VY)).toBe(0);
  });

  test("press = null with origin 'press' uses the centre", () => {
    const pressed = calm({ forces: [{ origin: 'press' }] });
    const centred = calm({ forces: [{ origin: 'center' }] });
    expect(build(pressed, null).state).toEqual(build(centred, null).state);
    expect(build(pressed, { x: 20, y: 250 }).state).not.toEqual(build(centred, null).state);
    expect(build(pressed, { x: 20, y: 250 }).state).toEqual(
      build(calm({ forces: [{ origin: { x: 20 / W, y: 250 / H } }] }), null).state,
    );
  });

  test('mass is 1 without variance and area/meanArea at full variance', () => {
    const fragment = { pattern: 'radial-glass', count: 40 } as const;
    const flat = build(calm({ fragment }));
    const full = build(calm({ fragment, physics: { massVariance: 1 } }));
    const half = build(calm({ fragment, physics: { massVariance: 0.5 } }));
    let sum = 0;
    for (let i = 0; i < full.count; i++) sum += full.mesh.areas[i]!;
    const mean = sum / full.count;
    for (let i = 0; i < full.count; i++) {
      const ratio = full.mesh.areas[i]! / mean;
      expect(at(flat, i, MASS)).toBe(1);
      expect(at(full, i, MASS)).toBeCloseTo(ratio, 4);
      expect(at(half, i, MASS)).toBeCloseTo(1 + (ratio - 1) * 0.5, 4);
      // v0 is divided by the mass.
      const flatSpeed = Math.hypot(at(flat, i, VX), at(flat, i, VY));
      const halfSpeed = Math.hypot(at(half, i, VX), at(half, i, VY));
      expect(halfSpeed * at(half, i, MASS)).toBeCloseTo(flatSpeed, 1);
    }
  });

  test('randomness spreads direction within ±randomness·spread and speed within ±randomness/2', () => {
    const b = build(
      calm({
        forces: [{ origin: 'center', falloff: 'none', strength: 1000, spread: 40 }],
        physics: { randomness: 0.5 },
      }),
    );
    let turned = 0;
    for (let i = 0; i < b.count; i++) {
      const dx = at(b, i, HX) - W / 2;
      const dy = at(b, i, HY) - H / 2;
      const vx = at(b, i, VX);
      const vy = at(b, i, VY);
      const speed = Math.hypot(vx, vy);
      expect(speed).toBeGreaterThanOrEqual(750 - 1e-2);
      expect(speed).toBeLessThanOrEqual(1250 + 1e-2);
      const angle = Math.abs(Math.atan2(dx * vy - dy * vx, dx * vx + dy * vy)) * (180 / Math.PI);
      expect(angle).toBeLessThanOrEqual(20 + 1e-3);
      if (angle > 1) turned++;
    }
    expect(turned).toBeGreaterThan(0);
  });

  test('spin 0 gives no angular velocity; otherwise it stays within spin·(0.5 + randomness)', () => {
    const still = build(calm({ physics: { spin: 0 } }));
    const spun = build(calm({ physics: { spin: 360, randomness: 0.35 } }));
    const limit = 360 * (Math.PI / 180) * 0.85;
    let turning = 0;
    for (let i = 0; i < spun.count; i++) {
      expect(Math.abs(at(still, i, OMEGA))).toBe(0);
      expect(Math.abs(at(spun, i, OMEGA))).toBeLessThanOrEqual(limit + 1e-4);
      if (at(spun, i, OMEGA) !== 0) turning++;
    }
    expect(turning).toBeGreaterThan(0);
  });

  test('vz is a seeded draw in -1..1', () => {
    const b = build(calm());
    const seen = new Set<number>();
    for (let i = 0; i < b.count; i++) {
      expect(at(b, i, VZ)).toBeGreaterThanOrEqual(-1);
      expect(at(b, i, VZ)).toBeLessThan(1);
      seen.add(at(b, i, VZ));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  test('a radial release delays pieces by their distance from the origin', () => {
    const b = build(calm({ release: { order: 'radial', duration: 0.4 } }));
    const maxD = Math.hypot(W / 2, H / 2);
    for (let i = 0; i < b.count; i++) {
      const dist = Math.hypot(at(b, i, HX) - W / 2, at(b, i, HY) - H / 2);
      expect(at(b, i, DELAY)).toBeCloseTo((dist / maxD) * 0.4, 5);
    }
  });

  test('a sweep release at 90° gives the leftmost pieces the smallest delays', () => {
    const b = build(calm({ release: { order: 'sweep', angle: 90, duration: 0.5 } }));
    for (let i = 0; i < b.count; i++) {
      expect(at(b, i, DELAY)).toBeCloseTo((at(b, i, HX) / W) * 0.5, 5);
    }
  });

  test('a sweep release stays within 0..duration at any angle and on any aspect', () => {
    for (const angle of [0, 45, 135, 180, 270, 315]) {
      const p = calm({ release: { order: 'sweep', angle, duration: 0.5 } });
      const mesh = generateFracture(p.fragment, 400, 100);
      const state = new Float32Array(mesh.count * FRAG_STRIDE);
      const count = initFragmentsInto(mesh, p, 400, 100, null, state);
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < count; i++) {
        min = Math.min(min, state[i * FRAG_STRIDE + DELAY]!);
        max = Math.max(max, state[i * FRAG_STRIDE + DELAY]!);
      }
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeLessThanOrEqual(0.5);
      expect(max).toBeGreaterThan(min);
    }
    // At 270° the front travels toward -x, so the rightmost pieces go first.
    const b = build(calm({ release: { order: 'sweep', angle: 270, duration: 0.5 } }));
    for (let i = 0; i < b.count; i++) {
      expect(at(b, i, DELAY)).toBeCloseTo((1 - at(b, i, HX) / W) * 0.5, 5);
    }
  });

  test('a random release draws each delay from 0..duration', () => {
    const b = build(calm({ release: { order: 'random', duration: 0.3 } }));
    const seen = new Set<number>();
    for (let i = 0; i < b.count; i++) {
      expect(at(b, i, DELAY)).toBeGreaterThanOrEqual(0);
      expect(at(b, i, DELAY)).toBeLessThanOrEqual(Math.fround(0.3));
      seen.add(at(b, i, DELAY));
    }
    expect(seen.size).toBeGreaterThan(b.count / 2);
  });

  test('timingRandomness adds up to that share of the duration, never past the duration', () => {
    const base = build(calm({ release: { order: 'radial', duration: 0.4 } }));
    const loose = build(
      calm({ release: { order: 'radial', duration: 0.4, timingRandomness: 0.5 } }),
    );
    let moved = 0;
    for (let i = 0; i < base.count; i++) {
      const extra = at(loose, i, DELAY) - at(base, i, DELAY);
      expect(extra).toBeGreaterThanOrEqual(0);
      expect(extra).toBeLessThanOrEqual(0.2 + 1e-6);
      expect(at(loose, i, DELAY)).toBeLessThanOrEqual(Math.fround(0.4));
      if (extra > 0) moved++;
    }
    expect(moved).toBeGreaterThan(0);
  });

  test('life is the lifetime, spread by ±lifetimeVariance', () => {
    const fixed = build(calm({ life: { lifetime: 0.9 } }));
    const varied = build(calm({ life: { lifetime: 0.9, lifetimeVariance: 0.25 } }));
    const seen = new Set<number>();
    for (let i = 0; i < fixed.count; i++) {
      expect(at(fixed, i, LIFE)).toBeCloseTo(0.9, 6);
      expect(at(varied, i, LIFE)).toBeGreaterThanOrEqual(0.9 * 0.75 - 1e-6);
      expect(at(varied, i, LIFE)).toBeLessThanOrEqual(0.9 * 1.25 + 1e-6);
      seen.add(at(varied, i, LIFE));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  test('every piece of the default presets is done by TOTAL', () => {
    for (const p of [shatter(), disintegrate()]) {
      const b = build(p, { x: 10, y: 10 }, 360, 64);
      const total = packPhysicsInto(p, new Float32Array(PHYS_LEN))[TOTAL]!;
      for (let i = 0; i < b.count; i++) {
        expect(at(b, i, DELAY)).toBeGreaterThanOrEqual(0);
        expect(at(b, i, DELAY) + at(b, i, LIFE)).toBeLessThanOrEqual(total + 1e-6);
      }
    }
  });

  test('the same seed gives byte-equal arrays; another seed does not', () => {
    const bytes = (seed: number): Uint8Array =>
      new Uint8Array(build(shatter({ fragment: { seed } })).state.buffer);
    expect(bytes(7)).toEqual(bytes(7));
    expect(bytes(7)).not.toEqual(bytes(8));
  });

  test('filling the same buffer again leaves no trace of the earlier run', () => {
    const p = shatter();
    const mesh = generateFracture(p.fragment, W, H);
    const state = new Float32Array(mesh.count * FRAG_STRIDE).fill(123);
    initFragmentsInto(mesh, shatter({ fragment: { seed: 9 } }), W, H, null, state);
    initFragmentsInto(mesh, p, W, H, null, state);
    expect(Array.from(state)).toEqual(Array.from(build(p).state));
  });

  test('rejects a buffer shorter than 12 floats per piece', () => {
    const p = shatter();
    const mesh = generateFracture(p.fragment, W, H);
    const short = new Float32Array(mesh.count * FRAG_STRIDE - 1);
    expect(() => initFragmentsInto(mesh, p, W, H, null, short)).toThrow(RangeError);
  });
});

describe('packPhysicsInto', () => {
  test('writes into and returns out', () => {
    const out = new Float32Array(PHYS_LEN);
    expect(packPhysicsInto(shatter(), out)).toBe(out);
  });

  test('packs the shatter defaults', () => {
    const phys = packPhysicsInto(shatter(), new Float32Array(PHYS_LEN).fill(9));
    // Gravity 1800 at 180°: straight down the screen.
    expect(phys[GX]!).toBeCloseTo(0, 6);
    expect(phys[GY]!).toBeCloseTo(1800, 3);
    expect(phys[DRAG]!).toBeCloseTo(1.2, 6);
    expect(phys[ADRAG]!).toBeCloseTo(0.8, 6);
    expect(phys[DEPTH]!).toBe(0);
    expect(phys[OP0]!).toBe(1);
    expect(phys[OP1]!).toBe(0);
    expect(phys[SC0]!).toBe(1);
    expect(phys[SC1]!).toBeCloseTo(0.85, 6);
    expect(phys[FADE_START]!).toBeCloseTo(0.55, 6);
    expect(phys[REVERSE_MODE]!).toBe(0);
    expect(phys[TOTAL]!).toBeCloseTo(0.15 + 0.9 * 1.25, 6);
    expect(phys[OMEGA0]!).toBeCloseTo((2 * Math.PI) / (0.15 + 0.9 * 1.25), 5);
    expect(phys[ZETA]!).toBe(1);
    expect(phys[14]!).toBe(0);
    expect(phys[15]!).toBe(0);
  });

  test('gravity follows gravityAngle: 90° is +x, 0° is up', () => {
    const right = packPhysicsInto(
      shatter({ physics: { gravity: 100, gravityAngle: 90 } }),
      new Float32Array(PHYS_LEN),
    );
    expect(right[GX]!).toBeCloseTo(100, 4);
    expect(right[GY]!).toBeCloseTo(0, 4);
    const up = packPhysicsInto(
      shatter({ physics: { gravity: 100, gravityAngle: 0 } }),
      new Float32Array(PHYS_LEN),
    );
    expect(up[GX]!).toBeCloseTo(0, 4);
    expect(up[GY]!).toBeCloseTo(-100, 4);
  });

  test('a preset with no run length packs finite values', () => {
    const phys = packPhysicsInto(
      shatter({ release: { duration: 0 }, life: { lifetime: 0 } }),
      new Float32Array(PHYS_LEN),
    );
    expect(phys[TOTAL]!).toBe(0);
    for (const value of phys) expect(Number.isFinite(value)).toBe(true);
  });

  test('rejects a buffer shorter than PHYS_LEN', () => {
    expect(() => packPhysicsInto(shatter(), new Float32Array(PHYS_LEN - 1))).toThrow(RangeError);
  });
});
