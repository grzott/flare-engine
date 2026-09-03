import { describe, expect, it } from 'bun:test';
import { drawParticles, ParticleEmitter } from '@flare-engine/particles';
import { SpriteBatch } from '@flare-engine/render';

/**
 * OSS-M8b — `drawParticles` types its batch structurally so
 * `@flare-engine/particles` needs no dependency on `@flare-engine/render`. That
 * only pays off if a *real* `SpriteBatch` actually satisfies the shape, which
 * structural typing makes plausible but does not prove.
 *
 * This lives in `@flare-engine/engine` because it is the package that depends on
 * both, and it is a runtime test rather than a type-only probe on purpose: the
 * repo already contains `packages/render-web/tests/postfx-assignability.ts`,
 * which is referenced by no package script, turbo task, CI workflow or
 * verify.sh, and therefore never runs. A `bun test` file needs no wiring.
 */

const FRAME = { name: 'spark', x: 16, y: 8, w: 4, h: 4 };
const IMAGE = { atlas: true };

function burstingEmitter(): ParticleEmitter {
  const emitter = new ParticleEmitter(
    {
      rate: 0,
      lifetime: 1,
      speed: 60,
      direction: 0,
      spread: Math.PI,
      startSize: 6,
      endSize: 6,
      startAlpha: 1,
      endAlpha: 1,
    },
    { seed: 2, maxParticles: 64 },
  );
  emitter.x = 100;
  emitter.y = 100;
  return emitter;
}

describe('drawParticles against a real SpriteBatch', () => {
  it('a real SpriteBatch satisfies ParticleBatchLike and receives one command per particle', () => {
    const emitter = burstingEmitter();
    emitter.burst(12);
    const batch = new SpriteBatch();

    drawParticles(emitter.pool, batch, IMAGE, FRAME);

    expect(emitter.pool.activeCount).toBe(12);
    expect(batch.count).toBe(12);
  });

  it('queues nothing for an emitter with no live particles', () => {
    const batch = new SpriteBatch();
    drawParticles(burstingEmitter().pool, batch, IMAGE, FRAME);
    expect(batch.count).toBe(0);
  });

  it('shares one batch with the rest of the scene rather than owning it', () => {
    // The drawInto idiom: particles append to a caller-owned batch, so they
    // flush together with everything else instead of forcing a second pass.
    const emitter = burstingEmitter();
    emitter.burst(5);
    const batch = new SpriteBatch();

    batch.drawRaw(IMAGE, 0, 0, 8, 8, 0, 0, 8, 8);
    drawParticles(emitter.pool, batch, IMAGE, FRAME);

    expect(batch.count).toBe(6);
  });

  it('neither the pool nor the batch allocates across steady-state frames', () => {
    const emitter = new ParticleEmitter(
      { rate: 120, lifetime: 0.5, speed: 40, direction: 0, spread: 1 },
      { seed: 8, maxParticles: 128 },
    );
    const batch = new SpriteBatch();

    // Warm both pools: particles and the batch's own command pool.
    for (let i = 0; i < 60; i++) {
      emitter.update(1 / 60);
      drawParticles(emitter.pool, batch, IMAGE, FRAME);
      batch.clear();
    }

    const poolCreated = emitter.pool.created;
    const batchAllocs = batch.allocCount;
    for (let i = 0; i < 120; i++) {
      emitter.update(1 / 60);
      drawParticles(emitter.pool, batch, IMAGE, FRAME);
      batch.clear();
    }

    expect(emitter.pool.created).toBe(poolCreated);
    expect(batch.allocCount).toBe(batchAllocs);
  });

  it('an emitter shape composes with the adapter end to end', () => {
    const emitter = new ParticleEmitter(
      {
        rate: 0,
        lifetime: 1,
        speed: 80,
        direction: 0,
        spread: 0,
        startSize: 3,
        endSize: 3,
        shape: { kind: 'ring', radius: 20, radial: true },
      },
      { seed: 1, maxParticles: 32 },
    );
    emitter.x = 50;
    emitter.y = 50;
    emitter.burst(16);

    const batch = new SpriteBatch();
    drawParticles(emitter.pool, batch, IMAGE, FRAME);

    expect(batch.count).toBe(16);
    for (const p of emitter.pool.particles) {
      expect(Math.hypot(p.x - 50, p.y - 50)).toBeCloseTo(20, 6);
    }
  });
});
