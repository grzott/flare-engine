import { mock } from 'bun:test';
import { createElement, type ReactNode, type Ref } from 'react';

type Handler = (enabled: boolean) => void;

type HostProps = Record<string, unknown> & {
  ref?: Ref<unknown>;
  testID?: string;
  children?: unknown;
};

const hostProps = new WeakMap<object, HostProps>();
const tags = new WeakMap<object, number>();
let nextTag = 1;

/** What the tests drive and read. */
export const rn = {
  platform: { OS: 'android' },
  i18n: { isRTL: false },
  /** What `PixelRatio.get()` answers. */
  pixelRatio: 1,
  handlers: new Map<string, Set<Handler>>(),
  /** Every tag `AccessibilityInfo.setAccessibilityFocus` was called with. */
  focused: [] as number[],
  /** Runs inside every `setAccessibilityFocus` call. */
  onFocus: null as (() => void) | null,
  /** How many `reduceMotionChanged` listeners are registered. */
  reduceMotionListeners(): number {
    return rn.handlers.get('reduceMotionChanged')?.size ?? 0;
  },
  emit(name: string, enabled: boolean): void {
    for (const handler of rn.handlers.get(name) ?? []) handler(enabled);
  },
  /** The props the host component behind a DOM node was last rendered with. */
  props(node: Element | null): HostProps {
    const props = node === null ? undefined : hostProps.get(node);
    if (props === undefined) throw new Error('mock-rn: not a mounted host component');
    return props;
  },
  /** The native tag `findNodeHandle` gives a node. */
  tagOf(node: object): number {
    let tag = tags.get(node);
    if (tag === undefined) {
      tag = nextTag++;
      tags.set(node, tag);
    }
    return tag;
  },
  /** Forgets accessibility calls. Listeners stay: a module-scope source adds its own only once. */
  reset(): void {
    rn.focused = [];
    rn.onFocus = null;
    rn.platform.OS = 'android';
    rn.i18n.isRTL = false;
    rn.pixelRatio = 1;
  },
};

const host = (tag: string) =>
  function Host(props: HostProps): ReactNode {
    const { ref, testID, children } = props;
    const attach = (node: Element | null): void => {
      if (node !== null) hostProps.set(node, props);
      if (typeof ref === 'function') ref(node);
      else if (ref != null) ref.current = node;
    };
    const content = typeof children === 'function' ? children({ pressed: false }) : children;
    return createElement(
      tag,
      { ref: attach, 'data-testid': testID },
      tag === 'img' ? undefined : (content as ReactNode),
    );
  };

const reactNativeModule = {
  View: host('div'),
  Text: host('span'),
  Image: host('img'),
  Pressable: host('div'),
  Platform: rn.platform,
  I18nManager: rn.i18n,
  PixelRatio: { get: (): number => rn.pixelRatio },
  findNodeHandle: (node: object | null): number | null => (node === null ? null : rn.tagOf(node)),
  AccessibilityInfo: {
    isReduceMotionEnabled: (): Promise<boolean> => Promise.resolve(false),
    addEventListener(name: string, handler: Handler) {
      const set = rn.handlers.get(name) ?? new Set<Handler>();
      rn.handlers.set(name, set);
      set.add(handler);
      return { remove: () => set.delete(handler) };
    },
    setAccessibilityFocus(reactTag: number): void {
      rn.focused.push(reactTag);
      rn.onFocus?.();
    },
  },
};

/**
 * Replaces `react-native`. Call it before importing the module under test.
 *
 * `View`, `Text`, `Image` and `Pressable` render a `div`, `span`, `img` and `div`. The DOM node
 * takes only `testID` (as `data-testid`); every other prop, `style` and the event handlers
 * included, is read back with `rn.props(node)`.
 */
export const installRnMock = (): typeof rn => {
  mock.module('react-native', () => reactNativeModule);
  return rn;
};
