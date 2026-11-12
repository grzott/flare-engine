import type { Signal } from '@flare-engine/events';
import { easeOutCubic, linear } from '@flare-engine/math';
import { useEffect, useRef, useState } from 'react';

/**
 * Tweens from the current value to `target` over `durationMs` with `ease`, one
 * requestAnimationFrame chain at a time. Shared by `useOverlayFade` and
 * `useCountUp`; not exported.
 */
function useRafTween(target: number, durationMs: number, ease: (t: number) => number): number {
  const [value, setValue] = useState<number>(target);
  const valueRef = useRef<number>(value);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Keep ref in sync with state (runs before effect)
  valueRef.current = value;

  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') {
      setValue(target);
      return;
    }
    const from = valueRef.current;
    startRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const step = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min((now - startRef.current) / durationMs, 1);
      setValue(from + (target - from) * ease(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs, ease]);

  return value;
}

export function useOverlayFade(visible: boolean, durationMs = 300): number {
  return useRafTween(visible ? 1 : 0, durationMs, linear);
}

export function useCountUp(target: number, durationMs = 600): number {
  return useRafTween(target, durationMs, easeOutCubic);
}

export function useSignalState<T>(signal: Signal<T>, initial: T): T {
  const [state, setState] = useState<T>(initial);

  useEffect(() => {
    const disposer = signal.add(setState);
    return disposer;
  }, [signal]);

  return state;
}
