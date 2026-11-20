import { expect, test } from 'bun:test';
import { fade, slide } from '../../src/core/presets';
import type { ToastStore } from '../../src/runtime/toast-store';

// C19: the module is imported, and a store used, with getters in place of the browser globals,
// so any read of them is counted. Nothing registers a DOM in this file.
const touched: string[] = [];
const BROWSER_GLOBALS = ['window', 'document', 'matchMedia'] as const;
for (const name of BROWSER_GLOBALS) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    get() {
      touched.push(name);
      return undefined;
    },
  });
}
const { createToastStore, getDefaultToastStore, toast } = await import(
  '../../src/runtime/toast-store'
);
const touchedByImport = [...touched];

const ids = (store: ToastStore): string[] => store.snapshot().map((record) => record.id);

test('importing the module does not touch window (C19)', () => {
  expect(touchedByImport).toEqual([]);
});

test('show returns ids: the given one, or a generated one unique in the store', () => {
  const store = createToastStore();
  const a = store.show('a');
  const b = store.show('b');
  expect(typeof a).toBe('string');
  expect(a).not.toBe('');
  expect(b).not.toBe(a);
  expect(store.show('c', { id: 'mine' })).toBe('mine');
  expect(ids(store)).toEqual([a, b, 'mine']);
});

test('a generated id never collides with one the caller gave', () => {
  const probe = createToastStore();
  const generated = probe.show('x');

  const store = createToastStore();
  store.show('taken', { id: generated });
  const next = store.show('y');
  expect(next).not.toBe(generated);
  expect(ids(store)).toEqual([generated, next]);
});

test('a record carries the message and the options the toaster needs', () => {
  const store = createToastStore();
  const enter = slide({ from: 'top' });
  const exit = fade();
  store.show('Saved', { id: 'a', duration: 2, enter, exit });
  store.show('Plain', { id: 'b' });

  expect(store.snapshot()).toEqual([
    { id: 'a', message: 'Saved', duration: 2, enter, exit },
    { id: 'b', message: 'Plain', duration: undefined, enter: undefined, exit: undefined },
  ]);
});

test('standby appends, and is the default', () => {
  const store = createToastStore();
  store.show('a', { id: 'a' });
  store.show('b', { id: 'b', queue: 'standby' });
  store.show('c', { id: 'c' });
  expect(ids(store)).toEqual(['a', 'b', 'c']);
});

test('next inserts at the front of the queue, behind the current toast', () => {
  const store = createToastStore();
  store.show('a', { id: 'a' });
  store.show('b', { id: 'b' });
  store.show('c', { id: 'c', queue: 'next' });
  expect(ids(store)).toEqual(['a', 'c', 'b']);
});

test('immediate makes the toast current, replacing the one that was, and keeps the queue', () => {
  const store = createToastStore();
  store.show('a', { id: 'a' });
  store.show('b', { id: 'b' });
  store.show('c', { id: 'c', queue: 'immediate' });
  expect(ids(store)).toEqual(['c', 'b']);
});

test('reset clears the queue and the current toast', () => {
  const store = createToastStore();
  store.show('a', { id: 'a' });
  store.show('b', { id: 'b' });
  store.show('c', { id: 'c', queue: 'reset' });
  expect(ids(store)).toEqual(['c']);
});

test('every queue mode makes the toast current in an empty store', () => {
  for (const queue of ['reset', 'standby', 'next', 'immediate'] as const) {
    const store = createToastStore();
    store.show('a', { id: 'a', queue });
    expect(ids(store)).toEqual(['a']);
  }
});

test('showing an id that is already there updates it in place', () => {
  const store = createToastStore();
  store.show('a', { id: 'a' });
  store.show('Loading', { id: 'b' });
  store.show('c', { id: 'c' });

  expect(store.show('Done', { id: 'b', duration: 1, queue: 'reset' })).toBe('b');
  expect(ids(store)).toEqual(['a', 'b', 'c']);
  expect(store.snapshot()[1]).toEqual({
    id: 'b',
    message: 'Done',
    duration: 1,
    enter: undefined,
    exit: undefined,
  });
});

test('dismiss with an id removes that toast, current or queued', () => {
  const store = createToastStore();
  store.show('a', { id: 'a' });
  store.show('b', { id: 'b' });
  store.show('c', { id: 'c' });

  store.dismiss('b');
  expect(ids(store)).toEqual(['a', 'c']);
  store.dismiss('a');
  expect(ids(store)).toEqual(['c']);
});

test('dismiss with no id dismisses all', () => {
  const store = createToastStore();
  store.show('a');
  store.show('b');
  store.dismiss();
  expect(store.snapshot()).toEqual([]);
});

test('subscribers hear every change, and only changes', () => {
  const store = createToastStore();
  let calls = 0;
  const unsubscribe = store.subscribe(() => {
    calls++;
  });

  store.show('a', { id: 'a' });
  expect(calls).toBe(1);
  store.dismiss('missing');
  expect(calls).toBe(1);
  store.dismiss('a');
  expect(calls).toBe(2);
  store.dismiss();
  expect(calls).toBe(2);

  unsubscribe();
  store.show('b');
  expect(calls).toBe(2);
});

test('snapshot keeps one reference between changes', () => {
  const store = createToastStore();
  const empty = store.snapshot();
  expect(store.snapshot()).toBe(empty);

  store.show('a', { id: 'a' });
  const one = store.snapshot();
  expect(one).not.toBe(empty);
  expect(store.snapshot()).toBe(one);
  // A snapshot already handed out is never mutated.
  expect(empty).toEqual([]);

  store.dismiss('missing');
  expect(store.snapshot()).toBe(one);

  store.show('b', { id: 'b' });
  expect(one).toHaveLength(1);
  expect(store.snapshot()[0]).toBe(one[0]);
});

test('stores are independent', () => {
  const a = createToastStore();
  const b = createToastStore();
  a.show('a');
  expect(b.snapshot()).toEqual([]);
});

test('toast() and toast.dismiss() drive one lazily created default store', () => {
  const store = getDefaultToastStore();
  expect(getDefaultToastStore()).toBe(store);
  expect(store.snapshot()).toEqual([]);

  const first = toast('Saved');
  const second = toast('Again', { id: 'again', duration: 1 });
  expect(second).toBe('again');
  expect(ids(store)).toEqual([first, 'again']);

  toast.dismiss(first);
  expect(ids(store)).toEqual(['again']);
  toast('More');
  toast.dismiss();
  expect(store.snapshot()).toEqual([]);
});

// Kept last: it reads the counter after every test above has used the stores.
test('using a store does not touch window either (C19)', () => {
  expect(touched).toEqual([]);
  for (const name of BROWSER_GLOBALS) Reflect.deleteProperty(globalThis, name);
});
