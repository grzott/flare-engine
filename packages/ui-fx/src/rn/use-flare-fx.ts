import { type RefObject, useRef } from 'react';
import type { View } from 'react-native';
import type { PresetRef } from '../core/registry';
import type { FlareElementHandle } from '../runtime/element';

type FxControls = Pick<FlareElementHandle, 'play' | 'prepare'>;

export interface FlareFx {
  /** Put this on the Flare component to control. */
  ref: RefObject<View | null>;
  /**
   * Play a preset on the element in the exit direction. Resolves with whether it ran to its end;
   * `false` at once when the ref is on no mounted Flare component, or the element is exiting.
   */
  play(p: PresetRef): Promise<boolean>;
  /** Measure and capture now, for the next snapshot effect. Resolves with whether a capture is held. */
  prepare(): Promise<boolean>;
}

// Host view → the controls of the Flare component that renders it.
const controls = /* @__PURE__ */ new WeakMap<object, FxControls>();

/** Make `host` controllable through `useFlareFx`. Returns the function that undoes it. */
export function bindFlareFx(host: object, handle: FxControls): () => void {
  controls.set(host, handle);
  return () => {
    if (controls.get(host) === handle) controls.delete(host);
  };
}

/** Imperative effects on one Flare component: `<FlareView ref={fx.ref} />`, then `fx.play(preset)`. */
export function useFlareFx(): FlareFx {
  const ref = useRef<View>(null);
  const fx = useRef<FlareFx | null>(null);
  fx.current ??= {
    ref,
    play(p) {
      const bound = ref.current === null ? undefined : controls.get(ref.current);
      return bound === undefined ? Promise.resolve(false) : bound.play(p);
    },
    prepare() {
      const bound = ref.current === null ? undefined : controls.get(ref.current);
      return bound === undefined ? Promise.resolve(false) : bound.prepare();
    },
  };
  return fx.current;
}
