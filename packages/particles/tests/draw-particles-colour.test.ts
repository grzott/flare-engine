import { describe, expect, test } from 'bun:test';
import type { ParticleBatchLike, ParticleFrameLike } from '../src/draw-particles.js';
import { drawParticles } from '../src/draw-particles.js';
import { ParticleEmitter } from '../src/particle-emitter.js';
import type { Particle } from '../src/particle-pool.js';
import { ParticlePool } from '../src/particle-pool.js';

interface RecordedDraw {
  argCount: number;
  effect: unknown;
  alpha: number | undefined;
  stretch: boolean | undefined;
  blend: string | undefined;
  flipX: boolean | undefined;
  flipY: boolean | undefined;
  color: number | undefined;
}

/** A batch double that takes the full `SpriteBatch.drawRaw` parameter list. */
function fakeBatch(): ParticleBatchLike & { readonly calls: RecordedDraw[] } {
  const calls: RecordedDraw[] = [];
  return {
    calls,
    drawRaw(...args) {
      calls.push({
        argCount: args.length,
        effect: args[9],
        alpha: args[12],
        stretch: args[14],
        blend: args[15],
        flipX: args[16],
        flipY: args[17],
        color: args[18],
      });
    },
  };
}

const FRAME: ParticleFrameLike = { x: 0, y: 0, w: 8, h: 8 };
const IMAGE = { id: 'atlas' };

/** One live particle halfway through its life, visible and opaque unless overridden. */
function midLifeParticle(pool: ParticlePool, overrides: Partial<Particle> = {}): Particle {
  const p = pool.acquire();
  p.maxLife = 1;
  p.life = 0.5;
  p.startSize = 4;
  p.endSize = 4;
  p.startAlpha = 1;
  p.endAlpha = 1;
  Object.assign(p, overrides);
  return p;
}

describe('drawParticles per-particle colour', () => {
  test('passes the interpolated colour as an opaque packed ARGB', () => {
    const pool = new ParticlePool(8);
    midLifeParticle(pool, { startR: 1, startG: 0.5, startB: 0, endR: 0, endG: 0.5, endB: 1 });

    const batch = fakeBatch();
    drawParticles(pool, batch, IMAGE, FRAME);

    // Halfway from (1, 0.5, 0) to (0, 0.5, 1) is (0.5, 0.5, 0.5); 127.5 rounds to 0x80.
    expect(batch.calls[0]?.color).toBe(0xff808080);
  });

  test('a particle left at the default colour is opaque white', () => {
    const pool = new ParticlePool(8);
    midLifeParticle(pool);

    const batch = fakeBatch();
    drawParticles(pool, batch, IMAGE, FRAME);

    expect(batch.calls[0]?.color).toBe(0xffffffff);
  });

  test('alpha stays the alpha argument; the colour carries none of it', () => {
    const pool = new ParticlePool(8);
    midLifeParticle(pool, { startAlpha: 1, endAlpha: 0, startR: 1, startG: 0, startB: 0, endR: 1 });
    // endG / endB default to 1, so the colour is mid-fade too.

    const batch = fakeBatch();
    drawParticles(pool, batch, IMAGE, FRAME);

    expect(batch.calls[0]?.alpha).toBeCloseTo(0.5, 6);
    expect(batch.calls[0]?.color).toBe(0xffff8080);
  });

  test('leaves stretch, blend and flip at the batch defaults', () => {
    const pool = new ParticlePool(8);
    midLifeParticle(pool);

    const batch = fakeBatch();
    drawParticles(pool, batch, IMAGE, FRAME);

    const call = batch.calls[0];
    expect(call?.argCount).toBe(19);
    expect(call?.stretch).toBeUndefined();
    expect(call?.blend).toBeUndefined();
    expect(call?.flipX).toBeUndefined();
    expect(call?.flipY).toBeUndefined();
  });

  test('clamps channels outside [0, 1] instead of spilling into a neighbour', () => {
    const pool = new ParticlePool(8);
    midLifeParticle(pool, { startR: 3, endR: 3, startG: -2, endG: -2, startB: 0.2, endB: 0.2 });

    const batch = fakeBatch();
    drawParticles(pool, batch, IMAGE, FRAME);

    expect(batch.calls[0]?.color).toBe(0xffff0033);
  });

  test('each particle gets its own colour, and the constant effect still rides along', () => {
    const pool = new ParticlePool(8);
    midLifeParticle(pool, { startR: 1, endR: 1, startG: 0, endG: 0, startB: 0, endB: 0 });
    midLifeParticle(pool, { startR: 0, endR: 0, startG: 1, endG: 1, startB: 0, endB: 0 });
    midLifeParticle(pool, { startR: 0, endR: 0, startG: 0, endG: 0, startB: 1, endB: 1 });
    const effect = { type: 'grayscale' };

    const batch = fakeBatch();
    drawParticles(pool, batch, IMAGE, FRAME, { effect });

    expect(batch.calls.map((c) => c.color)).toEqual([0xffff0000, 0xff00ff00, 0xff0000ff]);
    for (const call of batch.calls) expect(call.effect).toBe(effect);
  });

  test('a coloured, fading emitter draws without creating a particle in steady state', () => {
    const emitter = new ParticleEmitter(
      {
        rate: 120,
        lifetime: 0.5,
        speed: 50,
        direction: 0,
        spread: 1,
        startAlpha: 1,
        endAlpha: 0,
        startColor: { r: 1, g: 0.8, b: 0.2, a: 1 },
        endColor: { r: 0.6, g: 0, b: 0, a: 1 },
      },
      { seed: 4, maxParticles: 128 },
    );
    const batch = fakeBatch();
    for (let i = 0; i < 60; i++) emitter.update(1 / 60);

    const created = emitter.pool.created;
    for (let i = 0; i < 120; i++) {
      emitter.update(1 / 60);
      batch.calls.length = 0;
      drawParticles(emitter.pool, batch, IMAGE, FRAME);
    }
    expect(emitter.pool.created).toBe(created);
    // One live frame holds particles of many ages: many colours, many alphas.
    expect(new Set(batch.calls.map((c) => c.color)).size).toBeGreaterThan(10);
    expect(new Set(batch.calls.map((c) => c.alpha)).size).toBeGreaterThan(10);
  });
});
