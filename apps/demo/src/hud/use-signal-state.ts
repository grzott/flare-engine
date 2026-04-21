import type { Signal } from '@flare-engine/events';
import { useEffect, useState } from 'react';

/**
 * Subscribe to a Signal and re-render whenever it emits. Returns whatever
 * `getter()` returns at render time — typically a reference to a mutable
 * store object. Replaces the `useState(0) + useEffect(signal.add(...))`
 * boilerplate duplicated across demo HUD hooks.
 */
export function useSignalState<T, S>(signal: Signal<S>, getter: () => T): T {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = signal.add(() => setTick((t) => t + 1));
    return () => {
      unsub();
    };
  }, [signal]);
  return getter();
}
