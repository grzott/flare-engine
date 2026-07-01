// Jones-model agent stigmergy — SoA agents that sense a ScalarField, turn (Jones 2010), move,
// and deposit — the engine's first emergent-AI primitive. Fully deterministic via SeededRNG.
// ZERO engine/DOM imports beyond @flare-engine/math. Allocation-free update().

import type { SeededRNG } from '@flare-engine/math';
import type { ScalarField } from '../field/scalar-field.js';

const TWO_PI = Math.PI * 2;

// ── Jones-model sense/rotate helpers (pure, lifted verbatim from field.ts) ──────────────────────

export interface SenseConfig {
  /** rad — angular offset of the two side sensors. */
  sensorAngle: number;
  /** px — how far ahead the sensors read. */
  sensorDist: number;
  /** rad — turn applied per step toward the brightest sensor. */
  rotateAngle: number;
}

export const SENSE_DEFAULTS: SenseConfig = {
  sensorAngle: 0.5,
  sensorDist: 9,
  rotateAngle: 0.45,
};

/** Read the field at one sensor: `offset` rad off the agent heading, `dist` px ahead. */
export function senseAt(
  field: ScalarField,
  x: number,
  y: number,
  heading: number,
  offset: number,
  dist: number,
): number {
  const a = heading + offset;
  return field.sample(x + Math.cos(a) * dist, y + Math.sin(a) * dist);
}

/** Jones turn decision from three sensor readings: −1 turn left, 0 straight, +1 turn right.
 *  `rand` ∈ [0,1) breaks the symmetric "both sides brighter" case. */
export function decideTurn(left: number, center: number, right: number, rand: number): -1 | 0 | 1 {
  if (center > left && center > right) return 0;
  if (center < left && center < right) return rand < 0.5 ? -1 : 1;
  if (left < right) return 1;
  return -1;
}

// ── Agent stigmergy ──────────────────────────────────────────────────────────────────────────────

export interface StigmergyConfig {
  count: number;
  sensorAngle: number;
  sensorDist: number;
  rotateAngle: number;
  stepSize: number;
  depositAmount: number;
  chaos: number;
  /** Returns an extra heading delta (rad) applied before moving. */
  onSense?: (index: number, x: number, y: number, heading: number) => number;
  /** Post-move notify. */
  onMove?: (index: number, x: number, y: number, heading: number) => void;
}

export interface AgentField {
  readonly count: number;
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly heading: Float32Array;
  update(): void;
  forEachAgent(cb: (x: number, y: number) => void, stride?: number): void;
  resize(width: number, height: number): void;
}

export function createStigmergy(
  field: ScalarField,
  config: StigmergyConfig,
  rng: SeededRNG,
): AgentField {
  const { count } = config;
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const heading = new Float32Array(count);

  // Scatter agents uniformly across the field.
  const fw = field.w;
  const fh = field.h;
  for (let i = 0; i < count; i++) {
    px[i] = rng.float(0, fw);
    py[i] = rng.float(0, fh);
    heading[i] = rng.float(0, TWO_PI);
  }

  // Wrap helper — toroidal or clamp, matching field edge mode.
  function wrapX(x: number, w: number): number {
    if (field.edge === 'toroidal') return ((x % w) + w) % w;
    return x < 0 ? 0 : x >= w ? w - 1 : x;
  }
  function wrapY(y: number, h: number): number {
    if (field.edge === 'toroidal') return ((y % h) + h) % h;
    return y < 0 ? 0 : y >= h ? h - 1 : y;
  }

  const af: AgentField = {
    count,
    px,
    py,
    heading,

    update() {
      const w = field.w;
      const h = field.h;
      const sa = config.sensorAngle;
      const sd = config.sensorDist;
      const turnRate = config.rotateAngle;
      const chaos = config.chaos;
      const stepSize = config.stepSize;
      const deposit = config.depositAmount;

      for (let i = 0; i < count; i++) {
        const x = px[i] ?? 0;
        const y = py[i] ?? 0;
        let hd = heading[i] ?? 0;

        // Jones sense → rotate.
        const cF = senseAt(field, x, y, hd, 0, sd);
        const cL = senseAt(field, x, y, hd, -sa, sd);
        const cR = senseAt(field, x, y, hd, sa, sd);
        hd += decideTurn(cL, cF, cR, rng.float(0, 1)) * turnRate;

        // Chaos jitter.
        hd += (rng.float(0, 1) * 2 - 1) * chaos;

        // Caller-injected heading delta (chemotaxis / repulsion).
        if (config.onSense) hd += config.onSense(i, x, y, hd);

        // Move.
        const nx = wrapX(x + Math.cos(hd) * stepSize, w);
        const ny = wrapY(y + Math.sin(hd) * stepSize, h);
        px[i] = nx;
        py[i] = ny;
        heading[i] = hd;

        field.deposit(nx, ny, deposit);

        if (config.onMove) config.onMove(i, nx, ny, hd);
      }
    },

    forEachAgent(cb, stride = 1) {
      const s = Math.max(1, Math.floor(stride));
      for (let i = 0; i < count; i += s) {
        cb(px[i] ?? 0, py[i] ?? 0);
      }
    },

    resize(width, height) {
      const newW = Math.max(1, width);
      const newH = Math.max(1, height);
      for (let i = 0; i < count; i++) {
        px[i] = wrapX(px[i] ?? 0, newW);
        py[i] = wrapY(py[i] ?? 0, newH);
      }
    },
  };

  return af;
}
