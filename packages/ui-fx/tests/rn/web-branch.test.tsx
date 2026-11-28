import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { act, type ComponentProps, type ReactNode, StrictMode } from 'react';
import { fade, flip, press, slide } from '../../src/core/presets';
import { FlarePresence } from '../../src/runtime/presence';
import { installDom, type Rendered, render } from '../support/dom';
import { type FakeAnimation, installFakeAnimate } from '../support/fake-animate';
import { installReanimatedMock } from '../support/mock-reanimated';
import { installRnMock } from '../support/mock-rn';

installDom();
const waapi = installFakeAnimate();
const rn = installRnMock();
const reanimated = installReanimatedMock();

// react-native-web: the wrappers read the platform once, when they are created at import.
rn.platform.OS = 'web';

const { createFlareComponent, FlareButton, FlareView } = await import('../../src/index');
const { View } = await import('react-native');

const rendered: Rendered[] = [];

const mount = (el: ReactNode): Rendered => {
  const r = render(el);
  rendered.push(r);
  return r;
};

const find = (r: Rendered, testID: string): Element | null =>
  r.container.querySelector(`[data-testid="${testID}"]`);

/** Runs the animations to their end and lets the driver hear of it. */
const finish = async (animations: FakeAnimation[]): Promise<void> => {
  await act(async () => {
    for (const animation of animations) animation.finish();
  });
};

const fire = (node: Element | null, name: string, event: unknown = {}): void => {
  const handler = rn.props(node)[name];
  if (typeof handler !== 'function') throw new Error(`the host has no ${name}`);
  act(() => {
    handler(event);
  });
};

const touch = (x: number, y: number) => ({ nativeEvent: { locationX: x, locationY: y } });

beforeEach(() => {
  waapi.reset();
  reanimated.reset();
});

afterEach(() => {
  for (const r of rendered.splice(0)) r.unmount();
});

test('on the web a FlareView enters through the web driver, never through useAnimatedStyle', async () => {
  const onEntered = mock(() => {});
  const r = mount(
    <FlareView testID="box" enter={fade({ duration: 0.25 })} onEntered={onEntered} />,
  );
  const box = find(r, 'box')!;

  expect(reanimated.styleRenders).toBe(0);
  expect(reanimated.timings).toEqual([]);
  expect(waapi.animations).toHaveLength(2);
  const [transform, paint] = waapi.animations;
  expect(transform!.target).toBe(box);
  expect(paint!.target).toBe(box);
  expect(transform!.keyframes).toHaveLength(16);
  expect(transform!.options.composite).toBe('add');
  expect(paint!.options.composite).toBe('replace');
  expect(paint!.keyframes[0]!.opacity).toBe(0);
  expect(onEntered).not.toHaveBeenCalled();

  await finish(waapi.animations);
  expect(onEntered).toHaveBeenCalledTimes(1);
  expect(reanimated.styleRenders).toBe(0);
});

test('on the web no host is made an animated component', () => {
  expect(reanimated.created).toEqual([]);
});

test("on the web the host gets the caller's style, with no animated style after it", () => {
  const own = { backgroundColor: 'red' };
  const r = mount(<FlareView testID="box" style={own} />);
  expect(rn.props(find(r, 'box')).style).toBe(own);
  expect(waapi.animations).toEqual([]);
});

test("on the web the origin of a flip follows the caller's style, and the flip plays in 3D", () => {
  const own = { backgroundColor: 'red' };
  const r = mount(
    <FlareView testID="box" style={own} enter={flip({ origin: { x: 0, y: 0.5 } })} />,
  );
  expect(rn.props(find(r, 'box')).style).toEqual([own, { transformOrigin: '0% 50%' }]);
  expect(waapi.animations[0]!.keyframes[0]!.transform).toBe(
    'perspective(800px) translate(0px, 0px) rotateX(0deg) rotateY(90deg) rotate(0deg) scale(1)',
  );
  expect(reanimated.styleRenders).toBe(0);
});

test('an entering slide starts from its distance', () => {
  mount(<FlareView testID="box" enter={slide({ from: 'right', distance: 48 })} />);
  expect(waapi.animations[0]!.keyframes[0]!.transform).toBe(
    'translate(48px, 0px) rotate(0deg) scale(1)',
  );
});

const list = (show: boolean, props: Partial<ComponentProps<typeof FlareView>> = {}): ReactNode => (
  <FlarePresence>
    {show ? <FlareView key="a" testID="row" exit={fade()} {...props} /> : null}
  </FlarePresence>
);

test('a removed FlareView plays its exit on the web driver and unmounts when both end', async () => {
  const onExited = mock((_finished: boolean) => {});
  const r = mount(list(true, { onExited }));
  expect(waapi.animations).toEqual([]);

  r.rerender(list(false, { onExited }));
  expect(waapi.animations).toHaveLength(2);
  expect(waapi.animations[1]!.keyframes.at(-1)!.opacity).toBe(0);
  expect(rn.props(find(r, 'row')).pointerEvents).toBe('none');

  await finish([waapi.animations[0]!]);
  expect(find(r, 'row')).not.toBeNull();
  await finish([waapi.animations[1]!]);
  expect(find(r, 'row')).toBeNull();
  expect(onExited.mock.calls).toEqual([[true]]);
});

test('a row that comes back during its exit reverses both animations', () => {
  const onExited = mock((_finished: boolean) => {});
  const r = mount(list(true, { onExited }));
  r.rerender(list(false, { onExited }));
  r.rerender(list(true, { onExited }));

  expect(waapi.animations).toHaveLength(2);
  expect(waapi.animations[0]!.calls).toEqual(['reverse']);
  expect(waapi.animations[1]!.calls).toEqual(['reverse']);
  expect(onExited.mock.calls).toEqual([[false]]);
  expect(rn.props(find(r, 'row')).pointerEvents).toBeUndefined();
});

test('a FlareButton exitOn="press" exits on the web driver and is released at its end', async () => {
  const onExited = mock((_finished: boolean) => {});
  const r = mount(
    <FlareButton testID="button" label="Delete" exit={fade()} exitOn="press" onExited={onExited} />,
  );
  fire(find(r, 'button'), 'onPressIn', touch(12, 5));
  fire(find(r, 'button'), 'onPress');
  expect(waapi.animations).toHaveLength(2);

  await finish(waapi.animations);
  expect(onExited.mock.calls).toEqual([[true]]);
  expect(find(r, 'button')).toBeNull();
});

test('press feedback is an added scale animation on the host', () => {
  const r = mount(<FlareView testID="box" press={press({ scale: 0.5 })} />);
  fire(find(r, 'box'), 'onTouchStart', touch(1, 1));
  expect(waapi.animations).toHaveLength(1);
  expect(waapi.animations[0]!.target).toBe(find(r, 'box')!);
  expect(waapi.animations[0]!.options.composite).toBe('add');
  expect(waapi.animations[0]!.keyframes).toEqual([
    { transform: 'scale(1)' },
    { transform: 'scale(0.5)' },
  ]);

  fire(find(r, 'box'), 'onTouchEnd');
  expect(waapi.animations).toHaveLength(2);
  expect(waapi.animations[1]!.keyframes[1]).toEqual({ transform: 'scale(1)' });
  expect(reanimated.timings).toEqual([]);
});

test('under StrictMode the enter is left with one pair of animations on the host', () => {
  const r = mount(
    <StrictMode>
      <FlareView testID="box" enter={slide({ from: 'right' })} />
    </StrictMode>,
  );
  // Added transforms stack, so a pair left over from the first effect pass would double the slide.
  expect(waapi.liveOn(find(r, 'box'))).toHaveLength(2);
});

test('unmounting removes the animations from the host', () => {
  const r = mount(<FlareView testID="box" enter={fade()} />);
  const box = find(r, 'box');
  expect(waapi.liveOn(box)).toHaveLength(2);
  r.unmount();
  rendered.splice(rendered.indexOf(r), 1);
  expect(waapi.liveOn(box)).toEqual([]);
});

function Card(props: { style?: unknown }): ReactNode {
  return <View testID="card" {...(props as object)} />;
}

const FlareCard = createFlareComponent(Card);

test('createFlareComponent(Custom) animates the host its ref reaches', () => {
  const r = mount(<FlareCard enter={fade()} />);
  expect(waapi.liveOn(find(r, 'card'))).toHaveLength(2);
  expect(reanimated.created).toEqual([]);
  expect(reanimated.styleRenders).toBe(0);
});
