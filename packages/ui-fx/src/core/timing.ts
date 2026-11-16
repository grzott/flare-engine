import {
  type EasingFn,
  easeInBack,
  easeInBounce,
  easeInCirc,
  easeInCubic,
  easeInElastic,
  easeInExpo,
  easeInOutBack,
  easeInOutBounce,
  easeInOutCirc,
  easeInOutCubic,
  easeInOutElastic,
  easeInOutExpo,
  easeInOutQuad,
  easeInOutQuart,
  easeInOutQuint,
  easeInOutSine,
  easeInQuad,
  easeInQuart,
  easeInQuint,
  easeInSine,
  easeOutBack,
  easeOutBounce,
  easeOutCirc,
  easeOutCubic,
  easeOutElastic,
  easeOutExpo,
  easeOutQuad,
  easeOutQuart,
  easeOutQuint,
  easeOutSine,
  linear,
} from '@flare-engine/math';

/**
 * A spring, either as a perceptual `{ duration, bounce }` (seconds; `-1 < bounce < 1`, default 0)
 * or as physical `{ stiffness, damping, mass }` (mass defaults to 1).
 */
export type SpringSpec =
  | { duration: number; bounce?: number }
  | { stiffness: number; damping: number; mass?: number };

/** A spring reduced to its natural frequency ω0 (rad/s) and damping ratio ζ. */
export interface ResolvedSpring {
  omega0: number;
  zeta: number;
}

// |ζ − 1| inside this band is solved as critically damped, the same band as
// @flare-engine/animation: the under/overdamped forms divide by a vanishing term there.
const CRITICAL_BAND = 1e-6;
const SETTLE_SCAN_STEP = 1 / 240;

/**
 * Resolve a spring to (ω0, ζ). For `{ duration, bounce }`: ω0 = 2π/duration and
 * ζ = 1 − bounce for bounce ≥ 0, 1/(1 + bounce) below 0.
 *
 * Throws a `RangeError` for a duration, stiffness, damping or mass that is not finite and above
 * 0, or a bounce outside the open range −1..1: none of those settles on the target.
 */
export function resolveSpring(s: SpringSpec): ResolvedSpring {
  if ('duration' in s) {
    const bounce = s.bounce ?? 0;
    if (!Number.isFinite(s.duration) || s.duration <= 0) {
      throw new RangeError(
        `resolveSpring: duration must be a finite number above 0, got ${s.duration}`,
      );
    }
    if (!(bounce > -1 && bounce < 1)) {
      throw new RangeError(`resolveSpring: bounce must be between -1 and 1, got ${bounce}`);
    }
    return {
      omega0: (2 * Math.PI) / s.duration,
      zeta: bounce >= 0 ? 1 - bounce : 1 / (1 + bounce),
    };
  }
  const mass = s.mass ?? 1;
  if (!Number.isFinite(s.stiffness) || s.stiffness <= 0) {
    throw new RangeError(
      `resolveSpring: stiffness must be a finite number above 0, got ${s.stiffness}`,
    );
  }
  if (!Number.isFinite(s.damping) || s.damping <= 0) {
    throw new RangeError(
      `resolveSpring: damping must be a finite number above 0, got ${s.damping}`,
    );
  }
  if (!Number.isFinite(mass) || mass <= 0) {
    throw new RangeError(`resolveSpring: mass must be a finite number above 0, got ${mass}`);
  }
  const omega0 = Math.sqrt(s.stiffness / mass);
  return { omega0, zeta: s.damping / (2 * mass * omega0) };
}

/**
 * Unit step response of a damped spring released from rest: 0 at `t <= 0`, tending to 1.
 * Closed form, so any `t` can be evaluated directly.
 */
export function springStepAt(omega0: number, zeta: number, t: number): number {
  'worklet';
  if (t <= 0) return 0;
  if (Math.abs(zeta - 1) <= CRITICAL_BAND) {
    return 1 - (1 + omega0 * t) * Math.exp(-omega0 * t);
  }
  if (zeta < 1) {
    const sigma = zeta * omega0;
    const wd = omega0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-sigma * t) * (Math.cos(wd * t) + (sigma / wd) * Math.sin(wd * t));
  }
  // Real roots r2 < r1 < 0; r1 = −ω0/(ζ + √(ζ²−1)) is −ω0·(ζ − √(ζ²−1)) without the cancellation.
  const root = Math.sqrt(zeta * zeta - 1);
  const r1 = -omega0 / (zeta + root);
  const r2 = -omega0 * (zeta + root);
  const c1 = r2 / (r1 - r2);
  const c2 = -1 - c1;
  return 1 + c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
}

/** Whether a ζ ≥ 1 step response is within `epsilon` of 1 in both position and velocity at `t`. */
function settledAt(omega0: number, zeta: number, t: number, epsilon: number): boolean {
  let velocity: number;
  if (Math.abs(zeta - 1) <= CRITICAL_BAND) {
    velocity = omega0 * omega0 * t * Math.exp(-omega0 * t);
  } else {
    const root = Math.sqrt(zeta * zeta - 1);
    const r1 = -omega0 / (zeta + root);
    const r2 = -omega0 * (zeta + root);
    const c1 = r2 / (r1 - r2);
    const c2 = -1 - c1;
    velocity = c1 * r1 * Math.exp(r1 * t) + c2 * r2 * Math.exp(r2 * t);
  }
  return Math.abs(1 - springStepAt(omega0, zeta, t)) < epsilon && Math.abs(velocity) < epsilon;
}

/**
 * Seconds until the step response stays within `epsilon` of 1. Underdamped springs use the decay
 * envelope, −ln(ε)/(ζω0); critical and overdamped ones are scanned in 1/240 s steps until the
 * distance to 1 and the velocity (per second) are both under `epsilon`.
 *
 * Throws a `RangeError` for an `epsilon` outside the open range 0..1, or an ω0 or ζ not above 0.
 */
export function springSettleTime(s: ResolvedSpring, epsilon = 1e-3): number {
  if (!(epsilon > 0 && epsilon < 1)) {
    throw new RangeError(`springSettleTime: epsilon must be between 0 and 1, got ${epsilon}`);
  }
  if (!(s.omega0 > 0 && Number.isFinite(s.omega0)) || !(s.zeta > 0 && Number.isFinite(s.zeta))) {
    throw new RangeError(
      `springSettleTime: omega0 and zeta must be finite numbers above 0, got ${s.omega0} and ${s.zeta}`,
    );
  }
  if (s.zeta < 1) return -Math.log(epsilon) / (s.zeta * s.omega0);
  let k = 1;
  while (!settledAt(s.omega0, s.zeta, k * SETTLE_SCAN_STEP, epsilon)) k++;
  return k * SETTLE_SCAN_STEP;
}

/** The Penner easings exported by `@flare-engine/math`, by name. */
export type EasingName =
  | 'linear'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeInQuart'
  | 'easeOutQuart'
  | 'easeInOutQuart'
  | 'easeInQuint'
  | 'easeOutQuint'
  | 'easeInOutQuint'
  | 'easeInSine'
  | 'easeOutSine'
  | 'easeInOutSine'
  | 'easeInExpo'
  | 'easeOutExpo'
  | 'easeInOutExpo'
  | 'easeInCirc'
  | 'easeOutCirc'
  | 'easeInOutCirc'
  | 'easeInBack'
  | 'easeOutBack'
  | 'easeInOutBack'
  | 'easeInElastic'
  | 'easeOutElastic'
  | 'easeInOutElastic'
  | 'easeInBounce'
  | 'easeOutBounce'
  | 'easeInOutBounce';

/** A named Penner easing, or a CSS-style cubic bezier with x1 and x2 in 0..1. */
export type EasingSpec = EasingName | { cubicBezier: readonly [number, number, number, number] };

const EASINGS: Record<EasingName, EasingFn> = {
  linear,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInQuart,
  easeOutQuart,
  easeInOutQuart,
  easeInQuint,
  easeOutQuint,
  easeInOutQuint,
  easeInSine,
  easeOutSine,
  easeInOutSine,
  easeInExpo,
  easeOutExpo,
  easeInOutExpo,
  easeInCirc,
  easeOutCirc,
  easeInOutCirc,
  easeInBack,
  easeOutBack,
  easeInOutBack,
  easeInElastic,
  easeOutElastic,
  easeInOutElastic,
  easeInBounce,
  easeOutBounce,
  easeInOutBounce,
};

/**
 * Timing of one animation, in seconds. Give `duration` and `easing`, or `spring`; a spring sets
 * its own duration, so combining it with either is an error.
 */
export interface TimingInput {
  duration?: number;
  easing?: EasingSpec;
  spring?: SpringSpec;
  delay?: number;
}

/** A timing curve sampled at even intervals over `duration`, first sample at the end of `delay`. */
export interface TimingTable {
  delay: number;
  duration: number;
  samples: Float32Array;
}

const NEWTON_ITERATIONS = 8;
const BISECTION_ITERATIONS = 40;
const BEZIER_TOLERANCE = 1e-7;

/** y of the cubic bezier (0,0) (x1,y1) (x2,y2) (1,1) at a given x in 0..1. */
function cubicBezierAt(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  let u = x;
  let solved = false;
  for (let i = 0; i < NEWTON_ITERATIONS; i++) {
    const error = ((ax * u + bx) * u + cx) * u - x;
    if (Math.abs(error) < BEZIER_TOLERANCE) {
      solved = true;
      break;
    }
    const slope = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(slope) < 1e-6) break;
    u -= error / slope;
  }
  if (!solved) {
    // x(u) is monotonic for x1, x2 in 0..1, so bisection always closes in.
    let lo = 0;
    let hi = 1;
    u = x;
    for (let i = 0; i < BISECTION_ITERATIONS; i++) {
      const error = ((ax * u + bx) * u + cx) * u - x;
      if (Math.abs(error) < BEZIER_TOLERANCE) break;
      if (error > 0) hi = u;
      else lo = u;
      u = (lo + hi) / 2;
    }
  }
  return ((ay * u + by) * u + cy) * u;
}

function allocateSamples(duration: number, samplesPerSecond: number): Float32Array {
  // The 1e-9 keeps a product that lands a rounding error above an integer from gaining an
  // interval.
  const intervals = Math.max(1, Math.ceil(duration * samplesPerSecond - 1e-9));
  return new Float32Array(intervals + 1);
}

/**
 * Sample a timing input into a table. `duration` falls back to `defaultDuration`, `easing` to
 * `'linear'`, `delay` to 0. A spring's duration is its {@link springSettleTime}, and its last
 * sample is 1 so the animation ends on the target.
 *
 * Throws a `RangeError` for a spring combined with `duration` or `easing`, an unknown easing
 * name, bezier x control points outside 0..1, a negative or non-finite duration or delay, or a
 * sample rate not above 0.
 */
export function compileTiming(
  t: TimingInput,
  defaultDuration: number,
  samplesPerSecond = 120,
): TimingTable {
  const delay = t.delay ?? 0;
  if (!Number.isFinite(delay) || delay < 0) {
    throw new RangeError(`compileTiming: delay must be a finite number >= 0, got ${delay}`);
  }
  if (!Number.isFinite(samplesPerSecond) || samplesPerSecond <= 0) {
    throw new RangeError(
      `compileTiming: samplesPerSecond must be a finite number above 0, got ${samplesPerSecond}`,
    );
  }

  if (t.spring !== undefined) {
    if (t.duration !== undefined || t.easing !== undefined) {
      throw new RangeError(
        'compileTiming: a spring sets its own duration; do not combine it with duration or easing',
      );
    }
    const resolved = resolveSpring(t.spring);
    const duration = springSettleTime(resolved);
    const samples = allocateSamples(duration, samplesPerSecond);
    const last = samples.length - 1;
    for (let i = 0; i < last; i++) {
      samples[i] = springStepAt(resolved.omega0, resolved.zeta, (i / last) * duration);
    }
    samples[last] = 1;
    return { delay, duration, samples };
  }

  const duration = t.duration ?? defaultDuration;
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError(`compileTiming: duration must be a finite number >= 0, got ${duration}`);
  }
  const easing = t.easing ?? 'linear';
  const samples = allocateSamples(duration, samplesPerSecond);
  const last = samples.length - 1;
  if (typeof easing === 'string') {
    if (!Object.hasOwn(EASINGS, easing)) {
      throw new RangeError(`compileTiming: unknown easing "${easing}"`);
    }
    const ease = EASINGS[easing];
    for (let i = 0; i <= last; i++) samples[i] = ease(i / last);
  } else {
    const [x1, y1, x2, y2] = easing.cubicBezier;
    if (
      !(x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1) ||
      !Number.isFinite(y1) ||
      !Number.isFinite(y2)
    ) {
      throw new RangeError(
        `compileTiming: cubicBezier needs x1 and x2 in 0..1 and finite y1 and y2, got [${x1}, ${y1}, ${x2}, ${y2}]`,
      );
    }
    for (let i = 0; i <= last; i++) samples[i] = cubicBezierAt(x1, y1, x2, y2, i / last);
  }
  return { delay, duration, samples };
}

/**
 * Progress at time `t` (seconds) from a sampled table: 0 before the delay, the last sample from
 * the end on, linear interpolation between samples in between.
 */
export function timingAt(
  samples: Float32Array,
  delay: number,
  duration: number,
  t: number,
): number {
  'worklet';
  const last = samples.length - 1;
  const local = t - delay;
  if (local < 0) return 0;
  if (local >= duration) return samples[last]!;
  const position = (local / duration) * last;
  const index = Math.floor(position);
  if (index >= last) return samples[last]!;
  const a = samples[index]!;
  const b = samples[index + 1]!;
  return a + (b - a) * (position - index);
}

/**
 * The table as a CSS `linear()` easing of at most `maxPoints` evenly spaced stops, resampled when
 * the table has more. It covers `duration` only; pass `delay` to the animation separately.
 *
 * Throws a `RangeError` when `maxPoints` is not an integer of at least 2.
 */
export function timingToCssLinear(table: TimingTable, maxPoints = 64): string {
  if (!Number.isInteger(maxPoints) || maxPoints < 2) {
    throw new RangeError(`timingToCssLinear: maxPoints must be an integer >= 2, got ${maxPoints}`);
  }
  const count = Math.max(2, Math.min(table.samples.length, maxPoints));
  let stops = '';
  for (let i = 0; i < count; i++) {
    const value = timingAt(table.samples, 0, 1, i / (count - 1));
    // Four decimals, then back through Number to drop trailing zeros and the sign of -0.
    stops += `${i === 0 ? '' : ', '}${Number(value.toFixed(4))}`;
  }
  return `linear(${stops})`;
}
