import { beforeEach, describe, expect, test } from 'bun:test';
import { type FocusManager, createFocusManager } from '../src/focus.js';

describe('FocusManager', () => {
  let mgr: FocusManager;
  beforeEach(() => {
    mgr = createFocusManager();
  });

  test('auto-focuses the first registered node', () => {
    mgr.register({ id: 'a', tabIndex: 0 });
    expect(mgr.getFocused()).toBe('a');
  });

  test('does not auto-focus disabled nodes', () => {
    mgr.register({ id: 'a', tabIndex: 0, disabled: true });
    expect(mgr.getFocused()).toBe(null);
  });

  test('next / prev traverse in tabIndex order, then registration order', () => {
    mgr.register({ id: 'a', tabIndex: 1 });
    mgr.register({ id: 'b', tabIndex: 0 });
    mgr.register({ id: 'c', tabIndex: 0 });
    expect(mgr.getOrder()).toEqual(['b', 'c', 'a']);
    // a was registered first → was auto-focused; re-check
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
    mgr.activate();
    expect(hit).toBe(1);
  });

  test('onFocus / onBlur fire on focus transitions', () => {
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
    expect(log).toEqual(['focus-a']);
    mgr.focus('b');
    expect(log).toEqual(['focus-a', 'blur-a', 'focus-b']);
    mgr.blur();
    expect(log).toEqual(['focus-a', 'blur-a', 'focus-b', 'blur-b']);
  });

  test('subscribe is called on every focus change', () => {
    const calls: (string | null)[] = [];
    mgr.subscribe((id) => calls.push(id));
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({ id: 'b', tabIndex: 1 });
    mgr.next();
    expect(calls).toEqual(['a', 'b']);
  });

  test('unregistering the focused node shifts focus to the next one', () => {
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({ id: 'b', tabIndex: 1 });
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
});
