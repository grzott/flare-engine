import { type RefObject, useRef } from 'react';
import type { PresetRef } from '../core/registry';
import type { FlareElementHandle } from '../runtime/element';

type FxControls = Pick<FlareElementHandle, 'play' | 'prepare'>;

export interface FlareFx<E extends Element = HTMLElement> {
  /** Put this on the Flare component to control. */
  ref: RefObject<E | null>;
  /**
   * Play a preset on the element in the exit direction. Resolves with whether it ran to its end;
   * `false` at once when the ref is on no mounted Flare component, or the element is exiting.
   */
  play(p: PresetRef): Promise<boolean>;
  /** Measure and capture now, for the next snapshot effect. Resolves with whether a capture is held. */
  prepare(): Promise<boolean>;
}

// Host element → the controls of the Flare component that renders it.
const controls = /* @__PURE__ */ new WeakMap<object, FxControls>();

/** Make `host` controllable through `useFlareFx`. Returns the function that undoes it. */
export function bindFlareFx(host: object, handle: FxControls): () => void {
  controls.set(host, handle);
  return () => {
    if (controls.get(host) === handle) controls.delete(host);
  };
}

/**
 * Imperative effects on one Flare component: `<FlareDiv ref={fx.ref} />`, then `fx.play(preset)`.
 * `E` is the element the component renders, as with `useRef`: `useFlareFx<HTMLDivElement>()`.
 */
export function useFlareFx<E extends Element = HTMLElement>(): FlareFx<E> {
  const ref = useRef<E>(null);
  const fx = useRef<FlareFx<E> | null>(null);
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
