import { describe, expect, it } from 'bun:test';
import { Pool } from '../src/pool.js';

describe('Pool.acquire', () => {
  it('creates new object when pool is empty', () => {
    let created = 0;
    const pool = new Pool(() => {
      created++;
      return { id: created };
    });
    const obj = pool.acquire();
    expect(obj.id).toBe(1);
    expect(created).toBe(1);
  });

  it('reuses released objects', () => {
    let created = 0;
    const pool = new Pool(() => {
      created++;
      return { id: created };
    });
    const obj1 = pool.acquire();
    pool.release(obj1);
    const obj2 = pool.acquire();
    expect(obj2).toBe(obj1); // Same reference
    expect(created).toBe(1); // No new creation
  });
});

describe('Pool.release', () => {
  it('calls reset function', () => {
    const pool = new Pool(
      () => ({ x: 0, y: 0 }),
      (obj) => {
        obj.x = 0;
        obj.y = 0;
      },
    );
    const obj = pool.acquire();
    obj.x = 42;
    obj.y = 99;
    pool.release(obj);
    const reused = pool.acquire();
    expect(reused.x).toBe(0);
    expect(reused.y).toBe(0);
  });

  it('works without reset function', () => {
    const pool = new Pool(() => ({ v: 0 }));
    const obj = pool.acquire();
    obj.v = 42;
    pool.release(obj);
    const reused = pool.acquire();
    expect(reused.v).toBe(42); // Not reset
  });
});

describe('Pool.prewarm', () => {
  it('pre-allocates objects', () => {
    let created = 0;
    const pool = new Pool(() => {
      created++;
      return {};
    });
    pool.prewarm(10);
    expect(pool.available).toBe(10);
    expect(created).toBe(10);
  });

  it('prewarmed objects are acquirable', () => {
    let created = 0;
    const pool = new Pool(() => {
      created++;
      return { id: created };
    });
    pool.prewarm(3);
    pool.acquire();
    pool.acquire();
    pool.acquire();
    // All 3 from pool, no additional creation
    const obj = pool.acquire(); // 4th requires new creation
    expect(obj.id).toBe(4);
    expect(created).toBe(4);
  });
});

describe('Pool.available', () => {
  it('tracks pool size', () => {
    const pool = new Pool(() => ({}));
    expect(pool.available).toBe(0);
    pool.prewarm(5);
    expect(pool.available).toBe(5);
    pool.acquire();
    expect(pool.available).toBe(4);
    pool.release({});
    expect(pool.available).toBe(5);
  });
});

describe('Pool.clear', () => {
  it('empties the pool', () => {
    const pool = new Pool(() => ({}));
    pool.prewarm(10);
    expect(pool.available).toBe(10);
    pool.clear();
    expect(pool.available).toBe(0);
  });
});
