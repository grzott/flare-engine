import { describe, expect, it, mock } from 'bun:test';
import type { RefObject } from 'react';
import type { Text, View } from 'react-native';

// Mocks must be registered before any imports that pull in react or react-native.
// Every file that mocks 'react' in this package carries the full key set — see the note in
// label-truncation.test.ts.

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

const { Button } = await import('../src/button.js');
const { Label } = await import('../src/label.js');
const { Panel } = await import('../src/panel.js');

type VNode = { type: unknown; props: Record<string, unknown> };

describe('ref prop reaches the root element', () => {
  it('Button passes an object ref to its root Pressable', () => {
    const ref: RefObject<View | null> = { current: null };
    const el = Button({ label: 'Go', ref }) as VNode;
    expect(el.type).toBe('Pressable');
    expect(el.props.ref).toBe(ref);
  });

  it('Button passes a callback ref to its root Pressable', () => {
    const ref = (_node: View | null): void => {};
    const el = Button({ label: 'Go', ref }) as VNode;
    expect(el.props.ref).toBe(ref);
  });

  it('Panel passes an object ref to its root View', () => {
    const ref: RefObject<View | null> = { current: null };
    const el = Panel({ ref }) as VNode;
    expect(el.type).toBe('View');
    expect(el.props.ref).toBe(ref);
  });

  it('Panel passes a callback ref to its root View', () => {
    const ref = (_node: View | null): void => {};
    const el = Panel({ ref }) as VNode;
    expect(el.props.ref).toBe(ref);
  });

  it('Label passes an object ref to its root Text', () => {
    const ref: RefObject<Text | null> = { current: null };
    const el = Label({ children: 'hello', ref }) as VNode;
    expect(el.type).toBe('Text');
    expect(el.props.ref).toBe(ref);
  });

  it('Label passes a callback ref to its root Text', () => {
    const ref = (_node: Text | null): void => {};
    const el = Label({ children: 'hello', ref }) as VNode;
    expect(el.props.ref).toBe(ref);
  });

  it('omitting ref leaves it undefined on every root element', () => {
    expect((Button({ label: 'Go' }) as VNode).props.ref).toBeUndefined();
    expect((Panel({}) as VNode).props.ref).toBeUndefined();
    expect((Label({ children: 'hello' }) as VNode).props.ref).toBeUndefined();
  });
});
