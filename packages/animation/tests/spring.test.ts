import { describe, expect, it } from 'bun:test';
import type { Spring, SpringConfig } from '../src/spring.js';
import { resetSpring, setSpringTarget, spring, updateSpring } from '../src/spring.js';

describe('Spring', () => {
  it('creates a spring with defaults', () => {
    const s = spring(0, 100);
    expect(s.value).toBe(0);
    expect(s.target).toBe(100);
    expect(s.velocity).toBe(0);
    expect(s.atRest).toBe(false);
    expect(s.config.stiffness).toBe(100);
    expect(s.config.damping).toBe(10);
    expect(s.config.mass).toBe(1);
  });

  it('is at rest when value equals target', () => {
    const s = spring(50, 50);
    expect(s.atRest).toBe(true);
  });

  it('moves toward target over time', () => {
    const s = spring(0, 100);
    for (let i = 0; i < 100; i++) {
      updateSpring(s, 1 / 60);
    }
    expect(s.value).toBeCloseTo(100, 0);
  });

  it('settles at target (atRest becomes true)', () => {
    const s = spring(0, 100, { stiffness: 200, damping: 30 });
    for (let i = 0; i < 600; i++) {
      updateSpring(s, 1 / 60);
    }
    expect(s.atRest).toBe(true);
    expect(s.value).toBe(100);
  });

  it('does not move when at rest', () => {
    const s = spring(50, 50);
    const before = s.value;
    updateSpring(s, 1 / 60);
    expect(s.value).toBe(before);
  });

  it('oscillates with low damping', () => {
    const s = spring(0, 100, { stiffness: 200, damping: 2 });
    // Simulate a bit
    let maxValue = 0;
    for (let i = 0; i < 60; i++) {
      updateSpring(s, 1 / 60);
      if (s.value > maxValue) maxValue = s.value;
    }
    // With low damping, should overshoot past 100
    expect(maxValue).toBeGreaterThan(100);
  });

  it('setSpringTarget wakes a resting spring', () => {
    const s = spring(50, 50);
    expect(s.atRest).toBe(true);
    setSpringTarget(s, 100);
    expect(s.atRest).toBe(false);
    expect(s.target).toBe(100);
  });

  it('resetSpring zeroes velocity and sets both value and target', () => {
    const s = spring(0, 100);
    for (let i = 0; i < 10; i++) updateSpring(s, 1 / 60);
    resetSpring(s, 42);
    expect(s.value).toBe(42);
    expect(s.target).toBe(42);
    expect(s.velocity).toBe(0);
    expect(s.atRest).toBe(true);
  });

  it('handles custom config', () => {
    const s = spring(0, 100, { stiffness: 300, damping: 20, mass: 2 });
    expect(s.config.stiffness).toBe(300);
    expect(s.config.damping).toBe(20);
    expect(s.config.mass).toBe(2);
  });

  it('converges from both directions', () => {
    const s = spring(200, 100, { stiffness: 200, damping: 30 });
    for (let i = 0; i < 600; i++) {
      updateSpring(s, 1 / 60);
    }
    expect(s.value).toBeCloseTo(100, 0);
    expect(s.atRest).toBe(true);
  });
});

describe('updateSpring — any dt (#135)', () => {
  const CONFIGS: [string, Partial<SpringConfig>][] = [
    ['defaults', {}],
    ['underdamped', { stiffness: 200, damping: 2 }],
    ['critical', { stiffness: 100, damping: 20, mass: 1 }],
    ['overdamped', { damping: 100 }],
    ['stiff', { stiffness: 10000, damping: 10 }],
    ['heavy', { stiffness: 300, damping: 20, mass: 2 }],
  ];
  const DTS = [1 / 60, 0.25, 1, 10];
  const STARTS: [number, number][] = [
    [1, 0],
    [0.5, 3],
  ];
  const HUGE_DT_CONFIGS = CONFIGS.filter(([name]) => name !== 'underdamped' && name !== 'heavy');

  function energy(s: Spring): number {
    const x = s.value - s.target;
    return 0.5 * s.config.stiffness * x * x + 0.5 * s.config.mass * s.velocity * s.velocity;
  }

  function expectWithin(actual: number, expected: number, tol: number): void {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(expected)));
  }

  it('stays bounded and settles when stepped by clamped 0.25 s hitch frames', () => {
    const s = spring(1, 0);
    for (let i = 0; i < 40; i++) {
      updateSpring(s, 0.25);
      expect(Math.abs(s.value - s.target)).toBeLessThanOrEqual(1);
    }
    expect(s.value).toBe(0);
    expect(s.atRest).toBe(true);
  });

  for (const [name, cfg] of CONFIGS) {
    for (const dt of DTS) {
      it(`never gains energy: ${name} at dt=${dt}`, () => {
        for (const [x0, v0] of STARTS) {
          const s = spring(x0, 0, cfg);
          s.velocity = v0;
          const e0 = energy(s);
          let prev = e0;
          for (let i = 0; i < 100000 && !s.atRest; i++) {
            updateSpring(s, dt);
            const e = energy(s);
            expect(e).toBeLessThanOrEqual(prev + 1e-12 * e0);
            prev = e;
          }
          expect(s.atRest).toBe(true);
        }
      });
    }
  }

  for (const [name, cfg] of CONFIGS.slice(0, 4)) {
    it(`15 steps of 1/60 s equal one step of 0.25 s: ${name}`, () => {
      const fine = spring(100, 0, cfg);
      const coarse = spring(100, 0, cfg);
      for (let i = 0; i < 15; i++) updateSpring(fine, 1 / 60);
      updateSpring(coarse, 0.25);
      expect(coarse.atRest).toBe(false);
      expect(Math.abs(fine.value - coarse.value)).toBeLessThanOrEqual(
        1e-9 * Math.abs(coarse.value),
      );
      expect(Math.abs(fine.velocity - coarse.velocity)).toBeLessThanOrEqual(
        1e-9 * Math.abs(coarse.velocity),
      );
    });
  }

  it('is continuous across the critical-damping boundary', () => {
    const k = 100;
    const m = 1;
    const after = (zeta: number): Spring => {
      const s = spring(1, 0, { stiffness: k, damping: 2 * Math.sqrt(k * m) * zeta, mass: m });
      updateSpring(s, 0.1);
      expect(Number.isFinite(s.value)).toBe(true);
      expect(Number.isFinite(s.velocity)).toBe(true);
      return s;
    };
    const crit = after(1);
    for (const zeta of [1 - 1e-7, 1 + 1e-7]) {
      const s = after(zeta);
      expectWithin(s.value, crit.value, 1e-6);
      expectWithin(s.velocity, crit.velocity, 1e-6);
    }
    for (const zeta of [1 - 1e-3, 1 + 1e-3]) {
      const s = after(zeta);
      expectWithin(s.value, crit.value, 1e-3);
      expectWithin(s.velocity, crit.velocity, 1e-3);
    }
  });

  for (const [name, cfg] of HUGE_DT_CONFIGS) {
    it(`a 1000 s step lands exactly at rest: ${name}`, () => {
      const s = spring(1, 0, cfg);
      updateSpring(s, 1e3);
      expect(s.value).toBe(0);
      expect(s.velocity).toBe(0);
      expect(s.atRest).toBe(true);
    });
  }

  it('matches the textbook underdamped solution and its derivative', () => {
    const k = 100;
    const c = 10;
    const m = 1;
    const w0 = Math.sqrt(k / m);
    const zeta = c / (2 * Math.sqrt(k * m));
    const sigma = zeta * w0;
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const xOf = (t: number): number =>
      Math.exp(-sigma * t) * (Math.cos(wd * t) + (sigma / wd) * Math.sin(wd * t));
    const s = spring(1, 0, { stiffness: k, damping: c, mass: m });
    updateSpring(s, 0.1);
    expect(Math.abs(s.value - xOf(0.1))).toBeLessThanOrEqual(1e-12);
    const h = 1e-5;
    const central = (xOf(0.1 + h) - xOf(0.1 - h)) / (2 * h);
    expect(Math.abs(s.velocity - central)).toBeLessThanOrEqual(1e-6);
  });

  it('decays velocity exponentially with zero stiffness (pure damping)', () => {
    const s = spring(1, 5, { stiffness: 0, damping: 2 });
    s.velocity = 4;
    updateSpring(s, 0.5);
    const gamma = 2;
    const e = Math.exp(-gamma * 0.5);
    const x0 = 1 - 5;
    expect(Math.abs(s.value - (5 + x0 + (4 * (1 - e)) / gamma))).toBeLessThanOrEqual(1e-12);
    expect(Math.abs(s.velocity - 4 * e)).toBeLessThanOrEqual(1e-12);
  });
});

describe('spring() config validation (#275)', () => {
  const invalid: [string, Partial<SpringConfig>, string][] = [
    ['mass 0', { mass: 0 }, 'mass'],
    ['negative mass', { mass: -1 }, 'mass'],
    ['negative stiffness', { stiffness: -5 }, 'stiffness'],
    ['negative damping', { damping: -0.5 }, 'damping'],
    ['NaN stiffness', { stiffness: Number.NaN }, 'stiffness'],
    ['Infinity damping', { damping: Number.POSITIVE_INFINITY }, 'damping'],
    ['-Infinity mass', { mass: Number.NEGATIVE_INFINITY }, 'mass'],
    ['NaN mass', { mass: Number.NaN }, 'mass'],
  ];

  for (const [label, config, field] of invalid) {
    it(`throws a RangeError naming the field for ${label}`, () => {
      let caught: unknown;
      try {
        spring(0, 1, config);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(RangeError);
      expect((caught as RangeError).message).toContain(field);
    });
  }

  it('still constructs at the valid edges: stiffness 0 and damping 0', () => {
    const free = spring(0, 1, { stiffness: 0 });
    expect(free.config.stiffness).toBe(0);
    const undamped = spring(0, 1, { damping: 0 });
    expect(undamped.config.damping).toBe(0);
    updateSpring(undamped, 1 / 60);
    expect(Number.isFinite(undamped.value)).toBe(true);
  });

  it('still constructs with the defaults and with partial configs', () => {
    expect(() => spring(0, 1)).not.toThrow();
    expect(() => spring(0, 1, { stiffness: 300 })).not.toThrow();
    expect(() => spring(0, 1, { mass: 0.25, damping: 2 })).not.toThrow();
  });
});
