import { springStepAt } from '../timing';
import {
  A0,
  ADRAG,
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
  OMEGA,
  OMEGA0,
  OP0,
  OP1,
  REVERSE_MODE,
  SC0,
  SC1,
  TOTAL,
  VX,
  VY,
  VZ,
  ZETA,
} from './layout';

/** Where a fragment is: its centroid in element pixels, `rotation` in radians. */
export interface FragmentPose {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  alpha: number;
}

/** The pose `t` seconds into the forward run: at home until the delay, then in flight for a life. */
function forwardPoseInto(
  state: Float32Array,
  i: number,
  t: number,
  phys: Float32Array,
  out: FragmentPose,
): FragmentPose {
  'worklet';
  const o = i * FRAG_STRIDE;
  const life = state[o + LIFE]!;
  const local = t - state[o + DELAY]!;
  const tau = local < 0 ? 0 : local > life ? life : local;
  const vx = state[o + VX]!;
  const vy = state[o + VY]!;
  const gx = phys[GX]!;
  const gy = phys[GY]!;
  const k = phys[DRAG]!;
  const ka = phys[ADRAG]!;

  if (k > 0) {
    const decay = (1 - Math.exp(-k * tau)) / k;
    out.x = state[o + HX]! + (gx / k) * tau + (vx - gx / k) * decay;
    out.y = state[o + HY]! + (gy / k) * tau + (vy - gy / k) * decay;
  } else {
    out.x = state[o + HX]! + vx * tau + (gx * tau * tau) / 2;
    out.y = state[o + HY]! + vy * tau + (gy * tau * tau) / 2;
  }
  out.rotation =
    state[o + A0]! + state[o + OMEGA]! * (ka > 0 ? (1 - Math.exp(-ka * tau)) / ka : tau);

  const u = life > 0 ? tau / life : 0;
  const op0 = phys[OP0]!;
  const fadeStart = phys[FADE_START]!;
  if (u < fadeStart) {
    out.alpha = op0;
  } else {
    const s = fadeStart < 1 ? (u - fadeStart) / (1 - fadeStart) : 1;
    out.alpha = op0 + (phys[OP1]! - op0) * s * s * (3 - 2 * s);
  }
  const sc0 = phys[SC0]!;
  out.scale = (sc0 + (phys[SC1]! - sc0) * u) * (1 + phys[DEPTH]! * state[o + VZ]! * tau);
  return out;
}

/**
 * The pose of fragment `i` at `t` seconds into the run, writing into `out`. Closed form, so any
 * `t` can be evaluated directly and in any order. `phys[REVERSE_MODE]` picks how the run plays:
 *
 * - 0, forward: each piece waits at home for its delay, then flies for its life and holds its
 *   last pose.
 * - 1, rewind: the forward run backwards, so the pose at `t` is the forward pose at `total − t`.
 * - 2, home: from the forward pose at `total`, in a straight line to home, arriving at
 *   `t = total`.
 * - 3, spring-home: the same line, travelled by the step response of the (ω0, ζ) spring.
 */
export function fragmentPoseInto(
  state: Float32Array,
  i: number,
  t: number,
  phys: Float32Array,
  out: FragmentPose,
): FragmentPose {
  'worklet';
  const mode = phys[REVERSE_MODE]!;
  const total = phys[TOTAL]!;
  if (mode === 0) return forwardPoseInto(state, i, t, phys, out);
  if (mode === 1) return forwardPoseInto(state, i, total - t, phys, out);

  let f = 1;
  if (total > 0) {
    if (mode === 2) f = t <= 0 ? 0 : t >= total ? 1 : t / total;
    else f = springStepAt(phys[OMEGA0]!, phys[ZETA]!, t);
  }
  forwardPoseInto(state, i, total, phys, out);
  // Weighted sum rather than a + (b − a)·f: at f = 1 it gives the home value to the last bit.
  const o = i * FRAG_STRIDE;
  const g = 1 - f;
  out.x = out.x * g + state[o + HX]! * f;
  out.y = out.y * g + state[o + HY]! * f;
  out.rotation = out.rotation * g + state[o + A0]! * f;
  out.scale = out.scale * g + phys[SC0]! * f;
  out.alpha = out.alpha * g + phys[OP0]! * f;
  return out;
}
