import { describe, expect, test } from 'bun:test';
import type { EmitterShape } from '../src/emitter-shape.js';
import { createShapeSample, hasRadialNormal, sampleEmitterShape } from '../src/emitter-shape.js';
import { ParticleEmitter } from '../src/particle-emitter.js';

/** Park-Miller, same generator the emitter uses — so tests are reproducible. */
function lcg(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const hypot = (x: number, y: number): number => Math.sqrt(x * x + y * y);

describe('sampleEmitterShape — distribution bounds', () => {
  test('point always lands on the origin with no normal', () => {
    const rand = lcg();
    const out = createShapeSample();
    for (let i = 0; i < 50; i++) {
      sampleEmitterShape({ kind: 'point' }, rand, out);
      expect(out.x).toBe(0);
      expect(out.y).toBe(0);
      expect(out.nx).toBe(0);
      expect(out.ny).toBe(0);
    }
  });

  test('circle stays inside its radius and reports a unit normal', () => {
    const rand = lcg();
    const out = createShapeSample();
    for (let i = 0; i < 500; i++) {
      sampleEmitterShape({ kind: 'circle', radius: 10 }, rand, out);
      expect(hypot(out.x, out.y)).toBeLessThanOrEqual(10 + 1e-9);
      expect(hypot(out.nx, out.ny)).toBeCloseTo(1, 10);
    }
  });

  test('circle is uniform by area, not clustered at the centre', () => {
    // The sqrt in the radial term is the whole point. Without it, half the
    // points fall inside half the radius; with it, about a quarter do.
    const rand = lcg();
    const out = createShapeSample();
    let inner = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      sampleEmitterShape({ kind: 'circle', radius: 10 }, rand, out);
      if (hypot(out.x, out.y) <= 5) inner++;
    }
    const fraction = inner / n;
    // Area ratio is 0.25; band is wide enough to be robust, tight enough that
    // dropping the sqrt (which gives ~0.5) fails.
    expect(fraction).toBeGreaterThan(0.2);
    expect(fraction).toBeLessThan(0.3);
  });

  test('ring stays within its band', () => {
    const rand = lcg();
    const out = createShapeSample();
    for (let i = 0; i < 500; i++) {
      sampleEmitterShape({ kind: 'ring', radius: 20, thickness: 4 }, rand, out);
      const r = hypot(out.x, out.y);
      expect(r).toBeGreaterThanOrEqual(18 - 1e-9);
      expect(r).toBeLessThanOrEqual(22 + 1e-9);
    }
  });

  test('a ring with no thickness sits exactly on the radius', () => {
    const rand = lcg();
    const out = createShapeSample();
    for (let i = 0; i < 100; i++) {
      sampleEmitterShape({ kind: 'ring', radius: 7 }, rand, out);
      expect(hypot(out.x, out.y)).toBeCloseTo(7, 10);
    }
  });

  test('rect stays within half-extents and spans both signs', () => {
    const rand = lcg();
    const out = createShapeSample();
    let sawNegX = false;
    let sawPosX = false;
    for (let i = 0; i < 500; i++) {
      sampleEmitterShape({ kind: 'rect', width: 30, height: 10 }, rand, out);
      expect(Math.abs(out.x)).toBeLessThanOrEqual(15 + 1e-9);
      expect(Math.abs(out.y)).toBeLessThanOrEqual(5 + 1e-9);
      if (out.x < 0) sawNegX = true;
      if (out.x > 0) sawPosX = true;
    }
    // Centred on the emitter, not anchored at a corner.
    expect(sawNegX && sawPosX).toBe(true);
  });

  test('cone stays inside its wedge, oriented by direction', () => {
    const rand = lcg();
    const out = createShapeSample();
    const direction = Math.PI / 2; // straight down in screen space
    const half = Math.PI / 12; // 15°
    for (let i = 0; i < 500; i++) {
      sampleEmitterShape({ kind: 'cone', radius: 12, angle: half }, rand, out, direction);
      expect(hypot(out.x, out.y)).toBeLessThanOrEqual(12 + 1e-9);
      if (hypot(out.x, out.y) < 1e-9) continue;
      // Angular distance from the cone axis must not exceed the half-angle.
      let delta = Math.atan2(out.y, out.x) - direction;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      expect(Math.abs(delta)).toBeLessThanOrEqual(half + 1e-9);
    }
  });

  test('degenerate sizes collapse to the origin rather than producing NaN', () => {
    const rand = lcg();
    const out = createShapeSample();
    const shapes: EmitterShape[] = [
      { kind: 'circle', radius: 0 },
      { kind: 'ring', radius: 0 },
      { kind: 'rect', width: 0, height: 0 },
      { kind: 'cone', radius: 0, angle: 0 },
      // Negative extents are clamped, not propagated.
      { kind: 'circle', radius: -5 },
      { kind: 'rect', width: -5, height: -5 },
    ];
    for (const shape of shapes) {
      sampleEmitterShape(shape, rand, out, 0);
      expect(Number.isFinite(out.x)).toBe(true);
      expect(Number.isFinite(out.y)).toBe(true);
      expect(hypot(out.x, out.y)).toBeCloseTo(0, 10);
    }
  });
});

describe('sampleEmitterShape — determinism and allocation', () => {
  test('the same seed replays the same offsets', () => {
    const shape: EmitterShape = { kind: 'circle', radius: 9 };
    const take = (): number[] => {
      const rand = lcg(12345);
      const out = createShapeSample();
      const acc: number[] = [];
      for (let i = 0; i < 20; i++) {
        sampleEmitterShape(shape, rand, out);
        acc.push(out.x, out.y);
      }
      return acc;
    };
    expect(take()).toEqual(take());
  });

  test('different seeds diverge', () => {
    const read = (seed: number): number[] => {
      const rand = lcg(seed);
      const out = createShapeSample();
      const acc: number[] = [];
      for (let i = 0; i < 10; i++) {
        sampleEmitterShape({ kind: 'ring', radius: 5 }, rand, out);
        acc.push(out.x);
      }
      return acc;
    };
    expect(read(1)).not.toEqual(read(2));
  });

  test('each shape draws a fixed number of values, so ordering is stable', () => {
    // Determinism across a mixed emitter depends on this: if a shape's draw
    // count varied with its own output, the velocity draws that follow would
    // shift and a seed would stop replaying.
    const counts = new Map<string, number>();
    const out = createShapeSample();
    const shapes: EmitterShape[] = [
      { kind: 'point' },
      { kind: 'circle', radius: 1 },
      { kind: 'ring', radius: 1 },
      { kind: 'rect', width: 1, height: 1 },
      { kind: 'cone', radius: 1, angle: 1 },
    ];
    for (const shape of shapes) {
      let draws = 0;
      const counting = (): number => {
        draws++;
        return 0.5;
      };
      sampleEmitterShape(shape, counting, out, 0);
      counts.set(shape.kind, draws);
    }
    expect(counts.get('point')).toBe(0);
    expect(counts.get('circle')).toBe(2);
    expect(counts.get('ring')).toBe(2);
    expect(counts.get('rect')).toBe(2);
    expect(counts.get('cone')).toBe(2);
  });

  test('sampling writes into the caller buffer and allocates nothing', () => {
    const rand = lcg();
    const out = createShapeSample();
    const before = out;
    for (let i = 0; i < 100; i++) {
      const returned = sampleEmitterShape({ kind: 'circle', radius: 3 }, rand, out);
      // Same object every time — no per-sample allocation.
      expect(returned).toBe(before);
    }
  });
});

describe('hasRadialNormal', () => {
  test('true only for radial shapes that opted in', () => {
    expect(hasRadialNormal({ kind: 'circle', radius: 1, radial: true })).toBe(true);
    expect(hasRadialNormal({ kind: 'ring', radius: 1, radial: true })).toBe(true);
    expect(hasRadialNormal({ kind: 'cone', radius: 1, angle: 1, radial: true })).toBe(true);
    expect(hasRadialNormal({ kind: 'circle', radius: 1 })).toBe(false);
    expect(hasRadialNormal({ kind: 'ring', radius: 1 })).toBe(false);
    expect(hasRadialNormal({ kind: 'point' })).toBe(false);
    // rect has no outward direction to offer, even in principle.
    expect(hasRadialNormal({ kind: 'rect', width: 1, height: 1 })).toBe(false);
  });
});

describe('ParticleEmitter — shape integration', () => {
  const baseConfig = {
    rate: 0,
    lifetime: 1,
    speed: 100,
    direction: 0,
    spread: 0,
  };

  test('no shape reproduces the pre-shape point behaviour exactly', () => {
    // Backward compatibility is asserted, not assumed: `point` draws zero
    // random values, so an emitter without a shape must produce the identical
    // sequence to one before shapes existed.
    const withoutShape = new ParticleEmitter({ ...baseConfig }, { seed: 7 });
    const withPoint = new ParticleEmitter({ ...baseConfig, shape: { kind: 'point' } }, { seed: 7 });
    withoutShape.x = 50;
    withoutShape.y = 60;
    withPoint.x = 50;
    withPoint.y = 60;
    withoutShape.burst(5);
    withPoint.burst(5);

    const read = (e: ParticleEmitter): number[] =>
      e.pool.particles.flatMap((p) => [p.x, p.y, p.vx, p.vy]);
    expect(read(withPoint)).toEqual(read(withoutShape));
  });

  test('a shape offsets spawn position from the emitter', () => {
    const emitter = new ParticleEmitter(
      { ...baseConfig, shape: { kind: 'ring', radius: 25 } },
      { seed: 3 },
    );
    emitter.x = 100;
    emitter.y = 200;
    emitter.burst(30);

    expect(emitter.pool.activeCount).toBe(30);
    for (const p of emitter.pool.particles) {
      // On the ring, measured from the emitter — not from the world origin.
      expect(hypot(p.x - 100, p.y - 200)).toBeCloseTo(25, 6);
    }
  });

  test('radial: true sends particles outward; without it they follow direction', () => {
    const radial = new ParticleEmitter(
      { ...baseConfig, shape: { kind: 'ring', radius: 10, radial: true } },
      { seed: 5 },
    );
    radial.burst(40);
    for (const p of radial.pool.particles) {
      const offset = Math.atan2(p.y, p.x);
      const velocity = Math.atan2(p.vy, p.vx);
      let delta = velocity - offset;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      // spread is 0, so velocity is exactly the outward normal.
      expect(Math.abs(delta)).toBeLessThan(1e-6);
    }

    const directional = new ParticleEmitter(
      { ...baseConfig, shape: { kind: 'ring', radius: 10 } },
      { seed: 5 },
    );
    directional.burst(40);
    for (const p of directional.pool.particles) {
      // direction 0, spread 0 ⇒ every particle moves along +x.
      expect(p.vx).toBeCloseTo(100, 6);
      expect(p.vy).toBeCloseTo(0, 6);
    }
  });

  test('a shaped emitter still allocates nothing in steady state', () => {
    const emitter = new ParticleEmitter(
      { ...baseConfig, rate: 120, lifetime: 0.5, shape: { kind: 'circle', radius: 8 } },
      { seed: 11, maxParticles: 128 },
    );
    // Warm up so the pool has handed out its objects.
    for (let i = 0; i < 60; i++) emitter.update(1 / 60);
    const created = emitter.pool.created;
    for (let i = 0; i < 120; i++) emitter.update(1 / 60);
    expect(emitter.pool.created).toBe(created);
  });

  test('a shaped emitter replays identically for the same seed', () => {
    const run = (): number[] => {
      const e = new ParticleEmitter(
        { ...baseConfig, shape: { kind: 'cone', radius: 15, angle: 0.4 } },
        { seed: 99 },
      );
      e.burst(12);
      return e.pool.particles.flatMap((p) => [p.x, p.y, p.vx, p.vy]);
    };
    expect(run()).toEqual(run());
  });
});
