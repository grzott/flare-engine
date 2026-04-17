import { describe, expect, it } from 'bun:test';
import { ParticlePool } from '../src/particle-pool.js';

describe('ParticlePool', () => {
  it('starts with zero active particles', () => {
    const pool = new ParticlePool(64);
    expect(pool.activeCount).toBe(0);
    expect(pool.particles.length).toBe(0);
  });

  it('acquires a particle and makes it active', () => {
    const pool = new ParticlePool(64);
    const p = pool.acquire();
    expect(p.active).toBe(true);
    expect(pool.activeCount).toBe(1);
  });

  it('sets initial particle state on acquire', () => {
    const pool = new ParticlePool(64);
    const p = pool.acquire();
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
    expect(p.vx).toBe(0);
    expect(p.vy).toBe(0);
  });

  it('updates active particles with gravity and position', () => {
    const pool = new ParticlePool(64);
    const p = pool.acquire();
    p.life = 2;
    p.maxLife = 2;
    p.vx = 100;
    p.vy = 0;

    pool.update(0.1, 0, 100); // gravity Y = 100
    expect(p.x).toBeCloseTo(10, 5); // 100 * 0.1
    expect(p.vy).toBeCloseTo(10, 5); // 100 * 0.1 gravity
    expect(p.y).toBeCloseTo(1, 5); // 10 * 0.1
  });

  it('removes dead particles on update', () => {
    const pool = new ParticlePool(64);
    const p = pool.acquire();
    p.life = 0.05;
    p.maxLife = 1;

    pool.update(0.1, 0, 0);
    expect(pool.activeCount).toBe(0);
    expect(p.active).toBe(false);
  });

  it('getSize interpolates between start and end', () => {
    const pool = new ParticlePool(8);
    const p = pool.acquire();
    p.life = 0.5;
    p.maxLife = 1;
    p.startSize = 10;
    p.endSize = 0;

    // t = 1 - 0.5/1 = 0.5
    expect(pool.getSize(p)).toBeCloseTo(5, 5);
  });

  it('getAlpha interpolates between start and end', () => {
    const pool = new ParticlePool(8);
    const p = pool.acquire();
    p.life = 0.25;
    p.maxLife = 1;
    p.startAlpha = 1;
    p.endAlpha = 0;

    // t = 1 - 0.25/1 = 0.75
    expect(pool.getAlpha(p)).toBeCloseTo(0.25, 5);
  });

  it('getColor interpolates between start and end', () => {
    const pool = new ParticlePool(8);
    const p = pool.acquire();
    p.life = 0.5;
    p.maxLife = 1;
    p.startR = 1;
    p.startG = 0;
    p.startB = 0;
    p.endR = 0;
    p.endG = 1;
    p.endB = 0;
    p.startAlpha = 1;
    p.endAlpha = 0;

    const c = pool.getColor(p);
    expect(c.r).toBeCloseTo(0.5, 5);
    expect(c.g).toBeCloseTo(0.5, 5);
    expect(c.b).toBe(0);
    expect(c.a).toBeCloseTo(0.5, 5);
  });

  it('getColor reuses its shared buffer across calls (zero-alloc)', () => {
    const pool = new ParticlePool(8);
    const p1 = pool.acquire();
    p1.life = 1;
    p1.maxLife = 1;
    const p2 = pool.acquire();
    p2.life = 1;
    p2.maxLife = 1;
    const c1 = pool.getColor(p1);
    const c2 = pool.getColor(p2);
    expect(c1).toBe(c2);
  });

  it('getColorInto writes into the caller-supplied out param', () => {
    const pool = new ParticlePool(8);
    const p = pool.acquire();
    p.life = 1;
    p.maxLife = 1;
    p.startR = 0.25;
    p.startG = 0.5;
    p.startB = 0.75;
    p.startAlpha = 1;
    p.endR = 0.25;
    p.endG = 0.5;
    p.endB = 0.75;
    p.endAlpha = 1;
    const out = { r: 0, g: 0, b: 0, a: 0 };
    const ret = pool.getColorInto(p, out);
    expect(ret).toBe(out);
    expect(out.r).toBeCloseTo(0.25, 5);
    expect(out.g).toBeCloseTo(0.5, 5);
    expect(out.b).toBeCloseTo(0.75, 5);
    expect(out.a).toBe(1);
  });

  it('clears all active particles', () => {
    const pool = new ParticlePool(64);
    for (let i = 0; i < 10; i++) {
      const p = pool.acquire();
      p.life = 10;
      p.maxLife = 10;
    }
    expect(pool.activeCount).toBe(10);
    pool.clear();
    expect(pool.activeCount).toBe(0);
  });

  it('recycles particles after release', () => {
    const pool = new ParticlePool(2);
    const p1 = pool.acquire();
    p1.life = 0.01;
    p1.maxLife = 1;
    pool.update(0.1, 0, 0); // kills p1

    const p2 = pool.acquire();
    // Should reuse the same object
    expect(p2).toBe(p1);
    expect(p2.active).toBe(true);
  });

  it('applies rotation over time', () => {
    const pool = new ParticlePool(8);
    const p = pool.acquire();
    p.life = 2;
    p.maxLife = 2;
    p.angularVelocity = Math.PI;

    pool.update(1, 0, 0);
    expect(p.rotation).toBeCloseTo(Math.PI, 5);
  });
});
