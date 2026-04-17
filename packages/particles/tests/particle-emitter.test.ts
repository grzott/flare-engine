import { describe, expect, it } from 'bun:test';
import { Color } from '@flare/math';
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
      5,
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
      3,
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

    // With full spread, we should have particles going in different directions
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
