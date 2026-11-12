import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { GameLoop } from '@flare-engine/core';
import { World } from '@flare-engine/ecs';
import * as RealReact from 'react';
import type { DevtoolsConfig, DevtoolsContextValue } from '../src/context.js';

// Minimal hook runtime: slots persist across renders of one mounted provider, and
// effects re-run (after their cleanup) only when a dep changes — enough to observe
// the provider's capture subscription without a React renderer.
interface EffectSlot {
  deps: readonly unknown[] | undefined;
  cleanup: (() => void) | undefined;
}

let slots: unknown[] = [];
let cursor = 0;
let pendingEffects: (() => void)[] = [];
let currentCtx: DevtoolsContextValue | null = null;

function depsChanged(prev: readonly unknown[] | undefined, next: readonly unknown[] | undefined) {
  if (prev === undefined || next === undefined) return true;
  return prev.length !== next.length || prev.some((d, i) => !Object.is(d, next[i]));
}

mock.module('react', () => ({
  ...RealReact,
  useContext: () => currentCtx,
  useState: (initial: unknown) => {
    const i = cursor++;
    if (!(i in slots)) slots[i] = initial;
    return [
      slots[i],
      (next: unknown) => {
        slots[i] = next;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = cursor++;
    if (!(i in slots)) slots[i] = { current: initial };
    return slots[i];
  },
  useMemo: (factory: () => unknown, deps: readonly unknown[]) => {
    const i = cursor++;
    const prev = slots[i] as { deps: readonly unknown[]; value: unknown } | undefined;
    if (prev && !depsChanged(prev.deps, deps)) return prev.value;
    const value = factory();
    slots[i] = { deps, value };
    return value;
  },
  useEffect: (effect: () => undefined | (() => void), deps?: readonly unknown[]) => {
    const i = cursor++;
    const prev = slots[i] as EffectSlot | undefined;
    if (prev && !depsChanged(prev.deps, deps)) return;
    const slot: EffectSlot = { deps, cleanup: prev?.cleanup };
    slots[i] = slot;
    pendingEffects.push(() => {
      slot.cleanup?.();
      slot.cleanup = effect() ?? undefined;
    });
  },
}));

const platform: { OS: string } = { OS: 'ios' };
mock.module('react-native', () => ({
  Platform: platform,
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

const { DevtoolsProvider } = await import('../src/provider.js');
const { DevtoolsHUD } = await import('../src/hud.js');

interface ComponentElement {
  type: () => unknown;
}

/** Resolves `<DevtoolsHUD />` to its final output: `null`, or the host `View` element. */
function renderHUD(): unknown {
  const outer = DevtoolsHUD() as unknown as ComponentElement | null;
  return outer === null ? null : outer.type();
}

interface ProviderElement {
  props: { value: DevtoolsContextValue };
}

const world = new World();
let loop = new GameLoop();

/** Renders (or re-renders) the mounted provider and returns its context value. */
function renderProvider(config?: DevtoolsConfig): DevtoolsContextValue {
  cursor = 0;
  const element = DevtoolsProvider({
    world,
    loop,
    snapshot: () => ({ frame: 1 }),
    config,
  }) as unknown as ProviderElement;
  for (const run of pendingEffects) run();
  pendingEffects = [];
  currentCtx = element.props.value;
  return currentCtx;
}

function tick(times: number): void {
  for (let i = 0; i < times; i++) loop.onUpdate.emit(1 / 60);
}

beforeEach(() => {
  slots = [];
  pendingEffects = [];
  currentCtx = null;
  loop = new GameLoop();
  platform.OS = 'ios';
});

describe('DevtoolsConfig.enabledOnNative', () => {
  test('native + enabledOnNative false: context is disabled, HUD renders null, nothing is captured', () => {
    const ctx = renderProvider({ enabledOnNative: false });

    expect(ctx.enabled).toBe(false);
    expect(renderHUD()).toBeNull();

    tick(5);
    expect(ctx.buffer.length).toBe(0);
    expect(ctx.buffer.latest).toBeNull();
  });

  test('native + default config: context is enabled, HUD renders, every update is captured', () => {
    const ctx = renderProvider();

    expect(ctx.enabled).toBe(true);
    expect(renderHUD()).toMatchObject({ type: 'View' });

    tick(3);
    expect(ctx.buffer.length).toBe(3);
    expect(ctx.buffer.latest).toEqual({ frame: 1 });
  });

  test('native + enabledOnNative true: context is enabled, HUD renders, every update is captured', () => {
    const ctx = renderProvider({ enabledOnNative: true });

    expect(ctx.enabled).toBe(true);
    expect(renderHUD()).toMatchObject({ type: 'View' });

    tick(3);
    expect(ctx.buffer.length).toBe(3);
  });

  test('web + enabledOnNative false: the flag is native-only, so context is enabled and capture runs', () => {
    platform.OS = 'web';
    const ctx = renderProvider({ enabledOnNative: false });

    expect(ctx.enabled).toBe(true);

    tick(3);
    expect(ctx.buffer.length).toBe(3);
  });

  test('web HUD still returns null without reading the context (no provider mounted)', () => {
    platform.OS = 'web';
    expect(currentCtx).toBeNull();
    expect(DevtoolsHUD()).toBeNull();
  });

  test('flipping enabledOnNative on a mounted native provider unsubscribes and re-subscribes capture', () => {
    const ctx = renderProvider({ enabledOnNative: true });
    tick(2);
    expect(ctx.buffer.length).toBe(2);

    const disabled = renderProvider({ enabledOnNative: false });
    expect(disabled.enabled).toBe(false);
    expect(disabled.buffer).toBe(ctx.buffer);
    tick(4);
    expect(ctx.buffer.length).toBe(2);
    expect(renderHUD()).toBeNull();

    const reenabled = renderProvider({ enabledOnNative: true });
    expect(reenabled.enabled).toBe(true);
    tick(1);
    expect(ctx.buffer.length).toBe(3);
    expect(renderHUD()).toMatchObject({ type: 'View' });
  });
});
