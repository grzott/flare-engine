/**
 * A11yBridge — one-liner wiring of an `A11yManager` into runtime systems that
 * expose `setMotionScale(k)`. Typical targets: `Camera2D` (screen-shake) and
 * `PostFxController` (global effect intensity).
 *
 * The bridge owns no platform wiring — callers push OS preferences (e.g.
 * `AccessibilityInfo.isReduceMotionEnabled()`) into the manager; the bridge
 * forwards the derived motion scale to every attached target.
 *
 * Extracted from Pan Tvardowski per Phase 11.14. Duck-typed on the target
 * side so `@flare-engine/a11y` stays dependency-free.
 */

import { motionScale } from './helpers.js';
import { A11yManager, type A11yManagerOptions } from './manager.js';

/** Minimal structural contract. `Camera2D` and `PostFxController` both match. */
export interface MotionScaleTarget {
  setMotionScale(k: number): void;
}

export interface A11yBridge {
  readonly manager: A11yManager;
  /**
   * Apply the current motion scale to `target` and subscribe for updates.
   * Returns an unsubscribe fn — call on target disposal.
   */
  attach(target: MotionScaleTarget): () => void;
  /** Alias of `attach` with a name that documents intent at call sites. */
  attachCamera(camera: MotionScaleTarget): () => void;
  /** Alias of `attach` with a name that documents intent at call sites. */
  attachPostfx(postfx: MotionScaleTarget): () => void;
}

export interface A11yBridgeOptions extends A11yManagerOptions {
  /** Provide an existing manager — otherwise one is constructed from `initial`. */
  readonly manager?: A11yManager;
}

export function createA11yBridge(options: A11yBridgeOptions = {}): A11yBridge {
  const manager = options.manager ?? new A11yManager({ initial: options.initial });

  function attach(target: MotionScaleTarget): () => void {
    const apply = (): void => {
      target.setMotionScale(motionScale(manager.settings));
    };
    apply();
    manager.onChange.add(apply);
    return () => manager.onChange.remove(apply);
  }

  return {
    manager,
    attach,
    attachCamera: attach,
    attachPostfx: attach,
  };
}
