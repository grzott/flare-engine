import type { Signal } from '@flare-engine/events';
import { easeOutCubic } from '@flare-engine/math';
import { useEffect, useRef, useState } from 'react';

export function useOverlayFade(visible: boolean, durationMs = 300): number {
  const target = visible ? 1 : 0;
  const [opacity, setOpacity] = useState<number>(target);
  const opacityRef = useRef<number>(opacity);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Keep ref in sync with state (runs before effect)
  opacityRef.current = opacity;

  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') {
      setOpacity(target);
      return;
    }
    const from = opacityRef.current;
    startRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const step = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min((now - startRef.current) / durationMs, 1);
      setOpacity(from + (target - from) * t);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return opacity;
}

export function useCountUp(target: number, durationMs = 600): number {
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
      setValue(from + (target - from) * easeOutCubic(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}

export function useSignalState<T>(signal: Signal<T>, initial: T): T {
  const [state, setState] = useState<T>(initial);

  useEffect(() => {
    const disposer = signal.add(setState);
    return disposer;
  }, [signal]);

  return state;
}
