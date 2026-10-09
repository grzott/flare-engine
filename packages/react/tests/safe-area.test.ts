import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { SafeArea } from '../src/safe-area.js';

// Controls what useContext returns — tests override this per scenario.
let _useContextReturn: unknown = null;

// Captured Provider values from JSX calls — inspected in GameView tests.
let _capturedProviderValues: Array<{ value: unknown }> = [];

mock.module('react', () => ({
  createElement: () => null,
  createContext: (defaultValue: unknown) => ({
    Provider: (props: { value: unknown }) => {
      _capturedProviderValues.push({ value: props.value });
      return null;
    },
    Consumer: 'Consumer',
    _defaultValue: defaultValue,
  }),
  useCallback: (fn: unknown) => fn,
  useContext: (_ctx: unknown) => _useContextReturn,
  useRef: (init: unknown) => ({ current: init }),
  useMemo: (fn: () => unknown) => fn(),
  useEffect: (fn: () => undefined | (() => void)) => {
    fn();
  },
  useState: (init: unknown) => [
    typeof init === 'function' ? (init as () => unknown)() : init,
    () => {},
  ],
}));

const jsxMock = {
  jsx: (_type: unknown, props: Record<string, unknown>) => {
    if (props && typeof props === 'object' && 'value' in props) {
      _capturedProviderValues.push({ value: props.value });
    }
    return null;
  },
  jsxs: (_type: unknown, props: Record<string, unknown>) => {
    if (props && typeof props === 'object' && 'value' in props) {
      _capturedProviderValues.push({ value: props.value });
    }
    return null;
  },
  jsxDEV: (_type: unknown, props: Record<string, unknown>) => {
    if (props && typeof props === 'object' && 'value' in props) {
      _capturedProviderValues.push({ value: props.value });
    }
    return null;
  },
  Fragment: null,
};
mock.module('react/jsx-runtime', () => jsxMock);
mock.module('react/jsx-dev-runtime', () => jsxMock);

mock.module('react-native', () => ({
  View: 'View',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
  Platform: { OS: 'ios' },
  PixelRatio: { get: () => 1 },
}));

mock.module('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Picture: 'Picture',
  Image: 'Image',
  RuntimeShader: 'RuntimeShader',
  useCanvasRef: () => ({ current: { redraw: () => {} } }),
  Skia: {
    Surface: {
      MakeOffscreen: (_width: number, _height: number) => ({
        getCanvas: () => ({ drawPicture: () => {} }),
        flush: () => {},
        makeImageSnapshot: () => ({ makeNonTextureImage: () => ({}) }),
      }),
    },
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

mock.module('@flare-engine/core', () => ({
  GameLoop: class {
    onPreRender = { add: () => () => {} };
    onLateUpdate = { add: () => () => {} };
    clock = { elapsed: 0 };
    start = () => {};
    stop = () => {};
  },
}));

mock.module('@flare-engine/ecs', () => ({
  World: class {
    query(): unknown {
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

mock.module('@flare-engine/render', () => ({
  Camera2D: class {
    effectiveX = 0;
    effectiveY = 0;
    zoom = 1;
    rotation = 0;
    viewportWidth = 0;
    viewportHeight = 0;
    setViewport() {}
    update() {}
  },
  Renderer: class {
    get canvas() {
      return {};
    }
    setCanvas() {}
    begin() {}
    end() {}
    applyCamera() {}
  },
  SpriteBatch: class {
    flush() {}
  },
  Sprite: { id: 1, bit: 2, name: 'Sprite', create: () => ({}) },
  createRenderSystem: () => () => {},
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
  createFrameRenderer: () => ({
    canvas: {
      save: () => 0,
      restore: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      clear: () => {},
    },
    beginFrame: () => {},
    drawAtlas: () => {},
    buildPostFxPasses: () => [],
    setPostFxBinding: () => {},
    hasPostFxBinding: () => false,
    endFrame: () => null,
  }),
}));

mock.module('@flare-engine/audio', () => ({ AudioManager: class {} }));
mock.module('@flare-engine/input', () => ({
  InputManager: class {},
  createJoystickState: () => ({ active: false, offset: { x: 0, y: 0 }, pointerId: null }),
  releaseJoystick: (s: unknown) => s,
  updateJoystick: (s: unknown) => s,
  createButtonState: () => ({ pressed: false, justPressed: false, justReleased: false }),
  pressButton: (s: unknown) => s,
  releaseButton: (s: unknown) => s,
  resetButtonFrame: (s: unknown) => s,
}));
mock.module('@flare-engine/assets', () => ({ AssetManager: class {} }));
mock.module('@flare-engine/scene', () => ({ SceneManager: class {} }));

mock.module('react-native-reanimated', () => ({
  useSharedValue: (init: unknown) => ({ value: init }),
}));

const RN_SAC_INSETS: SafeArea = { top: 44, right: 0, bottom: 34, left: 0 };

// F079: useSafeAreaInsets() throws "No safe area value available" when no
// <SafeAreaProvider> ancestor is mounted — which is always true in this
// no-real-renderer harness. GameView must never call it; it reads
// SafeAreaInsetsContext via useContext instead, which the 'react' mock above
// resolves to `_useContextReturn` (simulating what a real provider would set).
mock.module('react-native-safe-area-context', () => ({
  SafeAreaInsetsContext: 'SafeAreaInsetsContext',
  useSafeAreaInsets: () => {
    throw new Error(
      'No safe area value available. Make sure you are rendering `<SafeAreaProvider>` at the top of your app.',
    );
  },
}));

const safeAreaModule = await import('../src/safe-area.js');
const gameViewModule = await import('../src/game-view.js');

beforeEach(() => {
  _capturedProviderValues = [];
  _useContextReturn = null;
});

describe('useSafeArea', () => {
  it('T1: returns the context value when provider supplies one', () => {
    const expected: SafeArea = { top: 10, right: 5, bottom: 20, left: 5 };
    _useContextReturn = expected;
    const result = safeAreaModule.useSafeArea();
    expect(result).toEqual(expected);
  });

  it('T2: throws when context is null (outside GameView)', () => {
    _useContextReturn = null;
    expect(() => safeAreaModule.useSafeArea()).toThrow(
      'useSafeArea must be used inside a <GameView>',
    );
  });
});

/** Find SafeArea-shaped values from Provider calls (top/right/bottom/left keys). */
function findSafeAreaValues(): SafeArea[] {
  return _capturedProviderValues
    .filter(
      (c) =>
        c.value !== null &&
        typeof c.value === 'object' &&
        'top' in (c.value as object) &&
        'right' in (c.value as object) &&
        'bottom' in (c.value as object) &&
        'left' in (c.value as object),
    )
    .map((c) => c.value as SafeArea);
}

describe('GameView safe-area integration', () => {
  it('T3: resolves context insets (provider mounted) when no safeArea prop given', () => {
    _useContextReturn = RN_SAC_INSETS;
    gameViewModule.GameView({});
    const values = findSafeAreaValues();
    expect(values.length).toBeGreaterThan(0);
    expect(values[0]).toEqual(RN_SAC_INSETS);
  });

  it('T4: uses explicit safeArea prop, ignoring context insets', () => {
    _useContextReturn = RN_SAC_INSETS;
    const explicit: SafeArea = { top: 99, right: 1, bottom: 88, left: 2 };
    gameViewModule.GameView({ safeArea: explicit });
    const values = findSafeAreaValues();
    expect(values.length).toBeGreaterThan(0);
    expect(values[0]).toEqual(explicit);
  });

  it('T5: explicit zero-insets prop is honored as the resolved safe area', () => {
    const fallback: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
    gameViewModule.GameView({ safeArea: fallback });
    const values = findSafeAreaValues();
    expect(values.length).toBeGreaterThan(0);
    expect(values[0]).toEqual(fallback);
  });
});

// F079: useSafeAreaInsets() throws unconditionally without a <SafeAreaProvider>
// ancestor, and the mocked hook above reproduces that throw. Pre-fix, GameView
// called it unconditionally, so both cases below threw before a single
// assertion ran. Post-fix, GameView never calls it — it reads
// SafeAreaInsetsContext via useContext, which is null here (no provider).
describe('GameView safe-area — no provider (F079)', () => {
  it('no provider + explicit safeArea: mounts without throwing and uses the explicit value', () => {
    _useContextReturn = null;
    const explicit: SafeArea = { top: 20, right: 0, bottom: 0, left: 0 };
    expect(() => gameViewModule.GameView({ safeArea: explicit })).not.toThrow();
    const values = findSafeAreaValues();
    expect(values.length).toBeGreaterThan(0);
    expect(values[0]).toEqual(explicit);
  });

  it('no provider + no safeArea: mounts without throwing and falls back to zero insets', () => {
    _useContextReturn = null;
    expect(() => gameViewModule.GameView({})).not.toThrow();
    const values = findSafeAreaValues();
    expect(values.length).toBeGreaterThan(0);
    expect(values[0]).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

// Restore the real @flare-engine/ecs so test files loaded in the same Bun
// worker after this one are not affected by the limited ecs stub above
// (which omits Velocity, Rotation, Scale, etc.).
afterAll(async () => {
  const ecsSrc = await import('../../ecs/src/index.js');
  mock.module('@flare-engine/ecs', () => ({ ...ecsSrc }));
});
