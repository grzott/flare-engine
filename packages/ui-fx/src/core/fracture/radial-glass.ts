import { createStream, nextUnit } from '../prng';
import { clipPolygonToUnitInto } from './clip';
import type { FracturePolygons } from './types';

const MIN_RAYS = 8;
const MAX_RAYS = 24;
/** Each ring is this many times as far from the focus as the one inside it. */
const RING_GROWTH = 1.6;
/** How far a ring vertex may stray, in rings, at full jitter. Below 1, so rings never cross. */
const RING_JITTER = 0.8;
/** Below this fraction of the element, a piece is what clipping leaves of one outside it. */
const MIN_AREA = 1e-12;

const TAU = Math.PI * 2;

/**
 * Glass broken around a focus: rays from the focus cross rings whose radii grow geometrically,
 * so pieces are small near the focus and large far from it. The innermost band is triangles, the
 * rest quads, all clipped to the element. `focusX` and `focusY` are 0..1 of the element and may
 * lie outside it; `aspect` is its width over its height, so rings are round on screen.
 *
 * There are 8 to 24 rays and `count / rays` bands, rounded down, so at most `count` pieces once
 * `count` reaches 8. Fewer come back when bands fall outside the element.
 *
 * Every vertex sits on a ray, and a piece between two rays less than half a turn apart is convex
 * whatever its radii, so jitter never costs convexity.
 */
export function radialGlassPolygons(
  count: number,
  focusX: number,
  focusY: number,
  aspect: number,
  jitter: number,
  seed: number,
): FracturePolygons {
  const stream = createStream(seed, 'sites');
  const rays = Math.min(MAX_RAYS, Math.max(MIN_RAYS, Math.round(Math.sqrt(2 * count))));
  const rings = Math.max(1, Math.floor(count / rays));

  // Work where one unit is the element's height on both axes, then squash x back to 0..1.
  const fx = focusX * aspect;
  const fy = focusY;

  const angles = new Float64Array(rays);
  for (let r = 0; r < rays; r++) {
    angles[r] = ((r + jitter * (nextUnit(stream) - 0.5)) * TAU) / rays;
  }
  let widest = 0;
  for (let r = 0; r < rays; r++) {
    const next = r === rays - 1 ? angles[0]! + TAU : angles[r + 1]!;
    widest = Math.max(widest, next - angles[r]!);
  }

  const far = Math.max(
    Math.hypot(fx, fy),
    Math.hypot(aspect - fx, fy),
    Math.hypot(aspect - fx, 1 - fy),
    Math.hypot(fx, 1 - fy),
  );
  // The last ring is straight chords between rays. A chord across the widest gap comes this much
  // closer to the focus than its ends, so the ends go that much further out to keep the farthest
  // corner inside; the last ring is not jittered, to keep that true.
  const outer = (far / Math.cos(widest / 2)) * 1.001;

  // points[(k * rays + r) * 2] is where ray r meets ring k; ring `rings - 1` is the last.
  const points = new Float32Array(rays * rings * 2);
  for (let k = 0; k < rings; k++) {
    for (let r = 0; r < rays; r++) {
      const radius =
        k === rings - 1
          ? outer
          : far * RING_GROWTH ** (k + 1 - rings + RING_JITTER * jitter * (nextUnit(stream) - 0.5));
      const o = (k * rays + r) * 2;
      points[o] = (fx + Math.cos(angles[r]!) * radius) / aspect;
      points[o + 1] = fy + Math.sin(angles[r]!) * radius;
    }
  }

  const vertexStart = new Uint32Array(rays * rings + 1);
  // A quad clipped to the square has at most 8 vertices.
  const vertices = new Float32Array(rays * rings * 16);
  const piece = new Float32Array(8);
  const clipped = new Float32Array(16);
  let pieces = 0;
  let o = 0;
  for (let k = 0; k < rings; k++) {
    for (let r = 0; r < rays; r++) {
      const next = (r + 1) % rays;
      const here = (k * rays + r) * 2;
      const hereNext = (k * rays + next) * 2;
      let n = 0;
      if (k === 0) {
        piece[n++] = focusX;
        piece[n++] = focusY;
      } else {
        const near = ((k - 1) * rays + r) * 2;
        const nearNext = ((k - 1) * rays + next) * 2;
        piece[n++] = points[near]!;
        piece[n++] = points[near + 1]!;
        piece[n++] = points[nearNext]!;
        piece[n++] = points[nearNext + 1]!;
      }
      piece[n++] = points[hereNext]!;
      piece[n++] = points[hereNext + 1]!;
      piece[n++] = points[here]!;
      piece[n++] = points[here + 1]!;

      const kept = clipPolygonToUnitInto(piece, n / 2, clipped);
      if (kept < 3) continue;
      let twice = 0;
      for (let v = 0; v < kept; v++) {
        const w = (v + 1) % kept;
        twice += clipped[v * 2]! * clipped[w * 2 + 1]! - clipped[w * 2]! * clipped[v * 2 + 1]!;
      }
      if (Math.abs(twice) / 2 < MIN_AREA) continue;
      for (let v = 0; v < kept * 2; v++) vertices[o++] = clipped[v]!;
      vertexStart[++pieces] = o / 2;
    }
  }
  return {
    count: pieces,
    vertexStart: vertexStart.slice(0, pieces + 1),
    vertices: vertices.slice(0, o),
  };
}
