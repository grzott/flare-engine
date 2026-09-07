import { describe, expect, mock, test } from 'bun:test';

// `mock.module('react', ...)` is process-global and last-writer-wins across every
// test file bun runs in this package (see focus.test.ts / primitives.test.ts) — a
// static `import { Children } from 'react'` here can resolve against an EARLIER
// file's stub instead of the real module, depending on file load order. So this
// file supplies its own `Children.toArray`, verified against real React's output
// for these exact inputs (deep-flattens arrays, drops null/undefined/boolean,
// otherwise preserves order) rather than depending on cross-file import timing.
function toArray(children: unknown): unknown[] {
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

// `List` calls `useTheme()`, which needs a `useContext`/`createContext` pair; stub
// those (same pattern as primitives.test.ts).
mock.module('react', () => ({
  Children: { toArray },
  Fragment: 'Fragment',
  createContext: (def: unknown) => ({ Provider: 'Provider', Consumer: 'Consumer', _current: def }),
  createElement: (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => ({
    type,
    props: props ?? {},
    children,
  }),
  useContext: (ctx: { _current: unknown }) => ctx._current,
}));

mock.module('react/jsx-runtime', () => ({
  jsx: (type: unknown, props: Record<string, unknown> | null) => ({ type, props: props ?? {} }),
  jsxs: (type: unknown, props: Record<string, unknown> | null) => ({ type, props: props ?? {} }),
  Fragment: 'Fragment',
}));
mock.module('react/jsx-dev-runtime', () => ({
  jsxDEV: (type: unknown, props: Record<string, unknown> | null) => ({ type, props: props ?? {} }),
  Fragment: 'Fragment',
}));

mock.module('react-native', () => ({
  View: 'View',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
}));

const { List } = await import('../src/list.js');

interface Rendered {
  readonly type: unknown;
  readonly props: { readonly children?: unknown };
}

describe('List', () => {
  test('gives a gap to every leaf, even when one child is a mapped-children array', () => {
    // Mirrors <List><Label /> {items.map((i) => <Label key={i} />)}</List> — the JSX
    // transform packs `children` into [Label, [Label, Label, Label]]: one of the
    // array slots is itself an array, not a flat list of 4 leaves.
    const mapped = ['a', 'b', 'c'];
    const rendered = List({ children: ['leading', mapped] }) as unknown as Rendered;

    const items = rendered.props.children as Rendered[];
    const spacerCount = items.filter((el) => el.type === 'View').length;

    // 4 real leaves (leading + a + b + c) => 3 gaps between them.
    expect(spacerCount).toBe(3);
  });

  test('drops null/undefined/false children without leaving a gap for them', () => {
    const rendered = List({
      children: ['x', null, undefined, false, 'y'],
    }) as unknown as Rendered;

    const items = rendered.props.children as Rendered[];
    const spacerCount = items.filter((el) => el.type === 'View').length;

    // Only 'x' and 'y' are real leaves => exactly 1 gap.
    expect(spacerCount).toBe(1);
  });
});
