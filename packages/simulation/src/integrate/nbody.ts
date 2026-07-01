// N-body gravity — the engine-liftable EMERGENT core. A tiny structure-of-arrays gravitational
// system integrated with velocity-Verlet (leapfrog) under Plummer-softened pairwise gravity, so
// close encounters stay finite and the total mechanical energy stays bounded over minutes. ZERO
// engine/DOM imports — pure TS. Bun-testable in isolation.
//
// Why Verlet + softening: a symplectic integrator conserves a shifted "shadow" energy, so bound
// orbits don't secularly spiral in/out from integration error the way explicit Euler does. Plummer
// softening (acceleration ∝ 1/(r²+ε²)^{3/2}) caps the force at small separations, so a near-miss
// can't fling a body to infinity. NOTE: energy is bounded, but individual apoapses are NOT —
// spatial confinement (keeping the procession in frame) is the caller's job.
//
// Optional relativistic precession: pass `gr`>0 to step()/totalEnergy() to add a softened 1/r⁴
// central pull on bodies i≥1 toward body 0 (the post-Newtonian correction behind Mercury's
// perihelion advance). It's position-only ⇒ velocity-Verlet stays symplectic, and 1/r⁴ dies
// faster than the centrifugal barrier ⇒ it can't cancel the barrier and plunge an orbit. The
// precession produces a slowly-rotating (rosette) orbit; the underlying Newtonian potential is unchanged.

export interface ClosestPair {
  i: number;
  j: number;
  sep: number;
}

export interface NBodySystem {
  /** Backing-array capacity (max bodies). */
  readonly capacity: number;
  /** Live body count. */
  readonly count: number;
  // SoA state — px[i],py[i] position (px), vx[i],vy[i] velocity (px/s), mass[i].
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly mass: Float32Array;
  /** Generic caller tag carried per body (e.g. a planet/color id); swapped through `absorb`. */
  readonly tag: Float32Array;
  /** Largest mass currently present. */
  maxMass(): number;
  /** Add a body; returns its index, or -1 if at capacity. `tag` is an opaque per-body scalar. */
  add(x: number, y: number, vx: number, vy: number, m: number, tag?: number): number;
  /** One velocity-Verlet step under Plummer-softened gravity. `gr`>0 adds a relativistic 1/r⁴
   *  precession pull on bodies i≥1 toward body 0 (rosette orbits); `rs` is its GR length scale. */
  step(dt: number, g: number, softening: number, gr?: number, rs?: number): void;
  /** Total mechanical energy KE + PE (softened, incl. the optional GR term) — bounded ⇒ stable. */
  totalEnergy(g: number, softening: number, gr?: number, rs?: number): number;
  /** Center-of-mass position written into `out` (for keeping the system framed). */
  centerOfMass(out: { x: number; y: number }): void;
  /** Translate every body by (dx,dy) — used to re-center after a resize. */
  translate(dx: number, dy: number): void;
  /** Merge `victim` into `into` (momentum- and mass-conserving inelastic coalescence), then
   *  swap-remove `victim` so the array stays packed. In practice `into` is the central mass
   *  (index 0), which is never the moved last slot. */
  absorb(into: number, victim: number): void;
  /** Closest body pair + their separation (sep = Infinity with fewer than two bodies). */
  closestPair(out: ClosestPair): void;
}

export function createNBodySystem(capacity: number): NBodySystem {
  const cap = Math.max(1, Math.floor(capacity));
  const px = new Float32Array(cap);
  const py = new Float32Array(cap);
  const vx = new Float32Array(cap);
  const vy = new Float32Array(cap);
  const mass = new Float32Array(cap);
  const tag = new Float32Array(cap);
  // Acceleration scratch for velocity-Verlet (hoisted — no per-step allocation).
  const ax = new Float32Array(cap);
  const ay = new Float32Array(cap);
  const axOld = new Float32Array(cap);
  const ayOld = new Float32Array(cap);
  let count = 0;
  let primed = false; // whether ax/ay hold a(t) for the current positions

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
        // Newton's third law: equal/opposite, scaled by the other body's mass.
        ax[i] = (ax[i] ?? 0) + dx * invD3 * mj;
        ay[i] = (ay[i] ?? 0) + dy * invD3 * mj;
        ax[j] = (ax[j] ?? 0) - dx * invD3 * mi;
        ay[j] = (ay[j] ?? 0) - dy * invD3 * mi;
      }
    }
    // Relativistic precession (post-Newtonian 1/r⁴ correction): a small extra inward pull on each
    // planet toward the central body, softened with the SAME ε so it's finite at the throat. β grows
    // with the central mass, so a heavier hole precesses harder. β/(r²+ε²)^2.5 = the 1/r⁴ force.
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
    capacity: cap,
    get count() {
      return count;
    },
    px,
    py,
    vx,
    vy,
    mass,
    tag,

    maxMass() {
      let m = 0;
      for (let i = 0; i < count; i++) {
        const v = mass[i] ?? 0;
        if (v > m) m = v;
      }
      return m;
    },

    add(x, y, vx0, vy0, m, t = 0) {
      if (count >= cap) return -1;
      const i = count++;
      px[i] = x;
      py[i] = y;
      vx[i] = vx0;
      vy[i] = vy0;
      mass[i] = m;
      tag[i] = t;
      primed = false; // new body invalidates the cached accelerations
      return i;
    },

    step(dt, g, soft, gr = 0, rs = 0) {
      if (count === 0 || dt <= 0) return;
      if (!primed) {
        computeAccel(g, soft, gr, rs);
        primed = true;
      }
      // Drift + half kick (using a(t)), saving a(t) for the velocity update.
      for (let i = 0; i < count; i++) {
        const axi = ax[i] ?? 0;
        const ayi = ay[i] ?? 0;
        px[i] = (px[i] ?? 0) + (vx[i] ?? 0) * dt + 0.5 * axi * dt * dt;
        py[i] = (py[i] ?? 0) + (vy[i] ?? 0) * dt + 0.5 * ayi * dt * dt;
        axOld[i] = axi;
        ayOld[i] = ayi;
      }
      // a(t+dt) from the new positions, then the second half kick.
      computeAccel(g, soft, gr, rs);
      for (let i = 0; i < count; i++) {
        vx[i] = (vx[i] ?? 0) + 0.5 * ((axOld[i] ?? 0) + (ax[i] ?? 0)) * dt;
        vy[i] = (vy[i] ?? 0) + 0.5 * ((ayOld[i] ?? 0) + (ay[i] ?? 0)) * dt;
      }
    },

    totalEnergy(g, soft, gr = 0, rs = 0) {
      const soft2 = soft * soft;
      let ke = 0;
      for (let i = 0; i < count; i++) {
        const m = mass[i] ?? 0;
        const vxi = vx[i] ?? 0;
        const vyi = vy[i] ?? 0;
        ke += 0.5 * m * (vxi * vxi + vyi * vyi);
      }
      let pe = 0;
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = (px[j] ?? 0) - (px[i] ?? 0);
          const dy = (py[j] ?? 0) - (py[i] ?? 0);
          const d = Math.sqrt(dx * dx + dy * dy + soft2);
          pe -= (g * (mass[i] ?? 0) * (mass[j] ?? 0)) / d;
        }
      }
      // Conservative potential of the optional GR precession force: φ = -β/(3(r²+ε²)^1.5), so the
      // bounded-energy test stays honest when gr>0 (otherwise it would report a false drift).
      if (gr > 0 && count > 1) {
        const cxp = px[0] ?? 0;
        const cyp = py[0] ?? 0;
        const beta = gr * g * (mass[0] ?? 0) * rs * rs;
        for (let i = 1; i < count; i++) {
          const dx = (px[i] ?? 0) - cxp;
          const dy = (py[i] ?? 0) - cyp;
          const u = dx * dx + dy * dy + soft2;
          pe -= (beta * (mass[i] ?? 0)) / (3 * u * Math.sqrt(u));
        }
      }
      return ke + pe;
    },

    centerOfMass(out) {
      let mx = 0;
      let my = 0;
      let mt = 0;
      for (let i = 0; i < count; i++) {
        const m = mass[i] ?? 0;
        mx += (px[i] ?? 0) * m;
        my += (py[i] ?? 0) * m;
        mt += m;
      }
      out.x = mt > 0 ? mx / mt : 0;
      out.y = mt > 0 ? my / mt : 0;
    },

    translate(dx, dy) {
      for (let i = 0; i < count; i++) {
        px[i] = (px[i] ?? 0) + dx;
        py[i] = (py[i] ?? 0) + dy;
      }
    },

    absorb(into, victim) {
      if (into === victim || into < 0 || victim < 0 || into >= count || victim >= count) return;
      const mi = mass[into] ?? 0;
      const mj = mass[victim] ?? 0;
      const M = mi + mj;
      if (M <= 0) return;
      // Mass-weighted position + momentum-conserving velocity (perfectly inelastic).
      px[into] = ((px[into] ?? 0) * mi + (px[victim] ?? 0) * mj) / M;
      py[into] = ((py[into] ?? 0) * mi + (py[victim] ?? 0) * mj) / M;
      vx[into] = ((vx[into] ?? 0) * mi + (vx[victim] ?? 0) * mj) / M;
      vy[into] = ((vy[into] ?? 0) * mi + (vy[victim] ?? 0) * mj) / M;
      mass[into] = M;
      // Swap-remove the victim (into is the central mass, never the moved last slot).
      const last = count - 1;
      if (victim !== last) {
        px[victim] = px[last] ?? 0;
        py[victim] = py[last] ?? 0;
        vx[victim] = vx[last] ?? 0;
        vy[victim] = vy[last] ?? 0;
        mass[victim] = mass[last] ?? 0;
        tag[victim] = tag[last] ?? 0;
      }
      count--;
      primed = false;
    },

    closestPair(out) {
      out.i = -1;
      out.j = -1;
      out.sep = Number.POSITIVE_INFINITY;
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = (px[j] ?? 0) - (px[i] ?? 0);
          const dy = (py[j] ?? 0) - (py[i] ?? 0);
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < out.sep) {
            out.sep = d;
            out.i = i;
            out.j = j;
          }
        }
      }
    },
  };
}
