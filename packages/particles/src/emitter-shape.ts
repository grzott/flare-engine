/**
 * Emitter shapes — where a particle starts, not where it goes.
 *
 * The split matters, because `EmitterConfig` already owns direction: `direction`
 * plus `spread` describe the velocity cone. A shape samples a **position offset**
 * from the emitter origin and reports the outward normal at that point, so the
 * two compose instead of competing. A shape with a meaningful outward direction
 * can opt velocity into it with `radial: true` — that is what turns a `ring`
 * from a circle of drifting particles into an explosion.
 */

/** A filled disc of radius `radius`, sampled uniformly by area. */
export interface EmitterCircleShape {
  kind: 'circle';
  radius: number;
  /** Emit outward from the centre instead of along `config.direction`. */
  radial?: boolean;
}

/** An annulus at `radius`, `thickness` wide (default 0 — a bare ring). */
export interface EmitterRingShape {
  kind: 'ring';
  radius: number;
  thickness?: number;
  /** Emit outward from the centre instead of along `config.direction`. */
  radial?: boolean;
}

/** An axis-aligned rectangle centred on the emitter, sampled uniformly. */
export interface EmitterRectShape {
  kind: 'rect';
  width: number;
  height: number;
}

/**
 * A sector (wedge) of radius `radius` and half-angle `angle`, centred on
 * `config.direction` and sampled uniformly by area.
 *
 * This is a *position* wedge, which is what keeps it distinct from
 * `config.spread`: `spread` fans the velocity out of a single point, `cone`
 * spreads the spawn points themselves across the wedge.
 */
export interface EmitterConeShape {
  kind: 'cone';
  radius: number;
  angle: number;
  /** Emit outward from the apex instead of along `config.direction`. */
  radial?: boolean;
}

/** The emitter origin — every particle starts at the same point. The default. */
export interface EmitterPointShape {
  kind: 'point';
}

/** Where newly emitted particles are placed, relative to the emitter. */
export type EmitterShape =
  | EmitterPointShape
  | EmitterCircleShape
  | EmitterRingShape
  | EmitterRectShape
  | EmitterConeShape;

/**
 * A sampled spawn point: an offset from the emitter origin, plus the outward
 * normal at that offset.
 *
 * `nx`/`ny` are unit length for the radial shapes. For `point` and `rect` there
 * is no meaningful outward direction and both are 0 — a caller honouring
 * `radial` must fall back to `config.direction`, which is what `hasRadialNormal`
 * is for.
 */
export interface ShapeSample {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

/** A fresh, zeroed sample. Allocate once outside the loop and reuse. */
export function createShapeSample(): ShapeSample {
  return { x: 0, y: 0, nx: 0, ny: 0 };
}

const TAU = Math.PI * 2;

/**
 * Does this shape produce a usable outward normal?
 *
 * True only when the shape is radial *and* opted in. Lets a caller decide
 * between the normal and `config.direction` without inspecting the union.
 */
export function hasRadialNormal(shape: EmitterShape): boolean {
  switch (shape.kind) {
    case 'circle':
    case 'ring':
    case 'cone':
      return shape.radial === true;
    default:
      return false;
  }
}

/**
 * Sample a spawn offset into `out`. Zero-alloc: nothing is constructed here, so
 * this is safe to call once per emitted particle in a steady-state loop.
 *
 * `rand` must return a float in [0, 1). Pass the emitter's seeded generator to
 * keep emission deterministic — every shape draws a fixed number of values per
 * call (`point` 0, `ring`/`rect` 2, `circle`/`cone` 2), so a given seed replays
 * exactly.
 *
 * `direction` orients `cone` and is ignored by every other shape.
 */
export function sampleEmitterShape(
  shape: EmitterShape,
  rand: () => number,
  out: ShapeSample,
  direction = 0,
): ShapeSample {
  switch (shape.kind) {
    case 'point': {
      out.x = 0;
      out.y = 0;
      out.nx = 0;
      out.ny = 0;
      return out;
    }
    case 'circle': {
      const angle = rand() * TAU;
      // sqrt keeps the distribution uniform by area; without it particles
      // bunch toward the centre.
      const r = Math.sqrt(rand()) * Math.max(0, shape.radius);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      out.x = cos * r;
      out.y = sin * r;
      out.nx = cos;
      out.ny = sin;
      return out;
    }
    case 'ring': {
      const angle = rand() * TAU;
      const thickness = Math.max(0, shape.thickness ?? 0);
      const base = Math.max(0, shape.radius);
      // Uniform across the band rather than by area: a ring is thin by
      // definition, and area-weighting a 1px band buys nothing.
      const r = base + (rand() - 0.5) * thickness;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      out.x = cos * r;
      out.y = sin * r;
      out.nx = cos;
      out.ny = sin;
      return out;
    }
    case 'rect': {
      const w = Math.max(0, shape.width);
      const h = Math.max(0, shape.height);
      out.x = (rand() - 0.5) * w;
      out.y = (rand() - 0.5) * h;
      out.nx = 0;
      out.ny = 0;
      return out;
    }
    case 'cone': {
      const half = Math.max(0, shape.angle);
      const angle = direction + (rand() * 2 - 1) * half;
      const r = Math.sqrt(rand()) * Math.max(0, shape.radius);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      out.x = cos * r;
      out.y = sin * r;
      out.nx = cos;
      out.ny = sin;
      return out;
    }
  }
}
