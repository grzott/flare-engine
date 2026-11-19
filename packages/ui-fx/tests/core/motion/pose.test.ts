import { describe, expect, test } from 'bun:test';
import { generateFracture } from '../../../src/core/fracture/generate';
import { initFragmentsInto, packPhysicsInto } from '../../../src/core/motion/init';
import {
  A0,
  DELAY,
  DRAG,
  FRAG_STRIDE,
  GX,
  GY,
  HX,
  HY,
  LIFE,
  OMEGA0,
  PHYS_LEN,
  REVERSE_MODE,
  TOTAL,
  VX,
  VY,
  ZETA,
} from '../../../src/core/motion/layout';
import { fragmentPoseInto } from '../../../src/core/motion/pose';
import { type ShatterPreset, shatter } from '../../../src/core/presets';
import { springStepAt } from '../../../src/core/timing';
import { newPose, physOf, stateOf } from '../../support/motion';

const W = 320;
const H = 200;

const built = (p: ShatterPreset): { state: Float32Array; phys: Float32Array; count: number } => {
  const mesh = generateFracture(p.fragment, W, H);
  const state = new Float32Array(mesh.count * FRAG_STRIDE);
  const count = initFragmentsInto(mesh, p, W, H, null, state);
  return { state, phys: packPhysicsInto(p, new Float32Array(PHYS_LEN)), count };
};

// hx hy vx vy a0 omega delay life mass vz src cx
const PIECE = [100, 50, 240, -120, 0.25, 3, 0.2, 0.8, 1, 0.5, 0, 0];
// gx gy drag adrag depth op0 op1 sc0 sc1 fadeStart reverse omega0 zeta total
const PHYS = [30, 1800, 1.2, 0.8, 0, 1, 0, 1, 0.85, 0.55, 0, 2 * Math.PI, 1, 1];
const REWIND = 1;
const HOME = 2;
const SPRING_HOME = 3;

const withMode = (mode: number): Float32Array => {
  const phys = physOf(PHYS);
  phys[REVERSE_MODE] = mode;
  return phys;
};

describe('fragmentPoseInto, forward', () => {
  test('writes into and returns out', () => {
    const out = newPose();
    expect(fragmentPoseInto(stateOf(PIECE), 0, 0.5, physOf(PHYS), out)).toBe(out);
  });

  test('at t = 0 every piece of a default shatter is home, unrotated, opaque and unscaled', () => {
    const { state, phys, count } = built(shatter());
    expect(count).toBeGreaterThan(0);
    const out = newPose();
    for (let i = 0; i < count; i++) {
      fragmentPoseInto(state, i, 0, phys, out);
      expect(out.x).toBe(state[i * FRAG_STRIDE + HX]!);
      expect(out.y).toBe(state[i * FRAG_STRIDE + HY]!);
      expect(state[i * FRAG_STRIDE + A0]!).toBe(0);
      expect(out.rotation).toBe(0);
      expect(out.alpha).toBe(1);
      expect(out.scale).toBe(1);
    }
  });

  test('with gravity 0, drag 0 and spin 0 a piece moves at its launch velocity exactly', () => {
    const { state, phys, count } = built(shatter({ physics: { gravity: 0, drag: 0, spin: 0 } }));
    const out = newPose();
    let moving = 0;
    for (let i = 0; i < count; i++) {
      const o = i * FRAG_STRIDE;
      const tau = state[o + LIFE]! / 2;
      fragmentPoseInto(state, i, state[o + DELAY]! + tau, phys, out);
      expect(out.x).toBeCloseTo(state[o + HX]! + state[o + VX]! * tau, 9);
      expect(out.y).toBeCloseTo(state[o + HY]! + state[o + VY]! * tau, 9);
      expect(out.rotation).toBe(0);
      if (state[o + VX]! !== 0 || state[o + VY]! !== 0) moving++;
    }
    expect(moving).toBeGreaterThan(0);
  });

  test('with zero delay the drag-free form is hx + vx·τ to the last bit', () => {
    const state = stateOf([100, 50, 240, -120, 0, 0, 0, 0.8, 1, 0, 0, 0]);
    const phys = physOf([0, 0, 0, 0, 0, 1, 0, 1, 1, 0.5, 0, 1, 1, 1]);
    const out = fragmentPoseInto(state, 0, 0.3, phys, newPose());
    expect(out.x).toBe(100 + 240 * 0.3);
    expect(out.y).toBe(50 + -120 * 0.3);
  });

  test('drag 1.2 with gravity 1800 at 180° is the limit of semi-implicit Euler at τ = 0.5', () => {
    const { state, phys, count } = built(
      shatter({ physics: { drag: 1.2, gravity: 1800, gravityAngle: 180 } }),
    );
    expect(phys[GY]!).toBeCloseTo(1800, 3);
    const k = phys[DRAG]!;
    const gx = phys[GX]!;
    const gy = phys[GY]!;
    const out = newPose();
    /** Largest distance, over the sampled pieces, between the closed form and the integration. */
    const worstGap = (dt: number): number => {
      const steps = Math.round(0.5 / dt);
      let worst = 0;
      for (let i = 0; i < count; i += 7) {
        const o = i * FRAG_STRIDE;
        expect(state[o + LIFE]!).toBeGreaterThan(0.5);
        let x = state[o + HX]!;
        let y = state[o + HY]!;
        let vx = state[o + VX]!;
        let vy = state[o + VY]!;
        for (let n = 0; n < steps; n++) {
          vx += (gx - k * vx) * dt;
          vy += (gy - k * vy) * dt;
          x += vx * dt;
          y += vy * dt;
        }
        fragmentPoseInto(state, i, state[o + DELAY]! + 0.5, phys, out);
        worst = Math.max(worst, Math.abs(out.x - x), Math.abs(out.y - y));
      }
      return worst;
    };
    // The integrator is first order, so at dt = 1e-5 its own error under gravity 1800 is about
    // 7e-3 px. The gap shrinking tenfold per tenfold dt shows that error is the integrator's and
    // that the closed form is the limit; at dt = 1e-6 the two agree within 1e-3 px.
    const coarse = worstGap(1e-5);
    const fine = worstGap(1e-6);
    expect(coarse).toBeLessThan(1e-2);
    expect(fine).toBeLessThan(1e-3);
    expect(coarse / fine).toBeGreaterThan(9.5);
    expect(coarse / fine).toBeLessThan(10.5);
  });

  test('a piece with delay 0.2 sits at home for every t below 0.2', () => {
    const state = stateOf(PIECE);
    const phys = physOf(PHYS);
    const out = newPose();
    for (const t of [-1, 0, 0.05, 0.1, 0.19, 0.2]) {
      fragmentPoseInto(state, 0, t, phys, out);
      expect(out).toEqual({ x: 100, y: 50, rotation: 0.25, scale: 1, alpha: 1 });
    }
    fragmentPoseInto(state, 0, 0.21, phys, out);
    expect(out.x).toBeGreaterThan(100);
  });

  test('a piece holds its end-of-life pose once its life is over', () => {
    const state = stateOf(PIECE);
    const phys = physOf(PHYS);
    const atEnd = { ...fragmentPoseInto(state, 0, 1.5, phys, newPose()) };
    expect(fragmentPoseInto(state, 0, 5, phys, newPose())).toEqual(atEnd);
    expect(atEnd.alpha).toBe(0);
    expect(atEnd.scale).toBeCloseTo(0.85, 6);
  });

  test('rotation follows a0 + ω·(1 − e^(−ka·τ))/ka, or a0 + ω·τ without angular drag', () => {
    const state = stateOf(PIECE);
    const dragged = fragmentPoseInto(state, 0, 0.7, physOf(PHYS), newPose());
    expect(dragged.rotation).toBeCloseTo(0.25 + (3 * (1 - Math.exp(-0.8 * 0.5))) / 0.8, 6);
    const free = physOf(PHYS.map((value, slot) => (slot === 3 ? 0 : value)));
    expect(fragmentPoseInto(state, 0, 0.7, free, newPose()).rotation).toBeCloseTo(1.75, 6);
  });

  test('alpha holds op0 until fadeStart, then smoothsteps to op1', () => {
    const state = stateOf(PIECE);
    const phys = physOf(PHYS.map((value, slot) => (slot === 5 ? 0.9 : slot === 6 ? 0.1 : value)));
    const alphaAt = (u: number): number =>
      fragmentPoseInto(state, 0, 0.2 + u * 0.8, phys, newPose()).alpha;
    expect(alphaAt(0.3)).toBeCloseTo(0.9, 6);
    expect(alphaAt(0.5)).toBeCloseTo(0.9, 6);
    // Halfway through the fade smoothstep is 0.5.
    expect(alphaAt(0.775)).toBeCloseTo(0.5, 5);
    expect(alphaAt(1)).toBeCloseTo(0.1, 6);
  });

  test('a fadeStart of 1 never divides by zero', () => {
    const state = stateOf(PIECE);
    const phys = physOf(PHYS.map((value, slot) => (slot === 9 ? 1 : value)));
    expect(fragmentPoseInto(state, 0, 0.9, phys, newPose()).alpha).toBe(1);
    expect(fragmentPoseInto(state, 0, 1.5, phys, newPose()).alpha).toBe(0);
  });

  test('scale is lerp(sc0, sc1, u)·(1 + depth·vz·τ)', () => {
    const state = stateOf(PIECE);
    const flat = fragmentPoseInto(state, 0, 0.6, physOf(PHYS), newPose());
    expect(flat.scale).toBeCloseTo(1 + (0.85 - 1) * 0.5, 6);
    const deep = physOf(PHYS.map((value, slot) => (slot === 4 ? 0.5 : value)));
    expect(fragmentPoseInto(state, 0, 0.6, deep, newPose()).scale).toBeCloseTo(
      (1 + (0.85 - 1) * 0.5) * (1 + 0.5 * 0.5 * 0.4),
      6,
    );
  });

  test('a piece with no lifetime stays finite', () => {
    const state = stateOf(PIECE.map((value, slot) => (slot === 7 ? 0 : value)));
    const out = fragmentPoseInto(state, 0, 0.5, physOf(PHYS), newPose());
    for (const value of Object.values(out)) expect(Number.isFinite(value)).toBe(true);
  });
});

describe('fragmentPoseInto, reverse modes', () => {
  test('rewind at t equals forward at total − t', () => {
    const { state, phys, count } = built(shatter());
    const rewind = Float32Array.from(phys);
    rewind[REVERSE_MODE] = REWIND;
    const total = phys[TOTAL]!;
    for (let i = 0; i < count; i++) {
      for (const t of [0, 0.1, 0.4, 0.77, total]) {
        expect(fragmentPoseInto(state, i, t, rewind, newPose())).toEqual(
          fragmentPoseInto(state, i, total - t, phys, newPose()),
        );
      }
    }
  });

  test('rewind ends at home', () => {
    const state = stateOf(PIECE);
    expect(fragmentPoseInto(state, 0, 1, withMode(REWIND), newPose())).toEqual({
      x: 100,
      y: 50,
      rotation: 0.25,
      scale: 1,
      alpha: 1,
    });
  });

  test('home starts at the forward pose at total and is exactly home at t = total', () => {
    const { state, phys, count } = built(shatter());
    const home = Float32Array.from(phys);
    home[REVERSE_MODE] = HOME;
    const total = phys[TOTAL]!;
    for (let i = 0; i < count; i++) {
      expect(fragmentPoseInto(state, i, 0, home, newPose())).toEqual(
        fragmentPoseInto(state, i, total, phys, newPose()),
      );
      for (const t of [total, total + 1]) {
        expect(fragmentPoseInto(state, i, t, home, newPose())).toEqual({
          x: state[i * FRAG_STRIDE + HX]!,
          y: state[i * FRAG_STRIDE + HY]!,
          rotation: 0,
          scale: 1,
          alpha: 1,
        });
      }
    }
  });

  test('home is halfway between the scattered pose and home at t = total / 2', () => {
    const state = stateOf(PIECE);
    const far = fragmentPoseInto(state, 0, 1, physOf(PHYS), newPose());
    const mid = fragmentPoseInto(state, 0, 0.5, withMode(HOME), newPose());
    expect(mid.x).toBeCloseTo((far.x + 100) / 2, 6);
    expect(mid.y).toBeCloseTo((far.y + 50) / 2, 6);
    expect(mid.rotation).toBeCloseTo((far.rotation + 0.25) / 2, 6);
    expect(mid.scale).toBeCloseTo((far.scale + 1) / 2, 6);
    expect(mid.alpha).toBeCloseTo((far.alpha + 1) / 2, 6);
  });

  test('spring-home lerps to home by the spring step response', () => {
    const state = stateOf(PIECE);
    const phys = withMode(SPRING_HOME);
    const far = fragmentPoseInto(state, 0, 1, physOf(PHYS), newPose());
    expect(fragmentPoseInto(state, 0, 0, phys, newPose())).toEqual(far);
    for (const t of [0.1, 0.4, 1, 3]) {
      const f = springStepAt(phys[OMEGA0]!, phys[ZETA]!, t);
      const pose = fragmentPoseInto(state, 0, t, phys, newPose());
      expect(pose.x).toBeCloseTo(far.x + (100 - far.x) * f, 6);
      expect(pose.y).toBeCloseTo(far.y + (50 - far.y) * f, 6);
      expect(pose.alpha).toBeCloseTo(far.alpha + (1 - far.alpha) * f, 6);
    }
    const settled = fragmentPoseInto(state, 0, 30, phys, newPose());
    expect(settled.x).toBeCloseTo(100, 6);
    expect(settled.y).toBeCloseTo(50, 6);
  });
});

describe('fragmentPoseInto, purity', () => {
  test('two calls with the same arguments are identical', () => {
    const { state, phys } = built(shatter());
    for (const mode of [0, REWIND, HOME, SPRING_HOME]) {
      phys[REVERSE_MODE] = mode;
      const first = { ...fragmentPoseInto(state, 3, 0.4, phys, newPose()) };
      expect(fragmentPoseInto(state, 3, 0.4, phys, newPose())).toEqual(first);
    }
  });

  test('the result does not depend on the call order, on out, or on earlier calls', () => {
    const { state, phys, count } = built(shatter());
    const frozenState = Float32Array.from(state);
    const frozenPhys = Float32Array.from(phys);
    const times = [0, 0.05, 0.3, 0.6, 1.1];
    const ascending: string[] = [];
    const descending: string[] = [];
    const shared = newPose();
    for (let i = 0; i < count; i++) {
      for (const t of times) {
        ascending.push(JSON.stringify(fragmentPoseInto(state, i, t, phys, shared)));
      }
    }
    for (let i = count - 1; i >= 0; i--) {
      for (let n = times.length - 1; n >= 0; n--) {
        descending.push(JSON.stringify(fragmentPoseInto(state, i, times[n]!, phys, newPose())));
      }
    }
    expect(descending.reverse()).toEqual(ascending);
    expect(state).toEqual(frozenState);
    expect(phys).toEqual(frozenPhys);
  });
});
