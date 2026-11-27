import type { CanvasKit } from 'canvaskit-wasm';
import { type ReactNode, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { FxRun, FxRunOptions, FxRuntime } from '../../runtime/contracts';
import {
  FlareContext,
  type FlareContextValue,
  useFlareContext,
} from '../../runtime/provider-context';
import { createWebFxRuntime, type WebEffects } from '../../web/fx-runtime';
import { resolveCanvasKit } from '../../web/kit';
import { isFragmentPreset } from '../fragments';
import { grainsEffect } from './effects/grains';
import { shatterEffect } from './effects/shatter';

export interface FlareFxHostProps {
  children?: ReactNode;
  /** A loaded CanvasKit to draw with. It has to be the full build. */
  canvasKit?: CanvasKit;
  /**
   * Where the app serves the full CanvasKit binary, `canvaskit-wasm/bin/full/canvaskit.wasm`. It
   * is loaded on the first snapshot effect, and only when there is no `canvasKit` and no
   * `globalThis.CanvasKit`. The smaller `bin/canvaskit.wasm` does not load.
   */
  wasmUrl?: string;
}

interface Host {
  canvasKit: CanvasKit | undefined;
  wasmUrl: string | undefined;
  effects: WebEffects;
  canvas: HTMLCanvasElement | null;
  runtime: (FxRuntime & { dispose(): void }) | null;
  /** Unmounted. A host that has not mounted yet is not gone: its runtime is made on demand. */
  gone: boolean;
}

/**
 * The host's runtime, made with its canvas the first time either is needed, or `null` once the
 * host is gone. A child's effects run before the host's own, so a run can be what needs it first.
 */
function open(host: Host): FxRuntime | null {
  if (host.runtime !== null) return host.runtime;
  if (host.gone || typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const { style } = canvas;
  style.position = 'fixed';
  style.inset = '0';
  // The backing store is in device pixels. Without a size the box would be that many CSS pixels.
  style.width = '100%';
  style.height = '100%';
  style.pointerEvents = 'none';
  document.body.appendChild(canvas);
  host.canvas = canvas;
  host.runtime = createWebFxRuntime({
    canvas,
    kit: () => resolveCanvasKit({ canvasKit: host.canvasKit, wasmUrl: host.wasmUrl }),
    effects: (preset) => host.effects(preset),
  });
  return host.runtime;
}

function close(host: Host): void {
  host.runtime?.dispose();
  host.runtime = null;
  host.canvas?.remove();
  host.canvas = null;
}

// A run on a host that is gone: nothing was captured or drawn, and it ends unfinished.
function endedRun(o: FxRunOptions): FxRun {
  Promise.resolve().then(() => o.onEnd(false));
  return { cancel: () => false };
}

/** `FlareFxHost` with the effect table given. `FlareFxHost` is the public form. */
export function WebFxHost({
  children,
  canvasKit,
  wasmUrl,
  effects,
}: FlareFxHostProps & { effects: WebEffects }): ReactNode {
  const parent = useFlareContext();

  const created = useRef<{ host: Host; fx: FxRuntime } | null>(null);
  if (created.current === null) {
    const host: Host = { canvasKit, wasmUrl, effects, canvas: null, runtime: null, gone: false };
    created.current = {
      host,
      fx: { run: (t, p, o) => open(host)?.run(t, p, o) ?? endedRun(o) },
    };
  }
  const { host, fx } = created.current;

  useLayoutEffect(() => {
    host.canvasKit = canvasKit;
    host.wasmUrl = wasmUrl;
    host.effects = effects;
  });

  useLayoutEffect(() => {
    host.gone = false;
    open(host);
    return () => {
      host.gone = true;
      close(host);
    };
  }, [host]);

  const hostFactory = useCallback(
    (): ReactNode => nestedHost(canvasKit, wasmUrl, effects),
    [canvasKit, wasmUrl, effects],
  );
  const value = useMemo<FlareContextValue>(
    () => ({ ...parent, fx, hostFactory }),
    [parent, fx, hostFactory],
  );

  return <FlareContext.Provider value={value}>{children}</FlareContext.Provider>;
}

function nestedHost(
  canvasKit: CanvasKit | undefined,
  wasmUrl: string | undefined,
  effects: WebEffects,
): ReactNode {
  return <WebFxHost canvasKit={canvasKit} wasmUrl={wasmUrl} effects={effects} />;
}

// A preset without a web effect plays its live fallback. `grid` and `cells` are the patterns
// whose mesh is rectangular: its pieces are grains, cut from the capture with no bake.
const EFFECTS: WebEffects = (preset) => {
  if (!isFragmentPreset(preset)) return null;
  const { pattern } = preset.fragment;
  return pattern === 'grid' || pattern === 'cells' ? grainsEffect : shatterEffect;
};

/**
 * The snapshot-effect host on the web, under react-native-web and plain React DOM alike: it gives
 * the elements below it the runtime that plays `shatter`, `disintegrate`, `dust` and shader
 * `emerge`, and draws them through CanvasKit on one canvas. The canvas is appended to
 * `document.body`, fixed over the viewport, and takes no pointer events.
 *
 * Mount it inside `FlareProvider`. The nearest host plays an element's effects. CanvasKit is not
 * loaded, and no WebGL context made, before the first snapshot effect; an app that plays only
 * live presets pays for neither. Captures need a rasterizer: see `setWebRasterizer`. Until a
 * preset has a web effect, its run plays the preset's live fallback.
 */
export function FlareFxHost({ children, canvasKit, wasmUrl }: FlareFxHostProps): ReactNode {
  return (
    <WebFxHost canvasKit={canvasKit} wasmUrl={wasmUrl} effects={EFFECTS}>
      {children}
    </WebFxHost>
  );
}
