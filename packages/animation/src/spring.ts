/** Spring configuration. */
export interface SpringConfig {
  /** Spring stiffness (higher = faster oscillation). Default: 100. */
  stiffness: number;
  /** Damping coefficient (higher = less oscillation). Default: 10. */
  damping: number;
  /** Mass of the spring body. Default: 1. */
  mass: number;
}

/** Spring state. */
export interface Spring {
  /** Current value. */
  value: number;
  /** Current velocity. */
  velocity: number;
  /** Target value. */
  target: number;
  /** Configuration. */
  config: SpringConfig;
  /** Whether the spring has settled (within rest threshold). */
  atRest: boolean;
}

const REST_THRESHOLD = 0.001;
const VELOCITY_THRESHOLD = 0.001;
// |ζ − 1| inside this band is solved as critically damped: the under/overdamped forms divide by
// a vanishing ωd / root gap there, and the critical solution differs by under 1e-6·ω0·dt relative.
const CRITICAL_BAND = 1e-6;

/**
 * Create a spring with initial value.
 *
 * Throws a `RangeError` naming the field when `mass` is not above 0, `stiffness` or `damping`
 * is negative, or any of the three is not finite: none of those ever produced a usable spring.
 * `stiffness: 0` and `damping: 0` are valid. Only the config passed here is checked; later
 * edits to `s.config` are the caller's responsibility, so `updateSpring` stays check-free.
 */
export function spring(value: number, target: number, config?: Partial<SpringConfig>): Spring {
  const stiffness = config?.stiffness ?? 100;
  const damping = config?.damping ?? 10;
  const mass = config?.mass ?? 1;
  if (!Number.isFinite(mass) || mass <= 0) {
    throw new RangeError(`spring: mass must be a finite number above 0, got ${mass}`);
  }
  if (!Number.isFinite(stiffness) || stiffness < 0) {
    throw new RangeError(`spring: stiffness must be a finite number >= 0, got ${stiffness}`);
  }
  if (!Number.isFinite(damping) || damping < 0) {
    throw new RangeError(`spring: damping must be a finite number >= 0, got ${damping}`);
  }
  return {
    value,
    velocity: 0,
    target,
    config: { stiffness, damping, mass },
    atRest: value === target,
  };
}

/**
 * Update a spring by dt seconds. Returns the current value.
 * Advances with the exact damped-oscillator solution, so any dt — a clamped 0.25 s hitch frame
 * or several frames at once — is stable, and n steps of dt equal one step of n·dt (up to float
 * rounding).
 */
export function updateSpring(s: Spring, dt: number): number {
  if (s.atRest) return s.value;

  const { stiffness, damping, mass } = s.config;
  const x0 = s.value - s.target;
  const v0 = s.velocity;
  const gamma = damping / mass;
  let x: number;
  let v: number;

  if (stiffness === 0) {
    if (gamma > 0) {
      const e = Math.exp(-gamma * dt);
      x = x0 + (v0 * (1 - e)) / gamma;
      v = v0 * e;
    } else {
      x = x0 + v0 * dt;
      v = v0;
    }
  } else {
    const w0 = Math.sqrt(stiffness / mass);
    const zeta = gamma / (2 * w0);
    if (Math.abs(zeta - 1) <= CRITICAL_BAND) {
      // Critical: x = (x0 + (v0 + ω0·x0)·t)·e^(−ω0·t)
      const e = Math.exp(-w0 * dt);
      const b = v0 + w0 * x0;
      x = (x0 + b * dt) * e;
      v = (v0 - w0 * b * dt) * e;
    } else if (zeta < 1) {
      // Underdamped: x = e^(−σt)·(x0·cos ωd·t + B·sin ωd·t), σ = ζω0, B = (v0 + σ·x0)/ωd
      const sigma = zeta * w0;
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      const e = Math.exp(-sigma * dt);
      const cos = Math.cos(wd * dt);
      const sin = Math.sin(wd * dt);
      const b = (v0 + sigma * x0) / wd;
      x = e * (x0 * cos + b * sin);
      v = e * (v0 * cos - (sigma * b + wd * x0) * sin);
    } else {
      // Overdamped: x = c1·e^(r1·t) + c2·e^(r2·t) with real roots r2 < r1 < 0;
      // r1 = −ω0/(ζ + √(ζ²−1)) equals −ω0·(ζ − √(ζ²−1)) without the cancellation.
      const root = Math.sqrt(zeta * zeta - 1);
      const r1 = -w0 / (zeta + root);
      const r2 = -w0 * (zeta + root);
      const c1 = (v0 - r2 * x0) / (r1 - r2);
      const c2 = x0 - c1;
      const e1 = Math.exp(r1 * dt);
      const e2 = Math.exp(r2 * dt);
      x = c1 * e1 + c2 * e2;
      v = c1 * r1 * e1 + c2 * r2 * e2;
    }
  }

  s.value = s.target + x;
  s.velocity = v;

  // Check if settled
  if (Math.abs(s.value - s.target) < REST_THRESHOLD && Math.abs(s.velocity) < VELOCITY_THRESHOLD) {
    s.value = s.target;
    s.velocity = 0;
    s.atRest = true;
  }

  return s.value;
}

/** Set a new target for the spring. Wakes it if at rest. */
export function setSpringTarget(s: Spring, target: number): void {
  s.target = target;
  s.atRest = false;
}

/** Reset both value and target, zeroing velocity. */
export function resetSpring(s: Spring, value: number): void {
  s.value = value;
  s.target = value;
  s.velocity = 0;
  s.atRest = true;
}
