import { describe, expect, mock, test } from 'bun:test';
import { World } from '@flare-engine/ecs';
import * as RealReact from 'react';
import type { DevtoolsContextValue } from '../src/context.js';

// useEntityInspector only reads world/selectedEntity/select off the context, so a
// minimal fake suffices. Mock ONLY react.useContext (createContext stays real via
// the spread) to feed it in — no React renderer needed. Self-contained: no other
// devtools test imports react, so this cannot pollute them.
type MinimalCtx = Pick<DevtoolsContextValue, 'world' | 'selectedEntity' | 'select'>;
let currentCtx: MinimalCtx | null = null;
mock.module('react', () => ({ ...RealReact, useContext: () => currentCtx }));

const { useEntityInspector } = await import('../src/hooks.js');

describe('useEntityInspector', () => {
  test('lists live entities from the world (no id-range scan)', () => {
    const world = new World();
    const e1 = world.spawn();
    const e2 = world.spawn();
    const e3 = world.spawn();
    world.destroy(e2);
    currentCtx = { world, selectedEntity: null, select: () => {} };

    const view = useEntityInspector();
    expect([...view.entities].sort((a, b) => a - b)).toEqual([e1, e3]);
  });

  test('exposes the current selection and select callback', () => {
    const world = new World();
    world.spawn();
    const selectCalls: (number | null)[] = [];
    currentCtx = { world, selectedEntity: 7, select: (e) => selectCalls.push(e) };

    const view = useEntityInspector();
    expect(view.selected).toBe(7);
    view.select(null);
    expect(selectCalls).toEqual([null]);
  });
});
