/**
 * `@flare-engine/ui/focus` entry — the React-free focus core.
 *
 * Re-exports the focus manager and its keyboard driver and nothing else, so a
 * consumer can drive focus from a bun test / Node harness without React or
 * React Native installed. The `.` entry re-exports the same names.
 */

export {
  createFocusKeyboardDriver,
  type FocusKeyboardDriver,
  type FocusKeyboardDriverOptions,
  type FocusKeySource,
} from './focus-keyboard-driver.js';
export {
  createFocusManager,
  type FocusManager,
  type FocusNode,
} from './focus-manager.js';
