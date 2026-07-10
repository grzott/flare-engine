import type { FocusManager } from './focus.js';

/** Structural key source — createKeyboard() from @flare-engine/input is assignable; no hard dep. */
export interface FocusKeySource {
  wasPressed(code: string): boolean;
}

export interface FocusKeyboardDriver {
  /** Call once per frame; polls edges and drives the manager. */
  update(): void;
}

export interface FocusKeyboardDriverOptions {
  next?: readonly string[];
  prev?: readonly string[];
  activate?: readonly string[];
}

const DEFAULT_NEXT: readonly string[] = ['ArrowDown', 'ArrowRight', 'Tab'];
const DEFAULT_PREV: readonly string[] = ['ArrowUp', 'ArrowLeft'];
const DEFAULT_ACTIVATE: readonly string[] = ['Enter', 'Space'];

export function createFocusKeyboardDriver(
  manager: FocusManager,
  keys: FocusKeySource,
  options?: FocusKeyboardDriverOptions,
): FocusKeyboardDriver {
  const nextCodes = options?.next ?? DEFAULT_NEXT;
  const prevCodes = options?.prev ?? DEFAULT_PREV;
  const activateCodes = options?.activate ?? DEFAULT_ACTIVATE;

  return {
    update(): void {
      for (let i = 0; i < nextCodes.length; i++) {
        if (keys.wasPressed(nextCodes[i]!)) {
          manager.next();
          return;
        }
      }
      for (let i = 0; i < prevCodes.length; i++) {
        if (keys.wasPressed(prevCodes[i]!)) {
          manager.prev();
          return;
        }
      }
      for (let i = 0; i < activateCodes.length; i++) {
        if (keys.wasPressed(activateCodes[i]!)) {
          manager.activate();
          return;
        }
      }
    },
  };
}
