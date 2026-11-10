import { describe, expect, test } from 'bun:test';
import { createNBodySystem } from '../src/integrate/nbody.js';

// Verbatim copy of the integrator `step()` carried before it delegated to `verletStep` (its own
// drift / computeAccel / half-kick loops). Frozen here as the golden reference: do not "tidy" it.
function createReferenceNBody(cap: number) {
  const px = new Float32Array(cap);
  const py = new Float32Array(cap);
  const vx = new Float32Array(cap);
  const vy = new Float32Array(cap);
  const mass = new Float32Array(cap);
  const ax = new Float32Array(cap);
  const ay = new Float32Array(cap);
  const axOld = new Float32Array(cap);
  const ayOld = new Float32Array(cap);
  let count = 0;
  let primed = false;

  const computeAccel = (g: number, soft: number, gr: number, rs: number): void => {
    const soft2 = soft * soft;
    for (let i = 0; i < count; i++) {
      ax[i] = 0;
      ay[i] = 0;
    }
    for (let i = 0; i < count; i++) {
      const xi = px[i] ?? 0;
      const yi = py[i] ?? 0;
      const mi = mass[i] ?? 0;
      for (let j = i + 1; j < count; j++) {
        const dx = (px[j] ?? 0) - xi;
        const dy = (py[j] ?? 0) - yi;
        const d2 = dx * dx + dy * dy + soft2;
        const invD = 1 / Math.sqrt(d2);
        const invD3 = g * invD * invD * invD;
        const mj = mass[j] ?? 0;
        ax[i] = (ax[i] ?? 0) + dx * invD3 * mj;
        ay[i] = (ay[i] ?? 0) + dy * invD3 * mj;
        ax[j] = (ax[j] ?? 0) - dx * invD3 * mi;
        ay[j] = (ay[j] ?? 0) - dy * invD3 * mi;
      }
    }
    if (gr > 0 && count > 1) {
      const cxp = px[0] ?? 0;
      const cyp = py[0] ?? 0;
      const beta = gr * g * (mass[0] ?? 0) * rs * rs;
      for (let i = 1; i < count; i++) {
        const dx = (px[i] ?? 0) - cxp;
        const dy = (py[i] ?? 0) - cyp;
        const r2 = dx * dx + dy * dy + soft2;
        const invr2 = 1 / r2;
        const k = beta * invr2 * invr2 * Math.sqrt(invr2);
        ax[i] = (ax[i] ?? 0) - dx * k;
        ay[i] = (ay[i] ?? 0) - dy * k;
      }
    }
  };

  return {
    px,
    py,
    vx,
    vy,
    add(x: number, y: number, vx0: number, vy0: number, m: number): void {
      const i = count++;
      px[i] = x;
      py[i] = y;
      vx[i] = vx0;
      vy[i] = vy0;
      mass[i] = m;
      primed = false;
    },
    step(dt: number, g: number, soft: number, gr = 0, rs = 0): void {
      if (count === 0 || dt <= 0) return;
      if (!primed) {
        computeAccel(g, soft, gr, rs);
        primed = true;
      }
      for (let i = 0; i < count; i++) {
        const axi = ax[i] ?? 0;
        const ayi = ay[i] ?? 0;
        px[i] = (px[i] ?? 0) + (vx[i] ?? 0) * dt + 0.5 * axi * dt * dt;
        py[i] = (py[i] ?? 0) + (vy[i] ?? 0) * dt + 0.5 * ayi * dt * dt;
        axOld[i] = axi;
        ayOld[i] = ayi;
      }
      computeAccel(g, soft, gr, rs);
      for (let i = 0; i < count; i++) {
        vx[i] = (vx[i] ?? 0) + 0.5 * ((axOld[i] ?? 0) + (ax[i] ?? 0)) * dt;
        vy[i] = (vy[i] ?? 0) + 0.5 * ((ayOld[i] ?? 0) + (ay[i] ?? 0)) * dt;
      }
    },
  };
}

// mulberry32 — small deterministic PRNG so the golden system is the same on every run.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('NBodySystem', () => {
  test('add respects capacity and reports indices', () => {
    const nb = createNBodySystem(2);
    expect(nb.add(0, 0, 0, 0, 1)).toBe(0);
    expect(nb.add(10, 0, 0, 0, 1)).toBe(1);
    expect(nb.add(20, 0, 0, 0, 1)).toBe(-1); // full
    expect(nb.count).toBe(2);
  });

  test('a circular-ish two-body orbit conserves energy over thousands of steps', () => {
    const nb = createNBodySystem(2);
    const G = 1;
    const soft = 2;
    const Mc = 1000;
    const m = 1;
    const r = 100;
    const vCirc = Math.sqrt((G * Mc) / r); // Newtonian circular speed
    nb.add(0, 0, 0, (-m * vCirc) / Mc, Mc); // central — counter-momentum so the COM stays put
    nb.add(r, 0, 0, vCirc, m); // satellite, perpendicular velocity

    const e0 = nb.totalEnergy(G, soft);
    for (let i = 0; i < 6000; i++) nb.step(0.01, G, soft);
    const e1 = nb.totalEnergy(G, soft);

    expect(Math.abs(e1 - e0)).toBeLessThan(Math.abs(e0) * 0.02); // bounded — no drift
  });

  test('the orbit stays bound (separation never escapes a band)', () => {
    const nb = createNBodySystem(2);
    const G = 1;
    const soft = 2;
    const Mc = 1000;
    const r = 100;
    const vCirc = Math.sqrt((G * Mc) / r);
    nb.add(0, 0, 0, (-1 * vCirc) / Mc, Mc);
    nb.add(r, 0, 0, vCirc, 1);

    const pair: { i: number; j: number; sep: number } = { i: -1, j: -1, sep: 0 };
    let minSep = Number.POSITIVE_INFINITY;
    let maxSep = 0;
    for (let i = 0; i < 4000; i++) {
      nb.step(0.01, G, soft);
      nb.closestPair(pair);
      if (pair.sep < minSep) minSep = pair.sep;
      if (pair.sep > maxSep) maxSep = pair.sep;
    }
    expect(minSep).toBeGreaterThan(r * 0.5); // never plunges in
    expect(maxSep).toBeLessThan(r * 2); // never flies away
  });

  test('center of mass holds (zero net momentum stays framed)', () => {
    const nb = createNBodySystem(2);
    const G = 1;
    const Mc = 1000;
    const vCirc = Math.sqrt((G * Mc) / 100);
    nb.add(0, 0, 0, (-1 * vCirc) / Mc, Mc);
    nb.add(100, 0, 0, vCirc, 1);
    const com0 = { x: 0, y: 0 };
    nb.centerOfMass(com0);
    for (let i = 0; i < 3000; i++) nb.step(0.01, G, 2);
    const com1 = { x: 0, y: 0 };
    nb.centerOfMass(com1);
    expect(Math.hypot(com1.x - com0.x, com1.y - com0.y)).toBeLessThan(2);
  });

  test('closestPair finds the nearest two of three bodies', () => {
    const nb = createNBodySystem(3);
    nb.add(0, 0, 0, 0, 1);
    nb.add(5, 0, 0, 0, 1); // closest to body 0
    nb.add(100, 0, 0, 0, 1);
    const pair: { i: number; j: number; sep: number } = { i: -1, j: -1, sep: 0 };
    nb.closestPair(pair);
    expect(pair.i).toBe(0);
    expect(pair.j).toBe(1);
    expect(pair.sep).toBeCloseTo(5, 5);
  });

  test('absorb conserves total mass + momentum and shrinks the count', () => {
    const nb = createNBodySystem(4);
    // Central body at (10, 5), bystander at (-80, 30) — nonzero positions and velocities.
    nb.add(10, 5, 3, -1, 100); // index 0: central
    nb.add(50, 20, 7, 4, 10); // index 1: victim to be absorbed
    nb.add(-80, 30, -2, 2, 20); // index 2: bystander

    // Record pre-absorb total momentum (x and y) and expected merged position.
    const m0 = 100;
    const m1 = 10;
    const m2 = 20;
    const totalMass = m0 + m1 + m2;
    const p0x = (nb.vx[0] ?? 0) * m0 + (nb.vx[1] ?? 0) * m1 + (nb.vx[2] ?? 0) * m2;
    const p0y = (nb.vy[0] ?? 0) * m0 + (nb.vy[1] ?? 0) * m1 + (nb.vy[2] ?? 0) * m2;
    // Mass-weighted merged position of the two absorbed bodies.
    const mergedX = ((nb.px[0] ?? 0) * m0 + (nb.px[1] ?? 0) * m1) / (m0 + m1);
    const mergedY = ((nb.py[0] ?? 0) * m0 + (nb.py[1] ?? 0) * m1) / (m0 + m1);

    nb.absorb(0, 1); // central swallows the victim

    expect(nb.count).toBe(2);

    let mAfter = 0;
    let pxAfter = 0;
    let pyAfter = 0;
    for (let i = 0; i < nb.count; i++) {
      const m = nb.mass[i] ?? 0;
      mAfter += m;
      pxAfter += (nb.vx[i] ?? 0) * m;
      pyAfter += (nb.vy[i] ?? 0) * m;
    }
    expect(mAfter).toBeCloseTo(totalMass, 5);
    expect(pxAfter).toBeCloseTo(p0x, 4);
    expect(pyAfter).toBeCloseTo(p0y, 4);

    // Merged body (index 0) sits at the mass-weighted average of the two absorbed bodies.
    expect(nb.px[0] ?? 0).toBeCloseTo(mergedX, 4);
    expect(nb.py[0] ?? 0).toBeCloseTo(mergedY, 4);
  });

  test("GR precession (gr>0) keeps a bound orbit's energy bounded over thousands of steps", () => {
    const nb = createNBodySystem(2);
    const G = 1;
    const soft = 4;
    const Mc = 100000; // heavy + ~immobile central ⇒ the one-sided GR pull's potential center is fixed
    const r = 100;
    const gr = 0.3;
    const vCirc = Math.sqrt((G * Mc) / r);
    nb.add(0, 0, 0, 0, Mc);
    nb.add(r, 0, 0, vCirc, 1);

    const e0 = nb.totalEnergy(G, soft, gr, soft);
    for (let i = 0; i < 8000; i++) nb.step(0.002, G, soft, gr, soft);
    const e1 = nb.totalEnergy(G, soft, gr, soft);

    expect(Number.isFinite(e1)).toBe(true);
    expect(Math.abs(e1 - e0)).toBeLessThan(Math.abs(e0) * 0.05); // bounded — the GR PE term is honest
  });

  test('GR precession alters the orbit (rosette) yet stays bound', () => {
    const make = (gr: number) => {
      const nb = createNBodySystem(2);
      const G = 1;
      const Mc = 100000;
      const r = 100;
      const vCirc = Math.sqrt((G * Mc) / r);
      nb.add(0, 0, 0, 0, Mc);
      nb.add(r, 0, 0, vCirc * 0.8, 1); // eccentric so the apsides (and their precession) are visible
      let minR = Number.POSITIVE_INFINITY;
      let maxR = 0;
      // rs=20 (GR length) so the precession is clearly visible at r~100, like the sim's rs~r/3.
      for (let i = 0; i < 4000; i++) {
        nb.step(0.002, G, 4, gr, 20);
        const rad = Math.hypot(
          (nb.px[1] ?? 0) - (nb.px[0] ?? 0),
          (nb.py[1] ?? 0) - (nb.py[0] ?? 0),
        );
        if (rad < minR) minR = rad;
        if (rad > maxR) maxR = rad;
      }
      return {
        x: nb.px[1] ?? 0,
        y: nb.py[1] ?? 0,
        cx: nb.px[0] ?? 0,
        cy: nb.py[0] ?? 0,
        minR,
        maxR,
      };
    };
    const newton = make(0);
    const rel = make(0.5);

    // The extra 1/r⁴ pull measurably changes where the satellite ends up (precession), …
    const drift = Math.hypot(rel.x - newton.x, rel.y - newton.y);
    expect(drift).toBeGreaterThan(1);
    // … while both orbits stay bound (no plunge to the core, no escape).
    expect(rel.minR).toBeGreaterThan(4); // never plunges past the softened core
    expect(rel.maxR).toBeLessThan(100 * 2.5); // never flies away
  });

  test('softening keeps acceleration finite through a head-on near-collision', () => {
    const nb = createNBodySystem(2);
    nb.add(0, 0, 0, 0, 100);
    nb.add(0.001, 0, 0, 0, 100); // essentially coincident
    for (let i = 0; i < 100; i++) nb.step(0.01, 1, 4);
    // Finite (not NaN/Infinity) positions ⇒ the soft core absorbed the singularity.
    expect(Number.isFinite(nb.px[1] ?? Number.NaN)).toBe(true);
    expect(Number.isFinite(nb.vx[1] ?? Number.NaN)).toBe(true);
  });

  // Golden: step() delegates to verletStep; trajectories must match the pre-delegation integrator
  // bit for bit (Object.is, so -0 vs +0 and NaN are told apart too).
  for (const [label, gr, rs] of [
    ['Newtonian', 0, 0],
    ['GR precession', 0.3, 12],
  ] as const) {
    test(`golden: seeded 8-body, 200 steps, byte-identical to the reference (${label})`, () => {
      const N = 8;
      const STEPS = 200;
      const G = 1;
      const soft = 3;
      const rand = mulberry32(0x5eed84);
      const nb = createNBodySystem(N);
      const ref = createReferenceNBody(N);
      for (let i = 0; i < N; i++) {
        const x = (rand() - 0.5) * 400;
        const y = (rand() - 0.5) * 400;
        const vx = (rand() - 0.5) * 30;
        const vy = (rand() - 0.5) * 30;
        const m = i === 0 ? 5000 : 1 + rand() * 50;
        nb.add(x, y, vx, vy, m);
        ref.add(x, y, vx, vy, m);
      }

      const x0 = nb.px[1];
      for (let s = 0; s < STEPS; s++) {
        // Vary dt so the comparison is not limited to one step size.
        const dt = s % 3 === 0 ? 0.01 : 0.004;
        nb.step(dt, G, soft, gr, rs);
        ref.step(dt, G, soft, gr, rs);
        for (let i = 0; i < N; i++) {
          if (
            !Object.is(nb.px[i], ref.px[i]) ||
            !Object.is(nb.py[i], ref.py[i]) ||
            !Object.is(nb.vx[i], ref.vx[i]) ||
            !Object.is(nb.vy[i], ref.vy[i])
          ) {
            throw new Error(`trajectory diverged from the reference at step ${s}, body ${i}`);
          }
        }
      }
      expect(Object.is(nb.px[1], x0)).toBe(false); // the system evolved — not a vacuous match
      expect(Number.isFinite(nb.px[N - 1] ?? Number.NaN)).toBe(true);
    });
  }
});
