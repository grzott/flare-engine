import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
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

describe('Pool.tryAcquire (capacity cap)', () => {
  it('returns non-null below cap', () => {
    const pool = new Pool(() => ({}), undefined, { capacity: 3 });
    pool.prewarm(3);
    expect(pool.tryAcquire()).not.toBeNull();
    expect(pool.tryAcquire()).not.toBeNull();
    expect(pool.tryAcquire()).not.toBeNull();
  });

  it('returns null at cap — no factory call', () => {
    let created = 0;
    const pool = new Pool(
      () => {
        created++;
        return {};
      },
      undefined,
      { capacity: 2 },
    );
    pool.prewarm(2);
    const a = pool.tryAcquire();
    const b = pool.tryAcquire();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(pool.tryAcquire()).toBeNull(); // at cap
    expect(created).toBe(2); // no new objects created past prewarm
  });

  it('returns non-null again after a release frees a slot', () => {
    const pool = new Pool(() => ({}), undefined, { capacity: 1 });
    pool.prewarm(1);
    const obj = pool.tryAcquire();
    expect(obj).not.toBeNull();
    expect(pool.tryAcquire()).toBeNull(); // at cap
    pool.release(obj!);
    expect(pool.tryAcquire()).not.toBeNull(); // slot freed
  });

  it('acquire() is always uncapped regardless of capacity', () => {
    const pool = new Pool(() => ({}), undefined, { capacity: 2 });
    pool.prewarm(2);
    pool.tryAcquire();
    pool.tryAcquire();
    // tryAcquire would return null here — but acquire() ignores cap
    const extra = pool.acquire();
    expect(extra).not.toBeNull();
  });

  it('live getter reflects currently out-of-pool count', () => {
    const pool = new Pool(() => ({}), undefined, { capacity: 5 });
    pool.prewarm(5);
    expect(pool.live).toBe(0);
    const a = pool.tryAcquire();
    const b = pool.tryAcquire();
    expect(pool.live).toBe(2);
    pool.release(a!);
    expect(pool.live).toBe(1);
    pool.release(b!);
    expect(pool.live).toBe(0);
  });

  it('no capacity = tryAcquire behaves like acquire (unbounded)', () => {
    let created = 0;
    const pool = new Pool(() => {
      created++;
      return {};
    });
    for (let i = 0; i < 20; i++) {
      expect(pool.tryAcquire()).not.toBeNull();
    }
    expect(created).toBe(20);
  });
});

describe('Pool double-release guard (__DEV__)', () => {
  const g = globalThis as Record<string, unknown>;
  let originalDev: unknown;

  beforeEach(() => {
    originalDev = g.__DEV__;
    g.__DEV__ = true;
  });

  afterEach(() => {
    g.__DEV__ = originalDev;
  });

  it('throws on double-release in dev mode', () => {
    const pool = new Pool(() => ({ v: 0 }));
    const obj = pool.acquire();
    pool.release(obj);
    expect(() => pool.release(obj)).toThrow('[Pool] double-release detected');
  });

  it('does not throw on a fresh release after re-acquire', () => {
    const pool = new Pool(() => ({ v: 0 }));
    const obj = pool.acquire();
    pool.release(obj);
    pool.acquire(); // re-acquires obj
    expect(() => pool.release(obj)).not.toThrow();
  });
});
