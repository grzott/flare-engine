import { act, type ReactNode, useLayoutEffect } from 'react';
import type { SnapshotPreset } from '../../../src/core/presets';
import type { EffectLayerProps, NativeEffects } from '../../../src/fx/native/host';
import type { FxRun, FxRuntime, FxTarget } from '../../../src/runtime/contracts';
import { type FlareContextValue, useFlareContext } from '../../../src/runtime/provider-context';
import { createFakeTarget, type FakeTarget } from '../../support/fakes';

/** Lets the promises a run waits on settle, and flushes the renders they cause. */
export const settle = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
};

/** The layers mounted now, oldest first. Shared by every `layerEffects` of a test file. */
export const layers: EffectLayerProps[] = [];

function TestLayer(props: EffectLayerProps): ReactNode {
  useLayoutEffect(() => {
    layers.push(props);
    return () => {
      layers.splice(layers.indexOf(props), 1);
    };
  }, [props]);
  return null;
}

/** Every preset draws with a layer that records itself, and claims `sprites` pool sprites. */
export const layerEffects =
  (sprites = 0): NativeEffects =>
  () => ({ sprites: () => sprites, Layer: TestLayer });

/** What a layer's first-frame worklet does on the UI thread, without the hop back to JS. */
export const drawFirstFrame = (layer: EffectLayerProps): void => {
  layer.run.hidden.value = 1;
};

/** The whole first frame: the UI thread hides the target, then JS hears of it. */
export const firstFrame = (layer: EffectLayerProps): void => {
  act(() => {
    drawFirstFrame(layer);
    layer.onFirstFrame();
  });
};

export const done = (layer: EffectLayerProps, finished: boolean): void => {
  act(() => {
    layer.onDone(finished);
  });
};

/** `run.cancel()`, with the unmount it may cause flushed. */
export const cancel = (run: FxRun): boolean => {
  let result = false;
  act(() => {
    result = run.cancel();
  });
  return result;
};

export interface Started {
  target: FakeTarget;
  run: FxRun;
  /** `'handoff'`, `'end:true'`, `'end:false'` and `'fallback'`, in call order. */
  events: string[];
}

/** Starts a run of `preset` on a new fake target, recording what the run reports. */
export const start = (
  fx: FxRuntime,
  preset: SnapshotPreset,
  o: { deferCapture?: boolean; target?: FxTarget & FakeTarget } = {},
): Started => {
  const target = o.target ?? createFakeTarget({ deferCapture: o.deferCapture });
  const events: string[] = [];
  const run = fx.run(target, preset, {
    direction: -1,
    press: null,
    onHandoff: () => events.push('handoff'),
    onEnd: (finished) => events.push(`end:${finished}`),
    onFallback: () => events.push('fallback'),
  });
  return { target, run, events };
};

/** Renders nothing and hands the context it sees to `onContext`. */
export function ContextProbe({
  onContext,
}: {
  onContext(ctx: FlareContextValue): void;
}): ReactNode {
  onContext(useFlareContext());
  return null;
}
