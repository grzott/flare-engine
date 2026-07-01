import { describe, expect, test } from 'bun:test';
import { createNBodySystem } from '../src/integrate/nbody.js';

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
    nb.add(0, 0, 0, 0, 100); // central (index 0)
    nb.add(50, 0, 0, 4, 10); // victim
    nb.add(-80, 0, 0, -2, 20); // bystander
    const p0x = 100 * 0 + 10 * 0 + 20 * 0;
    const p0y = 100 * 0 + 10 * 4 + 20 * -2; // total y-momentum before
    const m0 = 100 + 10 + 20;
    nb.absorb(0, 1); // central swallows the victim
    expect(nb.count).toBe(2);
    let mAfter = 0;
    let pyAfter = 0;
    for (let i = 0; i < nb.count; i++) {
      const m = nb.mass[i] ?? 0;
      mAfter += m;
      pyAfter += (nb.vy[i] ?? 0) * m;
    }
    expect(mAfter).toBeCloseTo(m0, 5);
    expect(pyAfter).toBeCloseTo(p0y, 5);
    expect(p0x).toBe(0);
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
});
