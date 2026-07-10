import { describe, expect, test } from 'bun:test';
import {
  attachKeyboardListeners,
  createKeyboard,
  isActionDown,
  type KeyBindings,
  type KeyboardEventLike,
  type KeyboardEventTargetLike,
  resetKeyboardFrame,
  wasActionPressed,
  wasActionReleased,
} from '../src/keyboard.js';

describe('keyboard state', () => {
  test('edge flags per-frame and OS auto-repeat dedupe', () => {
    const kb = createKeyboard();

    // initial press
    kb.keyDown('KeyW');
    expect(kb.wasPressed('KeyW')).toBe(true);
    expect(kb.isDown('KeyW')).toBe(true);

    // advance frame — held but no longer "just pressed"
    resetKeyboardFrame(kb);
    expect(kb.wasPressed('KeyW')).toBe(false);
    expect(kb.isDown('KeyW')).toBe(true);

    // OS auto-repeat fires another keydown — wasPressed must stay false
    kb.keyDown('KeyW');
    expect(kb.wasPressed('KeyW')).toBe(false);
    expect(kb.isDown('KeyW')).toBe(true);

    // advance frame then release
    resetKeyboardFrame(kb);
    kb.keyUp('KeyW');
    expect(kb.wasReleased('KeyW')).toBe(true);
    expect(kb.isDown('KeyW')).toBe(false);

    // next frame — release edge clears
    resetKeyboardFrame(kb);
    expect(kb.wasReleased('KeyW')).toBe(false);
    expect(kb.isDown('KeyW')).toBe(false);
  });

  test('unknown code reads false without throwing', () => {
    const kb = createKeyboard();
    expect(kb.isDown('ArrowUp')).toBe(false);
    expect(kb.wasPressed('ArrowUp')).toBe(false);
    expect(kb.wasReleased('ArrowUp')).toBe(false);
  });

  test('blur clears held keys and emits release edges', () => {
    const kb = createKeyboard();

    kb.keyDown('KeyA');
    kb.keyDown('KeyS');
    resetKeyboardFrame(kb);

    kb.clear();

    expect(kb.isDown('KeyA')).toBe(false);
    expect(kb.isDown('KeyS')).toBe(false);
    expect(kb.wasReleased('KeyA')).toBe(true);
    expect(kb.wasReleased('KeyS')).toBe(true);

    // after next reset, quiescent
    resetKeyboardFrame(kb);
    expect(kb.wasReleased('KeyA')).toBe(false);
    expect(kb.wasReleased('KeyS')).toBe(false);
  });

  test('clear on already-released key emits no spurious edge', () => {
    const kb = createKeyboard();
    kb.keyDown('KeyA');
    kb.keyUp('KeyA');
    resetKeyboardFrame(kb);

    // key is not held — clear should be a no-op for it
    kb.clear();
    expect(kb.wasReleased('KeyA')).toBe(false);
  });
});

describe('attachKeyboardListeners', () => {
  test('synthetic feed + detach is genuinely inert', () => {
    const kb = createKeyboard();

    type H = (ev: KeyboardEventLike) => void;
    const handlers: Partial<Record<string, H>> = {};
    const addedHandlers: Partial<Record<string, H>> = {};
    const removedHandlers: Partial<Record<string, H>> = {};

    const target: KeyboardEventTargetLike = {
      addEventListener(type: string, h: H): void {
        handlers[type] = h;
        addedHandlers[type] = h;
      },
      removeEventListener(type: string, h: H): void {
        removedHandlers[type] = h;
        if (handlers[type] === h) delete handlers[type];
      },
    };

    const detach = attachKeyboardListeners(kb, target);

    // keydown feeds state
    handlers.keydown?.({ code: 'KeyW', type: 'keydown' });
    expect(kb.wasPressed('KeyW')).toBe(true);

    // keyup feeds state after frame advance
    resetKeyboardFrame(kb);
    handlers.keyup?.({ code: 'KeyW', type: 'keyup' });
    expect(kb.wasReleased('KeyW')).toBe(true);

    // blur clears held keys
    resetKeyboardFrame(kb);
    kb.keyDown('KeyA');
    expect(kb.isDown('KeyA')).toBe(true);
    handlers.blur?.({ code: '', type: 'blur' });
    expect(kb.isDown('KeyA')).toBe(false);
    expect(kb.wasReleased('KeyA')).toBe(true);

    // detach removes all handlers with the same reference
    detach();
    expect(handlers.keydown).toBeUndefined();
    expect(handlers.keyup).toBeUndefined();
    expect(handlers.blur).toBeUndefined();

    // verify same handler ref was used for add and remove
    expect(removedHandlers.keydown).toBe(addedHandlers.keydown);
    expect(removedHandlers.keyup).toBe(addedHandlers.keyup);
    expect(removedHandlers.blur).toBe(addedHandlers.blur);
  });
});

describe('KeyBindings action resolver', () => {
  const b: KeyBindings = { jump: ['Space', 'KeyW'] };

  test('OR-reduces over bound codes', () => {
    const kb = createKeyboard();
    kb.keyDown('KeyW');

    expect(wasActionPressed(kb, b, 'jump')).toBe(true);
    expect(isActionDown(kb, b, 'jump')).toBe(true);
  });

  test('unbound action returns false', () => {
    const kb = createKeyboard();
    kb.keyDown('KeyW');

    expect(isActionDown(kb, b, 'attack')).toBe(false);
    expect(wasActionPressed(kb, b, 'attack')).toBe(false);
    expect(wasActionReleased(kb, b, 'attack')).toBe(false);
  });

  test('isDown stays true while held', () => {
    const kb = createKeyboard();
    kb.keyDown('Space');
    resetKeyboardFrame(kb);

    expect(isActionDown(kb, b, 'jump')).toBe(true);
    expect(wasActionPressed(kb, b, 'jump')).toBe(false);
  });

  test('wasActionReleased fires only when the LAST held bound key lifts', () => {
    const kb = createKeyboard();

    kb.keyDown('Space');
    kb.keyDown('KeyW');
    resetKeyboardFrame(kb);

    // release Space — KeyW still held, action not released
    kb.keyUp('Space');
    expect(wasActionReleased(kb, b, 'jump')).toBe(false);

    resetKeyboardFrame(kb);

    // release KeyW — no bound key held, action released
    kb.keyUp('KeyW');
    expect(wasActionReleased(kb, b, 'jump')).toBe(true);

    // next frame — edge clears
    resetKeyboardFrame(kb);
    expect(wasActionReleased(kb, b, 'jump')).toBe(false);
  });

  test('wasActionReleased is vetoed by an EARLIER-index held key', () => {
    const kb = createKeyboard();

    kb.keyDown('Space'); // bound index 0
    kb.keyDown('KeyW'); // bound index 1
    resetKeyboardFrame(kb);

    // release the LATER-index key while the earlier one is still held —
    // an impl that inspected only the last bound code would wrongly fire
    kb.keyUp('KeyW');
    expect(wasActionReleased(kb, b, 'jump')).toBe(false);
  });
});
