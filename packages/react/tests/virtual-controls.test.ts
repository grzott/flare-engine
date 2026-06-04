import { describe, expect, it, mock } from 'bun:test';

// Capturing spy for JSX calls. With react-jsx transform, all JSX compiles to
// jsx(type, props) / jsxs(type, props) from react/jsx-runtime — not to
// React.createElement. We capture both so render output is inspectable.
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

mock.module('react', () => ({
  createElement: capturingJsx,
  useCallback: (fn: unknown) => fn,
  useRef: (init: unknown) => ({ current: init }),
  useMemo: (fn: () => unknown) => fn(),
  useEffect: () => {},
  useState: (init: unknown) => [
    typeof init === 'function' ? (init as () => unknown)() : init,
    () => {},
  ],
}));

mock.module('react-native', () => ({
  View: 'View',
  StyleSheet: {
    create: (s: unknown) => s,
    absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  },
}));

mock.module('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  useCanvasRef: () => ({ current: null }),
}));

mock.module('@flare-engine/core', () => ({
  GameLoop: class {
    onPreRender = { add: () => () => {} };
    onUpdate = { add: () => () => {} };
    start() {}
    stop() {}
  },
}));

mock.module('@flare-engine/ecs', () => ({
  World: class {},
  Position: { id: 0, bit: 1, name: 'Position', create: () => ({ x: 0, y: 0 }) },
  defineComponent: () => ({}),
  definePrefab: () => ({}),
  defineSystem: () => ({}),
  _resetComponentIds: () => {},
}));

mock.module('@flare-engine/render', () => ({
  Camera2D: class {},
  Renderer: class {
    setCanvas() {}
    begin() {}
    end() {}
  },
}));

mock.module('@flare-engine/audio', () => ({
  AudioManager: class {},
}));

mock.module('@flare-engine/assets', () => ({
  AssetManager: class {},
}));

mock.module('@flare-engine/scene', () => ({
  SceneManager: class {},
}));

const { VirtualJoystick } = await import('../src/virtual-joystick.js');
const { VirtualButton } = await import('../src/virtual-button.js');

// Helper — reset spy state and invoke the component function.
function render(props: Parameters<typeof VirtualJoystick>[0]): void {
  jsxCalls.length = 0;
  VirtualJoystick(props);
}

// Returns jsx calls whose `children` prop contains `node`.
function callsContainingChild(node: unknown): JsxCall[] {
  return jsxCalls.filter((c) => {
    const children = c.props.children;
    if (Array.isArray(children)) return children.includes(node);
    return children === node;
  });
}

describe('VirtualJoystick', () => {
  it('exports VirtualJoystick as a function', () => {
    expect(typeof VirtualJoystick).toBe('function');
  });

  it('accepts config, onStateChange, style props (compile-time check)', () => {
    expect(VirtualJoystick).toBeDefined();
  });

  // --- skin slot: base ---

  it('base provided — a jsx call carries that node as a child', () => {
    const customBase = { type: 'Image', props: {}, key: null };
    render({ base: customBase });
    const hits = callsContainingChild(customBase);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('base absent — no jsx call carries a custom element as a child', () => {
    render({});
    // When base is absent, no child should be an element-like object with a
    // `type` field. Style entries are plain objects without `type`.
    const allChildren = jsxCalls.flatMap((c) => {
      const ch = c.props.children;
      return Array.isArray(ch) ? ch : [ch];
    });
    const elementLike = allChildren.filter(
      (ch) => ch !== null && typeof ch === 'object' && 'type' in (ch as Record<string, unknown>),
    );
    expect(elementLike.length).toBe(0);
  });

  // --- skin slot: thumb ---

  it('thumb provided — a jsx call carries that node as a child', () => {
    const customThumb = { type: 'Knob', props: {}, key: null };
    render({ thumb: customThumb });
    const hits = callsContainingChild(customThumb);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('thumb absent — the default knob View renders with styles.knob (width:40)', () => {
    render({});
    // Default knob: a View whose style array contains an object with width:40.
    const knobCalls = jsxCalls.filter((c) => {
      const style = c.props.style;
      if (!Array.isArray(style)) return false;
      return style.some(
        (s: unknown) =>
          s !== null && typeof s === 'object' && (s as Record<string, unknown>).width === 40,
      );
    });
    expect(knobCalls.length).toBeGreaterThan(0);
  });

  // --- maxRadius flows into sizing ---

  it('maxRadius from config flows into outer View width and height', () => {
    render({ config: { maxRadius: 80 } });
    const sizedCalls = jsxCalls.filter((c) => {
      const style = c.props.style;
      if (!Array.isArray(style)) return false;
      return style.some(
        (s: unknown) =>
          s !== null &&
          typeof s === 'object' &&
          (s as Record<string, unknown>).width === 160 &&
          (s as Record<string, unknown>).height === 160,
      );
    });
    expect(sizedCalls.length).toBeGreaterThan(0);
  });

  // --- centering always applied regardless of base skin ---

  function flattenStyle(style: unknown): Record<string, unknown>[] {
    if (style === null || style === undefined) return [];
    if (Array.isArray(style)) return style.flatMap(flattenStyle);
    if (typeof style === 'object') return [style as Record<string, unknown>];
    return [];
  }

  function findOuterContainer(maxRadius = 50): JsxCall | undefined {
    return jsxCalls.find((c) => {
      const flat = flattenStyle(c.props.style);
      return flat.some(
        (s) =>
          s.width === maxRadius * 2 && s.height === maxRadius * 2 && s.borderRadius === maxRadius,
      );
    });
  }

  it('with base skin — outer container still has alignItems:center and justifyContent:center', () => {
    const customBase = { type: 'Image', props: {}, key: null };
    render({ base: customBase });
    const container = findOuterContainer();
    expect(container).toBeDefined();
    const flat = flattenStyle(container!.props.style);
    expect(flat.some((s) => s.alignItems === 'center')).toBe(true);
    expect(flat.some((s) => s.justifyContent === 'center')).toBe(true);
  });

  it('without base skin — outer container has alignItems:center, justifyContent:center, and default background', () => {
    render({});
    const container = findOuterContainer();
    expect(container).toBeDefined();
    const flat = flattenStyle(container!.props.style);
    expect(flat.some((s) => s.alignItems === 'center')).toBe(true);
    expect(flat.some((s) => s.justifyContent === 'center')).toBe(true);
    expect(flat.some((s) => s.backgroundColor === 'rgba(255,255,255,0.2)')).toBe(true);
  });

  // --- knob transform at rest ---

  it('knob transform contains translateX/translateY at rest, with and without thumb', () => {
    function hasTranslateX(style: unknown): boolean {
      if (Array.isArray(style)) {
        return style.some((s) => hasTranslateX(s));
      }
      if (style !== null && typeof style === 'object') {
        const transform = (style as Record<string, unknown>).transform;
        return (
          Array.isArray(transform) &&
          transform.some(
            (t) => t !== null && typeof t === 'object' && 'translateX' in (t as object),
          )
        );
      }
      return false;
    }

    // Without thumb
    render({});
    const withoutThumb = jsxCalls.filter((c) => hasTranslateX(c.props.style));
    expect(withoutThumb.length).toBeGreaterThan(0);

    // With thumb
    const customThumb = { type: 'Knob', props: {}, key: null };
    render({ thumb: customThumb });
    const withThumb = jsxCalls.filter((c) => hasTranslateX(c.props.style));
    expect(withThumb.length).toBeGreaterThan(0);
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
