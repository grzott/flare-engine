import type { Unsubscribe } from './emitter.js';

/** Lightweight single-event emitter. Less overhead than EventEmitter. */
export class Signal<T = void> {
  private handlers = new Set<(value: T) => void>();
  private iterating = false;
  private pendingRemove: Array<(value: T) => void> = [];

  /** Subscribe to the signal. Returns unsubscribe function. */
  add(handler: (value: T) => void): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.remove(handler);
    };
  }

  /** Subscribe once. Returns unsubscribe function. */
  once(handler: (value: T) => void): Unsubscribe {
    const wrapper = (value: T) => {
      unsub();
      handler(value);
    };
    const unsub = this.add(wrapper);
    return unsub;
  }

  /** Unsubscribe a specific handler. */
  remove(handler: (value: T) => void): void {
    if (this.iterating) {
      this.pendingRemove.push(handler);
    } else {
      this.handlers.delete(handler);
    }
  }

  /** Emit a value to all subscribers. Zero-alloc on the hot path. */
  emit(...args: T extends void ? [] : [value: T]): void {
    const value = args[0] as T;
    this.iterating = true;
    for (const handler of this.handlers) {
      handler(value);
    }
    this.iterating = false;
    // Flush pending removes (rare path — only when handler removed itself during emit)
    if (this.pendingRemove.length > 0) {
      for (let i = 0; i < this.pendingRemove.length; i++) {
        this.handlers.delete(this.pendingRemove[i]!);
      }
      this.pendingRemove.length = 0;
    }
  }

  /** Remove all handlers. */
  clear(): void {
    this.handlers.clear();
    this.pendingRemove.length = 0;
    this.iterating = false;
  }
}
