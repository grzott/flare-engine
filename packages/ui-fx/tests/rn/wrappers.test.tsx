import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  act,
  type ComponentProps,
  createRef,
  type ReactNode,
  type Ref,
  type RefObject,
  StrictMode,
} from 'react';
import type { View as RNView } from 'react-native';
import type { Vec2Out } from '../../src/core/conventions';
import { fade, press, slide } from '../../src/core/presets';
import { createPresetRegistry } from '../../src/core/registry';
import { FlarePresence } from '../../src/runtime/presence';
import { useFlareContext } from '../../src/runtime/provider-context';
import { installDom, type Rendered, render } from '../support/dom';
import { installReanimatedMock } from '../support/mock-reanimated';
import { installRnMock } from '../support/mock-rn';

installDom();
const rn = installRnMock();
const reanimated = installReanimatedMock();

/** Every press point the wrappers handed to the runtime. */
const pressPoints: (Vec2Out | null)[] = [];

const element = await import('../../src/runtime/element');
// Taken before the mock: bun patches the loaded module, so `element.useFlareElement` becomes the spy.
const useRealElement = element.useFlareElement;
mock.module('../../src/runtime/element', () => ({
  ...element,
  useFlareElement: (...args: Parameters<typeof useRealElement>) => {
    const handle = useRealElement(...args);
    return {
      ...handle,
      onPressIn(point: Vec2Out | null) {
        pressPoints.push(point === null ? null : { ...point });
        handle.onPressIn(point);
      },
    };
  },
}));

// Loaded after the mocks, so the entry never reaches the real `react-native` or Reanimated.
const {
  createFlareComponent,
  FlareButton,
  FlareImage,
  FlarePressable,
  FlareProvider,
  FlareText,
  FlareView,
  useFlareFx,
} = await import('../../src/index');
const { Text, View } = await import('react-native');

const createdAtImport = reanimated.created.length;

interface Style {
  opacity: number;
  transform: Record<string, number | string>[];
}

const rendered: Rendered[] = [];

const mount = (el: ReactNode): Rendered => {
  const r = render(el);
  rendered.push(r);
  return r;
};

const find = (r: Rendered, testID: string): Element | null =>
  r.container.querySelector(`[data-testid="${testID}"]`);

const styleOf = (node: Element | null): Style =>
  reanimated.styleOf(rn.props(node).style) as unknown as Style;

const transformValue = (style: Style, key: string): number | string => {
  const entry = style.transform.find((candidate) => key in candidate);
  if (entry === undefined) throw new Error(`no ${key} in the transform list`);
  return entry[key]!;
};

/** Calls an event handler the host was rendered with, as React Native would. */
const fire = (node: Element | null, name: string, event: unknown = {}): void => {
  const handler = rn.props(node)[name];
  if (typeof handler !== 'function') throw new Error(`the host has no ${name}`);
  act(() => {
    handler(event);
  });
};

const touch = (x: number, y: number) => ({ nativeEvent: { locationX: x, locationY: y } });

beforeEach(() => {
  rn.reset();
  reanimated.reset();
  pressPoints.length = 0;
});

afterEach(() => {
  for (const r of rendered.splice(0)) r.unmount();
});

test('a FlareView enter={fade()} is transparent at t = 0 and opaque after the flush', () => {
  const onEntered = mock(() => {});
  const r = mount(<FlareView testID="box" enter={fade()} onEntered={onEntered} />);

  expect(styleOf(find(r, 'box')).opacity).toBe(0);
  expect(onEntered).not.toHaveBeenCalled();

  act(() => reanimated.flush());
  expect(styleOf(find(r, 'box')).opacity).toBe(1);
  expect(onEntered).toHaveBeenCalledTimes(1);
});

/** The animated style each render handed the host, evaluated during that render. */
const renderStyles: Style[] = [];

function Recorder(props: { style?: unknown }): ReactNode {
  renderStyles.push(reanimated.styleOf(props.style) as unknown as Style);
  return <View testID="recorder" {...(props as object)} />;
}

const FlareRecorder = createFlareComponent(Recorder);

test('an element with an enter is hidden from its first render, so its rest pose never shows', () => {
  renderStyles.length = 0;
  const r = mount(<FlareRecorder enter={slide({ from: 'bottom', distance: 30 })} />);

  // The enter starts in a layout effect, after this first render has been committed.
  expect(renderStyles[0]!.opacity).toBe(0);

  const playing = styleOf(find(r, 'recorder'));
  expect(playing.opacity).toBe(1);
  expect(transformValue(playing, 'translateY')).toBe(30);
});

test('an element without an enter is visible from its first render', () => {
  renderStyles.length = 0;
  mount(<FlareRecorder />);
  expect(renderStyles[0]!.opacity).toBe(1);
});

test('the style keeps the stable seven-entry transform list', () => {
  const r = mount(<FlareView testID="box" enter={slide({ from: 'right' })} />);
  const keys = (): string[] =>
    styleOf(find(r, 'box')).transform.map((entry) => Object.keys(entry)[0]!);
  const expected = [
    'perspective',
    'translateX',
    'translateY',
    'rotateX',
    'rotateY',
    'rotate',
    'scale',
  ];
  expect(keys()).toEqual(expected);
  expect(transformValue(styleOf(find(r, 'box')), 'perspective')).toBe(100000);
  act(() => reanimated.flush());
  expect(keys()).toEqual(expected);
});

test("the caller's style comes before the animated one", () => {
  const own = { backgroundColor: 'red' };
  const r = mount(<FlareView testID="box" style={own} />);
  const style = rn.props(find(r, 'box')).style;
  expect(Array.isArray(style)).toBe(true);
  expect((style as unknown[])[0]).toBe(own);
  expect(styleOf(find(r, 'box')).opacity).toBe(1);
});

test('a FlareButton exitOn="press" plays its exit on press, then calls onExited(true)', () => {
  const onExited = mock((_finished: boolean) => {});
  const onPress = mock(() => {});
  const r = mount(
    <FlareButton
      testID="button"
      label="Delete"
      exit={fade()}
      exitOn="press"
      onExited={onExited}
      onPress={onPress}
    />,
  );

  fire(find(r, 'button'), 'onPressIn', touch(12, 5));
  fire(find(r, 'button'), 'onPressOut');
  fire(find(r, 'button'), 'onPress');
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(onExited).not.toHaveBeenCalled();
  expect(styleOf(find(r, 'button')).opacity).toBe(1);
  expect(reanimated.timings.some((timing) => timing.finished === null)).toBe(true);

  act(() => reanimated.flush());
  expect(onExited.mock.calls).toEqual([[true]]);
  // Released: the button is gone, though its owner still renders it.
  expect(find(r, 'button')).toBeNull();
});

test('the press origin passed to the runtime is the locationX/Y of onPressIn', () => {
  const r = mount(<FlareButton testID="button" label="Delete" exit={fade()} exitOn="press" />);
  fire(find(r, 'button'), 'onPressIn', touch(12, 5));
  expect(pressPoints).toEqual([{ x: 12, y: 5 }]);
});

test('a FlareView reads the press origin from onTouchStart', () => {
  const onTouchStart = mock((_event: unknown) => {});
  const r = mount(<FlareView testID="box" onTouchStart={onTouchStart} />);
  const event = touch(30, 8);
  fire(find(r, 'box'), 'onTouchStart', event);
  expect(pressPoints).toEqual([{ x: 30, y: 8 }]);
  expect(onTouchStart.mock.calls).toEqual([[event]]);
});

test('a FlarePressable does not also read the origin from onTouchStart', () => {
  const r = mount(<FlarePressable testID="pressable" />);
  expect(rn.props(find(r, 'pressable')).onTouchStart).toBeUndefined();
  fire(find(r, 'pressable'), 'onPressIn', touch(3, 4));
  expect(pressPoints).toEqual([{ x: 3, y: 4 }]);
});

test('press feedback scales a FlarePressable to 0.96 while it is pressed', () => {
  const onPressIn = mock((_event: unknown) => {});
  const onPressOut = mock((_event: unknown) => {});
  const r = mount(
    <FlarePressable
      testID="pressable"
      press={press({ scale: 0.96 })}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    />,
  );
  fire(find(r, 'pressable'), 'onPressIn', touch(1, 1));
  act(() => reanimated.flush());
  expect(transformValue(styleOf(find(r, 'pressable')), 'scale')).toBeCloseTo(0.96, 6);
  expect(onPressIn).toHaveBeenCalledTimes(1);

  fire(find(r, 'pressable'), 'onPressOut');
  act(() => reanimated.flush());
  expect(transformValue(styleOf(find(r, 'pressable')), 'scale')).toBe(1);
  expect(onPressOut).toHaveBeenCalledTimes(1);
});

test('a touch that ends or is cancelled releases the press feedback of a FlareView', () => {
  const r = mount(<FlareView testID="box" press={press({ scale: 0.9 })} />);
  for (const release of ['onTouchEnd', 'onTouchCancel']) {
    fire(find(r, 'box'), 'onTouchStart', touch(1, 1));
    act(() => reanimated.flush());
    expect(transformValue(styleOf(find(r, 'box')), 'scale')).toBeCloseTo(0.9, 6);

    fire(find(r, 'box'), release);
    act(() => reanimated.flush());
    expect(transformValue(styleOf(find(r, 'box')), 'scale')).toBe(1);
  }
});

const list = (show: boolean, props: Partial<ComponentProps<typeof FlareView>> = {}): ReactNode => (
  <View testID="parent">
    <FlarePresence>
      {show ? <FlareView key="a" testID="row" exit={fade()} {...props} /> : null}
    </FlarePresence>
  </View>
);

test('an exiting FlareView renders pointerEvents="none", and drops it when it re-presents', () => {
  const onExited = mock((_finished: boolean) => {});
  const props = { pointerEvents: 'box-only', onExited } as const;
  const r = mount(list(true, props));
  expect(rn.props(find(r, 'row')).pointerEvents).toBe('box-only');

  r.rerender(list(false, props));
  expect(rn.props(find(r, 'row')).pointerEvents).toBe('none');

  r.rerender(list(true, props));
  expect(rn.props(find(r, 'row')).pointerEvents).toBe('box-only');
  expect(onExited.mock.calls).toEqual([[false]]);
});

test('an exiting FlareView without a pointerEvents of its own drops the prop again', () => {
  const r = mount(list(true));
  expect(rn.props(find(r, 'row')).pointerEvents).toBeUndefined();
  r.rerender(list(false));
  expect(rn.props(find(r, 'row')).pointerEvents).toBe('none');
  r.rerender(list(true));
  expect(rn.props(find(r, 'row')).pointerEvents).toBeUndefined();
});

test('an exiting FlareView leaves the accessibility tree, and returns when it re-presents', () => {
  const r = mount(list(true));
  expect(rn.props(find(r, 'row')).importantForAccessibility).toBeUndefined();
  expect(rn.props(find(r, 'row')).accessibilityElementsHidden).toBeUndefined();

  r.rerender(list(false));
  expect(rn.props(find(r, 'row')).importantForAccessibility).toBe('no-hide-descendants');
  expect(rn.props(find(r, 'row')).accessibilityElementsHidden).toBe(true);

  r.rerender(list(true));
  expect(rn.props(find(r, 'row')).importantForAccessibility).toBeUndefined();
  expect(rn.props(find(r, 'row')).accessibilityElementsHidden).toBeUndefined();
});

test('a removed FlareView unmounts once its exit ends', () => {
  const onExited = mock((_finished: boolean) => {});
  const r = mount(list(true, { onExited }));
  r.rerender(list(false, { onExited }));
  expect(find(r, 'row')).not.toBeNull();

  act(() => reanimated.flush());
  expect(find(r, 'row')).toBeNull();
  expect(onExited.mock.calls).toEqual([[true]]);
});

test('a FlareButton exitOn="press" moves accessibility focus to its parent once, before it is hidden', () => {
  const r = mount(
    <View testID="parent">
      <FlareButton testID="button" label="Delete" exit={fade()} exitOn="press" />
    </View>,
  );
  const button = find(r, 'button');
  const opacityAtFocus: number[] = [];
  rn.onFocus = () => opacityAtFocus.push(styleOf(button).opacity);

  fire(button, 'onPressIn', touch(2, 2));
  expect(rn.focused).toEqual([]);
  fire(button, 'onPress');
  expect(rn.focused).toEqual([rn.tagOf(find(r, 'parent')!)]);
  expect(opacityAtFocus).toEqual([1]);

  fire(button, 'onPress');
  act(() => reanimated.flush());
  expect(rn.focused).toHaveLength(1);
});

test('a list removal never moves accessibility focus', () => {
  const button = (show: boolean): ReactNode => (
    <View testID="parent">
      <FlarePresence>
        {show ? (
          <FlareButton key="a" testID="button" label="Row" exit={fade()} exitOn="press" />
        ) : null}
      </FlarePresence>
    </View>
  );
  const r = mount(button(true));
  r.rerender(button(false));
  expect(rn.props(find(r, 'button')).pointerEvents).toBe('none');
  // A press on a row that is already leaving starts nothing.
  fire(find(r, 'button'), 'onPress');
  act(() => reanimated.flush());
  expect(find(r, 'button')).toBeNull();
  expect(rn.focused).toEqual([]);
});

test('on the web a press exit asks for no native tag', () => {
  rn.platform.OS = 'web';
  const r = mount(
    <View testID="parent">
      <FlareButton testID="button" label="Delete" exit={fade()} exitOn="press" />
    </View>,
  );
  fire(find(r, 'button'), 'onPress');
  expect(rn.props(find(r, 'button')).pointerEvents).toBe('none');
  expect(rn.focused).toEqual([]);
});

test('two FlareProvider mounts, one under StrictMode, add one reduceMotionChanged listener', () => {
  mount(
    <StrictMode>
      <FlareProvider>
        <FlareView testID="a" />
      </FlareProvider>
    </StrictMode>,
  );
  const second = mount(
    <FlareProvider>
      <FlareView testID="b" />
    </FlareProvider>,
  );
  second.rerender(
    <FlareProvider>
      <FlareView testID="b" />
    </FlareProvider>,
  );
  expect(rn.reduceMotionListeners()).toBe(1);
});

test('a reducedMotion source given to FlareProvider replaces the default one', () => {
  const r = mount(
    <FlareProvider reducedMotion={{ get: () => true, subscribe: () => () => {} }}>
      <FlareView testID="box" enter={slide({ from: 'right', distance: 48 })} />
    </FlareProvider>,
  );
  // Reduced: the slide plays as its fade fallback, so nothing moves.
  expect(transformValue(styleOf(find(r, 'box')), 'translateX')).toBe(0);
  expect(styleOf(find(r, 'box')).opacity).toBe(0);
});

test('the OS setting, heard by the default source, reduces motion', () => {
  mount(<FlareProvider />);
  act(() => rn.emit('reduceMotionChanged', true));
  const r = mount(
    <FlareProvider>
      <FlareView testID="box" enter={slide({ from: 'right', distance: 48 })} />
    </FlareProvider>,
  );
  expect(transformValue(styleOf(find(r, 'box')), 'translateX')).toBe(0);
  act(() => rn.emit('reduceMotionChanged', false));
});

test('FlareProvider resolves named presets through its registry', () => {
  const registry = createPresetRegistry();
  registry.register('pop', fade({ opacity: 0.25 }));
  const r = mount(
    <FlareProvider registry={registry}>
      <FlareView testID="box" enter="pop" />
    </FlareProvider>,
  );
  expect(styleOf(find(r, 'box')).opacity).toBeCloseTo(0.25, 6);
});

test('FlareProvider rtl resolves the start edge to the right', () => {
  const tree = (rtl?: boolean): ReactNode => (
    <FlareProvider rtl={rtl}>
      <FlareView testID="box" enter={slide({ from: 'start', distance: 48 })} />
    </FlareProvider>
  );
  expect(transformValue(styleOf(find(mount(tree(true)), 'box')), 'translateX')).toBeCloseTo(48, 6);
  expect(transformValue(styleOf(find(mount(tree(false)), 'box')), 'translateX')).toBeCloseTo(
    -48,
    6,
  );
  expect(transformValue(styleOf(find(mount(tree()), 'box')), 'translateX')).toBeCloseTo(-48, 6);

  rn.i18n.isRTL = true;
  expect(transformValue(styleOf(find(mount(tree()), 'box')), 'translateX')).toBeCloseTo(48, 6);
});

function Tip({ show }: { show: boolean }): ReactNode {
  const Overlay = useFlareContext().overlay;
  if (Overlay === null || !show) return null;
  return (
    <Overlay>
      <View testID="tip" />
    </Overlay>
  );
}

test('FlareProvider renders an overlay layer that children can portal into', () => {
  const tree = (show: boolean): ReactNode => (
    <FlareProvider>
      <View testID="app">
        <Tip show={show} />
      </View>
    </FlareProvider>
  );
  const r = mount(tree(true));
  const app = find(r, 'app')!;
  const layer = r.container.lastElementChild!;
  expect(layer).not.toBe(app);
  expect(rn.props(layer).pointerEvents).toBe('box-none');
  expect(rn.props(layer).style).toEqual({
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  });

  const tip = find(r, 'tip');
  expect(tip).not.toBeNull();
  expect(layer.contains(tip)).toBe(true);
  expect(app.contains(tip)).toBe(false);

  r.rerender(tree(false));
  expect(find(r, 'tip')).toBeNull();
  expect(r.container.lastElementChild).toBe(layer);
});

test('content portalled into the overlay follows its updates', () => {
  function Label({ text }: { text: string }): ReactNode {
    const Overlay = useFlareContext().overlay;
    if (Overlay === null) return null;
    return (
      <Overlay>
        <Text testID="label">{text}</Text>
      </Overlay>
    );
  }
  const tree = (text: string): ReactNode => (
    <StrictMode>
      <FlareProvider>
        <Label text={text} />
      </FlareProvider>
    </StrictMode>
  );
  const r = mount(tree('one'));
  expect(r.container.querySelectorAll('[data-testid="label"]')).toHaveLength(1);
  expect(find(r, 'label')!.textContent).toBe('one');
  r.rerender(tree('two'));
  expect(find(r, 'label')!.textContent).toBe('two');
});

test('without a FlareProvider there is no overlay', () => {
  let overlay: unknown = 'unset';
  function Probe(): ReactNode {
    overlay = useFlareContext().overlay;
    return null;
  }
  mount(<Probe />);
  expect(overlay).toBeNull();
});

interface CardProps {
  title: string;
  ref?: Ref<RNView>;
  style?: unknown;
  pointerEvents?: 'none' | 'auto';
}

function Card({ title, ...host }: CardProps): ReactNode {
  return (
    <View testID="card" {...(host as object)}>
      <Text testID="title">{title}</Text>
    </View>
  );
}

const FlareCard = createFlareComponent(Card);

test('createFlareComponent(Custom) forwards ref to the host and passes props through', () => {
  const ref = createRef<RNView>();
  const r = mount(<FlareCard ref={ref} title="Hello" enter={fade()} />);
  const card = find(r, 'card');
  expect(card).not.toBeNull();
  expect(ref.current as unknown).toBe(card);
  expect(find(r, 'title')!.textContent).toBe('Hello');
  expect(styleOf(card).opacity).toBe(0);
  // The element options stay with the wrapper.
  expect(rn.props(card).enter).toBeUndefined();

  r.unmount();
  rendered.splice(rendered.indexOf(r), 1);
  expect(ref.current).toBeNull();
});

test('createFlareComponent forwards a callback ref too', () => {
  const seen: unknown[] = [];
  const r = mount(<FlareCard ref={(node) => void seen.push(node)} title="Hello" />);
  expect(seen.at(-1)).toBe(find(r, 'card'));
});

test('createAnimatedComponent is applied once per wrapped component, never during a render', () => {
  expect(createdAtImport).toBeGreaterThanOrEqual(4);
  const before = reanimated.created.length;
  const r = mount(
    <FlareProvider>
      <FlareView testID="a" />
      <FlareView testID="b" />
      <FlareButton label="c" />
      <FlareCard title="d" />
    </FlareProvider>,
  );
  r.rerender(
    <FlareProvider>
      <FlareView testID="a" />
    </FlareProvider>,
  );
  expect(reanimated.created.length).toBe(before);
  expect(new Set(reanimated.created).size).toBe(reanimated.created.length);
});

test('FlareText, FlareImage and FlarePressable wrap their React Native hosts', () => {
  const r = mount(
    <>
      {/* biome-ignore lint/correctness/noReactNativeRawText: FlareText is a Text */}
      <FlareText testID="text">Hi</FlareText>
      <FlareImage testID="image" source={{ uri: 'https://example.test/a.png' }} />
      <FlarePressable testID="pressable">
        <Text>Go</Text>
      </FlarePressable>
    </>,
  );
  expect(find(r, 'text')!.tagName).toBe('SPAN');
  expect(find(r, 'text')!.textContent).toBe('Hi');
  expect(find(r, 'image')!.tagName).toBe('IMG');
  expect(rn.props(find(r, 'image')).source).toEqual({ uri: 'https://example.test/a.png' });
  expect(find(r, 'pressable')!.textContent).toBe('Go');
  for (const id of ['text', 'image', 'pressable']) expect(styleOf(find(r, id)).opacity).toBe(1);
});

test('FlareButton renders its label as a Text, or its children', () => {
  const r = mount(
    <>
      <FlareButton testID="labelled" label="Save" />
      <FlareButton testID="custom">
        <View testID="icon" />
      </FlareButton>
    </>,
  );
  const labelled = find(r, 'labelled')!;
  expect(labelled.children).toHaveLength(1);
  expect(labelled.firstElementChild!.tagName).toBe('SPAN');
  expect(labelled.textContent).toBe('Save');
  expect(find(r, 'custom')!.contains(find(r, 'icon'))).toBe(true);
});

test('a FlareButton without exitOn="press" stays after a press', () => {
  const onPress = mock(() => {});
  const r = mount(<FlareButton testID="button" label="Save" exit={fade()} onPress={onPress} />);
  fire(find(r, 'button'), 'onPress');
  act(() => reanimated.flush());
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(find(r, 'button')).not.toBeNull();
  expect(rn.props(find(r, 'button')).pointerEvents).toBeUndefined();
});

function Player({ probe }: { probe(fx: ReturnType<typeof useFlareFx>): void }): ReactNode {
  const fx = useFlareFx();
  probe(fx);
  return <FlareView testID="box" ref={fx.ref} />;
}

test('useFlareFx plays a preset on the element its ref is on', async () => {
  let fx: ReturnType<typeof useFlareFx> | null = null;
  const r = mount(<Player probe={(next) => (fx = next)} />);
  const ref: RefObject<RNView | null> = fx!.ref;
  expect(ref.current as unknown).toBe(find(r, 'box'));

  let played: Promise<boolean> | null = null;
  act(() => {
    played = fx!.play(fade({ opacity: 0.5 }));
  });
  expect(styleOf(find(r, 'box')).opacity).toBe(1);
  act(() => reanimated.flush());
  expect(styleOf(find(r, 'box')).opacity).toBeCloseTo(0.5, 6);
  expect(await played!).toBe(true);

  // No snapshot runtime is mounted, so there is nothing to capture for.
  expect(await fx!.prepare()).toBe(false);
});

test('useFlareFx is the same object on every render, and resolves false without an element', async () => {
  const seen: ReturnType<typeof useFlareFx>[] = [];
  function Unbound(): ReactNode {
    seen.push(useFlareFx());
    return null;
  }
  const r = mount(<Unbound />);
  r.rerender(<Unbound />);
  expect(seen.length).toBeGreaterThan(1);
  expect(seen.at(-1)).toBe(seen[0]!);
  expect(await seen[0]!.play(fade())).toBe(false);
  expect(await seen[0]!.prepare()).toBe(false);
});

test('useFlareFx resolves false once its element has unmounted', async () => {
  let fx: ReturnType<typeof useFlareFx> | null = null;
  const tree = (show: boolean): ReactNode => (
    <>{show ? <Player probe={(next) => (fx = next)} /> : null}</>
  );
  const r = mount(tree(true));
  const held = fx!;
  r.rerender(tree(false));
  expect(await held.play(fade())).toBe(false);
});

const sourceFiles = (dir: string): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
};

test('nothing in src mentions TouchableWithoutFeedback', () => {
  const files = sourceFiles(join(import.meta.dir, '..', '..', 'src'));
  expect(files.length).toBeGreaterThan(0);
  const offenders = files.filter((file) =>
    readFileSync(file, 'utf8').includes('TouchableWithoutFeedback'),
  );
  expect(offenders).toEqual([]);
});
