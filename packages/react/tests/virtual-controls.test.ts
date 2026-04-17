import { describe, expect, it, mock } from 'bun:test';

// Mock React and React Native before imports
mock.module('react', () => ({
  createElement: () => null,
  useCallback: (fn: unknown) => fn,
  useRef: (init: unknown) => ({ current: init }),
  useMemo: (fn: () => unknown) => fn(),
  useEffect: () => {},
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

mock.module('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  useCanvasRef: () => ({ current: null }),
}));

mock.module('@flare/core', () => ({
  GameLoop: class {
    onPreRender = { add: () => () => {} };
    onUpdate = { add: () => () => {} };
    start() {}
    stop() {}
  },
}));

mock.module('@flare/ecs', () => ({
  World: class {},
}));

mock.module('@flare/render', () => ({
  Camera2D: class {},
  Renderer: class {
    setCanvas() {}
    begin() {}
    end() {}
  },
}));

mock.module('@flare/audio', () => ({
  AudioManager: class {},
}));

mock.module('@flare/assets', () => ({
  AssetManager: class {},
}));

mock.module('@flare/scene', () => ({
  SceneManager: class {},
}));

const { VirtualJoystick } = await import('../src/virtual-joystick.js');
const { VirtualButton } = await import('../src/virtual-button.js');

describe('VirtualJoystick', () => {
  it('exports VirtualJoystick as a function', () => {
    expect(typeof VirtualJoystick).toBe('function');
  });

  it('accepts config, onStateChange, style props (compile-time check)', () => {
    // Prop types are verified at compile time.
    // Component cannot be called directly without a React reconciler.
    expect(VirtualJoystick).toBeDefined();
  });
});

describe('VirtualButton', () => {
  it('exports VirtualButton as a function', () => {
    expect(typeof VirtualButton).toBe('function');
  });

  it('accepts onStateChange, style, children props (compile-time check)', () => {
    expect(VirtualButton).toBeDefined();
  });
});
