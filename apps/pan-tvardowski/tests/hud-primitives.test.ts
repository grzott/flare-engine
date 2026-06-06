/**
 * Behavioral locks for CL4 HUD primitives:
 *   1. cloneGameState — deep-clone reference isolation
 *   2. HudPanelScaffold — structural tree via jsx capture
 *   3. useHudState — lifecycle: init, subscribe, emit, cleanup
 *
 * React mock is self-contained in this file. No other PT test mocks react,
 * so last-writer-wins is not a concern here.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Theme } from '@flare-engine/ui';
import type { ReactNode } from 'react';

// ── 1. cloneGameState (no React needed) ──────────────────────────────────────

describe('cloneGameState', () => {
  test('returns a new top-level object', async () => {
    const { gameState, resetGameState } = await import('../src/state');
    const { cloneGameState } = await import('../src/hud/useHudState');
    resetGameState();
    const clone = cloneGameState();
    expect(Object.is(clone, gameState)).toBe(false);
  });

  test('nested objects are new references (settings, controls, runStats, kills, zoneBanner)', async () => {
    const { gameState, resetGameState } = await import('../src/state');
    const { cloneGameState } = await import('../src/hud/useHudState');
    resetGameState();
    const clone = cloneGameState();
    expect(Object.is(clone.settings, gameState.settings)).toBe(false);
    expect(Object.is(clone.settings.controls, gameState.settings.controls)).toBe(false);
    expect(Object.is(clone.runStats, gameState.runStats)).toBe(false);
    expect(Object.is(clone.runStats.kills, gameState.runStats.kills)).toBe(false);
    expect(Object.is(clone.zoneBanner, gameState.zoneBanner)).toBe(false);
  });

  test('primitive values are preserved after mutation', async () => {
    const { gameState, resetGameState } = await import('../src/state');
    const { cloneGameState } = await import('../src/hud/useHudState');
    resetGameState();
    gameState.score = 42;
    gameState.settings.locale = 'pl';
    gameState.settings.controls.joystickSide = 'right';
    gameState.runStats.score = 7;
    gameState.runStats.kills.boss = 3;
    gameState.zoneBanner.visible = true;
    const clone = cloneGameState();
    expect(clone.score).toBe(42);
    expect(clone.settings.locale).toBe('pl');
    expect(clone.settings.controls.joystickSide).toBe('right');
    expect(clone.runStats.score).toBe(7);
    expect(clone.runStats.kills.boss).toBe(3);
    expect(clone.zoneBanner.visible).toBe(true);
  });
});

// ── React mock (used by tests 2 and 3) ───────────────────────────────────────

// Per-invocation slots — reset before each test
const stateSlots: Array<{ value: unknown }> = [];
let stateSlotIdx = 0;
// Capture the actual setter fn so Signal callbacks can update the slot
const setters: Array<(v: unknown) => void> = [];

const effectCallbacks: Array<() => (() => void) | undefined> = [];

const refSlots: Array<{ current: unknown }> = [];
let refSlotIdx = 0;

function resetReactMock(): void {
  stateSlots.length = 0;
  stateSlotIdx = 0;
  setters.length = 0;
  effectCallbacks.length = 0;
  refSlots.length = 0;
  refSlotIdx = 0;
}

mock.module('react', () => ({
  useState: (init: unknown) => {
    const idx = stateSlotIdx++;
    const initialValue = typeof init === 'function' ? (init as () => unknown)() : init;
    stateSlots[idx] = { value: initialValue };
    const setter = (v: unknown): void => {
      stateSlots[idx]!.value =
        typeof v === 'function' ? (v as (prev: unknown) => unknown)(stateSlots[idx]!.value) : v;
    };
    setters[idx] = setter;
    return [stateSlots[idx]!.value, setter];
  },
  useEffect: (cb: () => (() => void) | undefined) => {
    effectCallbacks.push(cb);
  },
  useRef: (init: unknown) => {
    const idx = refSlotIdx++;
    if (refSlots[idx] === undefined) {
      refSlots[idx] = { current: init };
    }
    return refSlots[idx]!;
  },
  useContext: () => null,
  createContext: (def: unknown) => ({ Provider: 'Provider', _default: def }),
  createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({
    type,
    props,
    children,
  }),
  Fragment: 'Fragment',
}));

interface JsxCall {
  type: unknown;
  props: Record<string, unknown>;
}
const jsxLog: JsxCall[] = [];

const jsxCapture = {
  jsx: (type: unknown, props: Record<string, unknown>) => {
    jsxLog.push({ type, props });
    return { type, props };
  },
  jsxs: (type: unknown, props: Record<string, unknown>) => {
    jsxLog.push({ type, props });
    return { type, props };
  },
  jsxDEV: (type: unknown, props: Record<string, unknown>) => {
    jsxLog.push({ type, props });
    return { type, props };
  },
  Fragment: 'Fragment',
};

mock.module('react/jsx-runtime', () => jsxCapture);
mock.module('react/jsx-dev-runtime', () => jsxCapture);

mock.module('@flare-engine/ui', () => ({
  ThemeProvider: 'ThemeProvider',
  FocusProvider: 'FocusProvider',
  darkTheme: { name: 'dark' },
}));

// ── 2. HudPanelScaffold ───────────────────────────────────────────────────────

// Sentinel child — identity checked at the leaf of each tree assertion.
// Cast to ReactNode so HudPanelScaffold's prop type is satisfied at call sites.
const CHILDREN = { sentinel: true } as unknown as ReactNode;

describe('HudPanelScaffold', () => {
  beforeEach(() => {
    jsxLog.length = 0;
    resetReactMock();
  });

  test('focus=true (default): ThemeProvider > FocusProvider > children', async () => {
    const { HudPanelScaffold } = await import('../src/hud/HudPanelScaffold');
    const { ThemeProvider, FocusProvider, darkTheme } = await import('@flare-engine/ui');
    const tree = HudPanelScaffold({ children: CHILDREN }) as {
      type: unknown;
      props: { theme: unknown; children: { type: unknown; props: { children: unknown } } };
    };
    expect(tree.type).toBe(ThemeProvider);
    expect(tree.props.theme).toBe(darkTheme);
    expect(tree.props.children.type).toBe(FocusProvider);
    expect(tree.props.children.props.children).toBe(CHILDREN);
  });

  test('focus=false: ThemeProvider > children, no FocusProvider node', async () => {
    const { HudPanelScaffold } = await import('../src/hud/HudPanelScaffold');
    const { ThemeProvider, FocusProvider, darkTheme } = await import('@flare-engine/ui');
    const tree = HudPanelScaffold({ children: CHILDREN, focus: false }) as {
      type: unknown;
      props: { theme: unknown; children: unknown };
    };
    expect(tree.type).toBe(ThemeProvider);
    expect(tree.props.theme).toBe(darkTheme);
    expect(tree.props.children).toBe(CHILDREN);
    // Explicit guard: children is not a FocusProvider node
    expect((tree.props.children as { type?: unknown } | null)?.type).not.toBe(FocusProvider);
  });

  test('custom theme threads through to ThemeProvider', async () => {
    const { HudPanelScaffold } = await import('../src/hud/HudPanelScaffold');
    const { ThemeProvider, darkTheme } = await import('@flare-engine/ui');
    const customTheme = { name: 'custom' } as unknown as Theme;
    const treeDefault = HudPanelScaffold({ children: CHILDREN }) as {
      type: unknown;
      props: { theme: unknown; children: unknown };
    };
    const treeCustom = HudPanelScaffold({ children: CHILDREN, theme: customTheme }) as {
      type: unknown;
      props: { theme: unknown; children: unknown };
    };
    expect(treeDefault.type).toBe(ThemeProvider);
    expect(treeDefault.props.theme).toBe(darkTheme);
    expect(treeCustom.type).toBe(ThemeProvider);
    expect(treeCustom.props.theme).toBe(customTheme);
  });
});

// ── 3. useHudState ────────────────────────────────────────────────────────────

describe('useHudState', () => {
  beforeEach(async () => {
    resetReactMock();
    // Clear stateChanged to prevent leakage between hook lifecycle tests.
    const { stateChanged } = await import('../src/state');
    stateChanged.clear();
  });

  test('returns initial value from select()', async () => {
    const { gameState, resetGameState } = await import('../src/state');
    const { useHudState } = await import('../src/hud/useHudState');
    resetGameState();
    gameState.score = 99;
    const result = useHudState(() => gameState.score);
    expect(result).toBe(99);
  });

  test('stateChanged emission updates snap via captured setter', async () => {
    const { gameState, resetGameState, stateChanged } = await import('../src/state');
    const { useHudState } = await import('../src/hud/useHudState');
    resetGameState();
    gameState.score = 10;

    useHudState(() => gameState.score);

    // Run captured effects (registers subscriber)
    const cleanups: Array<(() => void) | undefined> = [];
    for (const cb of effectCallbacks) {
      cleanups.push(cb());
    }

    // Slot 0 is the snap useState slot
    expect(stateSlots[0]?.value).toBe(10);

    // Mutate state and emit signal
    gameState.score = 55;
    stateChanged.emit();

    // Signal called setSnap(selRef.current()) = setSnap(55)
    expect(stateSlots[0]?.value).toBe(55);

    // Cleanup (unsubscribe) so stateChanged is clean for next test
    for (const cleanup of cleanups) {
      if (typeof cleanup === 'function') cleanup();
    }
  });

  test('cleanup unsubscribes — emit after cleanup does not update slot', async () => {
    const { gameState, resetGameState, stateChanged } = await import('../src/state');
    const { useHudState } = await import('../src/hud/useHudState');
    resetGameState();
    gameState.score = 1;

    useHudState(() => gameState.score);

    const cleanups: Array<(() => void) | undefined> = [];
    for (const cb of effectCallbacks) {
      cleanups.push(cb());
    }

    // Confirm subscription is live
    gameState.score = 20;
    stateChanged.emit();
    expect(stateSlots[0]?.value).toBe(20);

    // Unsubscribe via cleanup
    for (const cleanup of cleanups) {
      if (typeof cleanup === 'function') cleanup();
    }

    // Emit after unsubscribe — slot must stay at 20
    gameState.score = 99;
    stateChanged.emit();
    expect(stateSlots[0]?.value).toBe(20);
  });
});
