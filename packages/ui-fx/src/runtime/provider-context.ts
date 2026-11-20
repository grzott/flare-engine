import { createContext, type ReactNode, useContext } from 'react';
import { createPresetRegistry, type PresetRegistry } from '../core/registry';
import type { FxRuntime, ReducedMotionSource } from './contracts';

/** Renders its children into the provider's overlay layer, above the app. */
export type OverlayPortal = (props: { children: ReactNode }) => ReactNode;

export interface FlareContextValue {
  registry: PresetRegistry;
  reducedMotion: ReducedMotionSource;
  /** The snapshot runtime of the nearest FX host, or `null` without one. */
  fx: FxRuntime | null;
  overlay: OverlayPortal | null;
  /** Mounts a nested FX host, for content that draws above the app's own (a modal). */
  hostFactory: (() => ReactNode) | null;
  rtl: boolean;
}

const unsubscribe = (): void => {};

// What an element gets without a provider: live presets only, motion never reduced.
const DEFAULT_CONTEXT: FlareContextValue = {
  registry: /* @__PURE__ */ createPresetRegistry(),
  reducedMotion: { get: () => false, subscribe: () => unsubscribe },
  fx: null,
  overlay: null,
  hostFactory: null,
  rtl: false,
};

export const FlareContext = /* @__PURE__ */ createContext<FlareContextValue>(DEFAULT_CONTEXT);

export function useFlareContext(): FlareContextValue {
  return useContext(FlareContext);
}
