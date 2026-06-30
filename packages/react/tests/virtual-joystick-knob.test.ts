import { describe, expect, it, mock } from 'bun:test';

// This file runs last alphabetically. Its mock.module calls override the
// no-op useState / @flare-engine/input stubs set by safe-area.test.ts and
// virtual-controls.test.ts. Bun's module registry is last-writer-wins.

// Controlled stub for @flare-engine/input — tests component wiring, not math.
// updateJoystick sets offset = (touchX - centerX, touchY - centerY) so
// the exact output is predictable without re-implementing the real algorithm.
mock.module('@flare-engine/input', () => ({
  createJoystickState: () => ({
    active: false,
    direction: { x: 0, y: 0 },
    magnitude: 0,
    offset: { x: 0, y: 0 },
  }),
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
}));

// Captured setKnob setter from the real useState call.
let capturedSetKnob:
  | ((updater: (prev: { x: number; y: number }) => { x: number; y: number }) => void)
  | null = null;
// Stable ref objects keyed by call order — useRef must return the SAME object
// across re-invocations of the component function so sizeRef.current persists.
const refStore: Array<{ current: unknown }> = [];
let refCallCount = 0;

mock.module('react', () => ({
  useRef(init: unknown) {
    const idx = refCallCount++;
    if (!refStore[idx]) refStore[idx] = { current: init };
    return refStore[idx];
  },
  useState(init: unknown) {
    const value = typeof init === 'function' ? (init as () => unknown)() : init;
    const setter = (updater: unknown) => {
      capturedSetKnob = updater as typeof capturedSetKnob;
    };
    return [value, setter];
  },
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
  useEffect: () => {},
}));

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

mock.module('react-native', () => ({
  View: 'View',
  StyleSheet: {
    create: (s: unknown) => s,
    absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  },
}));

// Import AFTER all mock.module registrations.
const { VirtualJoystick } = await import('../src/virtual-joystick.js');

function render(props: Parameters<typeof VirtualJoystick>[0] = {}): void {
  jsxCalls.length = 0;
  refCallCount = 0;
  VirtualJoystick(props);
}

// Extract a named prop handler from the captured JSX calls.
function findProp<T>(propName: string): T | undefined {
  for (const call of jsxCalls) {
    if (propName in call.props) return call.props[propName] as T;
  }
  return undefined;
}

describe('VirtualJoystick — real component wiring (Option B)', () => {
  it('handleTouch calls setKnob with a functional updater that returns stub offset', () => {
    render();

    // Fire onLayout so sizeRef.current is populated (center = w/2, h/2 = 50,50).
    const onLayout = findProp<(e: unknown) => void>('onLayout');
    expect(onLayout).toBeDefined();
    onLayout?.({ nativeEvent: { layout: { width: 100, height: 100 } } });

    // Reset to detect the call from handleTouch only.
    capturedSetKnob = null;

    // Fire onResponderMove with touch at (80,50) → stub sets offset.x = 80-50 = 30.
    const onResponderMove = findProp<(e: unknown) => void>('onResponderMove');
    expect(onResponderMove).toBeDefined();
    onResponderMove?.({ nativeEvent: { locationX: 80, locationY: 50 } });

    // The real component must have called setKnob.
    expect(capturedSetKnob).not.toBeNull();

    // Apply the functional updater to the initial knob {x:0,y:0}.
    const updater = capturedSetKnob as unknown as (prev: { x: number; y: number }) => {
      x: number;
      y: number;
    };
    const next = updater({ x: 0, y: 0 });
    expect(next.x).toBe(30);
    expect(next.y).toBe(0);
  });

  it('setKnob updater is identity when knob already matches offset (no redundant render)', () => {
    render();
    const onLayout = findProp<(e: unknown) => void>('onLayout');
    onLayout?.({ nativeEvent: { layout: { width: 100, height: 100 } } });

    onResponderMove_move(80, 50);

    const updater = capturedSetKnob as unknown as (prev: { x: number; y: number }) => {
      x: number;
      y: number;
    };
    const prev = { x: 30, y: 0 };
    expect(updater(prev)).toBe(prev);
  });

  it('handleRelease calls setKnob with an updater that returns {x:0,y:0}', () => {
    render();
    const onLayout = findProp<(e: unknown) => void>('onLayout');
    onLayout?.({ nativeEvent: { layout: { width: 100, height: 100 } } });

    // Move first so knob is non-zero.
    onResponderMove_move(80, 50);

    // Now release.
    capturedSetKnob = null;
    const onResponderRelease = findProp<() => void>('onResponderRelease');
    expect(onResponderRelease).toBeDefined();
    onResponderRelease?.();

    expect(capturedSetKnob).not.toBeNull();
    const updater = capturedSetKnob as unknown as (prev: { x: number; y: number }) => {
      x: number;
      y: number;
    };
    const result = updater({ x: 30, y: 0 });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('release updater is identity when knob is already at {x:0,y:0}', () => {
    render();
    const onLayout = findProp<(e: unknown) => void>('onLayout');
    onLayout?.({ nativeEvent: { layout: { width: 100, height: 100 } } });

    capturedSetKnob = null;
    const onResponderRelease = findProp<() => void>('onResponderRelease');
    onResponderRelease?.();

    const updater = capturedSetKnob as unknown as (prev: { x: number; y: number }) => {
      x: number;
      y: number;
    };
    const zero = { x: 0, y: 0 };
    expect(updater(zero)).toBe(zero);
  });

  it('onResponderGrant also calls setKnob (grant fires same handleTouch)', () => {
    render();
    const onLayout = findProp<(e: unknown) => void>('onLayout');
    onLayout?.({ nativeEvent: { layout: { width: 100, height: 100 } } });

    capturedSetKnob = null;
    const onResponderGrant = findProp<(e: unknown) => void>('onResponderGrant');
    expect(onResponderGrant).toBeDefined();
    onResponderGrant?.({ nativeEvent: { locationX: 70, locationY: 50 } });

    expect(capturedSetKnob).not.toBeNull();
    const updater = capturedSetKnob as unknown as (prev: { x: number; y: number }) => {
      x: number;
      y: number;
    };
    // center=50,50 → offset.x = 70-50 = 20
    const next = updater({ x: 0, y: 0 });
    expect(next.x).toBe(20);
  });

  it('onResponderTerminate also calls setKnob with release updater', () => {
    render();
    const onLayout = findProp<(e: unknown) => void>('onLayout');
    onLayout?.({ nativeEvent: { layout: { width: 100, height: 100 } } });

    onResponderMove_move(80, 50);
    capturedSetKnob = null;

    const onResponderTerminate = findProp<() => void>('onResponderTerminate');
    expect(onResponderTerminate).toBeDefined();
    onResponderTerminate?.();

    expect(capturedSetKnob).not.toBeNull();
    const updater = capturedSetKnob as unknown as (prev: { x: number; y: number }) => {
      x: number;
      y: number;
    };
    const result = updater({ x: 30, y: 0 });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});

// Helper — fires onResponderMove from the last render() call.
function onResponderMove_move(locationX: number, locationY: number): void {
  const handler = findProp<(e: unknown) => void>('onResponderMove');
  handler?.({ nativeEvent: { locationX, locationY } });
}
