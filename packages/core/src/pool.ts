/**
 * Generic object pool for zero-alloc gameplay.
 *
 * - acquire() returns a recycled or newly created object
 * - release(obj) returns it to the pool
 * - prewarm(count) pre-allocates objects
 */
export class Pool<T> {
  private items: T[] = [];
  private factory: () => T;
  private resetFn: ((item: T) => void) | undefined;

  /**
   * @param factory Function to create a new instance.
   * @param reset Optional function to reset an object before reuse.
   */
  constructor(factory: () => T, reset?: (item: T) => void) {
    this.factory = factory;
    this.resetFn = reset;
  }

  /** Get an object from the pool (or create a new one). */
  acquire(): T {
    if (this.items.length > 0) {
      return this.items.pop()!;
    }
    return this.factory();
  }

  /** Return an object to the pool. Calls reset if configured. */
  release(item: T): void {
    if (this.resetFn) this.resetFn(item);
    this.items.push(item);
  }

  /** Pre-allocate objects into the pool. */
  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      this.items.push(this.factory());
    }
  }

  /** Number of available objects in the pool. */
  get available(): number {
    return this.items.length;
  }

  /** Clear all pooled objects. */
  clear(): void {
    this.items.length = 0;
  }
}
