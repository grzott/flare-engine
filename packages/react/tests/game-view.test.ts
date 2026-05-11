import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Collected cleanup fns from mocked useEffect — cleared before each test.
const _effectCleanups: Array<() => void> = [];

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
  useState: (init: unknown) => [
    typeof init === 'function' ? (init as () => unknown)() : init,
    () => {},
  ],
}));
const jsxMock = {
  jsx: () => null,
  jsxs: () => null,
  jsxDEV: () => null,
  Fragment: null,
};
mock.module('react/jsx-runtime', () => jsxMock);
mock.module('react/jsx-dev-runtime', () => jsxMock);

mock.module('react-native', () => ({
  View: 'View',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
}));

mock.module('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

mock.module('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Picture: 'Picture',
  useCanvasRef: () => ({ current: { redraw: () => {} } }),
  Skia: {
    XYWHRect: () => ({ setXYWH: () => {} }),
    RSXform: () => ({ set: () => {} }),
    Paint: () => ({}),
    PictureRecorder: () => ({
      beginRecording: () => ({
        save: () => 0,
        restore: () => {},
        translate: () => {},
        scale: () => {},
        rotate: () => {},
        clear: () => {},
        drawAtlas: () => {},
      }),
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
  WATER_SKSL: '',
  FOG_SKSL: '',
  FIRE_SKSL: '',
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

  it('bridge passed to onRenderPostFx exposes applyPostFx method', () => {
    let capturedBridge: unknown = undefined;
    mount({
      config: {
        onRenderPostFx: (_ctx, _canvas, bridge) => {
          capturedBridge = bridge;
        },
      },
    });
    _loopInstance!.onPreRender._handler?.();
    expect(typeof (capturedBridge as { applyPostFx?: unknown })?.applyPostFx).toBe('function');
    unmountAll();
  });

  it('no-op when onRenderPostFx is absent — onPreRender does not throw', () => {
    mount({ config: {} });
    expect(() => _loopInstance!.onPreRender._handler?.()).not.toThrow();
    unmountAll();
  });
});
