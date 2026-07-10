import { beforeEach, describe, expect, test } from 'bun:test';
import { createFocusManager } from '../src/focus.js';
import { createFocusKeyboardDriver } from '../src/focus-keyboard-driver.js';

describe('createFocusKeyboardDriver', () => {
  let pressed: Set<string>;
  const keys = { wasPressed: (c: string) => pressed.has(c) };

  beforeEach(() => {
    pressed = new Set<string>();
  });

  test('ArrowDown from null focus moves to first node; Tab advances to second', () => {
    const mgr = createFocusManager();
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({ id: 'b', tabIndex: 1 });
    const driver = createFocusKeyboardDriver(mgr, keys);

    pressed.add('ArrowDown');
    driver.update();
    expect(mgr.getFocused()).toBe('a');

    pressed.clear();
    pressed.add('Tab');
    driver.update();
    expect(mgr.getFocused()).toBe('b');
  });

  test('ArrowUp from null focus moves to last node', () => {
    const mgr = createFocusManager();
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({ id: 'b', tabIndex: 1 });
    const driver = createFocusKeyboardDriver(mgr, keys);

    pressed.add('ArrowUp');
    driver.update();
    expect(mgr.getFocused()).toBe('b');
  });

  test('Enter activates the focused node', () => {
    const mgr = createFocusManager();
    let hits = 0;
    mgr.register({
      id: 'a',
      tabIndex: 0,
      onActivate: () => {
        hits++;
      },
    });
    mgr.focusFirst();
    const driver = createFocusKeyboardDriver(mgr, keys);

    pressed.add('Enter');
    driver.update();
    expect(hits).toBe(1);
  });

  test('Space activates the focused node', () => {
    const mgr = createFocusManager();
    let hits = 0;
    mgr.register({
      id: 'a',
      tabIndex: 0,
      onActivate: () => {
        hits++;
      },
    });
    mgr.focusFirst();
    const driver = createFocusKeyboardDriver(mgr, keys);

    pressed.add('Space');
    driver.update();
    expect(hits).toBe(1);
  });

  test('no press leaves focus unchanged', () => {
    const mgr = createFocusManager();
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({ id: 'b', tabIndex: 1 });
    mgr.focusFirst();
    const driver = createFocusKeyboardDriver(mgr, keys);

    driver.update();
    expect(mgr.getFocused()).toBe('a');
  });

  test('drives the reactive subscribe channel on move', () => {
    const mgr = createFocusManager();
    mgr.register({ id: 'a', tabIndex: 0 });
    mgr.register({ id: 'b', tabIndex: 1 });
    const driver = createFocusKeyboardDriver(mgr, keys);

    const spy = { callCount: 0, lastId: null as string | null };
    mgr.subscribe((id) => {
      spy.lastId = id;
      spy.callCount++;
    });

    pressed.add('ArrowDown');
    driver.update();

    expect(spy.callCount).toBe(1);
    expect(spy.lastId).toBe('a');
  });

  test('activate leaves the subscribe channel silent (no notify)', () => {
    const mgr = createFocusManager();
    let hits = 0;
    mgr.register({
      id: 'a',
      tabIndex: 0,
      onActivate: () => {
        hits++;
      },
    });
    mgr.focusFirst();

    // subscribe AFTER focusFirst so the initial focus notify is not counted
    const spy = { callCount: 0 };
    mgr.subscribe(() => {
      spy.callCount++;
    });
    const driver = createFocusKeyboardDriver(mgr, keys);

    pressed.add('Enter');
    driver.update();

    expect(hits).toBe(1);
    expect(spy.callCount).toBe(0);
  });
});
