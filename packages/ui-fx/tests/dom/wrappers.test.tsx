import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { act, type ComponentProps, createRef, type ReactNode, type Ref, StrictMode } from 'react';
import type { Vec2Out } from '../../src/core/conventions';
import { fade, press, slide } from '../../src/core/presets';
import { createPresetRegistry } from '../../src/core/registry';
import { FlarePresence } from '../../src/runtime/presence';
import { useFlareContext } from '../../src/runtime/provider-context';
import { installDom, type Rendered, render } from '../support/dom';
import { type FakeAnimation, installFakeAnimate } from '../support/fake-animate';

installDom();
const waapi = installFakeAnimate();

/** Every module `./dom` must never load that was asked for anyway. */
const forbiddenLoads: string[] = [];
for (const name of ['react-native', 'react-native-reanimated']) {
  mock.module(name, () => {
    forbiddenLoads.push(name);
    throw new Error(`./dom loaded ${name}`);
  });
}

/** The query of every `matchMedia` call. */
const mediaQueries: string[] = [];
const media = { matches: false };
Reflect.set(globalThis, 'matchMedia', (query: string) => {
  mediaQueries.push(query);
  return {
    get matches() {
      return media.matches;
    },
    addEventListener() {},
    removeEventListener() {},
  };
});

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

const {
  createFlareComponent,
  FlareButton,
  FlareDiv,
  FlareImg,
  FlareLi,
  FlareProvider,
  FlareSpan,
  useFlareFx,
} = await import('../../src/dom');

const rendered: Rendered[] = [];

const mount = (el: ReactNode): Rendered => {
  const r = render(el);
  rendered.push(r);
  return r;
};

const find = (r: Rendered, id: string): HTMLElement | null =>
  r.container.querySelector<HTMLElement>(`[data-testid="${id}"]`);

/** Runs the animations to their end and lets the driver hear of it. */
const finish = async (animations: FakeAnimation[]): Promise<void> => {
  await act(async () => {
    for (const animation of animations) animation.finish();
  });
};

const pointer = (node: Element | null, type: string, x = 0, y = 0): void => {
  act(() => {
    node!.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }),
    );
  });
};

const click = (node: Element | null): void => {
  act(() => {
    node!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
};

/** Lays `node` out at (`left`, `top`), 100 by 40. */
const placeAt = (node: HTMLElement, left: number, top: number): void => {
  node.getBoundingClientRect = () => new DOMRect(left, top, 100, 40);
};

beforeEach(() => {
  waapi.reset();
  pressPoints.length = 0;
});

afterEach(() => {
  for (const r of rendered.splice(0)) r.unmount();
});

test('importing ./dom loads neither react-native nor Reanimated', () => {
  expect(forbiddenLoads).toEqual([]);
});

test('a FlareDiv enter={slide({ from: "right" })} starts 48 px to the right', () => {
  const r = mount(<FlareDiv data-testid="box" enter={slide({ from: 'right' })} />);
  const box = find(r, 'box')!;
  expect(box.tagName).toBe('DIV');
  expect(waapi.animations).toHaveLength(2);
  expect(waapi.animations[0]!.target).toBe(box);
  expect(waapi.animations[0]!.keyframes[0]!.transform).toBe(
    'translate(48px, 0px) rotate(0deg) scale(1)',
  );
});

test('an entered FlareDiv calls onEntered once both animations end', async () => {
  const onEntered = mock(() => {});
  mount(<FlareDiv enter={fade()} onEntered={onEntered} />);
  expect(onEntered).not.toHaveBeenCalled();
  await finish(waapi.animations);
  expect(onEntered).toHaveBeenCalledTimes(1);
});

test('a FlareButton exitOn="press" passes the pointerdown point, in element pixels, to the runtime', () => {
  const r = mount(<FlareButton data-testid="button" exit={fade()} exitOn="press" />);
  const button = find(r, 'button')!;
  expect(button.tagName).toBe('BUTTON');
  placeAt(button, 100, 50);
  pointer(button, 'pointerdown', 110, 55);
  expect(pressPoints).toEqual([{ x: 10, y: 5 }]);
});

test('a pointerdown on a child is still measured from the host', () => {
  const r = mount(
    <FlareDiv data-testid="box">
      <span data-testid="inner" />
    </FlareDiv>,
  );
  placeAt(find(r, 'box')!, 20, 30);
  placeAt(find(r, 'inner')!, 60, 40);
  pointer(find(r, 'inner'), 'pointerdown', 70, 45);
  expect(pressPoints).toEqual([{ x: 50, y: 15 }]);
});

test('a FlareButton exitOn="press" plays its exit on click, then is released', async () => {
  const onExited = mock((_finished: boolean) => {});
  const onClick = mock(() => {});
  const r = mount(
    <FlareButton
      data-testid="button"
      exit={fade()}
      exitOn="press"
      onExited={onExited}
      onClick={onClick}
    />,
  );
  pointer(find(r, 'button'), 'pointerdown', 10, 5);
  click(find(r, 'button'));
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(waapi.animations).toHaveLength(2);
  expect(waapi.animations[1]!.keyframes.at(-1)!.opacity).toBe(0);
  expect(find(r, 'button')!.style.pointerEvents).toBe('none');
  expect(find(r, 'button')!.getAttribute('aria-hidden')).toBe('true');

  await finish(waapi.animations);
  expect(onExited.mock.calls).toEqual([[true]]);
  expect(find(r, 'button')).toBeNull();
});

test('a FlareButton without exitOn="press" stays after a click', () => {
  const r = mount(<FlareButton data-testid="button" exit={fade()} />);
  click(find(r, 'button'));
  expect(waapi.animations).toEqual([]);
  expect(find(r, 'button')!.style.pointerEvents).toBe('');
});

const list = (show: boolean, props: Partial<ComponentProps<typeof FlareDiv>> = {}): ReactNode => (
  <FlarePresence>
    {show ? <FlareDiv key="a" data-testid="row" exit={fade()} {...props} /> : null}
  </FlarePresence>
);

test('an exiting FlareDiv has pointer-events: none until it re-presents (C40)', () => {
  const r = mount(list(true));
  expect(find(r, 'row')!.style.pointerEvents).toBe('');
  r.rerender(list(false));
  expect(find(r, 'row')!.style.pointerEvents).toBe('none');
  r.rerender(list(true));
  expect(find(r, 'row')!.style.pointerEvents).toBe('');
});

test('an exiting FlareDiv has pointer-events: none until it is released (C40)', async () => {
  const r = mount(list(true));
  r.rerender(list(false));
  await finish([waapi.animations[0]!]);
  expect(find(r, 'row')!.style.pointerEvents).toBe('none');
  await finish([waapi.animations[1]!]);
  expect(find(r, 'row')).toBeNull();
});

test('an exiting FlareDiv keeps the rest of its style and gets its own pointer-events back', () => {
  const style = { color: 'red', pointerEvents: 'auto' } as const;
  const r = mount(list(true, { style }));
  r.rerender(list(false, { style }));
  expect(find(r, 'row')!.style.pointerEvents).toBe('none');
  expect(find(r, 'row')!.style.color).toBe('red');
  r.rerender(list(true, { style }));
  expect(find(r, 'row')!.style.pointerEvents).toBe('auto');
});

test('an exiting FlareDiv has aria-hidden="true" until it re-presents', () => {
  const r = mount(list(true));
  expect(find(r, 'row')!.hasAttribute('aria-hidden')).toBe(false);
  r.rerender(list(false));
  expect(find(r, 'row')!.getAttribute('aria-hidden')).toBe('true');
  r.rerender(list(true));
  expect(find(r, 'row')!.hasAttribute('aria-hidden')).toBe(false);
});

test('an exiting FlareDiv has aria-hidden="true" until it is released', async () => {
  const r = mount(list(true));
  r.rerender(list(false));
  await finish([waapi.animations[0]!]);
  expect(find(r, 'row')!.getAttribute('aria-hidden')).toBe('true');
  await finish([waapi.animations[1]!]);
  expect(find(r, 'row')).toBeNull();
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
});

test('a focused FlareButton whose exit starts hands focus to the next focusable sibling before it is hidden', () => {
  const r = mount(
    <div>
      <FlareButton data-testid="first" exit={fade()} exitOn="press" />
      <span data-testid="not-focusable" />
      <button type="button" data-testid="second" />
    </div>,
  );
  const first = find(r, 'first')!;
  first.focus();
  expect(document.activeElement).toBe(first);

  click(first);
  // The exit has only started: the button is still mounted and nothing has hidden it.
  expect(find(r, 'first')).toBe(first);
  expect(first.style.visibility).toBe('');
  expect(waapi.animations).toHaveLength(2);
  expect(document.activeElement).toBe(find(r, 'second'));
});

test('a removed row hands on the focus one of its descendants holds', () => {
  const rows = (ids: readonly string[]): ReactNode => (
    <FlarePresence>
      {ids.map((id) => (
        <FlareLi key={id} data-testid={id} exit={fade()}>
          <button type="button" data-testid={`${id}-button`} />
        </FlareLi>
      ))}
    </FlarePresence>
  );
  const r = mount(rows(['a', 'b']));
  find(r, 'a-button')!.focus();
  r.rerender(rows(['b']));
  expect(find(r, 'a')).not.toBeNull();
  expect(document.activeElement).toBe(find(r, 'b-button'));
});

test('an exit does not take focus from another element', () => {
  const tree = (show: boolean): ReactNode => (
    <div>
      <button type="button" data-testid="elsewhere" />
      <FlarePresence>
        {show ? <FlareButton key="a" data-testid="leaving" exit={fade()} /> : null}
      </FlarePresence>
      <button type="button" data-testid="next" />
    </div>
  );
  const r = mount(tree(true));
  find(r, 'elsewhere')!.focus();
  r.rerender(tree(false));
  expect(find(r, 'leaving')!.getAttribute('aria-hidden')).toBe('true');
  expect(document.activeElement).toBe(find(r, 'elsewhere'));
});

test("createFlareComponent('section') renders a <section> and forwards ref", () => {
  const FlareSection = createFlareComponent('section');
  const ref = createRef<HTMLElement>();
  const r = mount(<FlareSection ref={ref} data-testid="section" className="card" />);
  const section = find(r, 'section')!;
  expect(section.tagName).toBe('SECTION');
  expect(section.className).toBe('card');
  expect(ref.current).toBe(section);
});

test('createFlareComponent forwards a callback ref too, and runs its cleanup', () => {
  const FlareSection = createFlareComponent('section');
  const seen: (HTMLElement | null)[] = [];
  const cleanup = mock(() => {});
  const r = mount(
    <FlareSection
      data-testid="section"
      ref={(node) => {
        seen.push(node);
        return cleanup;
      }}
    />,
  );
  expect(seen).toEqual([find(r, 'section')]);
  r.unmount();
  rendered.splice(rendered.indexOf(r), 1);
  expect(cleanup).toHaveBeenCalledTimes(1);
});

function Card(props: { title: string; ref?: Ref<HTMLElement>; style?: object }): ReactNode {
  const { title, ...host } = props;
  return (
    <article data-testid="card" {...host}>
      {title}
    </article>
  );
}

const FlareCard = createFlareComponent(Card);

test('createFlareComponent(Custom) animates the host its ref reaches and passes props through', () => {
  const ref = createRef<HTMLElement>();
  const r = mount(<FlareCard ref={ref} title="Hello" enter={fade()} />);
  const card = find(r, 'card')!;
  expect(card.textContent).toBe('Hello');
  expect(ref.current).toBe(card);
  expect(waapi.liveOn(card)).toHaveLength(2);
});

test('FlareSpan, FlareImg and FlareLi render their own elements', () => {
  const r = mount(
    <ul>
      <FlareLi data-testid="li">
        <FlareSpan data-testid="span" />
        <FlareImg data-testid="img" alt="" />
      </FlareLi>
    </ul>,
  );
  expect(find(r, 'li')!.tagName).toBe('LI');
  expect(find(r, 'span')!.tagName).toBe('SPAN');
  expect(find(r, 'img')!.tagName).toBe('IMG');
});

test('press feedback scales the host while the pointer is down, and calls the host handlers', () => {
  const onPointerDown = mock(() => {});
  const onPointerUp = mock(() => {});
  const r = mount(
    <FlareDiv
      data-testid="box"
      press={press({ scale: 0.5 })}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    />,
  );
  pointer(find(r, 'box'), 'pointerdown', 1, 1);
  expect(onPointerDown).toHaveBeenCalledTimes(1);
  expect(waapi.animations).toHaveLength(1);
  expect(waapi.animations[0]!.keyframes).toEqual([
    { transform: 'scale(1)' },
    { transform: 'scale(0.5)' },
  ]);

  pointer(find(r, 'box'), 'pointerup');
  expect(onPointerUp).toHaveBeenCalledTimes(1);
  expect(waapi.animations).toHaveLength(2);
  expect(waapi.animations[1]!.keyframes[1]).toEqual({ transform: 'scale(1)' });
});

test('a cancelled pointer, or one that leaves the host, releases the press feedback once', () => {
  const r = mount(<FlareDiv data-testid="box" press={press({ scale: 0.5 })} />);
  pointer(find(r, 'box'), 'pointerdown');
  pointer(find(r, 'box'), 'pointercancel');
  expect(waapi.animations).toHaveLength(2);

  pointer(find(r, 'box'), 'pointerdown');
  pointer(find(r, 'box'), 'pointerout');
  expect(waapi.animations).toHaveLength(4);
  expect(waapi.animations[3]!.keyframes[1]).toEqual({ transform: 'scale(1)' });

  // Nothing is pressed any more, so a pointer that only passes over releases nothing.
  pointer(find(r, 'box'), 'pointerout');
  pointer(find(r, 'box'), 'pointerup');
  expect(waapi.animations).toHaveLength(4);
});

test('under StrictMode the enter is left with one pair of animations on the host', () => {
  const r = mount(
    <StrictMode>
      <FlareDiv data-testid="box" enter={slide({ from: 'right' })} />
    </StrictMode>,
  );
  expect(waapi.liveOn(find(r, 'box'))).toHaveLength(2);
});

test('unmounting removes the animations from the host', () => {
  const r = mount(<FlareDiv data-testid="box" enter={fade()} />);
  const box = find(r, 'box');
  expect(waapi.liveOn(box)).toHaveLength(2);
  r.unmount();
  rendered.splice(rendered.indexOf(r), 1);
  expect(waapi.liveOn(box)).toEqual([]);
});

test('the default reduced-motion source is the prefers-reduced-motion media query', () => {
  media.matches = true;
  mount(
    <FlareProvider>
      <FlareDiv enter={slide({ from: 'right' })} />
    </FlareProvider>,
  );
  media.matches = false;
  expect(mediaQueries).toEqual(['(prefers-reduced-motion: reduce)']);
  // The calm fallback of a slide does not move.
  expect(waapi.animations[0]!.keyframes[0]!.transform).toBe(
    'translate(0px, 0px) rotate(0deg) scale(1)',
  );

  // Every provider shares the one source, so the query is made once.
  mount(<FlareProvider />);
  expect(mediaQueries).toHaveLength(1);
});

test('a reducedMotion source given to FlareProvider replaces the default one', () => {
  const never = { get: () => false, subscribe: () => () => {} };
  mount(
    <FlareProvider reducedMotion={never}>
      <FlareDiv enter={slide({ from: 'right' })} />
    </FlareProvider>,
  );
  expect(waapi.animations[0]!.keyframes[0]!.transform).toBe(
    'translate(48px, 0px) rotate(0deg) scale(1)',
  );
});

const still = { get: () => false, subscribe: () => () => {} };

test('FlareProvider resolves named presets through its registry', () => {
  const registry = createPresetRegistry();
  registry.register('pop', fade({ opacity: 0.25 }));
  mount(
    <FlareProvider registry={registry} reducedMotion={still}>
      <FlareDiv enter="pop" />
    </FlareProvider>,
  );
  expect(waapi.animations[1]!.keyframes[0]!.opacity).toBeCloseTo(0.25, 6);
});

test('FlareProvider rtl resolves the start edge to the right, and defaults to left-to-right', () => {
  const tree = (rtl?: boolean): ReactNode => (
    <FlareProvider rtl={rtl} reducedMotion={still}>
      <FlareDiv enter={slide({ from: 'start' })} />
    </FlareProvider>
  );
  mount(tree(true));
  expect(waapi.animations[0]!.keyframes[0]!.transform).toBe(
    'translate(48px, 0px) rotate(0deg) scale(1)',
  );
  waapi.reset();
  mount(tree());
  expect(waapi.animations[0]!.keyframes[0]!.transform).toBe(
    'translate(-48px, 0px) rotate(0deg) scale(1)',
  );
});

function Tip({ show }: { show: boolean }): ReactNode {
  const Overlay = useFlareContext().overlay;
  if (Overlay === null || !show) return null;
  return (
    <Overlay>
      <div data-testid="tip" />
    </Overlay>
  );
}

test('the overlay of FlareProvider portals into document.body', () => {
  const tree = (show: boolean): ReactNode => (
    <FlareProvider>
      <div data-testid="app">
        <Tip show={show} />
      </div>
    </FlareProvider>
  );
  const r = mount(tree(true));
  const tip = document.querySelector('[data-testid="tip"]');
  expect(tip).not.toBeNull();
  expect(tip!.parentElement).toBe(document.body);
  expect(r.container.contains(tip)).toBe(false);

  r.rerender(tree(false));
  expect(document.querySelector('[data-testid="tip"]')).toBeNull();
});

test('FlareProvider adds no element of its own', () => {
  const r = mount(
    <FlareProvider>
      <div data-testid="app" />
    </FlareProvider>,
  );
  expect(r.container.children).toHaveLength(1);
  expect(r.container.firstElementChild).toBe(find(r, 'app'));
});

function Player({ probe }: { probe(fx: ReturnType<typeof useFlareFx>): void }): ReactNode {
  const fx = useFlareFx<HTMLDivElement>();
  probe(fx);
  return <FlareDiv data-testid="box" ref={fx.ref} />;
}

test('useFlareFx plays a preset on the element its ref is on', async () => {
  let fx: ReturnType<typeof useFlareFx> | null = null;
  const r = mount(<Player probe={(next) => (fx = next)} />);
  expect(fx!.ref.current).toBe(find(r, 'box'));

  let played: Promise<boolean> | null = null;
  act(() => {
    played = fx!.play(fade({ opacity: 0.5 }));
  });
  expect(waapi.liveOn(find(r, 'box'))).toHaveLength(2);
  expect(waapi.animations[1]!.keyframes.at(-1)!.opacity).toBeCloseTo(0.5, 6);
  await finish(waapi.animations);
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

test('nothing ./dom loaded while it rendered was react-native or Reanimated', () => {
  expect(forbiddenLoads).toEqual([]);
});
