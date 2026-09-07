import {
  createButtonState,
  pressButton,
  releaseButton,
  resetButtonFrame,
  type VirtualButtonState,
} from './virtual-button.js';

/** Minimal keyboard event shape — no DOM type dep. */
export interface KeyboardEventLike {
  readonly code: string;
  readonly type: string;
  /** Optional — real DOM events have it; synthetic feeds may not. */
  preventDefault?(): void;
}

/** Minimal event target shape for attaching keyboard listeners. */
export interface KeyboardEventTargetLike {
  addEventListener(type: string, handler: (ev: KeyboardEventLike) => void): void;
  removeEventListener(type: string, handler: (ev: KeyboardEventLike) => void): void;
}

/**
 * Buffered per-frame keyboard state.
 *
 * Edge flags (`wasPressed`, `wasReleased`) clear each frame via `reset()`.
 * `keyDown` / `keyUp` are the platform-neutral injection points: web feeds
 * them via `attachKeyboardListeners`; mobile/RN feeds them from a
 * hardware-keyboard native module or an on-screen source.
 */
export interface KeyboardState {
  /** True while the key is physically held. */
  isDown(code: string): boolean;
  /** True only on the frame the key was pressed. */
  wasPressed(code: string): boolean;
  /** True only on the frame the key was released. */
  wasReleased(code: string): boolean;
  /** Platform-neutral injection. OS auto-repeat is de-edged by the pressButton guard. */
  keyDown(code: string): void;
  /** Platform-neutral injection. */
  keyUp(code: string): void;
  /** Frame-start edge clear. Zero-alloc. */
  reset(): void;
  /** Blur/stuck-key guard: emits a release edge for every held code, then drops held. */
  clear(): void;
}

/** Create a fresh keyboard state. */
export function createKeyboard(): KeyboardState {
  const states: VirtualButtonState[] = [];
  const codeIndex = new Map<string, number>();

  return {
    isDown(code: string): boolean {
      const i = codeIndex.get(code);
      if (i === undefined) return false;
      return states[i]?.isPressed ?? false;
    },

    wasPressed(code: string): boolean {
      const i = codeIndex.get(code);
      if (i === undefined) return false;
      return states[i]?.justPressed ?? false;
    },

    wasReleased(code: string): boolean {
      const i = codeIndex.get(code);
      if (i === undefined) return false;
      return states[i]?.justReleased ?? false;
    },

    keyDown(code: string): void {
      let i = codeIndex.get(code);
      if (i === undefined) {
        i = states.length;
        states.push(createButtonState());
        codeIndex.set(code, i);
      }
      pressButton(states[i]!);
    },

    keyUp(code: string): void {
      const i = codeIndex.get(code);
      if (i === undefined) return;
      releaseButton(states[i]!);
    },

    reset(): void {
      for (let i = 0; i < states.length; i++) {
        resetButtonFrame(states[i]!);
      }
    },

    clear(): void {
      for (let i = 0; i < states.length; i++) {
        releaseButton(states[i]!);
      }
    },
  };
}

/**
 * Web turnkey adapter: registers `keydown`, `keyup`, and `blur` listeners on
 * `target`. `blur` calls `kb.clear()` (stuck-key guard). Returns a detach fn.
 *
 * `target` is structural `{ addEventListener, removeEventListener }` — no DOM
 * types dep. On web, pass `window`; for mobile/RN, feed `keyDown`/`keyUp`
 * directly from a hardware-keyboard native module or an on-screen source.
 *
 * Does NOT call `preventDefault` — bare use lets Space/arrows scroll and Tab
 * move DOM focus. For game-mode input, attach your own listener that calls
 * `preventDefault` for game keys and forwards `kb.keyDown(ev.code)`.
 */
export function attachKeyboardListeners(
  kb: KeyboardState,
  target: KeyboardEventTargetLike,
): () => void {
  const onKeyDown = (ev: KeyboardEventLike): void => {
    kb.keyDown(ev.code);
  };
  const onKeyUp = (ev: KeyboardEventLike): void => {
    kb.keyUp(ev.code);
  };
  const onBlur = (_ev: KeyboardEventLike): void => {
    kb.clear();
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return (): void => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onBlur);
  };
}

/**
 * Action → code binding map. Keys are action names; values are arrays of
 * `KeyboardEvent.code` strings. Multiple codes OR-reduce (any bound key
 * triggers the action).
 */
export type KeyBindings = Readonly<Record<string, readonly string[]>>;

/** True if any bound code for `action` is currently held. */
export function isActionDown(kb: KeyboardState, bindings: KeyBindings, action: string): boolean {
  const codes = bindings[action];
  if (!codes) return false;
  for (let i = 0; i < codes.length; i++) {
    if (kb.isDown(codes[i]!)) return true;
  }
  return false;
}

/** True if any bound code for `action` was pressed this frame. */
export function wasActionPressed(
  kb: KeyboardState,
  bindings: KeyBindings,
  action: string,
): boolean {
  const codes = bindings[action];
  if (!codes) return false;
  for (let i = 0; i < codes.length; i++) {
    if (kb.wasPressed(codes[i]!)) return true;
  }
  return false;
}

/**
 * True if any bound code for `action` was released this frame AND no bound
 * code is still held. Release fires only when the last held bound key lifts.
 */
export function wasActionReleased(
  kb: KeyboardState,
  bindings: KeyBindings,
  action: string,
): boolean {
  const codes = bindings[action];
  if (!codes) return false;
  let anyReleased = false;
  for (let i = 0; i < codes.length; i++) {
    if (kb.isDown(codes[i]!)) return false;
    if (kb.wasReleased(codes[i]!)) anyReleased = true;
  }
  return anyReleased;
}
