import type { Unsubscribe } from './emitter.js';

/**
 * Lightweight single-event emitter. Less overhead than EventEmitter.
 *
 * Emit semantics (shared with EventEmitter):
 * - A handler **added** during an emit runs in that **same** emit — the handler
 *   set is iterated live (no per-emit snapshot allocation).
 * - A handler **removed** during an emit still runs for that emit (and any nested
 *   emit); the removal takes effect once the outermost emit completes.
 * - `emit` is re-entrant (a handler may emit again) and throw-safe: a throwing
 *   handler propagates to the caller but never wedges deferred removal.
 */
export class Signal<T = void> {
  private handlers = new Set<(value: T) => void>();
  private emitDepth = 0;
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

  /** Unsubscribe a specific handler. Deferred to the outermost emit if called during one. */
  remove(handler: (value: T) => void): void {
    if (this.emitDepth > 0) {
      this.pendingRemove.push(handler);
    } else {
      this.handlers.delete(handler);
    }
  }

  /**
   * Emit a value to all subscribers. Zero-alloc on the hot path; re-entrant and
   * throw-safe (see the class docstring for the add/remove-during-emit semantics).
   */
  emit(...args: T extends void ? [] : [value: T]): void {
    const value = args[0] as T;
    this.emitDepth++;
    try {
      for (const handler of this.handlers) {
        handler(value);
      }
    } finally {
      this.emitDepth--;
      // Flush deferred removes only when the outermost emit has unwound (rare path).
      if (this.emitDepth === 0 && this.pendingRemove.length > 0) {
        this.flushPending();
      }
    }
  }

  private flushPending(): void {
    for (let i = 0; i < this.pendingRemove.length; i++) {
      this.handlers.delete(this.pendingRemove[i]!);
    }
    this.pendingRemove.length = 0;
  }

  /** Remove all handlers. */
  clear(): void {
    this.handlers.clear();
    this.pendingRemove.length = 0;
  }
}
