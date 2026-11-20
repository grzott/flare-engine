import { afterEach, expect, test } from 'bun:test';
import { act, type ReactNode, Suspense, startTransition, use, useEffect, useState } from 'react';
import { FlarePresence, usePresence } from '../../src/runtime/presence';
import { installDom, type Rendered, render } from '../support/dom';

installDom();

const releases = new Map<string, () => void>();
const mounts: string[] = [];
const unmounts: string[] = [];

function Item({ id }: { id: string }): ReactNode {
  const [isPresent, release] = usePresence();
  releases.set(id, release);
  useEffect(() => {
    mounts.push(id);
    return () => {
      unmounts.push(id);
    };
  }, [id]);
  return <span data-id={id} data-present={String(isPresent)} />;
}

const list = (...ids: string[]): ReactNode => (
  <FlarePresence>
    {ids.map((id) => (
      <Item key={id} id={id} />
    ))}
  </FlarePresence>
);

const rendered: Rendered[] = [];

const mount = (el: ReactNode): Rendered => {
  const r = render(el);
  rendered.push(r);
  return r;
};

afterEach(() => {
  for (const r of rendered.splice(0)) r.unmount();
  releases.clear();
  mounts.length = 0;
  unmounts.length = 0;
});

const ids = (r: Rendered): string[] =>
  [...r.container.querySelectorAll('[data-id]')].map((el) => el.getAttribute('data-id') ?? '');

const presentOf = (r: Rendered, id: string): string | null =>
  r.container.querySelector(`[data-id="${id}"]`)?.getAttribute('data-present') ?? null;

const release = (id: string): void => {
  const fn = releases.get(id);
  if (fn === undefined) throw new Error(`no release for "${id}"`);
  act(() => fn());
};

test('usePresence outside a FlarePresence is always present', () => {
  const r = mount(<Item id="a" />);
  expect(presentOf(r, 'a')).toBe('true');
  release('a');
  expect(ids(r)).toEqual(['a']);
});

test('a removed keyed child stays mounted until its release runs', () => {
  const r = mount(list('a', 'b'));
  expect(presentOf(r, 'a')).toBe('true');

  r.rerender(list('b'));
  expect(ids(r)).toEqual(['a', 'b']);
  expect(presentOf(r, 'a')).toBe('false');
  expect(presentOf(r, 'b')).toBe('true');
  expect(unmounts).toEqual([]);

  release('a');
  expect(ids(r)).toEqual(['b']);
  expect(unmounts).toEqual(['a']);
});

test('a removed child survives further renders of the parent', () => {
  const r = mount(list('a', 'b'));
  r.rerender(list('b'));
  r.rerender(list('b', 'c'));
  expect(ids(r)).toEqual(['a', 'b', 'c']);
  expect(presentOf(r, 'a')).toBe('false');
});

test('a key that returns before release keeps its instance', () => {
  const r = mount(list('a'));
  const node = r.container.querySelector('[data-id="a"]');

  r.rerender(list());
  expect(presentOf(r, 'a')).toBe('false');
  r.rerender(list('a'));
  expect(presentOf(r, 'a')).toBe('true');
  expect(r.container.querySelector('[data-id="a"]')).toBe(node);
  expect(mounts).toEqual(['a']);
  expect(ids(r)).toEqual(['a']);
});

test('a key that returns after release mounts a new instance', () => {
  const r = mount(list('a'));
  const node = r.container.querySelector('[data-id="a"]');

  r.rerender(list());
  release('a');
  expect(ids(r)).toEqual([]);

  r.rerender(list('a'));
  expect(ids(r)).toEqual(['a']);
  expect(r.container.querySelector('[data-id="a"]')).not.toBe(node);
  expect(mounts).toEqual(['a', 'a']);
  expect(presentOf(r, 'a')).toBe('true');
});

test('a key released and re-added in one update still mounts a new instance', () => {
  const r = mount(list('a'));
  r.rerender(list());
  const releaseFirst = releases.get('a')!;

  act(() => {
    releaseFirst();
    r.rerender(list('a'));
  });
  expect(ids(r)).toEqual(['a']);
  expect(mounts).toEqual(['a', 'a']);
  expect(unmounts).toEqual(['a']);
});

test('releasing a present child does nothing', () => {
  const r = mount(list('a', 'b'));
  release('a');
  expect(ids(r)).toEqual(['a', 'b']);
  expect(unmounts).toEqual([]);
});

test('a release that runs twice removes the child once', () => {
  const r = mount(list('a', 'b'));
  r.rerender(list('b'));
  const releaseA = releases.get('a')!;
  act(() => {
    releaseA();
    releaseA();
  });
  expect(ids(r)).toEqual(['b']);
});

test('order is preserved around exiting children', () => {
  const r = mount(list('a', 'b', 'c', 'd'));

  r.rerender(list('a', 'c', 'e'));
  expect(ids(r)).toEqual(['a', 'b', 'c', 'd', 'e']);

  r.rerender(list('c', 'e'));
  expect(ids(r)).toEqual(['a', 'b', 'c', 'd', 'e']);

  release('b');
  expect(ids(r)).toEqual(['a', 'c', 'd', 'e']);
  release('a');
  release('d');
  expect(ids(r)).toEqual(['c', 'e']);
});

test('unmounting the presence unmounts a retained child', () => {
  const r = mount(list('a'));
  r.rerender(list());
  expect(ids(r)).toEqual(['a']);

  r.rerender(null);
  expect(ids(r)).toEqual([]);
  expect(unmounts).toEqual(['a']);
  // The late release of an unmounted presence is harmless.
  release('a');
});

test('children without keys and text render in place', () => {
  const text: ReactNode = 'hello';
  const r = mount(
    <FlarePresence>
      {text}
      <Item id="a" />
    </FlarePresence>,
  );
  expect(r.container.textContent).toBe('hello');
  expect(ids(r)).toEqual(['a']);
});

// A transition whose render suspends is thrown away by React, and a later urgent render starts
// again from what was committed. Nothing the thrown-away render saw may survive it.
const never = new Promise<void>(() => {});

function Suspends({ when }: { when: boolean }): ReactNode {
  if (when) use(never);
  return null;
}

const driver = {
  setIds: (_ids: readonly string[]): void => {},
  tick: (): void => {},
};

function Transitions({ initial, suspendOn }: { initial: readonly string[]; suspendOn: string }) {
  const [shownIds, setIds] = useState(initial);
  const [, setTick] = useState(0);
  driver.setIds = setIds;
  driver.tick = () => setTick((n) => n + 1);
  return (
    <>
      {list(...shownIds)}
      <Suspense fallback={null}>
        <Suspends when={shownIds.includes(suspendOn) !== initial.includes(suspendOn)} />
      </Suspense>
    </>
  );
}

test('a child a discarded render saw arrive is not mounted', async () => {
  const r = mount(<Transitions initial={['a']} suspendOn="d" />);
  await act(async () => startTransition(() => driver.setIds(['a', 'd'])));
  await act(async () => driver.tick());
  expect(ids(r)).toEqual(['a']);
  expect(mounts).toEqual(['a']);
});

test('a child a discarded render saw leave stays present', async () => {
  const r = mount(<Transitions initial={['a', 'b']} suspendOn="b" />);
  await act(async () => startTransition(() => driver.setIds(['a'])));
  await act(async () => driver.tick());
  expect(ids(r)).toEqual(['a', 'b']);
  expect(presentOf(r, 'b')).toBe('true');
  expect(unmounts).toEqual([]);
});
