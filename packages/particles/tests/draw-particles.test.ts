import { describe, expect, test } from 'bun:test';
import type { ParticleBatchLike, ParticleFrameLike } from '../src/draw-particles.js';
import { drawParticles } from '../src/draw-particles.js';
import { ParticleEmitter } from '../src/particle-emitter.js';
import { ParticlePool } from '../src/particle-pool.js';

/** Records every drawRaw call so tests can assert on what was queued. */
interface RecordedDraw {
  image: unknown;
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
  dstX: number;
  dstY: number;
  dstW: number;
  dstH: number;
  effect: unknown;
  anchorX: number | undefined;
  anchorY: number | undefined;
  alpha: number | undefined;
  rotation: number | undefined;
}

function fakeBatch(): ParticleBatchLike & { readonly calls: RecordedDraw[] } {
  const calls: RecordedDraw[] = [];
  return {
    calls,
    drawRaw(
      image,
      srcX,
      srcY,
      srcW,
      srcH,
      dstX,
      dstY,
      dstW,
      dstH,
      effect,
      anchorX,
      anchorY,
      alpha,
      rotation,
    ) {
      calls.push({
        image,
        srcX,
        srcY,
        srcW,
        srcH,
        dstX,
        dstY,
        dstW,
        dstH,
        effect,
        anchorX,
        anchorY,
        alpha,
        rotation,
      });
    },
  };
}

const FRAME: ParticleFrameLike = { x: 32, y: 64, w: 8, h: 8 };
const IMAGE = { id: 'atlas' };

/** A pool with `count` live particles, each at a known position. */
function seededPool(count: number): ParticlePool {
  const pool = new ParticlePool(64);
  for (let i = 0; i < count; i++) {
    const p = pool.acquire();
    p.x = i * 10;
    p.y = i * 5;
    p.life = 1;
    p.maxLife = 1;
    p.startSize = 4;
    p.endSize = 4;
    p.startAlpha = 1;
    p.endAlpha = 1;
    p.rotation = i * 0.1;
  }
  return pool;
}

describe('drawParticles', () => {
  test('queues one draw per live particle', () => {
    const batch = fakeBatch();
    drawParticles(seededPool(5), batch, IMAGE, FRAME);
    expect(batch.calls.length).toBe(5);
  });

  test('an empty pool queues nothing', () => {
    const batch = fakeBatch();
    drawParticles(new ParticlePool(8), batch, IMAGE, FRAME);
    expect(batch.calls.length).toBe(0);
  });

  test('forwards the frame rect as the source and the particle as the destination', () => {
    const batch = fakeBatch();
    drawParticles(seededPool(3), batch, IMAGE, FRAME);

    const first = batch.calls[0]!;
    expect(first.image).toBe(IMAGE);
    expect([first.srcX, first.srcY, first.srcW, first.srcH]).toEqual([32, 64, 8, 8]);
    expect([first.dstX, first.dstY]).toEqual([0, 0]);
    // startSize === endSize === 4, so the interpolated size is 4 square.
    expect([first.dstW, first.dstH]).toEqual([4, 4]);

    const third = batch.calls[2]!;
    expect([third.dstX, third.dstY]).toEqual([20, 10]);
  });

  test('passes interpolated alpha and the particle rotation', () => {
    const pool = new ParticlePool(8);
    const p = pool.acquire();
    p.x = 0;
    p.y = 0;
    p.maxLife = 1;
    p.life = 0.5; // halfway through life
    p.startSize = 10;
    p.endSize = 10;
    p.startAlpha = 1;
    p.endAlpha = 0;
    p.rotation = 1.25;

    const batch = fakeBatch();
    drawParticles(pool, batch, IMAGE, FRAME);

    expect(batch.calls.length).toBe(1);
    expect(batch.calls[0]!.alpha).toBeCloseTo(0.5, 6);
    expect(batch.calls[0]!.rotation).toBe(1.25);
  });

  test('centres on the particle by default, and honours an explicit anchor', () => {
    const batch = fakeBatch();
    drawParticles(seededPool(1), batch, IMAGE, FRAME);
    expect(batch.calls[0]!.anchorX).toBe(0.5);
    expect(batch.calls[0]!.anchorY).toBe(0.5);

    const topLeft = fakeBatch();
    drawParticles(seededPool(1), topLeft, IMAGE, FRAME, { anchorX: 0, anchorY: 0 });
    expect(topLeft.calls[0]!.anchorX).toBe(0);
    expect(topLeft.calls[0]!.anchorY).toBe(0);
  });

  test('applies the same effect reference to every particle', () => {
    // Constant per call by design — a batch retains the reference until flush,
    // so a per-particle mutable effect would give every particle the last one's
    // values.
    const effect = { type: 'tint' };
    const batch = fakeBatch();
    drawParticles(seededPool(4), batch, IMAGE, FRAME, { effect });
    expect(batch.calls.length).toBe(4);
    for (const call of batch.calls) expect(call.effect).toBe(effect);
  });

  test('skips particles that would draw nothing', () => {
    const pool = new ParticlePool(8);
    const visible = pool.acquire();
    visible.maxLife = 1;
    visible.life = 1;
    visible.startSize = 4;
    visible.endSize = 4;
    visible.startAlpha = 1;
    visible.endAlpha = 1;

    const shrunk = pool.acquire();
    shrunk.maxLife = 1;
    shrunk.life = 1;
    shrunk.startSize = 0;
    shrunk.endSize = 0;
    shrunk.startAlpha = 1;
    shrunk.endAlpha = 1;

    const faded = pool.acquire();
    faded.maxLife = 1;
    faded.life = 1;
    faded.startSize = 4;
    faded.endSize = 4;
    faded.startAlpha = 0;
    faded.endAlpha = 0;

    const batch = fakeBatch();
    drawParticles(pool, batch, IMAGE, FRAME);
    // Only the visible one costs a draw call.
    expect(batch.calls.length).toBe(1);
    expect(batch.calls[0]!.dstW).toBe(4);
  });

  test('drawing allocates nothing per particle in steady state', () => {
    const emitter = new ParticleEmitter(
      { rate: 120, lifetime: 0.5, speed: 50, direction: 0, spread: 1 },
      { seed: 4, maxParticles: 128 },
    );
    const batch = fakeBatch();
    for (let i = 0; i < 60; i++) emitter.update(1 / 60);

    const created = emitter.pool.created;
    for (let i = 0; i < 120; i++) {
      emitter.update(1 / 60);
      drawParticles(emitter.pool, batch, IMAGE, FRAME);
    }
    expect(emitter.pool.created).toBe(created);
    expect(batch.calls.length).toBeGreaterThan(0);
  });

  test('draw order follows the pool active order', () => {
    const pool = seededPool(4);
    const batch = fakeBatch();
    drawParticles(pool, batch, IMAGE, FRAME);
    const queued = batch.calls.map((c) => c.dstX);
    const expected = pool.particles.map((p) => p.x);
    expect(queued).toEqual(expected);
  });
});
