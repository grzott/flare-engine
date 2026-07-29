declare const __DEV__: boolean | undefined;

/**
 * Dev-flag access for `release()`, which runs once per released object.
 *
 * JSC has no inline cache for an unresolvable global identifier, so reading the
 * bare `__DEV__` identifier behind a `typeof` guard costs ~270 ns *per
 * evaluation* wherever the global is undeclared. React Native always defines it;
 * web/CanvasKit and any Node or Bun consumer does not. A property miss on
 * `globalThis` is inline-cached at ~0.46 ns and stays togglable at runtime
 * exactly as before. Measured B28 (on JSC — V8 was never measured), PERF-10.
 *
 * Phrased without the literal old expression so `tests/pool-dist.test.ts` can
 * count its occurrences in the built artifact: exactly one must survive, the
 * constructor's.
 *
 * The constructor below deliberately keeps the identifier form: it runs once
 * per pool, where ~270 ns is free, and it is the site a bundler can
 * constant-fold for dead-code elimination.
 */
const G = globalThis as { __DEV__?: boolean };

/** Options for Pool construction. */
export interface PoolOptions {
  /**
   * Maximum number of simultaneously live (acquired) objects.
   * Enforced ONLY by `tryAcquire()` — `acquire()` is uncapped.
   */
  capacity?: number;
}

/**
 * Generic object pool for zero-alloc gameplay.
 *
 * - acquire() returns a recycled or newly created object (uncapped)
 * - tryAcquire() returns null when the live count is at capacity
 * - release(obj) returns it to the pool
 * - prewarm(count) pre-allocates objects
 */
export class Pool<T> {
  private items: T[] = [];
  private factory: () => T;
  private resetFn: ((item: T) => void) | undefined;
  private _capacity: number | undefined;
  private _live = 0;
  private _created = 0;
  private _liveSet: Set<T> | undefined;

  /**
   * @param factory Function to create a new instance.
   * @param reset Optional function to reset an object before reuse.
   * @param options Optional pool configuration (capacity cap).
   */
  constructor(factory: () => T, reset?: (item: T) => void, options?: PoolOptions) {
    this.factory = factory;
    this.resetFn = reset;
    this._capacity = options?.capacity;
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      this._liveSet = new Set();
    }
  }

  /** Get an object from the pool (or create a new one). Never throws; may exceed capacity. */
  acquire(): T {
    this._live++;
    let item: T;
    if (this.items.length > 0) {
      item = this.items.pop()!;
    } else {
      this._created++;
      item = this.factory();
    }
    this._liveSet?.delete(item);
    return item;
  }

  /**
   * Get an object from the pool only if the live count is below capacity.
   * Returns null when at cap — the caller must handle null (no allocation occurs).
   * When no capacity was configured, behaves identically to acquire().
   */
  tryAcquire(): T | null {
    if (this._capacity !== undefined && this._live >= this._capacity) return null;
    this._live++;
    let item: T;
    if (this.items.length > 0) {
      item = this.items.pop()!;
    } else {
      this._created++;
      item = this.factory();
    }
    this._liveSet?.delete(item);
    return item;
  }

  /** Return an object to the pool. Calls reset if configured. */
  release(item: T): void {
    if (G.__DEV__) {
      if (!this._liveSet) this._liveSet = new Set();
      if (this._liveSet.has(item)) throw new Error('[Pool] double-release detected');
      this._liveSet.add(item);
    }
    this._live--;
    if (this.resetFn) this.resetFn(item);
    this.items.push(item);
  }

  /** Pre-allocate objects into the pool. Does not count toward live. */
  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      this.items.push(this.factory());
    }
  }

  /** Number of available objects currently in the pool (not live). */
  get available(): number {
    return this.items.length;
  }

  /** Number of currently live (acquired, not yet released) objects. */
  get live(): number {
    return this._live;
  }

  /** Cumulative number of factory calls made by acquire()/tryAcquire().
   *  prewarm() is deliberately excluded: this counter exists to detect
   *  steady-state allocation, so compare it before and after a frame. */
  get created(): number {
    return this._created;
  }

  /** Clear all pooled objects. Does not affect live count. */
  clear(): void {
    this.items.length = 0;
    this._liveSet?.clear();
  }
}
