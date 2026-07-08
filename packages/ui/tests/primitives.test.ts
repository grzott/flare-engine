import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { FocusContextValue } from '../src/focus-context.js';

// Module-level hook state — declared before mock.module so closures capture them.
const stateStore: unknown[] = [];
let stateIndex = 0;
const refStore: Array<{ current: unknown }> = [];
let refIndex = 0;
const pendingEffects: Array<() => (() => void) | undefined> = [];

/** Reset call indices + effects but PRESERVE stateStore (simulates a re-render). */
function resetHookIndices(): void {
  stateIndex = 0;
  refIndex = 0;
  pendingEffects.length = 0;
}

function flushEffects(): Array<() => void> {
  const cleanups: Array<() => void> = [];
  while (pendingEffects.length > 0) {
    const fn = pendingEffects.shift()!;
    const cleanup = fn();
    if (typeof cleanup === 'function') cleanups.push(cleanup);
  }
  return cleanups;
}

mock.module('react', () => ({
  createContext: (def: unknown) => ({ Provider: 'Provider', Consumer: 'Consumer', _current: def }),
  useContext: (ctx: { _current: unknown }) => ctx._current,
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
  useMemo: (fn: () => unknown) => fn(),
  useCallback: (fn: unknown) => fn,
  useRef: (init: unknown) => {
    const idx = refIndex;
    if (refStore[idx] === undefined) {
      refStore[idx] = { current: init };
    }
    refIndex++;
    return refStore[idx];
  },
  useId: () => 'auto-id',
  Fragment: 'Fragment',
  createElement: (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => ({ type, props: props ?? {}, children }),
}));

mock.module('react/jsx-runtime', () => ({
  jsx: (type: unknown, props: Record<string, unknown> | null) => ({ type, props: props ?? {} }),
  jsxs: (type: unknown, props: Record<string, unknown> | null) => ({ type, props: props ?? {} }),
  jsxDEV: (type: unknown, props: Record<string, unknown> | null) => ({ type, props: props ?? {} }),
  Fragment: 'Fragment',
}));

mock.module('react/jsx-dev-runtime', () => ({
  jsx: (type: unknown, props: Record<string, unknown> | null) => ({ type, props: props ?? {} }),
  jsxs: (type: unknown, props: Record<string, unknown> | null) => ({ type, props: props ?? {} }),
  jsxDEV: (type: unknown, props: Record<string, unknown> | null) => ({ type, props: props ?? {} }),
  Fragment: 'Fragment',
}));

mock.module('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
}));

const { createFocusManager } = await import('../src/focus.js');
const { FocusContext } = await import('../src/focus-context.js');
const { FocusProvider } = await import('../src/focus-provider.js');
const { Button } = await import('../src/button.js');

function setFocusContext(v: FocusContextValue | null): void {
  (FocusContext as unknown as { _current: FocusContextValue | null })._current = v;
}

/** Button's style prop is [styles.wrap, container, style]; index 1 is the container. */
function containerStyle(el: unknown): Record<string, unknown> {
  return ((el as { props: { style: unknown[] } }).props.style[1] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  stateStore.length = 0;
  stateIndex = 0;
  refStore.length = 0;
  refIndex = 0;
  pendingEffects.length = 0;
  setFocusContext(null);
});

describe('Button + FocusProvider (reactive focus)', () => {
  it('FocusProvider republishes context value on focus move', () => {
    const mgr = createFocusManager();
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({ id: 'b', tabIndex: 1 });
    mgr.focusFirst(); // explicit (register no longer auto-focuses)

    let el = FocusProvider({ manager: mgr, children: 'kids' });
    flushEffects();

    const v1 = (el as { props: { value: FocusContextValue } }).props.value;
    expect(v1.manager).toBe(mgr);
    expect(v1.focusedId).toBe('a');

    mgr.focus('b');

    resetHookIndices();
    el = FocusProvider({ manager: mgr, children: 'kids' });

    const v2 = (el as { props: { value: FocusContextValue } }).props.value;
    expect(v2.focusedId).toBe('b');
  });

  it('FocusProvider without autoFocus leaves focus null (no ring until a driver acts)', () => {
    const mgr = createFocusManager();
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({ id: 'b', tabIndex: 1 });

    const el = FocusProvider({ manager: mgr, children: 'kids' });
    flushEffects();

    expect(mgr.getFocused()).toBe(null);
    const v = (el as { props: { value: FocusContextValue } }).props.value;
    expect(v.focusedId).toBe(null);
  });

  it('FocusProvider autoFocus focuses the tab-order first node after children register', () => {
    const mgr = createFocusManager();
    mgr.register({ id: 'a', tabIndex: 1 });
    mgr.register({ id: 'b', tabIndex: 0 });

    FocusProvider({ manager: mgr, autoFocus: true, children: 'kids' });
    flushEffects();

    // tab-order first (b, tabIndex 0), not registration order (a).
    expect(mgr.getFocused()).toBe('b');

    // The focus change is published to context on the next render.
    resetHookIndices();
    const el = FocusProvider({ manager: mgr, autoFocus: true, children: 'kids' });
    const v = (el as { props: { value: FocusContextValue } }).props.value;
    expect(v.focusedId).toBe('b');
  });

  it('Button ring follows context.focusedId', () => {
    const mgr = createFocusManager();

    setFocusContext({ manager: mgr, focusedId: 'x' });
    resetHookIndices();
    let el = Button({ label: 'A', focusId: 'x' });

    expect(containerStyle(el).borderWidth).toBe(2);
    expect(
      (el as { props: { accessibilityState: { selected: boolean } } }).props.accessibilityState
        .selected,
    ).toBe(true);

    setFocusContext({ manager: mgr, focusedId: 'y' });
    resetHookIndices();
    el = Button({ label: 'A', focusId: 'x' });

    expect(containerStyle(el).borderWidth).toBe(1);
    expect(
      (el as { props: { accessibilityState: { selected: boolean } } }).props.accessibilityState
        .selected,
    ).toBe(false);
  });

  it('Press focuses via manager + fires onPress', () => {
    const mgr = createFocusManager();
    mgr.register({ id: 'other', tabIndex: 0 });
    mgr.register({ id: 'x', tabIndex: 1 });
    setFocusContext({ manager: mgr, focusedId: 'other' });
    let pressed = 0;
    resetHookIndices();
    const el = Button({
      label: 'A',
      focusId: 'x',
      onPress: () => {
        pressed++;
      },
    });
    (el as { props: { onPress: () => void } }).props.onPress();

    expect(mgr.getFocused()).toBe('x');
    expect(pressed).toBe(1);
  });

  it('Disabled Button ignores press', () => {
    const mgr = createFocusManager();
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.focus('a'); // register no longer auto-focuses
    setFocusContext({ manager: mgr, focusedId: 'a' });
    let pressed = 0;
    resetHookIndices();
    const el = Button({
      label: 'A',
      focusId: 'x',
      disabled: true,
      onPress: () => {
        pressed++;
      },
    });
    (el as { props: { onPress: () => void } }).props.onPress();

    expect(pressed).toBe(0);
    expect(mgr.getFocused()).toBe('a');
    expect(containerStyle(el).opacity).toBe(0.5);
  });

  it('Button registers an activatable node + disposer unregisters', () => {
    const mgr = createFocusManager();
    setFocusContext({ manager: mgr, focusedId: null });
    let activated = 0;
    resetHookIndices();
    Button({
      label: 'A',
      focusId: 'x',
      onPress: () => {
        activated++;
      },
    });
    const cleanups = flushEffects();

    expect(mgr.getOrder().includes('x')).toBe(true);

    mgr.focus('x');
    mgr.activate();
    expect(activated).toBe(1);

    for (const c of cleanups) c();
    expect(mgr.getOrder().includes('x')).toBe(false);
  });
});
