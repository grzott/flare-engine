import { afterEach, expect, test } from 'bun:test';
import {
  act,
  type ReactNode,
  StrictMode,
  Suspense,
  startTransition,
  use,
  useLayoutEffect,
  useState,
} from 'react';
import { type PresenceEntry, useFlarePresenceList } from '../../src/runtime/list-presence';
import { installDom, type Rendered, render } from '../support/dom';

installDom();

interface Row {
  id: string;
  label: string;
}

const keyOf = (row: Row): string => row.id;

/** The entries each render of the harness returned, oldest first. */
const renders: (readonly PresenceEntry<Row>[])[] = [];

function Harness({ data, animateInitial }: { data: readonly Row[]; animateInitial?: boolean }) {
  const entries = useFlarePresenceList(
    data,
    keyOf,
    animateInitial === undefined ? undefined : { animateInitial },
  );
  renders.push(entries);
  return entries.map((entry) => (
    <span key={entry.key} data-key={entry.key} data-phase={entry.phase}>
      {entry.item.label}
    </span>
  ));
}

const rows = (...ids: string[]): Row[] => ids.map((id) => ({ id, label: id.toUpperCase() }));

const list = (...ids: string[]): ReactNode => <Harness data={rows(...ids)} />;

const rendered: Rendered[] = [];

const mount = (el: ReactNode): Rendered => {
  const r = render(el);
  rendered.push(r);
  return r;
};

afterEach(() => {
  for (const r of rendered.splice(0)) r.unmount();
  renders.length = 0;
});

const latest = (): readonly PresenceEntry<Row>[] => {
  const entries = renders[renders.length - 1];
  if (entries === undefined) throw new Error('the harness has not rendered');
  return entries;
};

/** `key:phase` of every rendered row, in DOM order. */
const shown = (r: Rendered): string[] =>
  [...r.container.querySelectorAll('[data-key]')].map(
    (el) => `${el.getAttribute('data-key')}:${el.getAttribute('data-phase')}`,
  );

const entryOf = (key: string): PresenceEntry<Row> => {
  const entry = latest().find((e) => e.key === key);
  if (entry === undefined) throw new Error(`no entry for "${key}"`);
  return entry;
};

const release = (key: string): void => {
  const entry = entryOf(key);
  act(() => entry.release());
};

test('the initial data is idle', () => {
  const r = mount(list('a', 'b'));
  expect(shown(r)).toEqual(['a:idle', 'b:idle']);
  expect(entryOf('a').item).toEqual({ id: 'a', label: 'A' });
});

test('animateInitial enters the initial data', () => {
  const r = mount(<Harness data={rows('a', 'b')} animateInitial />);
  expect(shown(r)).toEqual(['a:enter', 'b:enter']);
});

test('an appended key enters, and the rows already there stay idle', () => {
  const r = mount(list('a', 'b'));
  r.rerender(list('a', 'b', 'c'));
  expect(shown(r)).toEqual(['a:idle', 'b:idle', 'c:enter']);

  r.rerender(list('a', 'b', 'c'));
  expect(shown(r)).toEqual(['a:idle', 'b:idle', 'c:enter']);
});

test('a key added to an empty list enters without animateInitial', () => {
  const r = mount(list());
  r.rerender(list('a'));
  expect(shown(r)).toEqual(['a:enter']);
});

test('a removed key stays in place as exit until its release runs', () => {
  const r = mount(list('a', 'b', 'c'));
  r.rerender(list('a', 'c'));
  expect(shown(r)).toEqual(['a:idle', 'b:exit', 'c:idle']);
  // The row keeps the item it last had, since the data no longer holds one.
  expect(entryOf('b').item).toEqual({ id: 'b', label: 'B' });

  r.rerender(list('a', 'c'));
  expect(shown(r)).toEqual(['a:idle', 'b:exit', 'c:idle']);

  release('b');
  expect(shown(r)).toEqual(['a:idle', 'c:idle']);
});

test('a removed key re-added before its release returns to enter, as one entry', () => {
  const r = mount(list('a', 'b', 'c'));
  r.rerender(list('a', 'c'));
  const exiting = entryOf('b');
  expect(exiting.phase).toBe('exit');

  r.rerender(list('a', 'b', 'c'));
  expect(shown(r)).toEqual(['a:idle', 'b:enter', 'c:idle']);
  expect(latest().filter((e) => e.key === 'b')).toHaveLength(1);

  // The release its exit was given, arriving late, cannot remove the row that came back.
  act(() => exiting.release());
  expect(shown(r)).toEqual(['a:idle', 'b:enter', 'c:idle']);
});

test('a key that returns after its release enters as a new entry', () => {
  const r = mount(list('a', 'b'));
  r.rerender(list('a'));
  const first = entryOf('b');
  release('b');
  expect(shown(r)).toEqual(['a:idle']);

  r.rerender(list('a', 'b'));
  expect(shown(r)).toEqual(['a:idle', 'b:enter']);

  // The first instance's release belongs to a row that is gone; it must not touch the new one.
  r.rerender(list('a'));
  expect(shown(r)).toEqual(['a:idle', 'b:exit']);
  act(() => first.release());
  expect(shown(r)).toEqual(['a:idle', 'b:exit']);

  release('b');
  expect(shown(r)).toEqual(['a:idle']);
});

test('releasing a row that is still in the data does nothing', () => {
  const r = mount(list('a', 'b'));
  release('a');
  expect(shown(r)).toEqual(['a:idle', 'b:idle']);
});

test('order is preserved around exiting entries', () => {
  const r = mount(list('a', 'b', 'c', 'd'));

  // The first row, and two neighbours, leave.
  r.rerender(list('d'));
  expect(shown(r)).toEqual(['a:exit', 'b:exit', 'c:exit', 'd:idle']);

  // New rows land where the data puts them; the exiting ones keep leading.
  r.rerender(list('x', 'd', 'y'));
  expect(shown(r)).toEqual(['a:exit', 'b:exit', 'c:exit', 'x:enter', 'd:idle', 'y:enter']);

  release('b');
  expect(shown(r)).toEqual(['a:exit', 'c:exit', 'x:enter', 'd:idle', 'y:enter']);
});

test('an exiting entry follows the row it sat after when the data reorders', () => {
  const r = mount(list('a', 'b', 'c'));
  r.rerender(list('a', 'c'));
  expect(shown(r)).toEqual(['a:idle', 'b:exit', 'c:idle']);

  r.rerender(list('c', 'a'));
  expect(shown(r)).toEqual(['c:idle', 'a:idle', 'b:exit']);
});

test('the last row leaving keeps its place at the end', () => {
  const r = mount(list('a', 'b'));
  r.rerender(list('a'));
  expect(shown(r)).toEqual(['a:idle', 'b:exit']);

  r.rerender(list());
  expect(shown(r)).toEqual(['a:exit', 'b:exit']);
  release('a');
  release('b');
  expect(shown(r)).toEqual([]);
});

test('a key the data holds twice gets one entry, at its first position', () => {
  const r = mount(list('a', 'b', 'a'));
  expect(shown(r)).toEqual(['a:idle', 'b:idle']);
});

test('StrictMode double rendering does not change the phases', () => {
  const strict = (...ids: string[]): ReactNode => <StrictMode>{list(...ids)}</StrictMode>;
  const r = mount(strict('a', 'b'));
  expect(shown(r)).toEqual(['a:idle', 'b:idle']);

  r.rerender(strict('b', 'c'));
  expect(shown(r)).toEqual(['a:exit', 'b:idle', 'c:enter']);

  release('a');
  expect(shown(r)).toEqual(['b:idle', 'c:enter']);
});

test('an entry carries the latest item for its key', () => {
  const r = mount(list('a'));
  r.rerender(<Harness data={[{ id: 'a', label: 'renamed' }]} />);
  expect(entryOf('a').item.label).toBe('renamed');
  expect(entryOf('a').phase).toBe('idle');
});

test('entries and the array keep their identity while nothing changes', () => {
  const data = rows('a', 'b');
  const r = mount(<Harness data={data} />);
  const before = latest();

  r.rerender(<Harness data={data} />);
  expect(latest()).toBe(before);

  r.rerender(<Harness data={[...data, { id: 'c', label: 'C' }]} />);
  expect(latest()).not.toBe(before);
  expect(latest()[0]).toBe(before[0]);
  expect(latest()[1]).toBe(before[1]);
});

// A transition whose render suspends is thrown away by React, and a later urgent render starts
// again from what was committed. Nothing the thrown-away render saw may survive it.
const never = new Promise<void>(() => {});

function Suspends({ when }: { when: boolean }) {
  if (when) use(never);
  return null;
}

function Transitions({ initial, suspendOn }: { initial: readonly string[]; suspendOn: string }) {
  const [ids, setIds] = useState(initial);
  const [, setTick] = useState(0);
  driver.setIds = setIds;
  driver.tick = () => setTick((n) => n + 1);
  const suspend = ids.includes(suspendOn) !== initial.includes(suspendOn);
  return (
    <>
      <Harness data={rows(...ids)} />
      <Suspense fallback={null}>
        <Suspends when={suspend} />
      </Suspense>
    </>
  );
}

const driver = {
  setIds: (_ids: readonly string[]): void => {},
  tick: (): void => {},
};

test('a row a discarded render saw arrive is not left behind', async () => {
  const r = mount(<Transitions initial={['a']} suspendOn="d" />);
  await act(async () => startTransition(() => driver.setIds(['a', 'd'])));
  expect(shown(r)).toEqual(['a:idle']);

  await act(async () => driver.tick());
  expect(shown(r)).toEqual(['a:idle']);
});

test('a row a discarded render saw leave stays idle', async () => {
  const r = mount(<Transitions initial={['a', 'b']} suspendOn="b" />);
  await act(async () => startTransition(() => driver.setIds(['a'])));
  expect(shown(r)).toEqual(['a:idle', 'b:idle']);

  await act(async () => driver.tick());
  expect(shown(r)).toEqual(['a:idle', 'b:idle']);
});

// A row's element asks for its release from its own layout effect in the commit that turns it to
// exit when its exit already ran (a press exit whose item the caller then drops). Child layout
// effects run before the parent's, so the hook must have recorded that render before they do.
function ReleasesOnExit({ entry }: { entry: PresenceEntry<Row> }): ReactNode {
  useLayoutEffect(() => {
    if (entry.phase === 'exit') entry.release();
  });
  return <span data-key={entry.key} data-phase={entry.phase} />;
}

function SameCommit({ ids }: { ids: readonly string[] }): ReactNode {
  const entries = useFlarePresenceList(rows(...ids), keyOf);
  return entries.map((entry) => <ReleasesOnExit key={entry.key} entry={entry} />);
}

test('a release asked for in the commit that turns the row to exit is honoured', () => {
  const r = mount(<SameCommit ids={['a', 'b']} />);
  r.rerender(<SameCommit ids={['a']} />);
  expect(shown(r)).toEqual(['a:idle']);
});
