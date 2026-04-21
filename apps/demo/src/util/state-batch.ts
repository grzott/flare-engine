import { notifyStateChanged } from '../state';

let depth = 0;
let dirty = false;

/**
 * Run `fn`, suppressing intermediate `notifyStateChanged()` calls. When the
 * outermost batch exits, fires a single notification iff one was requested.
 *
 * Nested batches are safe: only the outermost level emits.
 */
export function batchStateNotify(fn: () => void): void {
  depth++;
  try {
    fn();
  } finally {
    depth--;
    if (depth === 0 && dirty) {
      dirty = false;
      notifyStateChanged();
    }
  }
}

/**
 * Request a state-change notification. Inside a batch, defers emission to the
 * outermost batch exit. Outside a batch, emits immediately — drop-in replacement
 * for `notifyStateChanged()` at call sites that may or may not be batched.
 */
export function requestStateNotify(): void {
  if (depth > 0) {
    dirty = true;
    return;
  }
  notifyStateChanged();
}
