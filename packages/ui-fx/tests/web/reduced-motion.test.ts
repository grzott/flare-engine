import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { A11yManager } from '@flare-engine/a11y';
import { act, createElement, type ReactNode, useLayoutEffect, useRef } from 'react';
import { fade, shatter } from '../../src/core/presets';
import type { PresetRef } from '../../src/core/registry';
import { createPresetRegistry } from '../../src/core/registry';
import { type ElementPlatform, useFlareElement } from '../../src/runtime/element';
import { FlarePresence } from '../../src/runtime/presence';
import { FlareContext, type FlareContextValue } from '../../src/runtime/provider-context';
import { exitA11yProps, moveFocusOff, webReducedMotionSource } from '../../src/web/reduced-motion';
import { installDom, type Rendered, render } from '../support/dom';
import {
  createFakeDriver,
  createFakeFxRuntime,
  createFakeTarget,
  type FakeDriver,
  type FakeFxRuntime,
  type FakeTarget,
  staticReducedMotion,
} from '../support/fakes';

interface FakeMedia {
  matches: boolean;
  /** The query of every `matchMedia` call. */
  queries: string[];
  listeners: Set<(e: { matches: boolean }) => void>;
  emit(matches: boolean): void;
}

/** Replaces `globalThis.matchMedia` with one list that tests drive by hand. */
const installMatchMedia = (matches: boolean): FakeMedia => {
  const media: FakeMedia = {
    matches,
    queries: [],
    listeners: new Set(),
    emit(next) {
      media.matches = next;
      for (const listener of media.listeners) listener({ matches: next });
    },
  };
  const list = {
    get matches() {
      return media.matches;
    },
    addEventListener(type: string, listener: (e: { matches: boolean }) => void) {
      if (type === 'change') media.listeners.add(listener);
    },
    removeEventListener(_type: string, listener: (e: { matches: boolean }) => void) {
      media.listeners.delete(listener);
    },
  };
  Reflect.set(globalThis, 'matchMedia', (query: string) => {
    media.queries.push(query);
    return list;
  });
  return media;
};

// This block runs first, before anything registers a DOM.
describe('without a window (C19)', () => {
  test('importing the module does not throw', async () => {
    expect(Reflect.get(globalThis, 'window')).toBeUndefined();
    expect(Reflect.get(globalThis, 'matchMedia')).toBeUndefined();
    const loaded = await import('../../src/web/reduced-motion');
    expect(typeof loaded.webReducedMotionSource).toBe('function');
  });

  test('a source reports unreduced motion and takes subscribers', () => {
    const source = webReducedMotionSource();
    expect(source.get()).toBe(false);
    const unsubscribe = source.subscribe(() => {});
    expect(() => unsubscribe()).not.toThrow();
  });

  test('a source made on the server starts listening once matchMedia exists', () => {
    const source = webReducedMotionSource();
    expect(source.get()).toBe(false);

    installMatchMedia(true);
    expect(source.get()).toBe(true);
    Reflect.deleteProperty(globalThis, 'matchMedia');
  });
});

describe('webReducedMotionSource', () => {
  test('matchMedia is called lazily, once, on the first get', () => {
    const media = installMatchMedia(true);
    const source = webReducedMotionSource();
    expect(media.queries).toEqual([]);

    expect(source.get()).toBe(true);
    expect(source.get()).toBe(true);
    source.subscribe(() => {});
    expect(media.queries).toEqual(['(prefers-reduced-motion: reduce)']);
  });

  test('matchMedia is called on the first subscribe', () => {
    const media = installMatchMedia(false);
    const source = webReducedMotionSource();
    const heard: boolean[] = [];
    source.subscribe((v) => heard.push(v));
    expect(media.queries).toHaveLength(1);
    // The first read is not a change.
    expect(heard).toEqual([]);
  });

  test('a change event updates get() and subscribers', () => {
    const media = installMatchMedia(false);
    const source = webReducedMotionSource();
    const first: boolean[] = [];
    const second: boolean[] = [];
    source.subscribe((v) => first.push(v));
    const unsubscribe = source.subscribe((v) => second.push(v));

    media.emit(true);
    expect(source.get()).toBe(true);
    unsubscribe();
    media.emit(false);
    expect(source.get()).toBe(false);
    expect(first).toEqual([true, false]);
    expect(second).toEqual([true]);
  });

  test('the first read and every change reach the manager', () => {
    const media = installMatchMedia(true);
    const manager = new A11yManager();
    const setReducedMotion = spyOn(manager, 'setReducedMotion');
    const source = webReducedMotionSource(manager);
    expect(setReducedMotion).not.toHaveBeenCalled();

    source.get();
    expect(manager.reducedMotion).toBe(true);

    media.emit(false);
    expect(setReducedMotion).toHaveBeenLastCalledWith(false);
    expect(manager.reducedMotion).toBe(false);
  });
});

describe('exitA11yProps', () => {
  test('aria-hidden while exiting, nothing otherwise', () => {
    expect(exitA11yProps(true)).toEqual({ 'aria-hidden': true });
    expect(exitA11yProps(false)).toEqual({});
    // Called every render, so it hands back the same objects.
    expect(exitA11yProps(true)).toBe(exitA11yProps(true));
    expect(exitA11yProps(false)).toBe(exitA11yProps(false));
  });
});

describe('moveFocusOff', () => {
  const mounted: HTMLElement[] = [];

  const mount = (html: string): HTMLElement => {
    installDom();
    const root = document.createElement('div');
    root.innerHTML = html;
    document.body.appendChild(root);
    mounted.push(root);
    return root;
  };

  const focus = (root: HTMLElement, selector: string): HTMLElement => {
    const el = root.querySelector<HTMLElement>(selector)!;
    el.focus();
    expect(document.activeElement).toBe(el);
    return el;
  };

  afterEach(() => {
    for (const root of mounted.splice(0)) root.remove();
  });

  test('focus goes to the next focusable sibling, past ones that take none', () => {
    const root = mount(
      '<button id="a">a</button><span>text</span><button disabled>off</button><button id="b">b</button>',
    );
    const a = focus(root, '#a');

    moveFocusOff(a);
    expect(document.activeElement).toBe(root.querySelector('#b'));
  });

  test('a focused descendant counts, and a sibling may hold the focusable', () => {
    const root = mount(
      '<div id="row-a"><button id="a">a</button></div><div id="row-b"><a id="b" href="#b">b</a></div>',
    );
    focus(root, '#a');

    moveFocusOff(root.querySelector('#row-a')!);
    expect(document.activeElement).toBe(root.querySelector('#b'));
  });

  test('a sibling that is itself leaving is skipped', () => {
    const root = mount(
      '<button id="a">a</button><button id="b" aria-hidden="true">b</button><button id="c">c</button>',
    );
    const a = focus(root, '#a');

    moveFocusOff(a);
    expect(document.activeElement).toBe(root.querySelector('#c'));
  });

  test('a sibling whose focusable refuses focus is skipped', () => {
    const root = mount(
      '<button id="a">a</button><div inert><button>off</button></div><button id="c">c</button>',
    );
    const a = focus(root, '#a');

    moveFocusOff(a);
    expect(document.activeElement).toBe(root.querySelector('#c'));
  });

  test('a hidden input is not a focus target', () => {
    const root = mount(
      '<button id="a">a</button><input type="hidden" name="token" /><button id="c">c</button>',
    );
    const a = focus(root, '#a');

    moveFocusOff(a);
    expect(document.activeElement).toBe(root.querySelector('#c'));
  });

  test('with no focusable sibling after it, focus goes to document.body', () => {
    const root = mount('<button id="before">before</button><button id="a">a</button><p>text</p>');
    const a = focus(root, '#a');

    moveFocusOff(a);
    expect(document.activeElement).toBe(document.body);
  });

  test('focus elsewhere is left alone', () => {
    const root = mount('<button id="a">a</button><button id="b">b</button><input id="c" />');
    const c = focus(root, '#c');

    moveFocusOff(root.querySelector('#a')!);
    expect(document.activeElement).toBe(c);
  });
});

describe('in the element runtime', () => {
  interface RowProps {
    id: string;
    platform: ElementPlatform;
    exit: PresetRef;
  }

  // What the Task 13 and Task 15 wrappers do with the handle.
  function Row({ id, platform, exit }: RowProps): ReactNode {
    const ref = useRef<HTMLDivElement>(null);
    const handle = useFlareElement({ exit }, platform);
    const exiting = handle.phase === 'exiting';
    useLayoutEffect(() => {
      if (exiting && ref.current !== null) moveFocusOff(ref.current);
    }, [exiting]);
    return createElement(
      'div',
      { ref, 'data-row': id, ...exitA11yProps(exiting) },
      createElement('button', { type: 'button' }, id),
    );
  }

  interface Harness {
    fx: FakeFxRuntime;
    drivers: Record<string, FakeDriver>;
    targets: Record<string, FakeTarget>;
    tree(ids: readonly string[]): ReactNode;
    mount(ids: readonly string[]): Rendered;
  }

  const rendered: Rendered[] = [];

  afterEach(() => {
    for (const r of rendered.splice(0)) r.unmount();
  });

  const harness = (exit: PresetRef): Harness => {
    installDom();
    const fx = createFakeFxRuntime();
    const ctx: FlareContextValue = {
      registry: createPresetRegistry(),
      reducedMotion: staticReducedMotion(false),
      fx,
      overlay: null,
      hostFactory: null,
      rtl: false,
    };
    const platforms: Record<string, ElementPlatform> = {};
    const h: Harness = {
      fx,
      drivers: {},
      targets: {},
      tree(ids) {
        return createElement(
          FlareContext.Provider,
          { value: ctx },
          createElement(
            FlarePresence,
            null,
            ids.map((id) => {
              if (platforms[id] === undefined) {
                const driver = createFakeDriver();
                const target = createFakeTarget();
                h.drivers[id] = driver;
                h.targets[id] = target;
                platforms[id] = { driver, target, size: () => ({ w: 100, h: 40 }) };
              }
              return createElement(Row, { key: id, id, platform: platforms[id]!, exit });
            }),
          ),
        );
      },
      mount(ids) {
        const r = render(h.tree(ids));
        rendered.push(r);
        return r;
      },
    };
    return h;
  };

  const row = (r: Rendered, id: string): HTMLElement | null =>
    r.container.querySelector<HTMLElement>(`[data-row="${id}"]`);
  const button = (r: Rendered, id: string): HTMLElement => row(r, id)!.querySelector('button')!;

  const settle = (): Promise<void> =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

  test('an exiting element gets aria-hidden, and loses it when it comes back', () => {
    const h = harness(fade());
    const r = h.mount(['a']);
    expect(row(r, 'a')!.hasAttribute('aria-hidden')).toBe(false);

    r.rerender(h.tree([]));
    expect(row(r, 'a')!.getAttribute('aria-hidden')).toBe('true');

    r.rerender(h.tree(['a']));
    expect(row(r, 'a')!.hasAttribute('aria-hidden')).toBe(false);
  });

  test('a focused element that starts a snapshot exit moves focus before it is hidden', async () => {
    const h = harness(shatter());
    const r = h.mount(['a', 'b']);
    button(r, 'a').focus();
    expect(document.activeElement).toBe(button(r, 'a'));

    const target = h.targets.a!;
    const focusAtHide: (Element | null)[] = [];
    const hideSync = target.hideSync;
    target.hideSync = () => {
      focusAtHide.push(document.activeElement);
      hideSync();
    };

    r.rerender(h.tree(['b']));
    expect(document.activeElement).toBe(button(r, 'b'));
    expect(row(r, 'a')!.getAttribute('aria-hidden')).toBe('true');
    expect(target.hidden.value).toBe(0);

    await settle();
    expect(h.fx.runs).toHaveLength(1);
    act(() => h.fx.handoff());
    expect(target.hidden.value).toBe(1);
    expect(focusAtHide).toEqual([button(r, 'b')]);
  });

  test('with nothing after it, a focused exiting element hands focus to document.body', () => {
    const h = harness(shatter());
    const r = h.mount(['a', 'b']);
    button(r, 'b').focus();

    r.rerender(h.tree(['a']));
    expect(document.activeElement).toBe(document.body);
    expect(h.targets.b!.hidden.value).toBe(0);
  });

  test('an exit does not take focus from another element', () => {
    const h = harness(shatter());
    const r = h.mount(['a', 'b']);
    button(r, 'b').focus();

    r.rerender(h.tree(['b']));
    expect(document.activeElement).toBe(button(r, 'b'));
  });
});
