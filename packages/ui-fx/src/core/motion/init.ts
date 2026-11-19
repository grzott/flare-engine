import { directionInto, resolveOriginInto, type Vec2Out } from '../conventions';
import type { FractureMesh } from '../fracture/types';
import type { DisintegratePreset, ForceSpec, ShatterPreset } from '../presets';
import { createStream, nextUnit } from '../prng';
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
} from './layout';

const DEG_TO_RAD = Math.PI / 180;

const _origin: Vec2Out = { x: 0, y: 0 };
const _dir: Vec2Out = { x: 0, y: 0 };

/** Share of a force's strength at `r` radii from its origin: 1 at the origin, falling with `r`. */
function falloffAt(kind: ForceSpec['falloff'], r: number): number {
  if (kind === 'none') return 1;
  if (kind === 'inverse-square') return 1 / (1 + r * r);
  const inside = r < 1 ? 1 - r : 0;
  return kind === 'linear' ? inside : inside * inside * (3 - 2 * inside);
}

/**
 * Fill `out` with the launch state of every piece of `mesh`, `FRAG_STRIDE` floats each, and
 * return the piece count. `press` is the press point in element pixels, or null.
 *
 * Each force adds a launch velocity: away from its origin (`'radial'`), toward it (`'implode'`),
 * clockwise around it (`'vortex'`) or along its angle (`'directional'`), scaled by its falloff
 * and divided by the piece's mass. A piece sitting exactly on the origin has no direction to
 * leave in, so only a directional force moves it.
 *
 * The release delay is the piece's place along the release front times `release.duration`, plus
 * its timing randomness, and never more than `release.duration`. A `'radial'` front spreads from
 * the first force's origin (`fragment.focus` without one) to the farthest corner; a `'sweep'`
 * front crosses the box along `release.angle`.
 *
 * Random terms come from the `velocity` and `timing` streams of `fragment.seed`, drawn in piece
 * order, so the same mesh and preset always fill `out` with the same bytes.
 *
 * Throws a `RangeError` when `out` holds fewer than `FRAG_STRIDE` floats per piece.
 */
export function initFragmentsInto(
  mesh: FractureMesh,
  p: ShatterPreset | DisintegratePreset,
  widthPx: number,
  heightPx: number,
  press: Vec2Out | null,
  out: Float32Array,
): number {
  const count = mesh.count;
  if (out.length < count * FRAG_STRIDE) {
    throw new RangeError(
      `initFragmentsInto: out needs ${count * FRAG_STRIDE} numbers for ${count} pieces, got ${out.length}`,
    );
  }
  const { forces, release, physics, life } = p;
  const centroids = mesh.centroids;
  const areas = mesh.areas;
  const diagonal = Math.hypot(widthPx, heightPx);
  const velocity = createStream(p.fragment.seed, 'velocity');
  const timing = createStream(p.fragment.seed, 'timing');

  let areaSum = 0;
  for (let i = 0; i < count; i++) areaSum += areas[i]!;
  const meanArea = areaSum / count;

  const first = forces[0];
  resolveOriginInto(
    first === undefined ? p.fragment.focus : first.origin,
    widthPx,
    heightPx,
    press,
    _origin,
  );
  const frontX = _origin.x;
  const frontY = _origin.y;
  const farX = Math.max(frontX, widthPx - frontX);
  const farY = Math.max(frontY, heightPx - frontY);
  const maxD = Math.hypot(farX, farY);

  directionInto(release.angle, _dir);
  const sweepX = _dir.x;
  const sweepY = _dir.y;
  // The box corners projected on the sweep direction span sweepMin .. sweepMin + sweepSpan.
  const sweepMin = Math.min(0, sweepX * widthPx) + Math.min(0, sweepY * heightPx);
  const sweepSpan = Math.abs(sweepX * widthPx) + Math.abs(sweepY * heightPx);

  for (let i = 0; i < count; i++) {
    const o = i * FRAG_STRIDE;
    const cx = centroids[i * 2]! * widthPx;
    const cy = centroids[i * 2 + 1]! * heightPx;
    const mass = 1 + (areas[i]! / meanArea - 1) * physics.massVariance;

    let vx = 0;
    let vy = 0;
    for (let f = 0; f < forces.length; f++) {
      const force = forces[f]!;
      resolveOriginInto(force.origin, widthPx, heightPx, press, _origin);
      const dx = cx - _origin.x;
      const dy = cy - _origin.y;
      const dist = Math.hypot(dx, dy);
      const radius = force.radius * diagonal;
      const weight = falloffAt(force.falloff, radius > 0 ? dist / radius : Infinity);

      let ux = 0;
      let uy = 0;
      if (force.kind === 'directional') {
        directionInto(force.angle, _dir);
        ux = _dir.x;
        uy = _dir.y;
      } else if (dist > 0) {
        const sign = force.kind === 'implode' ? -1 : 1;
        // Screen y points down, so (−dy, dx) is d turned a quarter clockwise.
        ux = (sign * (force.kind === 'vortex' ? -dy : dx)) / dist;
        uy = (sign * (force.kind === 'vortex' ? dx : dy)) / dist;
      }

      const turn = (nextUnit(velocity) - 0.5) * 2 * physics.randomness * force.spread * DEG_TO_RAD;
      const speed =
        (force.strength * weight * (1 + (nextUnit(velocity) - 0.5) * physics.randomness)) / mass;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      vx += (ux * cos - uy * sin) * speed;
      vy += (ux * sin + uy * cos) * speed;
    }

    const omega =
      physics.spin * DEG_TO_RAD * (nextUnit(velocity) - 0.5) * 2 * (0.5 + physics.randomness);
    const vz = (nextUnit(velocity) - 0.5) * 2;

    // Drawn for every order, so switching the order leaves the other timing draws where they were.
    let front = nextUnit(timing);
    if (release.order === 'radial') {
      front = maxD > 0 ? Math.hypot(cx - frontX, cy - frontY) / maxD : 0;
    } else if (release.order === 'sweep') {
      front = sweepSpan > 0 ? (cx * sweepX + cy * sweepY - sweepMin) / sweepSpan : 0;
    }
    const delay = Math.min(
      release.duration,
      (front + nextUnit(timing) * release.timingRandomness) * release.duration,
    );

    out[o + HX] = cx;
    out[o + HY] = cy;
    out[o + VX] = vx;
    out[o + VY] = vy;
    out[o + A0] = 0;
    out[o + OMEGA] = omega;
    out[o + DELAY] = delay;
    out[o + LIFE] = life.lifetime * (1 + (nextUnit(timing) - 0.5) * 2 * life.lifetimeVariance);
    out[o + MASS] = mass;
    out[o + VZ] = vz;
    out[o + SRC] = i;
    out[o + CX] = 0;
  }
  return count;
}

/**
 * Fill `out` with the preset's physics block, `PHYS_LEN` floats, and return it. The block is
 * packed for the forward run (`REVERSE_MODE` 0); to play the run as an enter, set
 * `REVERSE_MODE` to 1 (`'rewind'`), 2 (`'home'`) or 3 (`'spring-home'`).
 *
 * `TOTAL` is `release.duration + life.lifetime × (1 + life.lifetimeVariance)`, the preset's run
 * length without its delay. The spring-home spring is critically damped with a period of
 * `TOTAL`.
 *
 * Throws a `RangeError` when `out` holds fewer than `PHYS_LEN` floats.
 */
export function packPhysicsInto(
  p: ShatterPreset | DisintegratePreset,
  out: Float32Array,
): Float32Array {
  if (out.length < PHYS_LEN) {
    throw new RangeError(`packPhysicsInto: out needs ${PHYS_LEN} numbers, got ${out.length}`);
  }
  const { physics, life } = p;
  const total = p.release.duration + life.lifetime * (1 + life.lifetimeVariance);
  directionInto(physics.gravityAngle, _dir);
  out.fill(0, 0, PHYS_LEN);
  out[GX] = physics.gravity * _dir.x;
  out[GY] = physics.gravity * _dir.y;
  out[DRAG] = physics.drag;
  out[ADRAG] = physics.angularDrag;
  out[DEPTH] = physics.depth;
  out[OP0] = life.opacity[0];
  out[OP1] = life.opacity[1];
  out[SC0] = life.scale[0];
  out[SC1] = life.scale[1];
  out[FADE_START] = life.fadeStart;
  out[REVERSE_MODE] = 0;
  out[OMEGA0] = total > 0 ? (2 * Math.PI) / total : 0;
  out[ZETA] = 1;
  out[TOTAL] = total;
  return out;
}
