import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import { A11yManager } from '@flare-engine/a11y';
import { createElement, type ReactNode, useLayoutEffect } from 'react';
import { shatter } from '../../src/core/presets';
import { createPresetRegistry } from '../../src/core/registry';
import { type ElementPlatform, useFlareElement } from '../../src/runtime/element';
import { FlarePresence } from '../../src/runtime/presence';
import { FlareContext, type FlareContextValue } from '../../src/runtime/provider-context';
import { installDom, type Rendered, render } from '../support/dom';
import {
  createFakeDriver,
  createFakeFxRuntime,
  createFakeTarget,
  staticReducedMotion,
} from '../support/fakes';

type Handler = (enabled: boolean) => void;

const info = {
  handlers: new Map<string, Set<Handler>>(),
  /** Settles the `isReduceMotionEnabled()` call still in flight. */
  answer: null as { resolve(enabled: boolean): void; reject(error: Error): void } | null,
  focused: [] as number[],
  onFocus: null as (() => void) | null,
  isReduceMotionEnabled(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      info.answer = { resolve, reject };
    });
  },
  addEventListener(name: string, handler: Handler) {
    const set = info.handlers.get(name) ?? new Set<Handler>();
    info.handlers.set(name, set);
    set.add(handler);
    return { remove: () => set.delete(handler) };
  },
  setAccessibilityFocus(reactTag: number) {
    info.focused.push(reactTag);
    info.onFocus?.();
  },
  emit(name: string, enabled: boolean) {
    for (const handler of info.handlers.get(name) ?? []) handler(enabled);
  },
};

mock.module('react-native', () => ({ AccessibilityInfo: info }));

// Loaded after the mock, so neither module ever reaches the real `react-native`.
const { nativeReducedMotionSource } = await import('../../src/native/reduced-motion');
const { exitA11yProps, moveAccessibilityFocus } = await import('../../src/native/a11y');

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const rendered: Rendered[] = [];

beforeEach(() => {
  info.handlers.clear();
  info.answer = null;
  info.focused = [];
  info.onFocus = null;
});

afterEach(() => {
  for (const r of rendered.splice(0)) r.unmount();
});

test('get() is false until the OS answers, then follows it', async () => {
  const source = nativeReducedMotionSource();
  const heard: boolean[] = [];
  source.subscribe((v) => heard.push(v));
  expect(source.get()).toBe(false);

  info.answer!.resolve(true);
  await tick();
  expect(source.get()).toBe(true);
  expect(heard).toEqual([true]);
});

test('reduceMotionChanged(true) updates get() and calls manager.setReducedMotion(true)', async () => {
  const manager = new A11yManager();
  const setReducedMotion = spyOn(manager, 'setReducedMotion');
  const source = nativeReducedMotionSource(manager);
  const heard: boolean[] = [];
  source.subscribe((v) => heard.push(v));
  info.answer!.resolve(false);
  await tick();
  expect(source.get()).toBe(false);

  info.emit('reduceMotionChanged', true);
  expect(source.get()).toBe(true);
  expect(heard).toEqual([true]);
  expect(setReducedMotion).toHaveBeenLastCalledWith(true);
  expect(manager.reducedMotion).toBe(true);

  info.emit('reduceMotionChanged', false);
  expect(source.get()).toBe(false);
  expect(heard).toEqual([true, false]);
  expect(manager.reducedMotion).toBe(false);
});

test('the first OS answer reaches the manager too', async () => {
  const manager = new A11yManager();
  nativeReducedMotionSource(manager);

  info.answer!.resolve(true);
  await tick();
  expect(manager.reducedMotion).toBe(true);
});

test('a change heard before the first answer lands is not overwritten by it', async () => {
  const source = nativeReducedMotionSource();
  info.emit('reduceMotionChanged', true);

  info.answer!.resolve(false);
  await tick();
  expect(source.get()).toBe(true);
});

test('an unsubscribed callback hears nothing more', () => {
  const source = nativeReducedMotionSource();
  const heard: boolean[] = [];
  const unsubscribe = source.subscribe((v) => heard.push(v));

  info.emit('reduceMotionChanged', true);
  unsubscribe();
  info.emit('reduceMotionChanged', false);
  expect(heard).toEqual([true]);
  expect(source.get()).toBe(false);
});

test('a rejected OS read leaves motion unreduced and the listener live', async () => {
  const source = nativeReducedMotionSource();
  info.answer!.reject(new Error('no accessibility service'));
  await tick();
  expect(source.get()).toBe(false);

  info.emit('reduceMotionChanged', true);
  expect(source.get()).toBe(true);
});

test('only reduceMotionChanged is listened for', () => {
  nativeReducedMotionSource();
  expect([...info.handlers.keys()]).toEqual(['reduceMotionChanged']);
});

test('exitA11yProps hides an exiting element from the accessibility tree', () => {
  expect(exitA11yProps(true)).toEqual({
    importantForAccessibility: 'no-hide-descendants',
    accessibilityElementsHidden: true,
  });
  expect(exitA11yProps(false)).toEqual({});
  // Called every render, so it hands back the same objects.
  expect(exitA11yProps(true)).toBe(exitA11yProps(true));
  expect(exitA11yProps(false)).toBe(exitA11yProps(false));
});

test('moveAccessibilityFocus focuses the parent, and does nothing without one', () => {
  moveAccessibilityFocus(null);
  expect(info.focused).toEqual([]);

  moveAccessibilityFocus(7);
  expect(info.focused).toEqual([7]);
});

const PARENT_TAG = 42;

function Row({ platform }: { platform: ElementPlatform }): ReactNode {
  const handle = useFlareElement({ exit: shatter() }, platform);
  const exiting = handle.phase === 'exiting';
  useLayoutEffect(() => {
    if (exiting) moveAccessibilityFocus(PARENT_TAG);
  }, [exiting]);
  return createElement('div', { 'data-row': '' });
}

test('a snapshot exit moves accessibility focus to the parent before the element is hidden', async () => {
  installDom();
  const driver = createFakeDriver();
  const target = createFakeTarget();
  const fx = createFakeFxRuntime();
  const ctx: FlareContextValue = {
    registry: createPresetRegistry(),
    reducedMotion: staticReducedMotion(false),
    fx,
    overlay: null,
    hostFactory: null,
    rtl: false,
  };
  const platform: ElementPlatform = { driver, target, size: () => ({ w: 100, h: 40 }) };
  const tree = (show: boolean): ReactNode =>
    createElement(
      FlareContext.Provider,
      { value: ctx },
      createElement(FlarePresence, null, show ? createElement(Row, { key: 'a', platform }) : null),
    );
  const hiddenAtFocus: number[] = [];
  info.onFocus = () => hiddenAtFocus.push(target.hidden.value);

  const r = render(tree(true));
  rendered.push(r);
  expect(info.focused).toEqual([]);

  r.rerender(tree(false));
  expect(info.focused).toEqual([PARENT_TAG]);
  expect(hiddenAtFocus).toEqual([0]);

  const { act } = await import('react');
  await act(async () => {
    await tick();
  });
  act(() => fx.handoff());
  expect(target.hidden.value).toBe(1);
  expect(info.focused).toEqual([PARENT_TAG]);
});
