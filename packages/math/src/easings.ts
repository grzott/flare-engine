// 42 easing functions — all (t: number) => number, t in [0,1]
// Robert Penner easings + spring, bounce, elastic variants.
// Tree-shakeable named exports.

const PI = Math.PI;
const HALF_PI = PI / 2;
const TAU = PI * 2;

// ─── Linear ─────────────────────────────────────────────────
export function linear(t: number): number {
  return t;
}

// ─── Step ───────────────────────────────────────────────────
export function step(t: number): number {
  return t < 1 ? 0 : 1;
}

// ─── Quad ───────────────────────────────────────────────────
export function easeInQuad(t: number): number {
  return t * t;
}
export function easeOutQuad(t: number): number {
  return t * (2 - t);
}
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── Cubic ──────────────────────────────────────────────────
export function easeInCubic(t: number): number {
  return t * t * t;
}
export function easeOutCubic(t: number): number {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 + (t - 1) * (2 * t - 2) * (2 * t - 2);
}

// ─── Quart ──────────────────────────────────────────────────
export function easeInQuart(t: number): number {
  return t * t * t * t;
}
export function easeOutQuart(t: number): number {
  const t1 = t - 1;
  return 1 - t1 * t1 * t1 * t1;
}
export function easeInOutQuart(t: number): number {
  const t1 = t - 1;
  return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * t1 * t1 * t1 * t1;
}

// ─── Quint ──────────────────────────────────────────────────
export function easeInQuint(t: number): number {
  return t * t * t * t * t;
}
export function easeOutQuint(t: number): number {
  const t1 = t - 1;
  return 1 + t1 * t1 * t1 * t1 * t1;
}
export function easeInOutQuint(t: number): number {
  const t1 = t - 1;
  return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * t1 * t1 * t1 * t1 * t1;
}

// ─── Sine ───────────────────────────────────────────────────
export function easeInSine(t: number): number {
  return 1 - Math.cos(t * HALF_PI);
}
export function easeOutSine(t: number): number {
  return Math.sin(t * HALF_PI);
}
export function easeInOutSine(t: number): number {
  return 0.5 * (1 - Math.cos(PI * t));
}

// ─── Expo ───────────────────────────────────────────────────
export function easeInExpo(t: number): number {
  return t === 0 ? 0 : 2 ** (10 * (t - 1));
}
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - 2 ** (-10 * t);
}
export function easeInOutExpo(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5 ? 0.5 * 2 ** (20 * t - 10) : 1 - 0.5 * 2 ** (-20 * t + 10);
}

// ─── Circ ───────────────────────────────────────────────────
export function easeInCirc(t: number): number {
  return 1 - Math.sqrt(1 - t * t);
}
export function easeOutCirc(t: number): number {
  const t1 = t - 1;
  return Math.sqrt(1 - t1 * t1);
}
export function easeInOutCirc(t: number): number {
  return t < 0.5
    ? 0.5 * (1 - Math.sqrt(1 - 4 * t * t))
    : 0.5 * (Math.sqrt(1 - (2 * t - 2) * (2 * t - 2)) + 1);
}

// ─── Back ───────────────────────────────────────────────────
const S = 1.70158;
const S2 = S * 1.525;

export function easeInBack(t: number): number {
  return t * t * ((S + 1) * t - S);
}
export function easeOutBack(t: number): number {
  const t1 = t - 1;
  return t1 * t1 * ((S + 1) * t1 + S) + 1;
}
export function easeInOutBack(t: number): number {
  if (t < 0.5) {
    const t2 = 2 * t;
    return 0.5 * (t2 * t2 * ((S2 + 1) * t2 - S2));
  }
  const t2 = 2 * t - 2;
  return 0.5 * (t2 * t2 * ((S2 + 1) * t2 + S2) + 2);
}

// ─── Elastic ────────────────────────────────────────────────
export function easeInElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * (TAU / 3));
}
export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
}
export function easeInOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  const p = TAU / 4.5;
  return t < 0.5
    ? -0.5 * 2 ** (20 * t - 10) * Math.sin((20 * t - 11.125) * p)
    : 0.5 * 2 ** (-20 * t + 10) * Math.sin((20 * t - 11.125) * p) + 1;
}

// ─── Bounce ─────────────────────────────────────────────────
export function easeOutBounce(t: number): number {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t;
  }
  if (t < 2 / 2.75) {
    const t2 = t - 1.5 / 2.75;
    return 7.5625 * t2 * t2 + 0.75;
  }
  if (t < 2.5 / 2.75) {
    const t2 = t - 2.25 / 2.75;
    return 7.5625 * t2 * t2 + 0.9375;
  }
  const t2 = t - 2.625 / 2.75;
  return 7.5625 * t2 * t2 + 0.984375;
}
export function easeInBounce(t: number): number {
  return 1 - easeOutBounce(1 - t);
}
export function easeInOutBounce(t: number): number {
  return t < 0.5 ? 0.5 * easeInBounce(t * 2) : 0.5 * easeOutBounce(t * 2 - 1) + 0.5;
}

// ─── Spring ─────────────────────────────────────────────────
export function springIn(t: number): number {
  return t * t * ((1.70158 + 1) * t - 1.70158);
}
export function springOut(t: number): number {
  const t1 = t - 1;
  return t1 * t1 * ((1.70158 + 1) * t1 + 1.70158) + 1;
}
export function springInOut(t: number): number {
  if (t < 0.5) {
    const t2 = 2 * t;
    return 0.5 * t2 * t2 * ((S2 + 1) * t2 - S2);
  }
  const t2 = 2 * t - 2;
  return 0.5 * (t2 * t2 * ((S2 + 1) * t2 + S2) + 2);
}

// ─── Type ───────────────────────────────────────────────────
export type EasingFn = (t: number) => number;
