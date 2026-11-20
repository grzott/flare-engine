import type { A11yManager } from '@flare-engine/a11y';
import { AccessibilityInfo } from 'react-native';
import type { ReducedMotionSource } from '../runtime/contracts';
import { createReducedMotionBox } from '../runtime/reduced-motion';

const unanswered = (): void => {};

/**
 * The OS reduce-motion setting, kept live. `get()` is `false` until the first
 * `AccessibilityInfo.isReduceMotionEnabled()` answer lands. Every value the OS reports is also
 * pushed into `manager`, when one is given.
 *
 * The `reduceMotionChanged` listener stays for the life of the app: make one source, at the root.
 */
export function nativeReducedMotionSource(manager?: A11yManager): ReducedMotionSource {
  const box = createReducedMotionBox(manager);
  let changed = false;
  AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
    changed = true;
    box.set(enabled);
  });
  // A change heard while the first read is in flight is newer than the read's answer.
  AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
    if (!changed) box.set(enabled);
  }, unanswered);
  return { get: () => box.value, subscribe: box.subscribe };
}
