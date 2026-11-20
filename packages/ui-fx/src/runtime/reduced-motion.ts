import type { A11yManager } from '@flare-engine/a11y';
import type { ReducedMotionSource } from './contracts';

/** Whether motion is reduced for an element in `mode`. Only `'system'` reads the source. */
export function effectiveReduced(
  mode: 'system' | 'always' | 'never',
  src: ReducedMotionSource,
): boolean {
  return mode === 'always' || (mode === 'system' && src.get());
}

/** The value a platform source holds, and the subscribers it tells. */
export interface ReducedMotionBox {
  readonly value: boolean;
  /** Record what the OS reported: forwards it to the manager and tells subscribers of a change. */
  set(v: boolean): void;
  subscribe(cb: (v: boolean) => void): () => void;
}

/** Motion is unreduced until the platform source reports otherwise. */
export function createReducedMotionBox(manager?: A11yManager): ReducedMotionBox {
  const listeners = new Set<(v: boolean) => void>();
  let value = false;
  return {
    get value() {
      return value;
    },
    set(v) {
      manager?.setReducedMotion(v);
      if (v === value) return;
      value = v;
      for (const listener of listeners) listener(v);
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
