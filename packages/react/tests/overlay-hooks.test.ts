import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// Stateful useState mock — tracks the current value so effects that call
// setState are reflected in the next call to the hook.
const stateStore: unknown[] = [];
let stateIndex = 0;
const pendingEffects: Array<() => (() => void) | undefined> = [];
const refStore: Array<{ current: unknown }> = [];
let refIndex = 0;

function resetHookState(): void {
  stateStore.length = 0;
  stateIndex = 0;
  pendingEffects.length = 0;
  refStore.length = 0;
  refIndex = 0;
}

// Must write this mock BEFORE importing the hook module.
mock.module('react', () => ({
  useState: (init: unknown) => {
    const idx = stateIndex;
    if (stateStore[idx] === undefined) {
      stateStore[idx] = typeof init === 'function' ? (init as () => unknown)() : init;
    }
    const setter = (val: unknown) => {
      stateStore[idx] =
        typeof val === 'function' ? (val as (prev: unknown) => unknown)(stateStore[idx]) : val;
    };
    stateIndex++;
    return [stateStore[idx], setter];
  },
  useEffect: (fn: () => (() => void) | undefined) => {
    pendingEffects.push(fn);
  },
  useRef: (init: unknown) => {
    const idx = refIndex;
    if (refStore[idx] === undefined) {
      refStore[idx] = { current: init };
    }
    refIndex++;
    return refStore[idx];
  },
}));

function flushEffects(): Array<() => void> {
  const cleanups: Array<() => void> = [];
  while (pendingEffects.length > 0) {
    const fn = pendingEffects.shift()!;
    const cleanup = fn();
    if (typeof cleanup === 'function') cleanups.push(cleanup);
  }
  return cleanups;
}

// Controllable rAF/cAF — driven by explicit step calls.
type RafCallback = (now: number) => void;
const rafQueue: Map<number, RafCallback> = new Map();
let rafId = 0;
let fakeNow = 0;

function installFakeRaf(): void {
  rafQueue.clear();
  rafId = 0;
  fakeNow = 0;
  globalThis.requestAnimationFrame = (cb: RafCallback) => {
    const id = ++rafId;
    rafQueue.set(id, cb);
    return id;
  };
  globalThis.cancelAnimationFrame = (id: number) => {
    rafQueue.delete(id);
  };
}

function removeFakeRaf(): void {
  delete (globalThis as Record<string, unknown>).requestAnimationFrame;
  delete (globalThis as Record<string, unknown>).cancelAnimationFrame;
  rafQueue.clear();
}

/**
 * Advances fake time by `deltaMs` and fires all queued rAF callbacks once with
 * the new timestamp. Callbacks that re-schedule appear in the next step.
 */
function stepRaf(deltaMs: number): void {
  fakeNow += deltaMs;
  const batch = [...rafQueue.entries()];
  for (const [id] of batch) rafQueue.delete(id);
  for (const [, cb] of batch) cb(fakeNow);
}

const { useOverlayFade, useCountUp, useSignalState } = await import('../src/overlay-hooks.js');

beforeEach(() => {
  resetHookState();
});

afterEach(() => {
  pendingEffects.length = 0;
  removeFakeRaf();
});

// ---------------------------------------------------------------------------
// useOverlayFade — no-rAF env (snap path)
// ---------------------------------------------------------------------------

describe('useOverlayFade (no-rAF env)', () => {
  it('snaps to 1 when visible=true and rAF absent — non-tautological', () => {
    // Seed state to 0 so target (1) differs from init.
    stateStore[0] = 0;
    useOverlayFade(true, 300);
    flushEffects();
    // Effect must have called setValue(1) — a deleted-effect impl fails this.
    expect(stateStore[0]).toBe(1);
  });

  it('snaps to 0 when visible=false and rAF absent — non-tautological', () => {
    stateStore[0] = 1;
    useOverlayFade(false, 300);
    flushEffects();
    expect(stateStore[0]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// useOverlayFade — rAF env (animation path)
// ---------------------------------------------------------------------------

describe('useOverlayFade (rAF env)', () => {
  beforeEach(() => {
    installFakeRaf();
  });

  it('transitions from 0 to 1 over stepped frames and lands exactly on target', () => {
    // Seed state to 0 (visible=false initial).
    stateStore[0] = 0;
    // Call with visible=true so target=1, duration=200ms.
    useOverlayFade(true, 200);
    flushEffects();

    // First step initializes startRef.current = fakeNow (0→16ms). t=0 on this frame.
    stepRaf(16);
    // Second step: elapsed = 116ms, t = 116/200 = 0.58 → mid-value.
    stepRaf(100);
    const mid = stateStore[0] as number;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);

    // Step past duration (another 200ms makes total elapsed >> 200ms, t clamps to 1).
    stepRaf(200);
    expect(stateStore[0]).toBe(1);
  });

  it('interruption — does NOT jump to previous target mid-animation (regression for useOverlayFade)', () => {
    // Phase 1: animate from 0 → 1 with 400ms duration.
    stateStore[0] = 0;
    useOverlayFade(true, 400);
    flushEffects();

    // First step initializes startRef.current.
    stepRaf(16);
    // Second step: t = 116/400 ≈ 0.29 → value is between 0 and 1.
    stepRaf(100);
    const midOpacity = stateStore[0] as number;
    expect(midOpacity).toBeGreaterThan(0);
    expect(midOpacity).toBeLessThan(1);

    // Phase 2: interrupt — new effect for target=0 (visible=false).
    // Simulate re-render: reset hook call state but PRESERVE stateStore[0]
    // (it reflects the animated mid-value written by the rAF step above).
    stateIndex = 0;
    refIndex = 0;
    pendingEffects.length = 0;

    // Record the displayed value before triggering the new effect.
    const displayedBeforeInterrupt = stateStore[0] as number;

    // Trigger new effect for visible=false (target=0).
    useOverlayFade(false, 400);
    flushEffects();

    // First step of new animation initializes the new start time.
    stepRaf(16);
    // Second step: animation moves from displayedBeforeInterrupt toward 0.
    stepRaf(16);
    const afterInterrupt = stateStore[0] as number;
    // Must not have jumped upward — value is moving toward 0 from midOpacity.
    expect(afterInterrupt).toBeLessThanOrEqual(displayedBeforeInterrupt);
  });

  it('cancels rAF on cleanup (no dangling callbacks)', () => {
    stateStore[0] = 0;
    useOverlayFade(true, 200);
    const cleanups = flushEffects();

    // One callback is queued.
    expect(rafQueue.size).toBe(1);

    // Run cleanup (simulates unmount / dependency change).
    for (const c of cleanups) c();

    // Queue must be empty — the callback was cancelled.
    expect(rafQueue.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// useCountUp — no-rAF env (snap path)
// ---------------------------------------------------------------------------

describe('useCountUp (no-rAF env)', () => {
  it('snaps to target when rAF absent — non-tautological', () => {
    // Seed state to a different value so snap is observable.
    stateStore[0] = 0;
    useCountUp(100, 600);
    flushEffects();
    // A deleted-effect impl would leave stateStore[0] at 0.
    expect(stateStore[0]).toBe(100);
  });

  it('snaps to 0', () => {
    stateStore[0] = 50;
    useCountUp(0, 600);
    flushEffects();
    expect(stateStore[0]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// useCountUp — rAF env (animation path)
// ---------------------------------------------------------------------------

describe('useCountUp (rAF env)', () => {
  beforeEach(() => {
    installFakeRaf();
  });

  it('transitions from 0 to 100 over stepped frames and lands exactly on target', () => {
    stateStore[0] = 0;
    useCountUp(100, 600);
    flushEffects();

    // First step initializes startRef.current.
    stepRaf(16);
    // Second step: elapsed ≈ 316ms, t ≈ 0.53 → value is between 0 and 100.
    stepRaf(300);
    const mid = stateStore[0] as number;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(100);

    // Step past duration — t clamps to 1, value == target.
    stepRaf(600);
    expect(stateStore[0]).toBe(100);
  });

  it('INTERRUPTION — continues from current display value, not previous target (Fix 1)', () => {
    // Phase 1: animate 0 → 100 over 600ms.
    stateStore[0] = 0;
    useCountUp(100, 600);
    flushEffects();

    // First step initializes startRef.current.
    stepRaf(16);
    // Second step: elapsed ≈ 166ms, t ≈ 0.27 → value is clearly between 0 and 100.
    stepRaf(150);
    const midValue = stateStore[0] as number;
    expect(midValue).toBeGreaterThan(0);
    expect(midValue).toBeLessThan(100);

    // Phase 2: re-render with new target=200 mid-flight.
    // The displayed value (midValue) is the current on-screen position.
    // The old bug: from = prevRef.current = 100 (previous target), causing
    // a jump: first frame sets value = 100 + (200-100)*ease(tiny_t) ≈ 100.
    // The fix: from = valueRef.current = midValue, so first frame keeps value < 100.

    // Simulate re-render by resetting hook-call indices but NOT stateStore.
    stateIndex = 0;
    refIndex = 0;
    pendingEffects.length = 0;

    useCountUp(200, 600);
    flushEffects();

    // First step of new animation initializes start time for the new animation.
    stepRaf(16);
    // Second step: small delta → value = midValue + (200-midValue)*ease(small_t).
    // With the old bug: value = 100 + (200-100)*ease(small_t) ≥ 100.
    // With the fix: value starts from midValue < 100, so still < 100.
    stepRaf(16);
    const afterInterrupt = stateStore[0] as number;

    // The value must be above midValue (moving toward 200) but below 100 (no jump).
    expect(afterInterrupt).toBeGreaterThan(midValue);
    expect(afterInterrupt).toBeLessThan(100);
  });

  it('cancels rAF on cleanup (no dangling callbacks)', () => {
    stateStore[0] = 0;
    useCountUp(100, 600);
    const cleanups = flushEffects();

    expect(rafQueue.size).toBe(1);
    for (const c of cleanups) c();
    expect(rafQueue.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// useSignalState (verified strong — kept as-is)
// ---------------------------------------------------------------------------

describe('useSignalState', () => {
  it('returns initial value before any emission', () => {
    const fakeSignal = { add: (_fn: unknown) => () => {} };
    const val = useSignalState(fakeSignal as never, 42);
    expect(val).toBe(42);
  });

  it('subscribes via signal.add on effect flush', () => {
    let subscribedFn: ((v: number) => void) | null = null;
    const fakeSignal = {
      add: (fn: (v: number) => void) => {
        subscribedFn = fn;
        return () => {};
      },
    };
    useSignalState(fakeSignal as never, 0);
    flushEffects();
    expect(subscribedFn).not.toBeNull();
  });

  it('calls the disposer returned by signal.add on cleanup', () => {
    let disposed = false;
    const fakeSignal = {
      add: (_fn: unknown) => () => {
        disposed = true;
      },
    };
    useSignalState(fakeSignal as never, 0);
    const cleanups = flushEffects();
    for (const c of cleanups) c();
    expect(disposed).toBe(true);
  });

  it('emitting a value updates state via the subscriber', () => {
    let subscribedFn: ((v: number) => void) | null = null;
    const fakeSignal = {
      add: (fn: (v: number) => void) => {
        subscribedFn = fn;
        return () => {};
      },
    };
    useSignalState(fakeSignal as never, 0);
    flushEffects();
    subscribedFn!(99);
    expect(stateStore[0]).toBe(99);
  });
});
