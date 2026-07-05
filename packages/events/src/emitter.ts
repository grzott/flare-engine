/** Unsubscribe function returned by on/once. */
export type Unsubscribe = () => void;

/** Map of event names to handler signatures. */
export type EventMap = Record<string, (...args: never[]) => void>;

/**
 * Type-safe event emitter.
 *
 * Emit semantics (shared with Signal):
 * - A handler **added** during an emit runs in that **same** emit — the listener
 *   set is iterated live (no per-emit snapshot allocation).
 * - A handler **removed** during an emit still runs for that emit (and any nested
 *   emit); the removal takes effect once the outermost emit completes.
 * - `emit` is re-entrant (a handler may emit again) and throw-safe: a throwing
 *   handler propagates to the caller but never wedges deferred removal.
 */
export class EventEmitter<E extends EventMap> {
  private listeners = new Map<keyof E, Set<E[keyof E]>>();
  private emitDepth = 0;
  private pendingRemove: Array<{ event: keyof E; handler: E[keyof E] }> = [];

  /** Subscribe to an event. Returns unsubscribe function. */
  on<K extends keyof E>(event: K, handler: E[K]): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return () => {
      this.off(event, handler);
    };
  }

  /** Subscribe to an event once. Returns unsubscribe function. */
  once<K extends keyof E>(event: K, handler: E[K]): Unsubscribe {
    const wrapper = ((...args: never[]) => {
      unsub();
      // biome-ignore lint/complexity/noBannedTypes: generic handler call
      (handler as Function)(...args);
    }) as E[K];
    const unsub = this.on(event, wrapper);
    return unsub;
  }

  /** Unsubscribe a specific handler. Deferred to the outermost emit if called during one. */
  off<K extends keyof E>(event: K, handler: E[K]): void {
    if (this.emitDepth > 0) {
      this.pendingRemove.push({ event, handler });
      return;
    }
    const set = this.listeners.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) this.listeners.delete(event);
    }
  }

  /**
   * Emit an event to all subscribers. Zero-alloc on the hot path; re-entrant and
   * throw-safe (see the class docstring for the add/remove-during-emit semantics).
   */
  emit<K extends keyof E>(event: K, ...args: Parameters<E[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    this.emitDepth++;
    try {
      for (const handler of set) {
        // biome-ignore lint/complexity/noBannedTypes: generic handler call
        (handler as Function)(...args);
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
      const { event: ev, handler: h } = this.pendingRemove[i]!;
      const s = this.listeners.get(ev);
      if (s) {
        s.delete(h);
        if (s.size === 0) this.listeners.delete(ev);
      }
    }
    this.pendingRemove.length = 0;
  }

  /** Remove all listeners for a specific event, or all listeners. */
  removeAll(event?: keyof E): void {
    if (event !== undefined) {
      this.listeners.delete(event);
      // Don't clear the shared pendingRemove here: mid-emit it may hold deferred
      // removals for OTHER events. Entries for this event become harmless no-ops
      // at flush (their Set is already gone).
      return;
    }
    this.listeners.clear();
    this.pendingRemove.length = 0;
  }
}
