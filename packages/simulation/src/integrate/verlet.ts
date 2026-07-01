/**
 * AccelFn fills ax[i]/ay[i] for i in [0, count) from the current SoA position/velocity state.
 * Callers own the ax/ay scratch arrays (length >= count).
 */
export type AccelFn = (
  count: number,
  px: Float32Array,
  py: Float32Array,
  vx: Float32Array,
  vy: Float32Array,
  ax: Float32Array,
  ay: Float32Array,
) => void;

/**
 * Self-contained kick-drift-kick leapfrog (velocity-Verlet-equivalent). Advances pos/vel in place
 * under accel; symplectic => bounded energy for conservative forces. ax/ay are caller scratch
 * (length >= count). Evals accel TWICE per step. Zero-alloc.
 */
export function leapfrogInto(
  count: number,
  px: Float32Array,
  py: Float32Array,
  vx: Float32Array,
  vy: Float32Array,
  dt: number,
  accel: AccelFn,
  ax: Float32Array,
  ay: Float32Array,
): void {
  accel(count, px, py, vx, vy, ax, ay); // a(t)
  for (let i = 0; i < count; i++) {
    vx[i] = (vx[i] ?? 0) + 0.5 * (ax[i] ?? 0) * dt;
    vy[i] = (vy[i] ?? 0) + 0.5 * (ay[i] ?? 0) * dt;
  } // half-kick
  for (let i = 0; i < count; i++) {
    px[i] = (px[i] ?? 0) + (vx[i] ?? 0) * dt;
    py[i] = (py[i] ?? 0) + (vy[i] ?? 0) * dt;
  } // drift
  accel(count, px, py, vx, vy, ax, ay); // a(t+dt)
  for (let i = 0; i < count; i++) {
    vx[i] = (vx[i] ?? 0) + 0.5 * (ax[i] ?? 0) * dt;
    vy[i] = (vy[i] ?? 0) + 0.5 * (ay[i] ?? 0) * dt;
  } // half-kick
}

/**
 * Velocity-Verlet step reusing a cached a(t) — the nbody scheme, ONE accel eval/step. On ENTRY
 * ax/ay must hold a(t) for the current positions; on RETURN they hold a(t+dt) (feed into the next
 * step). axPrev/ayPrev are caller scratch (length >= count). Zero-alloc.
 *
 * Symplectic => bounded energy for conservative forces.
 */
export function verletStep(
  count: number,
  px: Float32Array,
  py: Float32Array,
  vx: Float32Array,
  vy: Float32Array,
  dt: number,
  accel: AccelFn,
  ax: Float32Array,
  ay: Float32Array,
  axPrev: Float32Array,
  ayPrev: Float32Array,
): void {
  for (let i = 0; i < count; i++) {
    px[i] = (px[i] ?? 0) + (vx[i] ?? 0) * dt + 0.5 * (ax[i] ?? 0) * dt * dt;
    py[i] = (py[i] ?? 0) + (vy[i] ?? 0) * dt + 0.5 * (ay[i] ?? 0) * dt * dt;
    axPrev[i] = ax[i] ?? 0;
    ayPrev[i] = ay[i] ?? 0;
  }
  accel(count, px, py, vx, vy, ax, ay); // a(t+dt) into ax/ay
  for (let i = 0; i < count; i++) {
    vx[i] = (vx[i] ?? 0) + 0.5 * ((axPrev[i] ?? 0) + (ax[i] ?? 0)) * dt;
    vy[i] = (vy[i] ?? 0) + 0.5 * ((ayPrev[i] ?? 0) + (ay[i] ?? 0)) * dt;
  }
}
