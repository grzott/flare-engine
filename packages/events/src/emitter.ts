/** Unsubscribe function returned by on/once. */
export type Unsubscribe = () => void;

/** Map of event names to handler signatures. */
export type EventMap = Record<string, (...args: never[]) => void>;

/** Type-safe event emitter. */
export class EventEmitter<E extends EventMap> {
  private listeners = new Map<keyof E, Set<E[keyof E]>>();
  private iterating = false;
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

  /** Unsubscribe a specific handler. */
  off<K extends keyof E>(event: K, handler: E[K]): void {
    if (this.iterating) {
      this.pendingRemove.push({ event, handler });
      return;
    }
    const set = this.listeners.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) this.listeners.delete(event);
    }
  }

  /** Emit an event to all subscribers. Zero-alloc on the hot path. */
  emit<K extends keyof E>(event: K, ...args: Parameters<E[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    this.iterating = true;
    for (const handler of set) {
      // biome-ignore lint/complexity/noBannedTypes: generic handler call
      (handler as Function)(...args);
    }
    this.iterating = false;
    // Flush pending removes (rare path — only when handler unsubscribed during emit)
    if (this.pendingRemove.length > 0) {
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
  }

  /** Remove all listeners for a specific event, or all listeners. */
  removeAll(event?: keyof E): void {
    if (event !== undefined) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    this.pendingRemove.length = 0;
    this.iterating = false;
  }
}
