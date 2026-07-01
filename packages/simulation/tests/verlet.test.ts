import { describe, expect, test } from 'bun:test';
import { type AccelFn, leapfrogInto, verletStep } from '../src/integrate/verlet.js';

// Harmonic oscillator: a = -omega^2 * x (1D embedded in 2D SoA).
const omega = 2.0;
const harmonicAccel: AccelFn = (count, px, _py, _vx, _vy, ax, ay) => {
  for (let i = 0; i < count; i++) {
    ax[i] = -(omega * omega) * (px[i] ?? 0);
    ay[i] = -(omega * omega) * (_py[i] ?? 0);
  }
};

// Total energy for harmonic oscillator: E = 0.5*(vx^2 + vy^2) + 0.5*omega^2*(x^2 + y^2).
function harmonicEnergy(
  vx: Float32Array,
  vy: Float32Array,
  px: Float32Array,
  py: Float32Array,
): number {
  return (
    0.5 * ((vx[0] ?? 0) ** 2 + (vy[0] ?? 0) ** 2) +
    0.5 * omega * omega * ((px[0] ?? 0) ** 2 + (py[0] ?? 0) ** 2)
  );
}

describe('leapfrogInto', () => {
  test('harmonic oscillator energy stays in a tight band (symplectic — forward-Euler would fail)', () => {
    const count = 1;
    const px = new Float32Array([1.0]);
    const py = new Float32Array([0.0]);
    const vx = new Float32Array([0.0]);
    const vy = new Float32Array([0.0]);
    const ax = new Float32Array(count);
    const ay = new Float32Array(count);
    const dt = 0.01;
    const steps = 2000;

    const e0 = harmonicEnergy(vx, vy, px, py);
    for (let i = 0; i < steps; i++) {
      leapfrogInto(count, px, py, vx, vy, dt, harmonicAccel, ax, ay);
    }
    const e1 = harmonicEnergy(vx, vy, px, py);

    // Symplectic integrator: energy bounded within 1% of initial.
    expect(Math.abs(e1 - e0)).toBeLessThan(e0 * 0.01);
    // Symplectic run must not blow up — the amplitude stays bounded near its initial value
    // (the sign-change / oscillation guarantee is asserted separately in the next test).
    expect(Math.abs(px[0] ?? 0)).toBeLessThan(1.1);
  });

  test('harmonic oscillator position oscillates (sign of x changes)', () => {
    const count = 1;
    const px = new Float32Array([1.0]);
    const py = new Float32Array([0.0]);
    const vx = new Float32Array([0.0]);
    const vy = new Float32Array([0.0]);
    const ax = new Float32Array(count);
    const ay = new Float32Array(count);
    const dt = 0.01;
    // Half period = pi/omega; at dt=0.01 that's ~157 steps.
    // After ~200 steps x should be near -1 (crossed zero).
    for (let i = 0; i < 200; i++) {
      leapfrogInto(count, px, py, vx, vy, dt, harmonicAccel, ax, ay);
    }
    // x should be negative after half a period.
    expect(px[0] ?? 0).toBeLessThan(0);
  });

  test('zero acceleration: position drifts linearly, velocity unchanged', () => {
    const zeroAccel: AccelFn = (_c, _px, _py, _vx, _vy, ax, ay) => {
      ax.fill(0);
      ay.fill(0);
    };
    const count = 1;
    const px = new Float32Array([0.0]);
    const py = new Float32Array([0.0]);
    const vx = new Float32Array([3.0]);
    const vy = new Float32Array([4.0]);
    const ax = new Float32Array(count);
    const ay = new Float32Array(count);
    const dt = 0.1;
    const steps = 50;
    for (let i = 0; i < steps; i++) {
      leapfrogInto(count, px, py, vx, vy, dt, zeroAccel, ax, ay);
    }
    // x = vx0 * dt * steps = 3 * 0.1 * 50 = 15 (Float32 accumulation: precision 3)
    expect(px[0] ?? 0).toBeCloseTo(3.0 * dt * steps, 3);
    expect(py[0] ?? 0).toBeCloseTo(4.0 * dt * steps, 3);
    // velocity unchanged
    expect(vx[0] ?? 0).toBeCloseTo(3.0, 5);
    expect(vy[0] ?? 0).toBeCloseTo(4.0, 5);
  });
});

describe('verletStep', () => {
  test('reproduces same trajectory as leapfrogInto within tolerance for harmonic oscillator', () => {
    const count = 1;
    const dt = 0.01;
    const steps = 500;

    // leapfrog run
    const lf_px = new Float32Array([1.0]);
    const lf_py = new Float32Array([0.0]);
    const lf_vx = new Float32Array([0.0]);
    const lf_vy = new Float32Array([0.0]);
    const lf_ax = new Float32Array(count);
    const lf_ay = new Float32Array(count);
    for (let i = 0; i < steps; i++) {
      leapfrogInto(count, lf_px, lf_py, lf_vx, lf_vy, dt, harmonicAccel, lf_ax, lf_ay);
    }

    // verletStep run — prime ax/ay with a(t) first
    const vs_px = new Float32Array([1.0]);
    const vs_py = new Float32Array([0.0]);
    const vs_vx = new Float32Array([0.0]);
    const vs_vy = new Float32Array([0.0]);
    const vs_ax = new Float32Array(count);
    const vs_ay = new Float32Array(count);
    const vs_axPrev = new Float32Array(count);
    const vs_ayPrev = new Float32Array(count);
    harmonicAccel(count, vs_px, vs_py, vs_vx, vs_vy, vs_ax, vs_ay); // prime
    for (let i = 0; i < steps; i++) {
      verletStep(
        count,
        vs_px,
        vs_py,
        vs_vx,
        vs_vy,
        dt,
        harmonicAccel,
        vs_ax,
        vs_ay,
        vs_axPrev,
        vs_ayPrev,
      );
    }

    // Both integrators are velocity-Verlet equivalent — trajectories should match very closely.
    expect(Math.abs((lf_px[0] ?? 0) - (vs_px[0] ?? 0))).toBeLessThan(1e-3);
    expect(Math.abs((lf_vx[0] ?? 0) - (vs_vx[0] ?? 0))).toBeLessThan(1e-3);
  });

  test('zero acceleration: position drifts linearly, velocity unchanged', () => {
    const zeroAccel: AccelFn = (_c, _px, _py, _vx, _vy, ax, ay) => {
      ax.fill(0);
      ay.fill(0);
    };
    const count = 1;
    const px = new Float32Array([0.0]);
    const py = new Float32Array([0.0]);
    const vx = new Float32Array([5.0]);
    const vy = new Float32Array([2.0]);
    const ax = new Float32Array(count);
    const ay = new Float32Array(count);
    const axPrev = new Float32Array(count);
    const ayPrev = new Float32Array(count);
    const dt = 0.1;
    const steps = 50;
    // Prime ax/ay
    zeroAccel(count, px, py, vx, vy, ax, ay);
    for (let i = 0; i < steps; i++) {
      verletStep(count, px, py, vx, vy, dt, zeroAccel, ax, ay, axPrev, ayPrev);
    }
    expect(px[0] ?? 0).toBeCloseTo(5.0 * dt * steps, 5);
    expect(py[0] ?? 0).toBeCloseTo(2.0 * dt * steps, 5);
    expect(vx[0] ?? 0).toBeCloseTo(5.0, 5);
    expect(vy[0] ?? 0).toBeCloseTo(2.0, 5);
  });

  test('energy bounded for harmonic oscillator (symplectic)', () => {
    const count = 1;
    const px = new Float32Array([1.0]);
    const py = new Float32Array([0.0]);
    const vx = new Float32Array([0.0]);
    const vy = new Float32Array([0.0]);
    const ax = new Float32Array(count);
    const ay = new Float32Array(count);
    const axPrev = new Float32Array(count);
    const ayPrev = new Float32Array(count);
    const dt = 0.01;
    const steps = 2000;

    harmonicAccel(count, px, py, vx, vy, ax, ay);
    const e0 = harmonicEnergy(vx, vy, px, py);
    for (let i = 0; i < steps; i++) {
      verletStep(count, px, py, vx, vy, dt, harmonicAccel, ax, ay, axPrev, ayPrev);
    }
    const e1 = harmonicEnergy(vx, vy, px, py);
    expect(Math.abs(e1 - e0)).toBeLessThan(e0 * 0.01);
  });
});
