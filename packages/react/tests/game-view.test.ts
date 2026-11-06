import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// Symbol.dispose runtime lookup — mirrors the pattern in scene-texture.ts.
const DISPOSE = (Symbol as unknown as { dispose?: symbol }).dispose;

// Collected cleanup fns from mocked useEffect — cleared before each test.
const _effectCleanups: Array<() => void> = [];

// Override viewport initial state for high-DPI tests. Set before mount(), reset in beforeEach.
let _viewportOverride: { w: number; h: number } | null = null;

// Override the passes state — when non-null the mocked useState hands this to
// GameView as the current `passes` value, so a mount renders a postfx tree
// directly (the mocked setter never re-renders). Reset in beforeEach.
let _passesOverride: readonly unknown[] | null = null;

// Every shared value the mocked useSharedValue created, in call order. GameView
// creates sceneImage first (game-view.tsx), so _sharedValues[0] is the scene
// texture the rendered tree must sample.
let _sharedValues: unknown[] = [];

// Controllable postfx-pass source — the mocked bridge.buildPostFxPasses returns
// _buildPasses() each frame, so a test can vary the chain between onPreRender ticks.
let _buildPasses: () => readonly unknown[] = () => [];
// Counts invocations of the passes-state setter (the per-frame gate under test)
// and captures the value handed to it, so tests assert WHAT propagates, not only WHEN.
let _setPassesCount = 0;
let _lastPasses: unknown = null;

// Reanimated shared value assignment tracking — set by the useSharedValue mock.
// _sharedValueSetCount increments on every sceneImage.value = img assignment.
let _sharedValueSetCount = 0;
let _sharedValueLastSet: unknown;

// makeNonTextureImage call tracking — incremented inside the MakeOffscreen stub's
// makeImageSnapshot return value, so tests can assert the GPU→CPU gating.
let _makeNonTextureImageCount = 0;

// Skia.Surface.MakeOffscreen call log — tracks how many offscreen surfaces were
// allocated and at what dimensions, and whether their dispose hooks ran.
let _makeOffscreenCalls: Array<{ width: number; height: number }> = [];
let _drawPictureCount = 0;
let _surfaceDisposeCount = 0;

// Controls what the mocked bridge's hasPostFxBinding() returns.
let _hasPostFxBinding = false;

// #60: controllable compiled-pass source for the web composite — the mocked
// bridge.compilePostFxPasses returns _compilePasses() and logs its args.
let _compilePasses: () => readonly unknown[] = () => [];
let _compilePassesCalls: unknown[][] = [];

// #60: the web compositor's footprint on the mocked Skia module — one Paint
// per compositor (disposed on unmount), one drawRect per pass on the offscreen
// surface's canvas.
let _paintCount = 0;
let _paintBlendModes: number[] = [];
let _paintDisposeCount = 0;
let _drawRectCount = 0;
let _drawRectLast: { x: number; y: number; width: number; height: number } | null = null;

// Captured console.warn messages — installed/cleared per test.
let _warnMessages: string[] = [];
let _origWarn: typeof console.warn | null = null;

// Captures the first container View's responder props so tests can call them directly.
// Populated during mount(); reset in beforeEach.
let _capturedContainerProps: Record<string, unknown> | null = null;

// Mock all external deps before import
mock.module('react', () => ({
  createElement: () => null,
  createContext: () => ({ Provider: 'Provider', Consumer: 'Consumer' }),
  useCallback: (fn: unknown) => fn,
  useContext: () => null,
  useRef: (init: unknown) => ({ current: init }),
  useMemo: (fn: () => unknown) => fn(),
  useEffect: (fn: () => undefined | (() => void)) => {
    const cleanup = fn();
    if (typeof cleanup === 'function') _effectCleanups.push(cleanup);
  },
  useState: (init: unknown) => {
    // If this is the viewportSize state (initial value has w/h), allow override.
    if (
      _viewportOverride !== null &&
      typeof init === 'object' &&
      init !== null &&
      'w' in (init as object) &&
      'h' in (init as object)
    ) {
      return [_viewportOverride, () => {}];
    }
    // The passes state is the only useState seeded with an array (EMPTY_PASSES);
    // count its setter's invocations so tests can assert the per-frame gate.
    if (Array.isArray(init)) {
      return [
        _passesOverride ?? init,
        (val: unknown) => {
          _setPassesCount++;
          _lastPasses = val;
        },
      ];
    }
    return [typeof init === 'function' ? (init as () => unknown)() : init, () => {}];
  },
}));
// A rendered element as the mocked jsx runtime records it: the component (a
// string for every mocked Skia / RN component) plus its props, children included.
interface El {
  type: unknown;
  props: Record<string, unknown>;
  key: unknown;
}

function recordElement(type: unknown, props: Record<string, unknown> | null, key?: unknown): El {
  if (
    _capturedContainerProps === null &&
    type === 'View' &&
    props !== null &&
    'onStartShouldSetResponder' in props
  ) {
    _capturedContainerProps = props;
  }
  return { type, props: props ?? {}, key };
}

const jsxMock = {
  jsx: recordElement,
  jsxs: recordElement,
  jsxDEV: recordElement,
  Fragment: null,
};
mock.module('react/jsx-runtime', () => jsxMock);
mock.module('react/jsx-dev-runtime', () => jsxMock);

let _mockPixelRatio = 1;
let _mockPlatformOS = 'ios';

mock.module('react-native', () => ({
  View: 'View',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
  PixelRatio: { get: () => _mockPixelRatio },
  // GameView branches both scene-capture and postfx-pass paths on Platform.OS.
  // Tests that exercise the web path set _mockPlatformOS = 'web' before mount.
  Platform: {
    get OS() {
      return _mockPlatformOS;
    },
  },
}));

mock.module('react-native-safe-area-context', () => ({
  SafeAreaInsetsContext: 'SafeAreaInsetsContext',
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

let _beginRecordingBounds: Array<{ width: number; height: number }> = [];
let _beginFramePdArgs: number[] = [];
const _beginFrameTimeArgs: number[] = [];

// XR-1c: which thread the native scene capture runs on. Set by the reanimated mock.
let _runOnUICount = 0;
let _runOnUIDispatchCount = 0;
let _runOnUILastFn: unknown = null;
let _runOnUILastArgs: unknown[] = [];

mock.module('react-native-reanimated', () => ({
  useSharedValue: (init: unknown) => {
    let _val = init;
    const sv = {
      get value() {
        return _val;
      },
      set value(v: unknown) {
        _val = v;
        _sharedValueSetCount++;
        _sharedValueLastSet = v;
      },
    };
    _sharedValues.push(sv);
    return sv;
  },
}));

// ADR-0002: the native capture dispatches through `scheduleOnUI` from
// react-native-worklets, not Reanimated's deprecated curried `runOnUI`. The
// real one hops to the UI thread, so the worklet body is deliberately NOT run
// here — the assertion is about which thread the capture is scheduled on, not
// what it draws.
//
// `scheduleOnUI(fn, ...args)` is a single call where `runOnUI(fn)(...args)` was
// two, so schedule-count and dispatch-count are now necessarily equal. Both are
// still tracked: `_runOnUIDispatchCount` is what the per-frame tests assert, and
// keeping `_runOnUICount` beside it means a regression back to a curried,
// per-frame-allocating form shows up as the two diverging rather than silently
// passing.
mock.module('react-native-worklets', () => ({
  scheduleOnUI: (fn: unknown, ...args: unknown[]) => {
    _runOnUICount++;
    _runOnUIDispatchCount++;
    _runOnUILastFn = fn;
    _runOnUILastArgs = args;
  },
}));

mock.module('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Image: 'Image',
  ImageShader: 'ImageShader',
  Rect: 'Rect',
  RuntimeShader: 'RuntimeShader',
  Shader: 'Shader',
  FilterMode: { Nearest: 0, Linear: 1 },
  MipmapMode: { None: 0, Nearest: 1, Linear: 2 },
  useCanvasRef: () => ({ current: { redraw: () => {} } }),
  Skia: {
    Surface: {
      MakeOffscreen: (width: number, height: number) => {
        _makeOffscreenCalls.push({ width, height });
        const surface: Record<string, unknown> = {
          getCanvas: () => ({
            drawPicture: () => {
              _drawPictureCount++;
            },
            drawRect: (rect: { x: number; y: number; width: number; height: number }) => {
              _drawRectCount++;
              _drawRectLast = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            },
          }),
          flush: () => {},
          makeImageSnapshot: () => {
            const snapshot: Record<string | symbol, unknown> = {
              kind: 'snapshot',
              makeNonTextureImage: () => {
                _makeNonTextureImageCount++;
                return {};
              },
              makeShaderOptions: () => {
                const shader: Record<string | symbol, unknown> = {
                  kind: 'srcShader',
                  from: snapshot,
                };
                if (DISPOSE !== undefined) shader[DISPOSE] = () => {};
                return shader;
              },
            };
            if (DISPOSE !== undefined) snapshot[DISPOSE] = () => {};
            return snapshot;
          },
        };
        if (DISPOSE !== undefined) {
          (surface as unknown as Record<symbol, unknown>)[DISPOSE] = () => {
            _surfaceDisposeCount++;
          };
        }
        return surface;
      },
    },
    XYWHRect: (x: number, y: number, w: number, h: number) => {
      const r = {
        x,
        y,
        width: w,
        height: h,
        setXYWH(nx: number, ny: number, nw: number, nh: number) {
          r.x = nx;
          r.y = ny;
          r.width = nw;
          r.height = nh;
        },
      };
      return r;
    },
    RSXform: () => ({ set: () => {} }),
    Paint: () => {
      _paintCount++;
      const paint: Record<string | symbol, unknown> = {
        setColorFilter: () => {},
        setShader: () => {},
        setAlphaf: () => {},
        setColor: () => {},
        setImageFilter: () => {},
        setBlendMode: (mode: number) => {
          _paintBlendModes.push(mode);
        },
      };
      if (DISPOSE !== undefined) {
        paint[DISPOSE] = () => {
          _paintDisposeCount++;
        };
      }
      return paint;
    },
    PictureRecorder: () => ({
      beginRecording: (bounds: { width: number; height: number }) => {
        if (bounds !== undefined) {
          _beginRecordingBounds.push({ width: bounds.width, height: bounds.height });
        }
        return {
          save: () => 0,
          restore: () => {},
          translate: () => {},
          scale: (sx: number) => {
            _beginFramePdArgs.push(sx);
          },
          rotate: () => {},
          clear: () => {},
          drawAtlas: () => {},
        };
      },
      finishRecordingAsPicture: () => ({}),
    }),
  },
}));

interface Signal<T> {
  add(fn: (v: T) => void): () => void;
  _handler: ((v: T) => void) | null;
  _unsubscribed: boolean;
}

function makeSignal<T>(): Signal<T> {
  const s: Signal<T> = {
    _handler: null,
    _unsubscribed: false,
    add(fn) {
      s._handler = fn;
      return () => {
        s._unsubscribed = true;
      };
    },
  };
  return s;
}

let _loopInstance: MockLoop | null = null;

class MockLoop {
  onPreRender = makeSignal<void>();
  onLateUpdate = makeSignal<number>();
  onUpdate = makeSignal<number>();
  clock = { elapsed: 0 };
  start = () => {
    this._started = true;
  };
  stop = () => {
    this._started = false;
  };
  _started = false;
}

mock.module('@flare-engine/core', () => ({
  GameLoop: class extends MockLoop {
    constructor() {
      super();
      _loopInstance = this;
    }
  },
}));

mock.module('@flare-engine/ecs', () => ({
  World: class {
    query(..._defs: unknown[]): unknown {
      return { [Symbol.iterator]: () => [][Symbol.iterator]() };
    }
  },
  Position: { id: 0, bit: 1, name: 'Position', create: () => ({ x: 0, y: 0 }) },
  // Stubs required so downstream packages (render/dist) can link { defineComponent }
  // without a SyntaxError when this mock is the first ecs cache entry.
  defineComponent: () => ({}),
  definePrefab: () => ({}),
  defineSystem: () => ({}),
  _resetComponentIds: () => {},
}));

let _cameraInstance: MockCamera2D | null = null;

class MockCamera2D {
  x = 0;
  y = 0;
  effectiveX = 0;
  effectiveY = 0;
  zoom = 1;
  rotation = 0;
  viewportWidth = 0;
  viewportHeight = 0;
  setViewportCalls: Array<{ w: number; h: number }> = [];
  updateCalls: number[] = [];
  setViewport(w: number, h: number): void {
    this.viewportWidth = w;
    this.viewportHeight = h;
    this.setViewportCalls.push({ w, h });
  }
  update(dt: number): void {
    this.updateCalls.push(dt);
  }
}

interface RendererCall {
  op: 'begin' | 'end' | 'applyCamera' | 'setCanvas' | 'flush';
  args?: readonly unknown[];
}

let _rendererInstance: MockRenderer | null = null;

class MockRenderer {
  calls: RendererCall[] = [];
  setCanvas(c: unknown): void {
    this.calls.push({ op: 'setCanvas', args: [c] });
  }
  begin(clearColor: number): void {
    this.calls.push({ op: 'begin', args: [clearColor] });
  }
  end(): void {
    this.calls.push({ op: 'end' });
  }
  applyCamera(cx: number, cy: number, zoom: number, rot: number, vw: number, vh: number): void {
    this.calls.push({ op: 'applyCamera', args: [cx, cy, zoom, rot, vw, vh] });
  }
}

let _batchInstance: MockBatch | null = null;

class MockBatch {
  flushCalls = 0;
  renderer: MockRenderer | null = null;
  flush(_drawAtlas: unknown, renderer: MockRenderer): void {
    this.flushCalls++;
    this.renderer = renderer;
    renderer.calls.push({ op: 'flush' });
  }
}

mock.module('@flare-engine/render', () => ({
  Camera2D: class extends MockCamera2D {
    constructor() {
      super();
      _cameraInstance = this;
    }
  },
  Renderer: class extends MockRenderer {
    constructor() {
      super();
      _rendererInstance = this;
    }
  },
  SpriteBatch: class extends MockBatch {
    constructor() {
      super();
      _batchInstance = this;
    }
  },
  flashIntensity: (effect: { duration: number; elapsed: number }) => {
    if (effect.duration <= 0) return 0;
    return Math.max(0, 1 - effect.elapsed / effect.duration);
  },
  Sprite: { id: 1, bit: 2, name: 'Sprite', create: () => ({}) },
  createRenderSystem: () => () => {},
  createFrameRenderer: (skia: {
    XYWHRect: (
      x: number,
      y: number,
      w: number,
      h: number,
    ) => {
      setXYWH: (x: number, y: number, w: number, h: number) => void;
    };
    PictureRecorder: () => {
      beginRecording: (b: unknown) => { scale: (sx: number, sy: number) => void };
      finishRecordingAsPicture: () => unknown;
    };
    Paint: () => unknown;
    RSXform: () => unknown;
    ColorFilter: unknown;
  }) => {
    const recorder = skia.PictureRecorder();
    const bounds = skia.XYWHRect(0, 0, 0, 0);
    let cur: { scale: (sx: number, sy: number) => void } | null = null;
    const canvas = {
      save: () => 0,
      restore: () => {},
      translate: () => {},
      scale: (sx: number, sy: number) => {
        cur?.scale(sx, sy);
      },
      rotate: () => {},
      clear: () => {},
    };
    return {
      canvas,
      beginFrame: (w: number, h: number, t = 0, pd = 1) => {
        _beginFrameTimeArgs.push(t);
        if (w === 0 || h === 0) return;
        bounds.setXYWH(0, 0, w * pd, h * pd);
        cur = recorder.beginRecording(bounds);
        if (pd !== 1) cur.scale(pd, pd);
      },
      drawAtlas: () => {},
      buildPostFxPasses: () => _buildPasses(),
      compilePostFxPasses: (...args: unknown[]) => {
        _compilePassesCalls.push(args);
        return _compilePasses();
      },
      setPostFxBinding: () => {},
      hasPostFxBinding: () => _hasPostFxBinding,
      endFrame: () => {
        if (cur === null) return null;
        cur = null;
        return recorder.finishRecordingAsPicture();
      },
    };
  },
  WATER_SKSL: '',
  FOG_SKSL: '',
  FIRE_SKSL: '',
  ROOFS_CITY_SKSL: '',
  FOREST_CANOPY_SKSL: '',
  RIVER_WAVE_SKSL: '',
  MOON_CRATER_SKSL: '',
  CAVE_INTERIOR_SKSL: '',
  MOUNTAIN_HILLS_SKSL: '',
  fire: () => ({ type: 'fire', color: {}, tipColor: {}, speed: 1, intensity: 0.8 }),
}));

mock.module('@flare-engine/audio', () => ({
  AudioManager: class {},
}));

let _inputInstance: MockInput | null = null;

class MockInput {
  updateCalls = 0;
  pointerDownCalls: Array<{ id: number; x: number; y: number }> = [];
  pointerMoveCalls: Array<{ id: number; x: number; y: number }> = [];
  pointerUpCalls: Array<{ id: number; x: number; y: number }> = [];
  touches: Array<{ id: number }> = [];

  update(): void {
    this.updateCalls++;
  }

  onPointerDown(id: number, x: number, y: number): void {
    this.pointerDownCalls.push({ id, x, y });
    if (!this.touches.some((t) => t.id === id)) {
      this.touches.push({ id });
    }
  }

  onPointerMove(id: number, x: number, y: number): void {
    this.pointerMoveCalls.push({ id, x, y });
    if (!this.touches.some((t) => t.id === id)) {
      this.touches.push({ id });
    }
  }

  onPointerUp(id: number, _x: number, _y: number): void {
    this.pointerUpCalls.push({ id, x: _x, y: _y });
    const idx = this.touches.findIndex((t) => t.id === id);
    if (idx !== -1) this.touches.splice(idx, 1);
  }
}

mock.module('@flare-engine/input', () => ({
  InputManager: class extends MockInput {
    constructor() {
      super();
      _inputInstance = this;
    }
  },
  createJoystickState: () => ({ active: false, offset: { x: 0, y: 0 }, pointerId: null }),
  releaseJoystick: (s: unknown) => s,
  updateJoystick: (s: unknown) => s,
  createButtonState: () => ({ pressed: false, justPressed: false, justReleased: false }),
  pressButton: (s: unknown) => s,
  releaseButton: (s: unknown) => s,
  resetButtonFrame: (s: unknown) => s,
}));

mock.module('@flare-engine/assets', () => ({
  AssetManager: class {},
}));

mock.module('@flare-engine/scene', () => ({
  SceneManager: class {},
}));

const reactModule = await import('../src/game-view.js');

function mount(props: Parameters<typeof reactModule.GameView>[0] = {}): unknown {
  return reactModule.GameView(props);
}

function unmountAll(): void {
  while (_effectCleanups.length > 0) {
    const fn = _effectCleanups.pop();
    fn?.();
  }
}

beforeEach(() => {
  _effectCleanups.length = 0;
  _loopInstance = null;
  _hasPostFxBinding = false;
  _warnMessages = [];
  _origWarn = console.warn;
  console.warn = (...args: Parameters<typeof console.warn>) => {
    _warnMessages.push(String(args[0]));
  };
  _cameraInstance = null;
  _rendererInstance = null;
  _batchInstance = null;
  _inputInstance = null;
  _capturedContainerProps = null;
  _mockPixelRatio = 1;
  _mockPlatformOS = 'ios';
  _viewportOverride = null;
  _passesOverride = null;
  _sharedValues = [];
  _beginRecordingBounds = [];
  _beginFramePdArgs = [];
  _buildPasses = () => [];
  _compilePasses = () => [];
  _compilePassesCalls = [];
  _paintCount = 0;
  _paintBlendModes = [];
  _paintDisposeCount = 0;
  _drawRectCount = 0;
  _drawRectLast = null;
  _setPassesCount = 0;
  _lastPasses = null;
  _beginFrameTimeArgs.length = 0;
  _sharedValueSetCount = 0;
  _sharedValueLastSet = null;
  _makeNonTextureImageCount = 0;
  _makeOffscreenCalls = [];
  _drawPictureCount = 0;
  _surfaceDisposeCount = 0;
  _runOnUICount = 0;
  _runOnUIDispatchCount = 0;
  _runOnUILastFn = null;
  _runOnUILastArgs = [];
});

afterEach(() => {
  if (_origWarn !== null) {
    console.warn = _origWarn;
    _origWarn = null;
  }
});

describe('GameView', () => {
  it('exports GameView as a function', () => {
    expect(typeof reactModule.GameView).toBe('function');
  });

  it('creates GameContextValue via useMemo on construction', () => {
    mount();
    expect(_loopInstance).not.toBeNull();
    expect(_cameraInstance).not.toBeNull();
    expect(_rendererInstance).not.toBeNull();
    expect(_batchInstance).not.toBeNull();
    unmountAll();
  });
});

describe('GameView — camera wiring', () => {
  it('subscribes to onLateUpdate and forwards dt to camera.update', () => {
    mount();
    const loop = _loopInstance!;
    const camera = _cameraInstance!;

    expect(loop.onLateUpdate._handler).not.toBeNull();
    loop.onLateUpdate._handler?.(0.016);
    loop.onLateUpdate._handler?.(0.032);

    expect(camera.updateCalls).toEqual([0.016, 0.032]);
    unmountAll();
  });

  it('onPreRender calls renderer in order: begin → applyCamera → flush → end', () => {
    mount();
    const loop = _loopInstance!;
    const renderer = _rendererInstance!;
    const batch = _batchInstance!;

    loop.onPreRender._handler?.();

    const ops = renderer.calls.map((c) => c.op);
    const beginIdx = ops.indexOf('begin');
    const applyIdx = ops.indexOf('applyCamera');
    const flushIdx = ops.indexOf('flush');
    const endIdx = ops.indexOf('end');
    expect(beginIdx).toBeGreaterThanOrEqual(0);
    expect(applyIdx).toBeGreaterThan(beginIdx);
    expect(flushIdx).toBeGreaterThan(applyIdx);
    expect(endIdx).toBeGreaterThan(flushIdx);
    expect(batch.flushCalls).toBe(1);
    unmountAll();
  });

  it('applyCamera receives camera.effectiveX/Y (shake-inclusive), not raw x/y', () => {
    mount();
    const camera = _cameraInstance!;
    const renderer = _rendererInstance!;

    camera.x = 10;
    camera.y = 20;
    camera.effectiveX = 15;
    camera.effectiveY = 25;
    camera.zoom = 2;
    camera.rotation = 0.5;
    camera.viewportWidth = 800;
    camera.viewportHeight = 600;

    _loopInstance!.onPreRender._handler?.();

    const applyCall = renderer.calls.find((c) => c.op === 'applyCamera');
    expect(applyCall?.args).toEqual([15, 25, 2, 0.5, 800, 600]);
    unmountAll();
  });

  it('cleanup unsubscribes onLateUpdate and onPreRender', () => {
    mount();
    const loop = _loopInstance!;
    expect(loop.onLateUpdate._unsubscribed).toBe(false);
    expect(loop.onPreRender._unsubscribed).toBe(false);

    unmountAll();

    expect(loop.onLateUpdate._unsubscribed).toBe(true);
    expect(loop.onPreRender._unsubscribed).toBe(true);
    expect(loop._started).toBe(false);
  });
});

describe('GameView — input wiring', () => {
  it('calls input.update() once per onLateUpdate tick', () => {
    mount();
    const loop = _loopInstance!;
    const input = _inputInstance!;

    loop.onLateUpdate._handler?.(0.016);
    loop.onLateUpdate._handler?.(0.016);

    expect(input.updateCalls).toBe(2);
    unmountAll();
  });
});

describe('GameView — PostFxRenderHook', () => {
  it('onRenderPostFx receives bridge as 3rd argument', () => {
    const received: unknown[] = [];
    mount({
      config: {
        onRenderPostFx: (_ctx, _canvas, bridge) => {
          received.push(bridge);
        },
      },
    });
    _loopInstance!.onPreRender._handler?.();
    expect(received).toHaveLength(1);
    expect(received[0]).not.toBeNull();
    unmountAll();
  });

  it('bridge passed to onRenderPostFx exposes setPostFxBinding method', () => {
    let capturedBridge: unknown;
    mount({
      config: {
        onRenderPostFx: (_ctx, _canvas, bridge) => {
          capturedBridge = bridge;
        },
      },
    });
    _loopInstance!.onPreRender._handler?.();
    expect(typeof (capturedBridge as { setPostFxBinding?: unknown })?.setPostFxBinding).toBe(
      'function',
    );
    unmountAll();
  });

  it('bridge passed to onRenderPostFx exposes buildPostFxPasses method', () => {
    let capturedBridge: unknown;
    mount({
      config: {
        onRenderPostFx: (_ctx, _canvas, bridge) => {
          capturedBridge = bridge;
        },
      },
    });
    _loopInstance!.onPreRender._handler?.();
    expect(typeof (capturedBridge as { buildPostFxPasses?: unknown })?.buildPostFxPasses).toBe(
      'function',
    );
    unmountAll();
  });

  it('no-op when onRenderPostFx is absent — onPreRender does not throw', () => {
    mount({ config: {} });
    expect(() => _loopInstance!.onPreRender._handler?.()).not.toThrow();
    unmountAll();
  });
});

describe('GameView — high-DPI scene texture', () => {
  it('native: capture is dispatched at physical pixels — PixelRatio=2, 400×600 → 800×1200', () => {
    // Since XR-1c the native surface is built inside the UI-thread worklet, so
    // the physical-pixel size is asserted on the dispatch arguments rather than
    // on MakeOffscreen (which no longer runs on this thread).
    _mockPlatformOS = 'ios';
    _mockPixelRatio = 2;
    _viewportOverride = { w: 400, h: 600 };
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 400;
    camera.viewportHeight = 600;
    tick();
    expect(_runOnUILastArgs[4]).toBe(800);
    expect(_runOnUILastArgs[5]).toBe(1200);
    unmountAll();
  });

  it('web: capture uses physical pixels — PixelRatio=2, layout=400×600 → MakeOffscreen at 800×1200', () => {
    _mockPlatformOS = 'web';
    _mockPixelRatio = 2;
    _viewportOverride = { w: 400, h: 600 };
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 400;
    camera.viewportHeight = 600;
    tick();
    expect(_makeOffscreenCalls[0]).toEqual({ width: 800, height: 1200 });
    unmountAll();
  });

  it('beginFrame is called with pixelDensity=2 as 4th arg (recording bounds at physical res)', () => {
    _mockPixelRatio = 2;
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 400;
    camera.viewportHeight = 600;
    _beginRecordingBounds.length = 0;
    _beginFramePdArgs.length = 0;
    _loopInstance!.onPreRender._handler?.();
    // bounds should be 800×1200
    const bounds = _beginRecordingBounds[0];
    expect(bounds).toBeDefined();
    expect(bounds?.width).toBe(800);
    expect(bounds?.height).toBe(1200);
    // scale(2, 2) baked into the recording
    expect(_beginFramePdArgs[0]).toBe(2);
    unmountAll();
  });

  it('rendered tree contains no Picture node (Picture import removed)', () => {
    // If <Picture> were referenced, the mock would need 'Picture' exported.
    // The game-view mock intentionally omits it; importing it would throw.
    // We verify indirectly: mounting must not throw even though 'Picture' is absent from mock.
    expect(() => mount()).not.toThrow();
    unmountAll();
  });
});

// ---------------------------------------------------------------------------
// Per-frame postfx pass churn — the setPasses gate.
// Frames are driven by invoking the onPreRender handler directly; each tick
// pulls a fresh chain from _buildPasses. _setPassesCount records how many times
// the passes-state setter is actually invoked, so an unchanged/empty chain must
// leave it at zero after the first push.
// ---------------------------------------------------------------------------

interface TestPass {
  id: string;
  source: object;
  uniforms: Record<string, number | readonly number[]>;
  children: readonly unknown[];
}

function makePass(
  id: string,
  source: object,
  uniforms: Record<string, number | readonly number[]> = {},
  children: readonly unknown[] = [],
): TestPass {
  return { id, source, uniforms, children };
}

function tick(): void {
  _loopInstance!.onPreRender._handler?.();
}

describe('GameView — postfx pass gate (per-frame churn)', () => {
  it('unchanged non-empty chain: setPasses fires once across frames (fail-old: fired every frame)', () => {
    const shader = {};
    // Fresh array + fresh pass/uniform objects each frame — proves the gate is
    // structural, not reference identity.
    _buildPasses = () => [makePass('flash', shader, { intensity: 1 })];
    mount();
    tick();
    tick();
    tick();
    expect(_setPassesCount).toBe(1);
    unmountAll();
  });

  it('empty chain: setPasses never fires (fail-old: fired every frame with a fresh [])', () => {
    _buildPasses = () => [];
    mount();
    tick();
    tick();
    tick();
    expect(_setPassesCount).toBe(0);
    unmountAll();
  });

  it('changed uniform with constant id+source propagates (hit-flash decay guard)', () => {
    // Same pass id + same shader ref, only the intensity uniform animates —
    // exactly the flash-decay / timed-trigger shape. An id+source-only signature
    // would freeze here (count stuck at 1); uniforms must be part of the gate.
    const shader = {};
    let intensity = 1;
    _buildPasses = () => [makePass('flash', shader, { intensity })];
    mount();
    tick(); // empty -> [flash@1] : 1
    intensity = 0.5;
    tick(); // uniform changed : 2
    intensity = 0;
    tick(); // uniform changed : 3
    expect(_setPassesCount).toBe(3);
    unmountAll();
  });

  it('changed vector uniform propagates; a structurally identical vector does not', () => {
    const shader = {};
    let color: readonly number[] = [1, 0, 0];
    _buildPasses = () => [makePass('vignette', shader, { color })];
    mount();
    tick(); // empty -> [vignette] : 1
    color = [1, 0, 0]; // new array ref, identical elements
    tick(); // no change : 1
    color = [0, 1, 0]; // one element differs
    tick(); // change : 2
    expect(_setPassesCount).toBe(2);
    unmountAll();
  });

  it('changed shader source ref propagates (shader recompile)', () => {
    let shader: object = {};
    _buildPasses = () => [makePass('x', shader, { a: 1 })];
    mount();
    tick(); // 1
    shader = {}; // new compiled-effect ref, same id + uniforms
    tick(); // 2
    expect(_setPassesCount).toBe(2);
    unmountAll();
  });

  it('changed pass id propagates', () => {
    const shader = {};
    let id = 'a';
    _buildPasses = () => [makePass(id, shader, {})];
    mount();
    tick(); // 1
    id = 'b';
    tick(); // 2
    expect(_setPassesCount).toBe(2);
    unmountAll();
  });

  it('length transitions both directions propagate; steady stretches are silent (fail-old: 5 fires)', () => {
    const shader = {};
    let has = false;
    _buildPasses = () => (has ? [makePass('x', shader, { a: 1 })] : []);
    mount();
    tick(); // empty -> empty : 0
    has = true;
    tick(); // empty -> [x] : 1
    tick(); // [x] -> [x] : 1
    has = false;
    tick(); // [x] -> empty : 2
    tick(); // empty -> empty : 2
    expect(_setPassesCount).toBe(2);
    unmountAll();
  });

  it('a second pass appended (length grows) propagates', () => {
    const a = {};
    const b = {};
    let two = false;
    _buildPasses = () =>
      two ? [makePass('a', a, {}), makePass('b', b, {})] : [makePass('a', a, {})];
    mount();
    tick(); // 1
    two = true;
    tick(); // length 1 -> 2 : 2
    tick(); // unchanged : 2
    expect(_setPassesCount).toBe(2);
    unmountAll();
  });

  it('propagates the actual built chain (not a stale or empty value) — payload, not just timing', () => {
    // Guards a value-level regression that keeps the count identical but pushes
    // the wrong array (e.g. setPasses(EMPTY_PASSES) instead of the built chain).
    const shader = {};
    let intensity = 1;
    _buildPasses = () => [makePass('flash', shader, { intensity })];
    mount();
    tick();
    const first = _lastPasses as readonly TestPass[];
    expect(first).toHaveLength(1);
    expect(first[0]?.id).toBe('flash');
    expect(first[0]?.source).toBe(shader);
    expect(first[0]?.uniforms.intensity).toBe(1);
    intensity = 0.5;
    tick();
    expect((_lastPasses as readonly TestPass[])[0]?.uniforms.intensity).toBe(0.5);
    unmountAll();
  });

  it('collapses an empty chain to one stable reference (not a fresh [] each frame)', () => {
    // The collapse frame must push the shared EMPTY_PASSES constant, so two
    // independent clears push the *same* reference — a fresh [] would differ.
    const shader = {};
    let has = true;
    _buildPasses = () => (has ? [makePass('x', shader, {})] : []);
    mount();
    tick(); // -> [x]
    has = false;
    tick(); // -> empty
    const firstEmpty = _lastPasses;
    expect(firstEmpty).toHaveLength(0);
    has = true;
    tick(); // -> [x]
    has = false;
    tick(); // -> empty again
    expect(_lastPasses).toBe(firstEmpty);
    unmountAll();
  });

  it('child-image list is part of the signature: identical is silent, changed ref or length fires', () => {
    // Exercises sameChildren in all three branches. A sameChildren that ignores
    // refs (or always returns true) would miss the ref/length changes below.
    const shader = {};
    const imgA = {};
    let children: readonly unknown[] = [imgA];
    _buildPasses = () => [makePass('lut', shader, { a: 1 }, children)];
    mount();
    tick(); // empty -> [lut] : 1
    children = [imgA]; // new array ref, identical member
    tick(); // : 1
    children = [{}]; // member ref changed
    tick(); // : 2
    children = [imgA, {}]; // length changed
    tick(); // : 3
    expect(_setPassesCount).toBe(3);
    unmountAll();
  });
});

describe('GameView — frame time forwarded to beginFrame', () => {
  it('beginFrame receives clock.elapsed not hardcoded 0', () => {
    mount();
    const loop = _loopInstance!;

    // With viewport non-zero (camera provides dimensions).
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;

    _beginFrameTimeArgs.length = 0;

    loop.clock.elapsed = 3.14;
    loop.onPreRender._handler?.();

    expect(_beginFrameTimeArgs.length).toBeGreaterThan(0);
    expect(_beginFrameTimeArgs[0]).toBe(3.14);
    unmountAll();
  });

  it('beginFrame time updates as clock advances across ticks', () => {
    mount();
    const loop = _loopInstance!;
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;

    _beginFrameTimeArgs.length = 0;

    loop.clock.elapsed = 1.0;
    loop.onPreRender._handler?.();
    loop.clock.elapsed = 2.0;
    loop.onPreRender._handler?.();

    expect(_beginFrameTimeArgs[0]).toBe(1.0);
    expect(_beginFrameTimeArgs[1]).toBe(2.0);
    unmountAll();
  });
});

// ---------------------------------------------------------------------------
// #60: postfx on web runs imperatively inside the scene capture.
//
// RN-Skia's declarative shader nodes cannot run on web (Skia.RuntimeShaderBuilder
// and ImageFilter.MakeRuntimeShaderWithChildren both throw "Not implemented on
// React Native Web"), so the old code (WEB-3/WEB-7) skipped the chain and warned
// once per instance. Now GameView compiles the bound chain at physical pixels
// (w*pd × h*pd — the surface's size, the space the pass rect is drawn in) and
// hands it to the capture, whose compositor draws each pass in place over the
// one offscreen surface before the snapshot. setPasses still never fires on
// web, so the tree stays the plain <Image> — the shape proven leak-free.
// ---------------------------------------------------------------------------

interface CompositeShaderCall {
  uniforms: unknown;
  children: unknown[];
}

/** A compiled pass whose shader records what the compositor hands it. The
 *  children array is copied at call time: the compositor reuses and nulls it. */
function makeCompiledPass(
  id: string,
  uniforms: Float32Array,
  children: readonly unknown[] = [],
): { pass: unknown; calls: CompositeShaderCall[] } {
  const calls: CompositeShaderCall[] = [];
  const shader = {
    makeShaderWithChildren: (u: unknown, c: unknown[]) => {
      calls.push({ uniforms: u, children: c.slice() });
      return { kind: 'passShader' };
    },
  };
  return { pass: { id, shader, uniforms, children }, calls };
}

describe('GameView — web postfx composite (#60)', () => {
  it('web + binding: composite receives the scene snapshot and the pass list, compiled at physical pixels (fail-old: nothing is called)', () => {
    _mockPlatformOS = 'web';
    _mockPixelRatio = 2;
    _hasPostFxBinding = true;
    const uniforms = new Float32Array([0.5, 800, 1200]);
    const { pass, calls } = makeCompiledPass('flash', uniforms);
    _compilePasses = () => [pass];
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 400;
    camera.viewportHeight = 600;

    tick();

    expect(_compilePassesCalls).toEqual([[null, null, 800, 1200]]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.uniforms).toBe(uniforms);
    expect(calls[0]!.children).toHaveLength(1);
    const src = calls[0]!.children[0] as { kind: string; from: { kind: string } };
    expect(src.kind).toBe('srcShader');
    expect(src.from.kind).toBe('snapshot');
    expect(_makeOffscreenCalls).toEqual([{ width: 800, height: 1200 }]);
    expect(_drawRectCount).toBe(1);
    expect(_drawRectLast).toEqual({ x: 0, y: 0, width: 800, height: 1200 });
    expect(_makeNonTextureImageCount).toBe(1);
    expect(_sharedValueSetCount).toBe(1);
    expect(_sharedValueLastSet).not.toBeNull();
    unmountAll();
  });

  it('web + binding: never warns, never pushes passes, and the tree is the plain <Image> of the scene texture', () => {
    _mockPlatformOS = 'web';
    _hasPostFxBinding = true;
    _viewportOverride = { w: 400, h: 600 };
    const { pass } = makeCompiledPass('flash', new Float32Array([1]));
    _compilePasses = () => [pass];
    _buildPasses = () => [makePass('flash', {}, { intensity: 1 })];
    const tree = mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 400;
    camera.viewportHeight = 600;

    tick();
    tick();
    tick();

    expect(_warnMessages.filter((m) => m.includes('postfx chain skipped'))).toHaveLength(0);
    expect(_warnMessages).toHaveLength(0);
    expect(_setPassesCount).toBe(0);
    expect(_drawRectCount).toBe(3);
    const image = findByType(tree, 'Image');
    expect(image).not.toBeNull();
    expect(image!.props.image).toBe(_sharedValues[0]);
    expect(flatChildren(image!).filter((k) => k.type === 'RuntimeShader')).toHaveLength(0);
    expect(findByType(tree, 'RuntimeShader')).toBeNull();
    expect(findByType(tree, 'Shader')).toBeNull();
    unmountAll();
  });

  it('web, no binding: compilePostFxPasses is not called, no shader is built, no warn', () => {
    _mockPlatformOS = 'web';
    _hasPostFxBinding = false;
    const { pass, calls } = makeCompiledPass('flash', new Float32Array([1]));
    _compilePasses = () => [pass];
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;

    tick();
    tick();
    tick();

    expect(_compilePassesCalls).toHaveLength(0);
    expect(calls).toHaveLength(0);
    expect(_drawRectCount).toBe(0);
    expect(_drawPictureCount).toBe(3);
    expect(_warnMessages).toHaveLength(0);
    unmountAll();
  });

  it('web, binding but an empty compiled chain: the capture still happens, nothing is drawn over it', () => {
    _mockPlatformOS = 'web';
    _hasPostFxBinding = true;
    _compilePasses = () => [];
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;

    tick();

    expect(_compilePassesCalls).toHaveLength(1);
    expect(_drawPictureCount).toBe(1);
    expect(_makeNonTextureImageCount).toBe(1);
    expect(_sharedValueSetCount).toBe(1);
    expect(_drawRectCount).toBe(0);
    unmountAll();
  });

  it('native with a binding: setPasses fires once (baseline), the web composite path is never taken', () => {
    _mockPlatformOS = 'ios';
    _hasPostFxBinding = true;
    const { pass, calls } = makeCompiledPass('flash', new Float32Array([1]));
    _compilePasses = () => [pass];
    _buildPasses = () => [makePass('flash', {}, { intensity: 1 })];
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;

    tick();

    expect(_setPassesCount).toBe(1);
    expect(_compilePassesCalls).toHaveLength(0);
    expect(calls).toHaveLength(0);
    expect(_drawRectCount).toBe(0);
    expect(_warnMessages).toHaveLength(0);
    unmountAll();
  });

  it('web: one Paint set to BlendMode.Src backs the compositor and unmount disposes it', () => {
    _mockPlatformOS = 'web';
    _hasPostFxBinding = true;
    const { pass } = makeCompiledPass('flash', new Float32Array([1]));
    _compilePasses = () => [pass];
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;

    tick();
    tick();
    tick();

    expect(_paintCount).toBe(1);
    expect(_paintBlendModes).toEqual([1]);
    expect(_paintDisposeCount).toBe(0);
    unmountAll();
    expect(_paintDisposeCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// WEB-6: scene capture driven from the frame callback, not a passive effect.
//
// The old reactive approach: onPreRender → setPicture(pic) → React render →
// useEffect keyed on [picture] → capture → setImage → React render.
// That setState-in-a-passive-effect cascade trips React's
// NESTED_PASSIVE_UPDATE_LIMIT (50) and logs "Maximum update depth exceeded"
// on every web load. It also costs two React renders per frame and delays the
// captured image by one hop.
//
// The new imperative approach: onPreRender → captureWebScene(pic, w*pd, h*pd)
// → capture → setImage (one render, no passive-effect chain).
// Native is unchanged: the else branch still calls setPicture(pic).
// ---------------------------------------------------------------------------

describe('GameView — web scene capture (WEB-6)', () => {
  it('web: each frame captures — 3 ticks produce 3 captures (fail-old: zero)', () => {
    // Old code: setPicture is a no-op in the mock, so picture stays null, the
    // passive effect never re-runs, and drawPicture is never called.
    // New code: captureWebScene is called directly in onPreRender each tick.
    _mockPlatformOS = 'web';
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;
    tick();
    tick();
    tick();
    expect(_drawPictureCount).toBe(3);
    unmountAll();
  });

  it('web: shared value assigned per frame — zero React renders (fail-old)', () => {
    // Old code: useWebSceneTexture called setImage (React state) each frame;
    // useSharedValue was never called → _sharedValueSetCount = 0 → assertion fails.
    // New code: sceneImage.value = img in onPreRender → _sharedValueSetCount = 3.
    _mockPlatformOS = 'web';
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;
    tick();
    tick();
    tick();
    expect(_sharedValueSetCount).toBe(3);
    unmountAll();
  });

  it('web: one offscreen surface across a long run', () => {
    // Proves the WEB-2 surface-reuse logic survives the new call path.
    // Old code: capture never fires → MakeOffscreen never called → length 0.
    // New code: surface cached at first capture → length 1 across 60 ticks.
    _mockPlatformOS = 'web';
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;
    for (let i = 0; i < 60; i++) tick();
    expect(_makeOffscreenCalls.length).toBe(1);
    unmountAll();
  });

  it('web: capture receives physical pixels', () => {
    // Guards w*pd replacing sceneSize: MakeOffscreen must be called with the
    // physical (DPR-scaled) viewport dimensions, not the logical CSS dimensions.
    // Old code: capture never fires → _makeOffscreenCalls[0] is undefined.
    _mockPlatformOS = 'web';
    _mockPixelRatio = 2;
    _viewportOverride = { w: 400, h: 600 };
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 400;
    camera.viewportHeight = 600;
    tick();
    expect(_makeOffscreenCalls[0]).toEqual({ width: 800, height: 1200 });
    unmountAll();
  });

  it('native: capture driven from the frame callback, once per tick (fail-old)', () => {
    // Old code (pre-XR-1a): native used setPicture + usePictureAsTexture, i.e. a
    // React render per frame and no frame-callback capture → 0 dispatches.
    // Since XR-1c the per-frame work is a UI-thread dispatch, so the assertion
    // moved off MakeOffscreen (which now runs on the UI thread, not here) onto
    // the dispatch count. The shared value is assigned inside the worklet, which
    // the mock deliberately does not execute, so it is not counted here either.
    _mockPlatformOS = 'ios';
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;
    tick();
    tick();
    tick();
    expect(_runOnUIDispatchCount).toBe(3);
    expect(_makeOffscreenCalls.length).toBe(0);
    unmountAll();
  });

  it('unmount releases the offscreen surface', () => {
    // Proves the mount-only dispose effect (captureRef.current?.dispose()) still
    // runs and releases the surface via Symbol.dispose.
    // Old code: capture never fires, no surface allocated → disposeCount stays 0.
    _mockPlatformOS = 'web';
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;
    tick();
    unmountAll();
    if (DISPOSE !== undefined) {
      expect(_surfaceDisposeCount).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// CW7-1: multi-touch routing through GameView's responder.
//
// GameView must route concurrent touches to InputManager with their real
// pointer identifiers — not hardcoded id 0. Two simultaneous touches must
// produce two distinct entries in InputManager.touches, and releasing one
// must leave the other intact.
//
// The container View's responder handlers are captured from the JSX via
// captureContainerView() above. Fail-old: pre-fix code always called
// onPointerDown/Move/Up with id=0, collapsing all touches to a single entry.
// ---------------------------------------------------------------------------

function makeTouch(identifier: string, locationX: number, locationY: number) {
  return { identifier, locationX, locationY, pageX: locationX, pageY: locationY };
}

function grantEvent(identifier: string, locationX: number, locationY: number) {
  return {
    nativeEvent: {
      identifier,
      locationX,
      locationY,
      changedTouches: [makeTouch(identifier, locationX, locationY)],
      touches: [makeTouch(identifier, locationX, locationY)],
    },
  };
}

function moveEvent(identifier: string, locationX: number, locationY: number) {
  return {
    nativeEvent: {
      identifier,
      locationX,
      locationY,
      changedTouches: [makeTouch(identifier, locationX, locationY)],
      touches: [makeTouch(identifier, locationX, locationY)],
    },
  };
}

function releaseEvent(identifier: string, locationX: number, locationY: number) {
  return {
    nativeEvent: {
      identifier,
      locationX,
      locationY,
      changedTouches: [makeTouch(identifier, locationX, locationY)],
      touches: [],
    },
  };
}

describe('GameView — multi-touch routing (CW7-1)', () => {
  it('onResponderGrant routes changedTouches to onPointerDown with real identifier (fail-old: always id 0)', () => {
    mount();
    const grant = _capturedContainerProps?.onResponderGrant as (e: unknown) => void;
    expect(grant).toBeDefined();

    grant(grantEvent('5', 80, 120));

    expect(_inputInstance?.pointerDownCalls).toEqual([{ id: 5, x: 80, y: 120 }]);
    unmountAll();
  });

  it('onResponderMove routes changedTouches to onPointerMove with real identifier (fail-old: always id 0)', () => {
    mount();
    const move = _capturedContainerProps?.onResponderMove as (e: unknown) => void;
    expect(move).toBeDefined();

    move(moveEvent('2', 40, 60));

    expect(_inputInstance?.pointerMoveCalls).toEqual([{ id: 2, x: 40, y: 60 }]);
    unmountAll();
  });

  it('onResponderRelease routes changedTouches to onPointerUp with real identifier (fail-old: always id 0)', () => {
    mount();
    const release = _capturedContainerProps?.onResponderRelease as (e: unknown) => void;
    expect(release).toBeDefined();

    release(releaseEvent('3', 10, 20));

    expect(_inputInstance?.pointerUpCalls).toEqual([{ id: 3, x: 10, y: 20 }]);
    unmountAll();
  });

  it('two concurrent touches produce distinct entries — not collapsed to id 0 (fail-old: both id 0)', () => {
    mount();
    const grant = _capturedContainerProps?.onResponderGrant as (e: unknown) => void;
    const move = _capturedContainerProps?.onResponderMove as (e: unknown) => void;

    grant(grantEvent('1', 50, 50));
    move(moveEvent('2', 200, 300));

    const input = _inputInstance!;
    expect(input.touches).toHaveLength(2);
    expect(input.touches.some((t) => t.id === 1)).toBe(true);
    expect(input.touches.some((t) => t.id === 2)).toBe(true);
    unmountAll();
  });

  it('releasing one touch leaves the other intact (fail-old: single id 0 entry removed for both)', () => {
    mount();
    const grant = _capturedContainerProps?.onResponderGrant as (e: unknown) => void;
    const move = _capturedContainerProps?.onResponderMove as (e: unknown) => void;
    const release = _capturedContainerProps?.onResponderRelease as (e: unknown) => void;

    grant(grantEvent('1', 50, 50));
    move(moveEvent('2', 200, 300));
    release(releaseEvent('1', 50, 50));

    const input = _inputInstance!;
    expect(input.touches).toHaveLength(1);
    expect(input.touches[0]?.id).toBe(2);
    unmountAll();
  });

  it('falls back to primary event identifier when changedTouches is empty', () => {
    mount();
    const grant = _capturedContainerProps?.onResponderGrant as (e: unknown) => void;
    grant({
      nativeEvent: {
        identifier: '7',
        locationX: 11,
        locationY: 22,
        changedTouches: [],
        touches: [],
      },
    });
    expect(_inputInstance?.pointerDownCalls).toEqual([{ id: 7, x: 11, y: 22 }]);
    unmountAll();
  });
});

// ---------------------------------------------------------------------------
// XR-1: shared-value scene capture — zero React renders, surface reuse, gating.
//
// Central claim: both platforms write frames into a Reanimated shared value
// (no React setState). The shared value mock's setter increments
// _sharedValueSetCount; useSharedValue never being called → count stays 0
// on old source, making assertions of N fail-old.
// ---------------------------------------------------------------------------

describe('GameView — XR-1c: the scene capture runs on the right thread', () => {
  // The regression these tests exist to prevent is invisible to assertions about
  // *what* the capture draws: XR-1a captured correctly and still rendered a black
  // frame on device, because it built the offscreen surface on the JS thread,
  // whose GL context the on-screen <Canvas> cannot sample. So these assert
  // *where* the work is scheduled. Device evidence: external-review §11.4b.

  it('native: the capture is dispatched to the UI thread (fail-old)', () => {
    // Old code (XR-1a): captured inline on the JS thread → runOnUI never called.
    _mockPlatformOS = 'ios';
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;
    tick();
    tick();
    tick();
    expect(_runOnUIDispatchCount).toBe(3);
    unmountAll();
  });

  it('native: no offscreen surface is built on the JS thread (fail-old)', () => {
    // The precise defect. XR-1a called MakeOffscreen here → 1; that surface
    // belongs to the JS thread's context and renders black.
    _mockPlatformOS = 'ios';
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;
    for (let i = 0; i < 60; i++) tick();
    expect(_makeOffscreenCalls.length).toBe(0);
    unmountAll();
  });

  it('native: a function — not an inline closure — is handed to runOnUI', () => {
    _mockPlatformOS = 'ios';
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;
    tick();
    tick();
    expect(typeof _runOnUILastFn).toBe('function');
    unmountAll();
  });

  // NOT asserted here, deliberately: that the shipped function still carries its
  // `'worklet'` directive. Bun's test transpile strips the directive from source
  // (observed 2026-09-01 — `String(fn)` shows a bare arrow), while tsup's output
  // keeps it, so any source-level assertion tests the transpiler rather than the
  // artifact and would fail while the artifact is correct. Reanimated only hops a
  // function to the UI thread if its Babel plugin saw that directive; lose it in
  // bundling and native silently returns to the black frame with every test here
  // still green. Guard it on `dist/index.mjs`, not from this file.

  it('native: makeNonTextureImage not called — no GPU→CPU readback', () => {
    // Forcing the readback also fixes the black frame, at a per-frame cost.
    // This asserts we took the threading fix, not the readback workaround.
    _mockPlatformOS = 'ios';
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;
    tick();
    tick();
    tick();
    expect(_makeNonTextureImageCount).toBe(0);
    unmountAll();
  });

  it('web: still captures on the JS thread — one context, no dispatch', () => {
    // Web has a single thread, so the JS-thread capture is same-context by
    // construction. This is the path WEB-1..WEB-7 verified in Chrome; the
    // native fix must not drag it onto a dispatch it does not need.
    _mockPlatformOS = 'web';
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;
    tick();
    tick();
    tick();
    expect(_runOnUIDispatchCount).toBe(0);
    expect(_makeOffscreenCalls.length).toBe(1);
    expect(_makeNonTextureImageCount).toBe(3);
    unmountAll();
  });

  it('web: unmount releases the offscreen surface via captureRef dispose', () => {
    _mockPlatformOS = 'web';
    mount();
    const camera = _cameraInstance!;
    camera.viewportWidth = 320;
    camera.viewportHeight = 240;
    tick();
    unmountAll();
    if (DISPOSE !== undefined) {
      expect(_surfaceDisposeCount).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// #53: passes with sampler children bind through a nested <Shader> chain.
//
// RN-Skia's <RuntimeShader> image filter calls MakeRuntimeShader(rtb, null,
// null) — it binds the implicit source only and never consumes child shaders
// (sksg/Recorder/commands/ImageFilters.ts, 2.4.18 and 2.6.0 alike). For a
// two-child effect such as color-grading-lut Skia returns a null filter and
// the frame draws ungraded. GameView therefore renders every pass up to the
// LAST child-bearing one as a paint shader on a <Rect>: nested <Shader>s whose
// children are bound positionally (src first, then each pass.children entry as
// an <ImageShader>), with any later child-free passes kept as <RuntimeShader>
// image filters on the same <Rect>. A chain with no children keeps today's
// <Image>{RuntimeShader…}</Image> tree.
//
// The trees are inspected through the element records the mocked jsx runtime
// returns (recordElement above): component identity is the mocked string type,
// image identity is the exact object handed in.
// ---------------------------------------------------------------------------

function isEl(v: unknown): v is El {
  return typeof v === 'object' && v !== null && 'type' in v && 'props' in v;
}

/** Direct child elements of `el`, with nested arrays flattened and holes dropped. */
function flatChildren(el: El): El[] {
  const out: El[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const x of v) visit(x);
    } else if (isEl(v)) {
      out.push(v);
    }
  };
  visit(el.props.children);
  return out;
}

/** Depth-first search for the first element whose type is `type`. */
function findByType(root: unknown, type: string): El | null {
  if (Array.isArray(root)) {
    for (const x of root) {
      const found = findByType(x, type);
      if (found !== null) return found;
    }
    return null;
  }
  if (!isEl(root)) return null;
  if (root.type === type) return root;
  return findByType(root.props.children, type);
}

const LINEAR_NO_MIPMAP = { filter: 1, mipmap: 0 };

describe('GameView — postfx passes with sampler children (#53)', () => {
  it('[A, LUT(children), C] renders Rect{ Shader(LUT){ Shader(A){ ImageShader(scene) }, ImageShader(lut) }, RuntimeShader(C) } (fail-old: Image with three RuntimeShaders)', () => {
    const srcA = {};
    const srcLut = {};
    const srcC = {};
    const lutImage = {};
    _viewportOverride = { w: 400, h: 600 };
    _passesOverride = [
      makePass('a', srcA, { amount: 1 }),
      makePass('lut', srcLut, { intensity: 0.5 }, [lutImage]),
      makePass('c', srcC, { strength: 2 }),
    ];
    const tree = mount();
    const sceneImage = _sharedValues[0];

    // The whole chain is drawn by one Rect covering the viewport, not an Image.
    expect(findByType(tree, 'Image')).toBeNull();
    const rect = findByType(tree, 'Rect');
    expect(rect).not.toBeNull();
    expect(rect!.props.x).toBe(0);
    expect(rect!.props.y).toBe(0);
    expect(rect!.props.width).toBe(400);
    expect(rect!.props.height).toBe(600);

    // Rect children: the paint shader (LUT, the last child-bearing pass) and
    // then C as an image filter — the split leaves C on the rasterizing path.
    const rectKids = flatChildren(rect!);
    expect(rectKids.map((k) => k.type)).toEqual(['Shader', 'RuntimeShader']);
    const lutShader = rectKids[0]!;
    expect(lutShader.props.source).toBe(srcLut);
    expect(lutShader.props.uniforms).toEqual({ intensity: 0.5 });
    const cFilter = rectKids[1]!;
    expect(cFilter.props.source).toBe(srcC);
    expect(cFilter.props.uniforms).toEqual({ strength: 2 });
    expect(cFilter.key).toBe('c');

    // LUT's children, positional: src = pass A's shader, then the LUT image.
    const lutKids = flatChildren(lutShader);
    expect(lutKids.map((k) => k.type)).toEqual(['Shader', 'ImageShader']);
    const aShader = lutKids[0]!;
    expect(aShader.props.source).toBe(srcA);
    expect(aShader.props.uniforms).toEqual({ amount: 1 });
    const lutChild = lutKids[1]!;
    expect(lutChild.props.image).toBe(lutImage);
    expect(lutChild.props.tx).toBe('clamp');
    expect(lutChild.props.ty).toBe('clamp');
    expect(lutChild.props.sampling).toEqual(LINEAR_NO_MIPMAP);

    // A's only child is the scene texture, fitted to the viewport like <Image>.
    const aKids = flatChildren(aShader);
    expect(aKids.map((k) => k.type)).toEqual(['ImageShader']);
    const scene = aKids[0]!;
    expect(scene.props.image).toBe(sceneImage);
    expect(scene.props.fit).toBe('cover');
    expect(scene.props.rect).toEqual({ x: 0, y: 0, width: 400, height: 600 });
    expect(scene.props.tx).toBe('clamp');
    expect(scene.props.ty).toBe('clamp');
    expect(scene.props.sampling).toEqual(LINEAR_NO_MIPMAP);
    unmountAll();
  });

  it('a chain with no children still renders an Image whose only children are RuntimeShaders', () => {
    const srcA = {};
    const srcB = {};
    _viewportOverride = { w: 320, h: 240 };
    _passesOverride = [makePass('a', srcA, { amount: 1 }), makePass('b', srcB, {})];
    const tree = mount();

    const image = findByType(tree, 'Image');
    expect(image).not.toBeNull();
    expect(image!.props.image).toBe(_sharedValues[0]);
    expect(image!.props.fit).toBe('cover');
    expect(image!.props.width).toBe(320);
    expect(image!.props.height).toBe(240);
    const kids = flatChildren(image!);
    expect(kids.map((k) => k.type)).toEqual(['RuntimeShader', 'RuntimeShader']);
    expect(kids[0]!.props.source).toBe(srcA);
    expect(kids[0]!.key).toBe('a');
    expect(kids[1]!.props.source).toBe(srcB);
    expect(kids[1]!.key).toBe('b');
    expect(findByType(tree, 'Rect')).toBeNull();
    expect(findByType(tree, 'Shader')).toBeNull();
    expect(findByType(tree, 'ImageShader')).toBeNull();
    unmountAll();
  });
});

// Restore @flare-engine/render after all game-view tests complete so that later
// files in the same Bun process (packages/tilemap, packages/render-web) see the
// real Camera2D (with getBoundsInto) instead of the MockCamera2D stub installed
// above.
//
// Bun 1.3.11 mutates module namespace objects in-place when mock.module replaces
// a module, so `await import('@flare-engine/render')` captured before mocking
// returns a reference that has already been mutated to point at the stub.
// A source-path import bypasses the mock cache and always delivers the original
// file-level module; spreading it gives a plain object with the real exports.
afterAll(async () => {
  const renderSrc = await import('../../render/src/index.js');
  mock.module('@flare-engine/render', () => ({ ...renderSrc }));
  // Restore real @flare-engine/ecs so test files that load in the same Bun
  // worker after this one are not affected by the limited ecs stub above
  // (which omits Velocity, Rotation, Scale, etc.).
  const ecsSrc = await import('../../ecs/src/index.js');
  mock.module('@flare-engine/ecs', () => ({ ...ecsSrc }));
});
