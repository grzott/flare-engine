import { describe, expect, it, mock } from 'bun:test';

// Mocks must be registered before any imports that pull in react or react-native.
// Whichever file mocks 'react' first freezes the named-export set bun's mock.module uses
// for the rest of the run — a later file adding a genuinely new key (not just a new value
// for an existing key, e.g. list.test.ts's `Children`) is silently dropped. File order is
// readdir order, which differs by OS (primitives.test.ts runs first on Linux CI), so every
// file that mocks 'react' here must carry the full key set.

function childrenToArray(children: unknown): unknown[] {
  const out: unknown[] = [];
  const flatten = (node: unknown): void => {
    if (node === null || node === undefined || typeof node === 'boolean') return;
    if (Array.isArray(node)) {
      for (const child of node) flatten(child);
      return;
    }
    out.push(node);
  };
  flatten(children);
  return out;
}

mock.module('react', () => ({
  Children: { toArray: childrenToArray },
  createContext: (def: unknown) => ({ Provider: 'Provider', Consumer: 'Consumer', _current: def }),
  useContext: (ctx: { _current: unknown }) => ctx._current,
  useState: (init: unknown) => {
    const val = typeof init === 'function' ? (init as () => unknown)() : init;
    return [val, () => {}];
  },
  useEffect: () => {},
  useMemo: (fn: () => unknown) => fn(),
  useCallback: (fn: unknown) => fn,
  useRef: (init: unknown) => ({ current: init }),
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
  PixelRatio: { get: () => 1 },
}));

const { Label } = await import('../src/label.js');

type VNode = { type: unknown; props: Record<string, unknown> };

describe('Label truncation props (CW7-2)', () => {
  it('forwards numberOfLines to Text', () => {
    const el = Label({ children: 'hello', numberOfLines: 3 }) as VNode;
    expect(el.props.numberOfLines).toBe(3);
  });

  it('forwards ellipsizeMode to Text', () => {
    const el = Label({ children: 'hello', ellipsizeMode: 'tail' }) as VNode;
    expect(el.props.ellipsizeMode).toBe('tail');
  });

  it('forwards adjustsFontSizeToFit to Text', () => {
    const el = Label({ children: 'hello', adjustsFontSizeToFit: true }) as VNode;
    expect(el.props.adjustsFontSizeToFit).toBe(true);
  });

  it('forwards minimumFontScale to Text', () => {
    const el = Label({ children: 'hello', minimumFontScale: 0.5 }) as VNode;
    expect(el.props.minimumFontScale).toBe(0.5);
  });

  it('omitting truncation props leaves output unchanged (all undefined)', () => {
    const el = Label({ children: 'hello' }) as VNode;
    expect(el.props.numberOfLines).toBeUndefined();
    expect(el.props.ellipsizeMode).toBeUndefined();
    expect(el.props.adjustsFontSizeToFit).toBeUndefined();
    expect(el.props.minimumFontScale).toBeUndefined();
  });

  it('renders Text as the root element type', () => {
    const el = Label({ children: 'hello' }) as VNode;
    expect(el.type).toBe('Text');
  });
});
