import { describe, expect, it } from 'bun:test';
import { Color } from '@flare-engine/math';
import { ParticleEmitter } from '../src/particle-emitter.js';

describe('ParticleEmitter', () => {
  it('creates an emitter with config', () => {
    const emitter = new ParticleEmitter({
      rate: 100,
      lifetime: 1,
      speed: 50,
      direction: 0,
      spread: Math.PI,
    });
    expect(emitter.config.rate).toBe(100);
    expect(emitter.emitting).toBe(true);
    expect(emitter.pool.activeCount).toBe(0);
  });

  it('emits particles over time based on rate', () => {
    const emitter = new ParticleEmitter({
      rate: 10,
      lifetime: 2,
      speed: 50,
      direction: 0,
      spread: 0,
    });
    emitter.update(1); // 10 particles/sec * 1 sec = 10 particles
    expect(emitter.pool.activeCount).toBe(10);
  });

  it('positions particles at emitter origin', () => {
    const emitter = new ParticleEmitter({
      rate: 1,
      lifetime: 2,
      speed: 0,
      direction: 0,
      spread: 0,
    });
    emitter.x = 100;
    emitter.y = 200;
    emitter.update(1);
    const p = emitter.pool.particles[0]!;
    expect(p.x).toBe(100);
    expect(p.y).toBe(200);
  });

  it('respects direction and speed', () => {
    const emitter = new ParticleEmitter({
      rate: 1,
      lifetime: 2,
      speed: 100,
      direction: 0, // right
      spread: 0,
    });
    emitter.update(1); // emit 1 particle
    const p = emitter.pool.particles[0]!;
    expect(p.vx).toBeCloseTo(100, 1);
    expect(p.vy).toBeCloseTo(0, 1);
  });

  it('applies gravity to particles', () => {
    const emitter = new ParticleEmitter({
      rate: 1,
      lifetime: 2,
      speed: 0,
      direction: 0,
      spread: 0,
      gravityY: 100,
    });
    emitter.update(1); // emit + update
    const p = emitter.pool.particles[0]!;
    // After 1 frame with gravity, vy should be positive
    expect(p.vy).toBeGreaterThan(0);
  });

  it('respects maxParticles limit', () => {
    const emitter = new ParticleEmitter(
      {
        rate: 1000,
        lifetime: 10,
        speed: 0,
        direction: 0,
        spread: 0,
        maxParticles: 5,
      },
      { maxParticles: 5 },
    );
    emitter.update(1); // Would emit 1000 but capped at 5
    expect(emitter.pool.activeCount).toBe(5);
  });

  it('does not emit when emitting is false', () => {
    const emitter = new ParticleEmitter({
      rate: 100,
      lifetime: 1,
      speed: 50,
      direction: 0,
      spread: 0,
    });
    emitter.emitting = false;
    emitter.update(1);
    expect(emitter.pool.activeCount).toBe(0);
  });

  it('burst emits a specified number of particles', () => {
    const emitter = new ParticleEmitter({
      rate: 0,
      lifetime: 1,
      speed: 50,
      direction: 0,
      spread: 0,
    });
    emitter.burst(20);
    expect(emitter.pool.activeCount).toBe(20);
  });

  it('burst respects maxParticles', () => {
    const emitter = new ParticleEmitter(
      {
        rate: 0,
        lifetime: 10,
        speed: 0,
        direction: 0,
        spread: 0,
        maxParticles: 3,
      },
      { maxParticles: 3 },
    );
    emitter.burst(10);
    expect(emitter.pool.activeCount).toBe(3);
  });

  it('applies start/end colors', () => {
    const emitter = new ParticleEmitter({
      rate: 1,
      lifetime: 2,
      speed: 0,
      direction: 0,
      spread: 0,
      startColor: Color.create(1, 0, 0, 1),
      endColor: Color.create(0, 1, 0, 1),
    });
    emitter.update(1);
    const p = emitter.pool.particles[0]!;
    expect(p.startR).toBe(1);
    expect(p.startG).toBe(0);
    expect(p.endR).toBe(0);
    expect(p.endG).toBe(1);
  });

  it('applies startSize and endSize', () => {
    const emitter = new ParticleEmitter({
      rate: 1,
      lifetime: 2,
      speed: 0,
      direction: 0,
      spread: 0,
      startSize: 10,
      endSize: 2,
    });
    emitter.update(1);
    const p = emitter.pool.particles[0]!;
    expect(p.startSize).toBe(10);
    expect(p.endSize).toBe(2);
  });

  it('reset clears particles and stops emission', () => {
    const emitter = new ParticleEmitter({
      rate: 100,
      lifetime: 10,
      speed: 50,
      direction: 0,
      spread: 0,
    });
    emitter.update(1);
    expect(emitter.pool.activeCount).toBeGreaterThan(0);
    emitter.reset();
    expect(emitter.pool.activeCount).toBe(0);
    expect(emitter.emitting).toBe(false);
  });

  it('removes particles when lifetime expires', () => {
    const emitter = new ParticleEmitter({
      rate: 10,
      lifetime: 0.5,
      speed: 0,
      direction: 0,
      spread: 0,
    });
    emitter.update(0.1); // Emit some particles
    const count = emitter.pool.activeCount;
    expect(count).toBeGreaterThan(0);

    emitter.emitting = false;
    emitter.update(1.0); // All should expire
    expect(emitter.pool.activeCount).toBe(0);
  });

  it('emits with spread cone', () => {
    const emitter = new ParticleEmitter({
      rate: 100,
      lifetime: 2,
      speed: 100,
      direction: 0,
      spread: Math.PI, // Full circle
    });
    emitter.update(1); // Emit 100 particles

    let hasPositiveVx = false;
    let hasNegativeVx = false;
    for (const p of emitter.pool.particles) {
      if (p.vx > 10) hasPositiveVx = true;
      if (p.vx < -10) hasNegativeVx = true;
    }
    expect(hasPositiveVx).toBe(true);
    expect(hasNegativeVx).toBe(true);
  });
});

describe('ParticleEmitter cap enforcement', () => {
  it('burst never exceeds cap — no allocation past cap', () => {
    const cap = 5;
    const emitter = new ParticleEmitter(
      { rate: 0, lifetime: 10, speed: 0, direction: 0, spread: 0 },
      { maxParticles: cap },
    );
    emitter.burst(100);
    expect(emitter.pool.activeCount).toBe(cap);
    // A second burst after cap is full adds zero particles
    emitter.burst(100);
    expect(emitter.pool.activeCount).toBe(cap);
  });

  it('update loop never exceeds cap', () => {
    const cap = 7;
    const emitter = new ParticleEmitter(
      { rate: 10000, lifetime: 10, speed: 0, direction: 0, spread: 0 },
      { maxParticles: cap },
    );
    emitter.update(1);
    expect(emitter.pool.activeCount).toBe(cap);
    emitter.update(1);
    expect(emitter.pool.activeCount).toBe(cap);
  });

  it('cap from config.maxParticles when no opts provided', () => {
    const emitter = new ParticleEmitter({
      rate: 0,
      lifetime: 10,
      speed: 0,
      direction: 0,
      spread: 0,
      maxParticles: 4,
    });
    emitter.burst(100);
    expect(emitter.pool.activeCount).toBe(4);
  });
});

describe('ParticleEmitter seed / reseed', () => {
  it('same seed produces identical burst velocity sequence', () => {
    const config = {
      rate: 0,
      lifetime: 10,
      speed: 100,
      direction: 0,
      spread: Math.PI,
    };
    const a = new ParticleEmitter(config, { seed: 42, maxParticles: 20 });
    const b = new ParticleEmitter(config, { seed: 42, maxParticles: 20 });
    a.burst(20);
    b.burst(20);
    const ap = a.pool.particles;
    const bp = b.pool.particles;
    expect(ap.length).toBe(bp.length);
    for (let i = 0; i < ap.length; i++) {
      expect(ap[i]!.vx).toBe(bp[i]!.vx);
      expect(ap[i]!.vy).toBe(bp[i]!.vy);
    }
  });

  it('different seeds produce different sequences', () => {
    const config = {
      rate: 0,
      lifetime: 10,
      speed: 100,
      direction: 0,
      spread: Math.PI,
    };
    const a = new ParticleEmitter(config, { seed: 1, maxParticles: 10 });
    const b = new ParticleEmitter(config, { seed: 99999, maxParticles: 10 });
    a.burst(10);
    b.burst(10);
    // At least one particle should differ
    let differs = false;
    for (let i = 0; i < 10; i++) {
      if (a.pool.particles[i]!.vx !== b.pool.particles[i]!.vx) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });

  it('reseed restarts the sequence identically to a fresh emitter', () => {
    const config = {
      rate: 0,
      lifetime: 10,
      speed: 100,
      direction: 0,
      spread: Math.PI,
    };
    const fresh = new ParticleEmitter(config, { seed: 7, maxParticles: 10 });
    fresh.burst(10);
    const freshVx = fresh.pool.particles.map((p) => p.vx);

    // Emit with a different seed first, then reseed and re-burst
    const reseeded = new ParticleEmitter(config, { seed: 999, maxParticles: 10 });
    reseeded.burst(10);
    reseeded.reset();
    reseeded.emitting = true;
    reseeded.reseed(7);
    reseeded.burst(10);
    const reseededVx = reseeded.pool.particles.map((p) => p.vx);

    expect(reseededVx).toEqual(freshVx);
  });

  it('seed 0 is normalized — RNG is non-degenerate (not a dead fixed point)', () => {
    const config = {
      rate: 0,
      lifetime: 10,
      speed: 50,
      speedMax: 150,
      direction: 0,
      spread: Math.PI,
    };
    const emitter = new ParticleEmitter(config, { seed: 0, maxParticles: 20 });
    emitter.burst(10);
    const particles = emitter.pool.particles;
    const vxValues = new Set(particles.map((p) => p.vx));
    expect(vxValues.size).toBeGreaterThan(1);
    for (const p of particles) {
      expect(Number.isFinite(p.vx)).toBe(true);
      expect(Number.isFinite(p.vy)).toBe(true);
    }
    // reseed(0) also normalizes
    emitter.pool.clear();
    emitter.emitting = true;
    emitter.reseed(0);
    emitter.burst(10);
    const vxAfterReseed = new Set(emitter.pool.particles.map((p) => p.vx));
    expect(vxAfterReseed.size).toBeGreaterThan(1);
  });

  it('negative seeds are normalized — RNG is non-degenerate', () => {
    const config = {
      rate: 0,
      lifetime: 10,
      speed: 50,
      speedMax: 150,
      direction: 0,
      spread: Math.PI,
    };
    const emitter = new ParticleEmitter(config, { seed: -42, maxParticles: 20 });
    emitter.burst(10);
    const vxValues = new Set(emitter.pool.particles.map((p) => p.vx));
    expect(vxValues.size).toBeGreaterThan(1);
    for (const p of emitter.pool.particles) {
      expect(Number.isFinite(p.vx)).toBe(true);
    }
  });

  it('seed 2147483647 (modulus — dead point) is normalized', () => {
    const config = {
      rate: 0,
      lifetime: 10,
      speed: 50,
      speedMax: 150,
      direction: 0,
      spread: Math.PI,
    };
    const emitter = new ParticleEmitter(config, { seed: 2147483647, maxParticles: 20 });
    emitter.burst(10);
    const vxValues = new Set(emitter.pool.particles.map((p) => p.vx));
    expect(vxValues.size).toBeGreaterThan(1);
  });
});
