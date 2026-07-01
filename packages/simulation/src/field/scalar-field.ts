// ScalarField — allocation-free diffuse/decay scalar pheromone grid with bilinear sampling,
// additive deposit, radial erode, separable box-blur ping-pong, palette RGBA pack, and a
// central-difference gradient. Edge mode is 'toroidal' (default, wrapping) or 'clamp' (bounded).
// ZERO engine/DOM imports — pure TS. Bun-testable in isolation.

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t: number): number => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

export interface ScalarField {
  readonly w: number;
  readonly h: number;
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly edge: 'toroidal' | 'clamp';
  /** Bilinear read in px space. */
  sample(x: number, y: number): number;
  /** Central-difference gradient ∇ of the field at (x,y) — one cell apart, edge-aware. */
  gradient(x: number, y: number, out: { x: number; y: number }): void;
  /** Additive pheromone splat into the nearest cell. */
  deposit(x: number, y: number, amount: number): void;
  /** Multiply cells within radiusPx of (x,y) by `mul` (0..1). */
  erode(x: number, y: number, radiusPx: number, mul: number): void;
  /** Whole-field update: separable 3×3 box blur lerped by diffuseRate, then × decayRate.
   *  Each cell is clamped to maxVal (use Infinity for no clamp). */
  step(diffuseRate: number, decayRate: number, maxVal: number): void;
  /** Strided mean over the whole field. */
  meanValue(stride: number): number;
  /** Strided max over the whole field. */
  maxValue(stride: number): number;
  /** Mean field value in a disc around (x,y). */
  localMean(x: number, y: number, radiusPx: number): number;
  /**
   * Pack the field into an RGBA byte buffer (length cols*rows*4) with a palette-binned ramp:
   * low→mid→hi by value, knot reserved for the brightest cells; brightness folded into rgb
   * so dim cells add nothing under additive Plus. `out` is caller-owned and reused.
   *
   * Palette channels (low/mid/hi/knot) are normalized [0,1] fractions (not byte values).
   * ScalarField values are assumed non-negative; negative values are clamped to 0 in the
   * output byte channels.
   */
  toRGBA(
    out: Uint8Array,
    norm: number,
    low: readonly number[],
    mid: readonly number[],
    hi: readonly number[],
    knot: readonly number[],
  ): void;
  resize(width: number, height: number): void;
}

export function createScalarField(
  width: number,
  height: number,
  cellSize: number,
  edgeMode: 'toroidal' | 'clamp' = 'toroidal',
): ScalarField {
  const cell = Math.max(1, cellSize);
  let w = Math.max(1, width);
  let h = Math.max(1, height);
  let cols = Math.max(1, Math.ceil(w / cell));
  let rows = Math.max(1, Math.ceil(h / cell));
  let a = new Float32Array(cols * rows);
  let b = new Float32Array(cols * rows); // blur scratch (ping-pong)

  // Edge-mode helpers: captured at construction for branch-light hot paths.
  let wrapCol: (c: number) => number;
  let wrapRow: (r: number) => number;

  function rebuildEdgeFns(): void {
    if (edgeMode === 'toroidal') {
      wrapCol = (c) => ((c % cols) + cols) % cols;
      wrapRow = (r) => ((r % rows) + rows) % rows;
    } else {
      wrapCol = (c) => (c < 0 ? 0 : c >= cols ? cols - 1 : c);
      wrapRow = (r) => (r < 0 ? 0 : r >= rows ? rows - 1 : r);
    }
  }

  rebuildEdgeFns();

  const field: ScalarField = {
    get w() {
      return w;
    },
    get h() {
      return h;
    },
    get cols() {
      return cols;
    },
    get rows() {
      return rows;
    },
    get cell() {
      return cell;
    },
    get edge() {
      return edgeMode;
    },

    sample(x, y) {
      const gx = x / cell - 0.5;
      const gy = y / cell - 0.5;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = gx - x0;
      const fy = gy - y0;
      const xa = wrapCol(x0);
      const xb = wrapCol(x0 + 1);
      const ya = wrapRow(y0);
      const yb = wrapRow(y0 + 1);
      const a00 = a[ya * cols + xa] ?? 0;
      const a10 = a[ya * cols + xb] ?? 0;
      const a01 = a[yb * cols + xa] ?? 0;
      const a11 = a[yb * cols + xb] ?? 0;
      const top = a00 + (a10 - a00) * fx;
      const bot = a01 + (a11 - a01) * fx;
      return top + (bot - top) * fy;
    },

    gradient(x, y, out) {
      // Central difference one cell apart, in px space.
      out.x = field.sample(x + cell, y) - field.sample(x - cell, y);
      out.y = field.sample(x, y + cell) - field.sample(x, y - cell);
    },

    deposit(x, y, amount) {
      const cx = wrapCol(Math.floor(x / cell));
      const cy = wrapRow(Math.floor(y / cell));
      const i = cy * cols + cx;
      a[i] = (a[i] ?? 0) + amount;
    },

    erode(x, y, radiusPx, mul) {
      const cr = Math.max(1, Math.ceil(radiusPx / cell));
      const ccx = Math.floor(x / cell);
      const ccy = Math.floor(y / cell);
      const r2 = cr * cr;
      for (let dy = -cr; dy <= cr; dy++) {
        for (let dx = -cr; dx <= cr; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const i = wrapRow(ccy + dy) * cols + wrapCol(ccx + dx);
          a[i] = (a[i] ?? 0) * mul;
        }
      }
    },

    step(diffuseRate, decayRate, maxVal) {
      // Horizontal blur a → b.
      for (let r = 0; r < rows; r++) {
        const base = r * cols;
        for (let c = 0; c < cols; c++) {
          const cl = edgeMode === 'toroidal' ? (c === 0 ? cols - 1 : c - 1) : c === 0 ? 0 : c - 1;
          const cr2 =
            edgeMode === 'toroidal'
              ? c === cols - 1
                ? 0
                : c + 1
              : c === cols - 1
                ? cols - 1
                : c + 1;
          b[base + c] = ((a[base + cl] ?? 0) + (a[base + c] ?? 0) + (a[base + cr2] ?? 0)) / 3;
        }
      }
      // Vertical blur b + lerp with original a + decay + clamp → a.
      for (let r = 0; r < rows; r++) {
        const ru = edgeMode === 'toroidal' ? (r === 0 ? rows - 1 : r - 1) : r === 0 ? 0 : r - 1;
        const rd =
          edgeMode === 'toroidal'
            ? r === rows - 1
              ? 0
              : r + 1
            : r === rows - 1
              ? rows - 1
              : r + 1;
        const base = r * cols;
        const upBase = ru * cols;
        const dnBase = rd * cols;
        for (let c = 0; c < cols; c++) {
          const blurred = ((b[upBase + c] ?? 0) + (b[base + c] ?? 0) + (b[dnBase + c] ?? 0)) / 3;
          const orig = a[base + c] ?? 0;
          const next = (orig + (blurred - orig) * diffuseRate) * decayRate;
          a[base + c] = next > maxVal ? maxVal : next;
        }
      }
    },

    meanValue(stride) {
      const s = Math.max(1, Math.floor(stride));
      let sum = 0;
      let n = 0;
      for (let i = 0; i < a.length; i += s) {
        sum += a[i] ?? 0;
        n++;
      }
      return n > 0 ? sum / n : 0;
    },

    maxValue(stride) {
      const s = Math.max(1, Math.floor(stride));
      const n = Math.ceil(a.length / s);
      if (n === 0) return 0;
      let m = Number.NEGATIVE_INFINITY;
      for (let i = 0; i < a.length; i += s) {
        const v = a[i] ?? 0;
        if (v > m) m = v;
      }
      return m;
    },

    localMean(x, y, radiusPx) {
      const cr = Math.max(1, Math.ceil(radiusPx / cell));
      const ccx = Math.floor(x / cell);
      const ccy = Math.floor(y / cell);
      let sum = 0;
      let n = 0;
      for (let dy = -cr; dy <= cr; dy++) {
        for (let dx = -cr; dx <= cr; dx++) {
          sum += a[wrapRow(ccy + dy) * cols + wrapCol(ccx + dx)] ?? 0;
          n++;
        }
      }
      return n > 0 ? sum / n : 0;
    },

    toRGBA(out, norm, low, mid, hi, knot) {
      const inv = norm > 1e-6 ? 1 / norm : 0;
      const lr = low[0] ?? 0;
      const lg = low[1] ?? 0;
      const lb = low[2] ?? 0;
      const mr = mid[0] ?? 0;
      const mg = mid[1] ?? 0;
      const mb = mid[2] ?? 0;
      const hr = hi[0] ?? 0;
      const hg = hi[1] ?? 0;
      const hb = hi[2] ?? 0;
      const kr = knot[0] ?? 0;
      const kg = knot[1] ?? 0;
      const kb = knot[2] ?? 0;
      for (let i = 0; i < a.length; i++) {
        const v = smooth((a[i] ?? 0) * inv);
        let r: number;
        let g: number;
        let bl: number;
        if (v < 0.5) {
          const t = v * 2;
          r = lr + (mr - lr) * t;
          g = lg + (mg - lg) * t;
          bl = lb + (mb - lb) * t;
        } else if (v < 0.85) {
          const t = (v - 0.5) / 0.35;
          r = mr + (hr - mr) * t;
          g = mg + (hg - mg) * t;
          bl = mb + (hb - mb) * t;
        } else {
          const t = (v - 0.85) / 0.15;
          r = hr + (kr - hr) * t;
          g = hg + (kg - hg) * t;
          bl = hb + (kb - hb) * t;
        }
        const o = i << 2;
        const rv = r * v * 255;
        const gv = g * v * 255;
        const bv = bl * v * 255;
        out[o] = rv < 0 ? 0 : rv > 255 ? 255 : rv | 0;
        out[o + 1] = gv < 0 ? 0 : gv > 255 ? 255 : gv | 0;
        out[o + 2] = bv < 0 ? 0 : bv > 255 ? 255 : bv | 0;
        out[o + 3] = 255;
      }
    },

    resize(width2, height2) {
      w = Math.max(1, width2);
      h = Math.max(1, height2);
      cols = Math.max(1, Math.ceil(w / cell));
      rows = Math.max(1, Math.ceil(h / cell));
      a = new Float32Array(cols * rows);
      b = new Float32Array(cols * rows);
      rebuildEdgeFns();
    },
  };

  return field;
}
