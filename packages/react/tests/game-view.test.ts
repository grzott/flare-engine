import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Collected cleanup fns from mocked useEffect — cleared before each test.
const _effectCleanups: Array<() => void> = [];

// Override viewport initial state for high-DPI tests. Set before mount(), reset in beforeEach.
let _viewportOverride: { w: number; h: number } | null = null;

// Controllable postfx-pass source — the mocked bridge.buildPostFxPasses returns
// _buildPasses() each frame, so a test can vary the chain between onPreRender ticks.
let _buildPasses: () => readonly unknown[] = () => [];
// Counts invocations of the passes-state setter (the per-frame gate under test)
// and captures the value handed to it, so tests assert WHAT propagates, not only WHEN.
let _setPassesCount = 0;
let _lastPasses: unknown = null;

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
        init,
        (val: unknown) => {
          _setPassesCount++;
          _lastPasses = val;
        },
      ];
    }
    return [typeof init === 'function' ? (init as () => unknown)() : init, () => {}];
  },
}));
const jsxMock = {
  jsx: () => null,
  jsxs: () => null,
  jsxDEV: () => null,
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
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

let _usePictureAsTextureArgs: Array<{ width: number; height: number }> = [];
let _beginRecordingBounds: Array<{ width: number; height: number }> = [];
let _beginFramePdArgs: number[] = [];
const _beginFrameTimeArgs: number[] = [];

mock.module('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Image: 'Image',
  RuntimeShader: 'RuntimeShader',
  useCanvasRef: () => ({ current: { redraw: () => {} } }),
  // usePictureAsTexture returns a SharedValue-shaped object with a null image stub.
  // In tests there is no Reanimated; we return a plain object that satisfies
  // the <Image image={sceneTexture}/> null-check in GameView.
  usePictureAsTexture: (_pic: unknown, size: { width: number; height: number }) => {
    _usePictureAsTextureArgs.push({ width: size.width, height: size.height });
    return { value: null };
  },
  Skia: {
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
    Paint: () => ({
      setColorFilter: () => {},
      setShader: () => {},
      setAlphaf: () => {},
      setColor: () => {},
      setImageFilter: () => {},
    }),
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
      setPostFxBinding: () => {},
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
  update(): void {
    this.updateCalls++;
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

function mount(props: Parameters<typeof reactModule.GameView>[0] = {}): void {
  reactModule.GameView(props);
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
  _cameraInstance = null;
  _rendererInstance = null;
  _batchInstance = null;
  _inputInstance = null;
  _mockPixelRatio = 1;
  _mockPlatformOS = 'ios';
  _viewportOverride = null;
  _usePictureAsTextureArgs = [];
  _beginRecordingBounds = [];
  _beginFramePdArgs = [];
  _buildPasses = () => [];
  _setPassesCount = 0;
  _lastPasses = null;
  _beginFrameTimeArgs.length = 0;
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
  it('usePictureAsTexture receives physical dimensions when PixelRatio=2 and layout=400×600', () => {
    _mockPixelRatio = 2;
    _viewportOverride = { w: 400, h: 600 };
    mount();
    // usePictureAsTexture is called during render (sceneSize memo); pick the last call.
    const last = _usePictureAsTextureArgs[_usePictureAsTextureArgs.length - 1];
    expect(last).toEqual({ width: 800, height: 1200 });
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
// WEB-3: postfx pass gate on web.
// On web, RuntimeShader image filters are unavailable (RN-Skia 2.4.18 throws
// "Not implemented on React Native Web" from both Skia.RuntimeShaderBuilder and
// ImageFilter.MakeRuntimeShaderWithChildren). GameView must never call
// buildPostFxPasses or setPasses on web — even when the hook supplies a chain —
// to avoid a per-frame throw.
// ---------------------------------------------------------------------------

describe('GameView — web postfx gate (WEB-3)', () => {
  it('setPasses is never called on web even when the chain is non-empty', () => {
    _mockPlatformOS = 'web';
    const shader = {};
    _buildPasses = () => [
      { id: 'flash', source: shader, uniforms: { intensity: 1 }, children: [] },
    ];
    mount();
    tick();
    tick();
    tick();
    expect(_setPassesCount).toBe(0);
    unmountAll();
  });

  it('setPasses fires on native when the chain is non-empty (baseline unchanged)', () => {
    _mockPlatformOS = 'ios';
    const shader = {};
    _buildPasses = () => [
      { id: 'flash', source: shader, uniforms: { intensity: 1 }, children: [] },
    ];
    mount();
    tick();
    expect(_setPassesCount).toBe(1);
    unmountAll();
  });
});
