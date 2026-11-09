import { beforeEach, describe, expect, test } from 'bun:test';
import { createFocusManager, type FocusManager } from '../src/focus.js';

describe('FocusManager', () => {
  let mgr: FocusManager;
  beforeEach(() => {
    mgr = createFocusManager();
  });

  test('register() does not focus — focus stays null until a driver acts', () => {
    mgr.register({ id: 'a', tabIndex: 0 });
    expect(mgr.getFocused()).toBe(null);
    mgr.register({ id: 'b', tabIndex: 1 });
    expect(mgr.getFocused()).toBe(null);
  });

  test('focusFirst() focuses the tab-order first node, not registration order', () => {
    mgr.register({ id: 'a', tabIndex: 1 });
    mgr.register({ id: 'b', tabIndex: 0 });
    mgr.focusFirst();
    expect(mgr.getFocused()).toBe('b');
  });

  test('focusFirst() skips disabled nodes', () => {
    mgr.register({ id: 'a', tabIndex: 0, disabled: true });
    mgr.register({ id: 'b', tabIndex: 1 });
    mgr.focusFirst();
    expect(mgr.getFocused()).toBe('b');
  });

  test('focusFirst() on an empty manager is a no-op (stays null, never undefined)', () => {
    // Discriminates a focusFirst that returns order[0] without the `?? null` guard:
    // that would set focusedId to undefined, which is not === null.
    mgr.focusFirst();
    expect(mgr.getFocused()).toBe(null);
  });

  test('next / prev traverse in tabIndex order, then registration order', () => {
    mgr.register({ id: 'a', tabIndex: 1 });
    mgr.register({ id: 'b', tabIndex: 0 });
    mgr.register({ id: 'c', tabIndex: 0 });
    expect(mgr.getOrder()).toEqual(['b', 'c', 'a']);
    mgr.focus('b');
    mgr.next();
    expect(mgr.getFocused()).toBe('c');
    mgr.next();
    expect(mgr.getFocused()).toBe('a');
    mgr.next();
    expect(mgr.getFocused()).toBe('b');
    mgr.prev();
    expect(mgr.getFocused()).toBe('a');
  });

  test('activate() calls onActivate of focused node', () => {
    let hit = 0;
    mgr.register({ id: 'a', tabIndex: 0, onActivate: () => hit++ });
    mgr.focusFirst();
    mgr.activate();
    expect(hit).toBe(1);
  });

  test('onFocus / onBlur fire on focus transitions (never on registration)', () => {
    const log: string[] = [];
    mgr.register({
      id: 'a',
      tabIndex: 0,
      onFocus: () => log.push('focus-a'),
      onBlur: () => log.push('blur-a'),
    });
    mgr.register({
      id: 'b',
      tabIndex: 1,
      onFocus: () => log.push('focus-b'),
      onBlur: () => log.push('blur-b'),
    });
    // Registration alone fires nothing.
    expect(log).toEqual([]);
    mgr.focus('a');
    expect(log).toEqual(['focus-a']);
    mgr.focus('b');
    expect(log).toEqual(['focus-a', 'blur-a', 'focus-b']);
    mgr.blur();
    expect(log).toEqual(['focus-a', 'blur-a', 'focus-b', 'blur-b']);
  });

  test('subscribe is called on every focus change, not on registration', () => {
    const calls: (string | null)[] = [];
    mgr.subscribe((id) => calls.push(id));
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({ id: 'b', tabIndex: 1 });
    expect(calls).toEqual([]);
    mgr.next();
    mgr.next();
    expect(calls).toEqual(['a', 'b']);
  });

  test('unregistering the focused node shifts focus to the next one', () => {
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({ id: 'b', tabIndex: 1 });
    mgr.focus('a');
    mgr.unregister('a');
    expect(mgr.getFocused()).toBe('b');
  });

  test('unregistering a non-focused node leaves focus untouched', () => {
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({ id: 'b', tabIndex: 1 });
    mgr.focus('b');
    mgr.unregister('a');
    expect(mgr.getFocused()).toBe('b');
  });

  test('register returns an unregister disposer', () => {
    const dispose = mgr.register({ id: 'a', tabIndex: 0 });
    dispose();
    expect(mgr.getOrder()).toEqual([]);
  });

  test('focus(id) is ignored for disabled nodes', () => {
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({ id: 'b', tabIndex: 1, disabled: true });
    mgr.focus('a');
    mgr.focus('b');
    expect(mgr.getFocused()).toBe('a');
  });

  test('next() wraps around at the end of the order', () => {
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({ id: 'b', tabIndex: 1 });
    mgr.focus('b');
    mgr.next();
    expect(mgr.getFocused()).toBe('a');
  });

  test('prev() from unfocused jumps to last', () => {
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({ id: 'b', tabIndex: 1 });
    mgr.blur();
    mgr.prev();
    expect(mgr.getFocused()).toBe('b');
  });

  test('activate() on empty manager is a no-op', () => {
    expect(() => mgr.activate()).not.toThrow();
  });

  test('re-registering a focused id updates it in place: order, focus, callbacks, fields', () => {
    const log: string[] = [];
    const calls: (string | null)[] = [];
    let oldHit = 0;
    let newHit = 0;
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({
      id: 'b',
      tabIndex: 0,
      onActivate: () => oldHit++,
      onFocus: () => log.push('focus-b'),
      onBlur: () => log.push('blur-b'),
    });
    mgr.register({ id: 'c', tabIndex: 0 });
    mgr.focus('b');
    expect(mgr.getOrder()).toEqual(['a', 'b', 'c']);
    expect(log).toEqual(['focus-b']);
    mgr.subscribe((id) => calls.push(id));

    mgr.register({
      id: 'b',
      tabIndex: 0,
      onActivate: () => newHit++,
      onFocus: () => log.push('focus-b2'),
      onBlur: () => log.push('blur-b2'),
    });

    expect(mgr.getOrder()).toEqual(['a', 'b', 'c']);
    expect(mgr.getFocused()).toBe('b');
    expect(calls).toEqual([]);
    expect(log).toEqual(['focus-b']);
    mgr.activate();
    expect(oldHit).toBe(0);
    expect(newHit).toBe(1);
  });

  test('re-registering the focused id as disabled keeps focus; activate() skips it', () => {
    let hit = 0;
    mgr.register({ id: 'a', tabIndex: 0, onActivate: () => hit++ });
    mgr.register({ id: 'b', tabIndex: 1 });
    mgr.focus('a');
    mgr.register({ id: 'a', tabIndex: 0, disabled: true, onActivate: () => hit++ });
    expect(mgr.getFocused()).toBe('a');
    mgr.activate();
    expect(hit).toBe(0);
  });

  test('register / unregister and the disposer work detached from the manager object', () => {
    const { register, unregister } = mgr;
    const dispose = register({ id: 'a', tabIndex: 0 });
    expect(mgr.getOrder()).toEqual(['a']);
    expect(() => dispose()).not.toThrow();
    expect(mgr.getOrder()).toEqual([]);
    register({ id: 'b', tabIndex: 0 });
    mgr.focus('b');
    unregister('b');
    expect(mgr.getOrder()).toEqual([]);
    expect(mgr.getFocused()).toBe(null);
  });
});

describe('createFocusManager({ refocusOnUnregister: false })', () => {
  test('unregistering the focused node leaves focus null and notifies once', () => {
    const m = createFocusManager({ refocusOnUnregister: false });
    const calls: (string | null)[] = [];
    m.register({ id: 'a', tabIndex: 0 });
    m.register({ id: 'b', tabIndex: 1 });
    m.focus('a');
    m.subscribe((id) => calls.push(id));
    m.unregister('a');
    expect(m.getFocused()).toBe(null);
    expect(calls).toEqual([null]);
  });

  test('unregistering a non-focused node leaves focus untouched', () => {
    const m = createFocusManager({ refocusOnUnregister: false });
    m.register({ id: 'a', tabIndex: 0 });
    m.register({ id: 'b', tabIndex: 1 });
    m.focus('b');
    m.unregister('a');
    expect(m.getFocused()).toBe('b');
  });

  test('a later next() / prev() starts from the first / last node', () => {
    const m = createFocusManager({ refocusOnUnregister: false });
    m.register({ id: 'a', tabIndex: 0 });
    m.register({ id: 'b', tabIndex: 1 });
    m.register({ id: 'c', tabIndex: 2 });
    m.focus('b');
    m.unregister('b');
    m.next();
    expect(m.getFocused()).toBe('a');
    m.blur();
    m.prev();
    expect(m.getFocused()).toBe('c');
  });

  test('an empty options bag keeps the re-home default', () => {
    const m = createFocusManager({});
    m.register({ id: 'a', tabIndex: 0 });
    m.register({ id: 'b', tabIndex: 1 });
    m.focus('a');
    m.unregister('a');
    expect(m.getFocused()).toBe('b');
  });
});
