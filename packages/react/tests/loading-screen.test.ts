import { describe, expect, it, mock } from 'bun:test';

mock.module('react', () => ({
  createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({
    type,
    props: props ?? {},
    children,
  }),
}));

const jsxMock = {
  jsx: (type: unknown, props: unknown) => ({ type, props: props ?? {} }),
  jsxs: (type: unknown, props: unknown) => ({ type, props: props ?? {} }),
  jsxDEV: (type: unknown, props: unknown) => ({ type, props: props ?? {} }),
  Fragment: Symbol('Fragment'),
};
mock.module('react/jsx-runtime', () => jsxMock);
mock.module('react/jsx-dev-runtime', () => jsxMock);

mock.module('react-native', () => ({
  View: 'View',
  StyleSheet: {
    create: (s: unknown) => s,
    absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  },
}));

const { LoadingScreen } = await import('../src/loading-screen.js');

interface JsxNode {
  type: unknown;
  props: {
    style?: unknown;
    children?: JsxNode | JsxNode[];
  };
}

function firstChild(node: JsxNode): JsxNode {
  const c = node.props.children;
  if (Array.isArray(c)) {
    const first = c[0];
    if (first === undefined) throw new Error('no children');
    return first;
  }
  if (c === undefined) throw new Error('no children');
  return c;
}

function inlineWidth(node: JsxNode): string | number | undefined {
  const style = node.props.style;
  if (!Array.isArray(style)) return undefined;
  for (const s of style) {
    if (s && typeof s === 'object' && !Array.isArray(s) && 'width' in s) {
      const w = (s as { width?: unknown }).width;
      if (typeof w === 'string' || typeof w === 'number') return w;
    }
  }
  return undefined;
}

function readBar(tree: JsxNode): JsxNode {
  return firstChild(firstChild(tree));
}

describe('LoadingScreen', () => {
  it('renders bar width at rounded percent', () => {
    const tree = LoadingScreen({ progress: 0.42 }) as unknown as JsxNode;
    expect(inlineWidth(readBar(tree))).toBe('42%');
  });

  it('clamps progress below 0 to 0%', () => {
    const tree = LoadingScreen({ progress: -0.5 }) as unknown as JsxNode;
    expect(inlineWidth(readBar(tree))).toBe('0%');
  });

  it('clamps progress above 1 to 100%', () => {
    const tree = LoadingScreen({ progress: 1.7 }) as unknown as JsxNode;
    expect(inlineWidth(readBar(tree))).toBe('100%');
  });

  it('rounds to nearest percent', () => {
    const tree = LoadingScreen({ progress: 0.005 }) as unknown as JsxNode;
    expect(inlineWidth(readBar(tree))).toBe('1%');
  });
});
