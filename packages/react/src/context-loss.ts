/** The event subset the watch needs from `webglcontextlost` / `webglcontextrestored`. */
export interface ContextLossEvent {
  preventDefault(): void;
}

/**
 * Structural `<canvas>` — the listener subset the watch needs. Declared locally
 * so this module does not depend on the DOM lib.
 */
export interface ContextLossTarget {
  addEventListener(type: string, listener: (event: ContextLossEvent) => void): void;
  removeEventListener(type: string, listener: (event: ContextLossEvent) => void): void;
}

/** Watches one canvas for a lost WebGL context and reports when to rebuild. */
export interface ContextLossWatch {
  /**
   * Watch `target`, taking the listeners off the canvas watched before it and
   * forgetting that canvas's loss. `null` only detaches.
   */
  attach(target: ContextLossTarget | null): void;
  /** Frame-loop check: recover now if a loss is still waiting for its restore. */
  flush(): void;
  /** Remove both listeners and drop a pending loss. Safe to call repeatedly. */
  detach(): void;
}

const LOST = 'webglcontextlost';
const RESTORED = 'webglcontextrestored';

/**
 * Watch a canvas for `webglcontextlost` / `webglcontextrestored`.
 *
 * `onRecover` runs once per loss: at the restore event, or at the first
 * `flush()` after the loss when no restore has arrived by then. The listeners
 * come off the canvas **before** `onRecover` runs. The caller answers by
 * unmounting that canvas, and RN-Skia's web view calls `loseContext()` on the
 * canvas it unmounts; with the listeners still on, that loss would start a
 * second recovery and the remount would loop.
 */
export function createContextLossWatch(onRecover: () => void): ContextLossWatch {
  let target: ContextLossTarget | null = null;
  let lost = false;

  const onLost = (event: ContextLossEvent): void => {
    // Without preventDefault the browser never restores the context.
    event.preventDefault();
    lost = true;
  };
  const onRestored = (): void => {
    if (lost) recover();
  };

  const detach = (): void => {
    lost = false;
    if (target === null) return;
    target.removeEventListener(LOST, onLost);
    target.removeEventListener(RESTORED, onRestored);
    target = null;
  };

  const recover = (): void => {
    detach();
    onRecover();
  };

  return {
    attach(next: ContextLossTarget | null): void {
      if (next === target) return;
      detach();
      if (next === null) return;
      target = next;
      next.addEventListener(LOST, onLost);
      next.addEventListener(RESTORED, onRestored);
    },
    flush(): void {
      if (lost) recover();
    },
    detach,
  };
}

/**
 * The first `<canvas>` under `host`, or null when `host` is not a DOM element
 * or holds none. `host` is `unknown` because the caller's ref is typed as a
 * React Native `View`, which is a DOM element only under react-native-web.
 */
export function findContextLossTarget(host: unknown): ContextLossTarget | null {
  if (typeof host !== 'object' || host === null) return null;
  const query = (host as { querySelector?: unknown }).querySelector;
  if (typeof query !== 'function') return null;
  return (query as (selector: string) => ContextLossTarget | null).call(host, 'canvas');
}
