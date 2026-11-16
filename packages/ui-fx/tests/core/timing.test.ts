import { describe, expect, test } from 'bun:test';
import {
  easeInOutBounce,
  easeInOutSine,
  easeInQuad,
  easeOutBack,
  easeOutElastic,
} from '@flare-engine/math';
// ui-fx does not depend on @flare-engine/animation, so the reference comes from its source.
import { spring, updateSpring } from '../../../animation/src/spring';
import {
  compileTiming,
  type EasingName,
  resolveSpring,
  type SpringSpec,
  springSettleTime,
  springStepAt,
  timingAt,
  timingToCssLinear,
} from '../../src/core/timing';

const PENNER_NAMES: EasingName[] = [
  'linear',
  'easeInQuad',
  'easeOutQuad',
  'easeInOutQuad',
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',
  'easeInQuart',
  'easeOutQuart',
  'easeInOutQuart',
  'easeInQuint',
  'easeOutQuint',
  'easeInOutQuint',
  'easeInSine',
  'easeOutSine',
  'easeInOutSine',
  'easeInExpo',
  'easeOutExpo',
  'easeInOutExpo',
  'easeInCirc',
  'easeOutCirc',
  'easeInOutCirc',
  'easeInBack',
  'easeOutBack',
  'easeInOutBack',
  'easeInElastic',
  'easeOutElastic',
  'easeInOutElastic',
  'easeInBounce',
  'easeOutBounce',
  'easeInOutBounce',
];

describe('resolveSpring', () => {
  test('resolveSpring duration+bounce', () => {
    expect(resolveSpring({ duration: 0.5 })).toEqual({ omega0: (2 * Math.PI) / 0.5, zeta: 1 });
    expect(resolveSpring({ duration: 0.5, bounce: 0.3 }).zeta).toBeCloseTo(0.7, 12);
    expect(resolveSpring({ duration: 0.5, bounce: -0.5 }).zeta).toBeCloseTo(2, 12);
    expect(resolveSpring({ stiffness: 100, damping: 10, mass: 1 })).toEqual({
      omega0: 10,
      zeta: 0.5,
    });
  });

  test('resolveSpring rejects', () => {
    for (const bad of [
      { duration: 0 },
      { duration: 0.5, bounce: 1 },
      { duration: 0.5, bounce: -1 },
      { duration: Number.NaN },
    ])
      expect(() => resolveSpring(bad)).toThrow(RangeError);
  });

  test('mass defaults to 1 and scales the physical form', () => {
    expect(resolveSpring({ stiffness: 100, damping: 10 })).toEqual({ omega0: 10, zeta: 0.5 });
    const heavy = resolveSpring({ stiffness: 100, damping: 10, mass: 4 });
    expect(heavy.omega0).toBeCloseTo(5, 12);
    expect(heavy.zeta).toBeCloseTo(0.25, 12);
  });

  test('rejects a physical spring that never settles or is not finite', () => {
    const bad: SpringSpec[] = [
      { stiffness: 0, damping: 10 },
      { stiffness: -1, damping: 10 },
      { stiffness: 100, damping: 0 },
      { stiffness: 100, damping: -1 },
      { stiffness: 100, damping: 10, mass: 0 },
      { stiffness: Number.POSITIVE_INFINITY, damping: 10 },
      { stiffness: 100, damping: Number.NaN },
      { duration: -1 },
      { duration: Number.POSITIVE_INFINITY },
      { duration: 0.5, bounce: Number.NaN },
    ];
    for (const spec of bad) expect(() => resolveSpring(spec)).toThrow(RangeError);
  });
});

describe('springStepAt', () => {
  test('springStepAt matches @flare-engine/animation stepping', () => {
    // ω0 = 5 keeps every case clear of the reference's rest snap (|x| and |v| under 1e-3)
    // for the whole second, which would otherwise jump the reference value to its target.
    const w0 = 5;
    const dt = 0.001;
    for (const zeta of [0.3, 1, 2]) {
      const reference = spring(0, 1, { stiffness: w0 * w0, damping: 2 * zeta * w0, mass: 1 });
      let compared = 0;
      for (let k = 1; k <= 1000; k++) {
        const value = updateSpring(reference, dt);
        if (k % 50 !== 0) continue;
        expect(Math.abs(springStepAt(w0, zeta, k * dt) - value)).toBeLessThan(1e-6);
        compared++;
      }
      expect(compared).toBe(20);
      expect(reference.atRest).toBe(false);
    }
  });

  test('matches the stepped reference from a duration + bounce spec too', () => {
    for (const bounce of [0.4, 0, -0.3]) {
      const { omega0, zeta } = resolveSpring({ duration: 2, bounce });
      const reference = spring(0, 1, {
        stiffness: omega0 * omega0,
        damping: 2 * zeta * omega0,
        mass: 1,
      });
      for (let k = 1; k <= 1000; k++) {
        const value = updateSpring(reference, 0.001);
        if (reference.atRest) break;
        if (k % 50 === 0) {
          expect(Math.abs(springStepAt(omega0, zeta, k * 0.001) - value)).toBeLessThan(1e-6);
        }
      }
    }
  });

  test('starts at 0 and tends to 1', () => {
    for (const zeta of [0.3, 1, 2]) {
      expect(springStepAt(10, zeta, 0)).toBe(0);
      expect(springStepAt(10, zeta, -1)).toBe(0);
      expect(springStepAt(10, zeta, 60)).toBeCloseTo(1, 9);
    }
  });

  test('an underdamped spring overshoots, a critical or overdamped one does not', () => {
    let underPeak = 0;
    let criticalPeak = 0;
    let overPeak = 0;
    for (let k = 0; k <= 2000; k++) {
      const t = k * 0.001;
      underPeak = Math.max(underPeak, springStepAt(10, 0.3, t));
      criticalPeak = Math.max(criticalPeak, springStepAt(10, 1, t));
      overPeak = Math.max(overPeak, springStepAt(10, 2, t));
    }
    expect(underPeak).toBeGreaterThan(1.1);
    expect(criticalPeak).toBeLessThanOrEqual(1);
    expect(overPeak).toBeLessThanOrEqual(1);
  });

  test('is continuous across the critical band', () => {
    for (const t of [0.05, 0.2, 0.7]) {
      const critical = springStepAt(10, 1, t);
      expect(springStepAt(10, 1 - 1e-5, t)).toBeCloseTo(critical, 4);
      expect(springStepAt(10, 1 + 1e-5, t)).toBeCloseTo(critical, 4);
      expect(springStepAt(10, 1 + 5e-7, t)).toBe(critical);
    }
  });
});

describe('springSettleTime', () => {
  test('underdamped: the envelope reaches epsilon', () => {
    const s = { omega0: 10, zeta: 0.5 };
    expect(springSettleTime(s)).toBeCloseTo(-Math.log(1e-3) / 5, 12);
    expect(springSettleTime(s, 1e-2)).toBeCloseTo(-Math.log(1e-2) / 5, 12);
  });

  test('critical and overdamped: within epsilon at the settle time, not one scan step earlier', () => {
    for (const zeta of [1, 2, 5]) {
      const settle = springSettleTime({ omega0: 10, zeta });
      expect(settle).toBeGreaterThan(0);
      expect(Math.abs(1 - springStepAt(10, zeta, settle))).toBeLessThan(1e-3);
      // The scan runs on a 1/240 s grid.
      expect(settle * 240).toBeCloseTo(Math.round(settle * 240), 6);
      const before = settle - 1 / 240;
      const h = 1e-6;
      const velocity =
        (springStepAt(10, zeta, before + h) - springStepAt(10, zeta, before - h)) / (2 * h);
      expect(Math.abs(1 - springStepAt(10, zeta, before)) >= 1e-3 || velocity >= 1e-3).toBe(true);
    }
  });

  test('more damping above critical settles later; a looser epsilon settles sooner', () => {
    expect(springSettleTime({ omega0: 10, zeta: 3 })).toBeGreaterThan(
      springSettleTime({ omega0: 10, zeta: 1 }),
    );
    expect(springSettleTime({ omega0: 10, zeta: 2 }, 1e-2)).toBeLessThan(
      springSettleTime({ omega0: 10, zeta: 2 }, 1e-4),
    );
  });

  test('rejects an epsilon outside (0, 1)', () => {
    for (const epsilon of [0, 1, -1, Number.NaN])
      expect(() => springSettleTime({ omega0: 10, zeta: 1 }, epsilon)).toThrow(RangeError);
  });
});

describe('compileTiming and timingAt', () => {
  test('cubicBezier ease at x=0.5', () => {
    const tbl = compileTiming({ duration: 1, easing: { cubicBezier: [0.25, 0.1, 0.25, 1] } }, 1);
    expect(timingAt(tbl.samples, 0, 1, 0.5)).toBeCloseTo(0.8024, 3);
  });

  test('delay and end clamp', () => {
    const tbl = compileTiming({ duration: 0.3, easing: 'easeOutCubic', delay: 0.1 }, 0.3);
    expect(timingAt(tbl.samples, tbl.delay, tbl.duration, 0.05)).toBe(0);
    expect(timingAt(tbl.samples, tbl.delay, tbl.duration, 9)).toBe(1);
  });

  test('spring + duration is rejected', () => {
    expect(() => compileTiming({ duration: 1, spring: { duration: 0.4 } }, 1)).toThrow(RangeError);
  });

  test('spring + easing is rejected', () => {
    expect(() => compileTiming({ easing: 'easeInQuad', spring: { duration: 0.4 } }, 1)).toThrow(
      RangeError,
    );
  });

  test('defaults: the default duration, no delay, linear easing, 120 samples per second', () => {
    const tbl = compileTiming({}, 0.5);
    expect(tbl.delay).toBe(0);
    expect(tbl.duration).toBe(0.5);
    expect(tbl.samples).toBeInstanceOf(Float32Array);
    expect(tbl.samples.length).toBe(61);
    expect(tbl.samples[0]).toBe(0);
    expect(tbl.samples[60]).toBe(1);
    expect(timingAt(tbl.samples, 0, 0.5, 0.125)).toBeCloseTo(0.25, 6);
  });

  test('samplesPerSecond sets the table density', () => {
    expect(compileTiming({ duration: 1 }, 1, 10).samples.length).toBe(11);
    expect(compileTiming({ duration: 0.004 }, 1).samples.length).toBe(2);
  });

  test('every Penner name compiles to a curve from 0 to 1', () => {
    expect(PENNER_NAMES.length).toBe(31);
    for (const name of PENNER_NAMES) {
      const tbl = compileTiming({ duration: 1, easing: name }, 1);
      expect(tbl.samples[0]).toBeCloseTo(0, 6);
      expect(tbl.samples[tbl.samples.length - 1]).toBeCloseTo(1, 6);
    }
  });

  test('a named easing is the @flare-engine/math curve of that name', () => {
    const references = [
      ['easeInQuad', easeInQuad],
      ['easeInOutSine', easeInOutSine],
      ['easeOutBack', easeOutBack],
      ['easeOutElastic', easeOutElastic],
      ['easeInOutBounce', easeInOutBounce],
    ] as const;
    for (const [name, reference] of references) {
      const tbl = compileTiming({ duration: 1, easing: name }, 1);
      for (const x of [0, 0.25, 0.5, 0.75, 1]) {
        expect(timingAt(tbl.samples, 0, 1, x)).toBeCloseTo(reference(x), 5);
      }
    }
  });

  test('the misnamed spring easings and unknown names are rejected', () => {
    for (const name of ['springIn', 'springOut', 'springInOut', 'step', 'nope', 'toString']) {
      expect(() => compileTiming({ easing: name as EasingName }, 1)).toThrow(RangeError);
    }
  });

  test('timingAt interpolates linearly between samples', () => {
    const samples = new Float32Array([0, 0.5, 0.25, 1]);
    expect(timingAt(samples, 0, 3, 0)).toBe(0);
    expect(timingAt(samples, 0, 3, 0.5)).toBe(0.25);
    expect(timingAt(samples, 0, 3, 1.5)).toBe(0.375);
    expect(timingAt(samples, 0, 3, 3)).toBe(1);
    expect(timingAt(samples, 1, 3, 2.5)).toBe(0.375);
  });

  test('a zero duration jumps to the end once the delay has passed', () => {
    const tbl = compileTiming({ duration: 0, delay: 0.2 }, 1);
    expect(tbl.duration).toBe(0);
    expect(timingAt(tbl.samples, tbl.delay, tbl.duration, 0.1)).toBe(0);
    expect(timingAt(tbl.samples, tbl.delay, tbl.duration, 0.2)).toBe(1);
  });

  test('cubicBezier: linear control points, endpoints and a steep curve', () => {
    const linear = compileTiming({ duration: 1, easing: { cubicBezier: [0, 0, 1, 1] } }, 1);
    for (const x of [0, 0.1, 0.5, 0.9, 1]) {
      expect(timingAt(linear.samples, 0, 1, x)).toBeCloseTo(x, 5);
    }
    // x'(u) vanishes at u = 0.5 here, which is where Newton has to hand over to bisection.
    const steep = compileTiming({ duration: 1, easing: { cubicBezier: [1, 0, 0, 1] } }, 1);
    expect(steep.samples[0]).toBe(0);
    expect(steep.samples[steep.samples.length - 1]).toBe(1);
    expect(timingAt(steep.samples, 0, 1, 0.5)).toBeCloseTo(0.5, 3);
    for (let i = 1; i < steep.samples.length; i++) {
      expect(steep.samples[i]!).toBeGreaterThanOrEqual(steep.samples[i - 1]!);
    }
  });

  test('cubicBezier: y may leave 0..1, x may not', () => {
    const overshoot = compileTiming(
      { duration: 1, easing: { cubicBezier: [0.34, 1.56, 0.64, 1] } },
      1,
    );
    expect(Math.max(...overshoot.samples)).toBeGreaterThan(1);
    for (const curve of [
      [-0.1, 0, 1, 1],
      [0, 0, 1.1, 1],
      [0, Number.NaN, 1, 1],
    ] as const) {
      expect(() => compileTiming({ easing: { cubicBezier: curve } }, 1)).toThrow(RangeError);
    }
  });

  test('a spring table lasts its settle time and ends exactly on 1', () => {
    const spec = { duration: 0.4, bounce: 0.3 };
    const tbl = compileTiming({ spring: spec, delay: 0.05 }, 9);
    const resolved = resolveSpring(spec);
    expect(tbl.delay).toBe(0.05);
    expect(tbl.duration).toBe(springSettleTime(resolved));
    expect(tbl.samples[0]).toBe(0);
    expect(tbl.samples[tbl.samples.length - 1]).toBe(1);
    expect(Math.max(...tbl.samples)).toBeGreaterThan(1);
    for (const t of [0.05, 0.1, 0.2, 0.33]) {
      expect(timingAt(tbl.samples, tbl.delay, tbl.duration, tbl.delay + t)).toBeCloseTo(
        springStepAt(resolved.omega0, resolved.zeta, t),
        2,
      );
    }
  });

  test('rejects a negative or non-finite duration, delay or sample rate', () => {
    expect(() => compileTiming({ duration: -1 }, 1)).toThrow(RangeError);
    expect(() => compileTiming({}, Number.NaN)).toThrow(RangeError);
    expect(() => compileTiming({ delay: -0.1 }, 1)).toThrow(RangeError);
    expect(() => compileTiming({ delay: Number.POSITIVE_INFINITY }, 1)).toThrow(RangeError);
    expect(() => compileTiming({}, 1, 0)).toThrow(RangeError);
  });
});

describe('timingToCssLinear', () => {
  test('timingToCssLinear', () => {
    expect(timingToCssLinear(compileTiming({ duration: 0.2 }, 0.2))).toMatch(
      /^linear\(0(, [\d.]+)+, 1\)$/,
    );
  });

  test('emits every sample when the table fits', () => {
    const css = timingToCssLinear(compileTiming({ duration: 0.1 }, 0.1, 40));
    expect(css).toBe('linear(0, 0.25, 0.5, 0.75, 1)');
  });

  test('maxPoints caps the stop count by resampling evenly', () => {
    const tbl = compileTiming({ duration: 2, easing: 'easeInQuad' }, 2);
    expect(tbl.samples.length).toBe(241);
    expect(timingToCssLinear(tbl).split(', ').length).toBe(64);
    expect(timingToCssLinear(tbl, 5)).toBe('linear(0, 0.0625, 0.25, 0.5625, 1)');
    expect(timingToCssLinear(tbl, 2)).toBe('linear(0, 1)');
  });

  test('keeps overshoot, which linear() allows', () => {
    const css = timingToCssLinear(compileTiming({ spring: { duration: 0.4, bounce: 0.4 } }, 1));
    const stops = css.slice('linear('.length, -1).split(', ').map(Number);
    expect(stops[0]).toBe(0);
    expect(stops[stops.length - 1]).toBe(1);
    expect(Math.max(...stops)).toBeGreaterThan(1);
    expect(css).not.toMatch(/\de/);
  });

  test('rejects fewer than two points', () => {
    expect(() => timingToCssLinear(compileTiming({}, 1), 1)).toThrow(RangeError);
  });
});
