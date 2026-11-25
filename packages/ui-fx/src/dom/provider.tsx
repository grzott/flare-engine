import { type ReactNode, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createPresetRegistry, type PresetRegistry } from '../core/registry';
import type { ReducedMotionSource } from '../runtime/contracts';
import { FlareContext, type FlareContextValue } from '../runtime/provider-context';
import { webReducedMotionSource } from '../web/reduced-motion';

export interface FlareProviderProps {
  children?: ReactNode;
  /** Resolves the preset names its elements use. Defaults to an empty registry of its own. */
  registry?: PresetRegistry;
  /** Defaults to the `prefers-reduced-motion` media query. */
  reducedMotion?: ReducedMotionSource;
  /** Whether `'start'` is the right edge. Defaults to `false`. */
  rtl?: boolean;
}

// The source's media-query listener is never removed, so every provider shares the one made here.
let defaultReducedMotion: ReducedMotionSource | null = null;

// It renders nothing on the server, where there is no document to portal into.
function OverlayPortal({ children }: { children: ReactNode }): ReactNode {
  return typeof document === 'undefined' ? null : createPortal(children, document.body);
}

/**
 * The root of ui-fx in a React DOM app: it gives the elements below it their preset registry,
 * reduced-motion source and writing direction, and an overlay that portals into `document.body`.
 * It renders no element of its own.
 *
 * It imports no CanvasKit: snapshot presets play their live fallback until an FX host is mounted
 * inside it.
 */
export function FlareProvider({
  children,
  registry,
  reducedMotion,
  rtl = false,
}: FlareProviderProps): ReactNode {
  const ownRegistry = useRef<PresetRegistry | null>(null);

  let resolvedRegistry = registry;
  if (resolvedRegistry === undefined) {
    ownRegistry.current ??= createPresetRegistry();
    resolvedRegistry = ownRegistry.current;
  }
  let source = reducedMotion;
  if (source === undefined) {
    defaultReducedMotion ??= webReducedMotionSource();
    source = defaultReducedMotion;
  }

  const value = useMemo<FlareContextValue>(
    () => ({
      registry: resolvedRegistry,
      reducedMotion: source,
      fx: null,
      overlay: OverlayPortal,
      hostFactory: null,
      rtl,
    }),
    [resolvedRegistry, source, rtl],
  );

  return <FlareContext.Provider value={value}>{children}</FlareContext.Provider>;
}
