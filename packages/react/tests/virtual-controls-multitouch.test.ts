import { describe, expect, it, mock } from 'bun:test';

// ---------------------------------------------------------------------------
// CW7-1: simultaneous VirtualJoystick + VirtualButton contracts.
//
// This file runs before virtual-controls.test.ts and virtual-joystick-knob.test.ts
// alphabetically ('-' < '.'), so later files override these mocks as needed.
//
// Fail-old evidence for each test is documented inline.
// ---------------------------------------------------------------------------

type JsxCall = { type: unknown; props: Record<string, unknown> };
const jsxCalls: JsxCall[] = [];

function capturingJsx(type: unknown, props: Record<string, unknown> | null): null {
  jsxCalls.push({ type, props: props ?? {} });
  return null;
}

mock.module('react/jsx-runtime', () => ({
  jsx: capturingJsx,
  jsxs: capturingJsx,
  jsxDEV: capturingJsx,
  Fragment: null,
}));
mock.module('react/jsx-dev-runtime', () => ({
  jsx: capturingJsx,
  jsxs: capturingJsx,
  jsxDEV: capturingJsx,
  Fragment: null,
}));

// Stable ref store so sizeRef persists across re-invocations.
const refStore: Array<{ current: unknown }> = [];
let refCallCount = 0;

let capturedSetKnob:
  | ((updater: (prev: { x: number; y: number }) => { x: number; y: number }) => void)
  | null = null;
let capturedJoystickState: { active: boolean; offset: { x: number; y: number } } | null = null;
let capturedButtonState: { pressed: boolean; justPressed: boolean } | null = null;

mock.module('react', () => ({
  useRef(init: unknown) {
    const idx = refCallCount++;
    if (!refStore[idx]) refStore[idx] = { current: init };
    return refStore[idx];
  },
  useState(init: unknown) {
    const value = typeof init === 'function' ? (init as () => unknown)() : init;
    return [
      value,
      (u: unknown) => {
        capturedSetKnob = u as typeof capturedSetKnob;
      },
    ];
  },
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
  useEffect: () => {},
}));

mock.module('react-native', () => ({
  View: 'View',
  StyleSheet: {
    create: (s: unknown) => s,
    absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  },
}));

mock.module('@flare-engine/input', () => ({
  createJoystickState: () => {
    capturedJoystickState = { active: false, offset: { x: 0, y: 0 } };
    return capturedJoystickState;
  },
  updateJoystick(
    s: { offset: { x: number; y: number }; active: boolean },
    cx: number,
    _cy: number,
    tx: number,
    _ty: number,
  ): void {
    s.active = true;
    s.offset.x = tx - cx;
    s.offset.y = 0;
  },
  releaseJoystick(s: { offset: { x: number; y: number }; active: boolean }): void {
    s.active = false;
    s.offset.x = 0;
    s.offset.y = 0;
  },
  createButtonState: () => {
    capturedButtonState = { pressed: false, justPressed: false };
    return capturedButtonState;
  },
  pressButton(s: { pressed: boolean; justPressed: boolean }): void {
    s.pressed = true;
    s.justPressed = true;
  },
  releaseButton(s: { pressed: boolean; justPressed: boolean }): void {
    s.pressed = false;
  },
  resetButtonFrame(s: { pressed: boolean; justPressed: boolean }): void {
    s.justPressed = false;
  },
}));

const { VirtualJoystick } = await import('../src/virtual-joystick.js');
const { VirtualButton } = await import('../src/virtual-button.js');

function findProp<T>(propName: string): T | undefined {
  for (const call of jsxCalls) {
    if (propName in call.props) return call.props[propName] as T;
  }
  return undefined;
}

function renderJoystick(props: Parameters<typeof VirtualJoystick>[0] = {}): void {
  jsxCalls.length = 0;
  refCallCount = 0;
  refStore.length = 0;
  capturedJoystickState = null;
  VirtualJoystick(props);
}

function renderButton(props: Parameters<typeof VirtualButton>[0] = {}): void {
  jsxCalls.length = 0;
  refCallCount = 0;
  refStore.length = 0;
  capturedButtonState = null;
  VirtualButton(props);
}

// ---------------------------------------------------------------------------
// VirtualJoystick — refuses responder termination (CW7-1)
// ---------------------------------------------------------------------------

describe('VirtualJoystick — onResponderTerminationRequest (CW7-1)', () => {
  it('renders onResponderTerminationRequest prop (fail-old: prop absent)', () => {
    renderJoystick();
    const handler = findProp<unknown>('onResponderTerminationRequest');
    expect(handler).toBeDefined();
  });

  it('onResponderTerminationRequest returns false — joystick holds responder when button touched', () => {
    renderJoystick();
    const handler = findProp<() => boolean>('onResponderTerminationRequest');
    expect(handler?.()).toBe(false);
  });

  it('joystick vector remains non-zero after grant — not zeroed by termination refusal', () => {
    renderJoystick();
    const onLayout = findProp<(e: unknown) => void>('onLayout');
    onLayout?.({ nativeEvent: { layout: { width: 100, height: 100 } } });

    const onGrant = findProp<(e: unknown) => void>('onResponderGrant');
    onGrant?.({ nativeEvent: { locationX: 80, locationY: 50 } });

    expect(capturedJoystickState?.active).toBe(true);
    expect(capturedJoystickState?.offset.x).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------
// VirtualButton — raw touch events, no responder (CW7-1)
// ---------------------------------------------------------------------------

describe('VirtualButton — raw touch events (CW7-1)', () => {
  it('renders onTouchStart prop (fail-old: prop absent — only onResponderGrant existed)', () => {
    renderButton();
    const handler = findProp<unknown>('onTouchStart');
    expect(handler).toBeDefined();
  });

  it('does NOT render onStartShouldSetResponder — button no longer competes for the responder', () => {
    renderButton();
    const handler = findProp<unknown>('onStartShouldSetResponder');
    expect(handler).toBeUndefined();
  });

  it('calling onTouchStart fires press — button pressed independently of responder (fail-old: onTouchStart absent)', () => {
    renderButton();
    const onTouchStart = findProp<() => void>('onTouchStart');
    expect(onTouchStart).toBeDefined();

    onTouchStart?.();

    expect(capturedButtonState?.pressed).toBe(true);
    expect(capturedButtonState?.justPressed).toBe(true);
  });

  it('calling onTouchEnd fires release', () => {
    renderButton();
    const onTouchStart = findProp<() => void>('onTouchStart');
    const onTouchEnd = findProp<() => void>('onTouchEnd');
    onTouchStart?.();
    onTouchEnd?.();
    expect(capturedButtonState?.pressed).toBe(false);
  });

  it('onTouchCancel is present for cancelled-touch cleanup', () => {
    renderButton();
    const handler = findProp<unknown>('onTouchCancel');
    expect(handler).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Combined — simultaneous joystick + button (CW7-1)
//
// The fail-old behavior: with pre-fix code,
//   - VirtualJoystick had no onResponderTerminationRequest → vector was zeroed
//   - VirtualButton had no onTouchStart → press never fired via raw touch
// Both assertions below would fail on pre-fix source.
// ---------------------------------------------------------------------------

describe('VirtualJoystick + VirtualButton — simultaneous use (CW7-1)', () => {
  it('joystick keeps non-zero vector AND button fires press when both are operated (fail-old: both broken)', () => {
    renderJoystick();
    const onLayout = findProp<(e: unknown) => void>('onLayout');
    onLayout?.({ nativeEvent: { layout: { width: 100, height: 100 } } });
    const onGrant = findProp<(e: unknown) => void>('onResponderGrant');
    const onTerminationRequest = findProp<() => boolean>('onResponderTerminationRequest');

    onGrant?.({ nativeEvent: { locationX: 80, locationY: 50 } });
    const joystickOffsetAfterGrant = capturedJoystickState?.offset.x ?? 0;

    const joystickRefused = onTerminationRequest?.() === false;

    renderButton();
    const onTouchStart = findProp<() => void>('onTouchStart');
    onTouchStart?.();

    expect(joystickOffsetAfterGrant).not.toBe(0);
    expect(joystickRefused).toBe(true);
    expect(capturedButtonState?.pressed).toBe(true);
  });
});
