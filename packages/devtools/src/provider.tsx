import type { GameLoop } from '@flare-engine/core';
import type { World } from '@flare-engine/ecs';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { type DevtoolsConfig, DevtoolsContext, type DevtoolsContextValue } from './context.js';
import { createSnapshotRingBuffer, type SnapshotSource } from './ring-buffer.js';
import { type RestoreCallback, TimeScrubber } from './time-scrubber.js';

export interface DevtoolsProviderProps<T = unknown> {
  world: World;
  loop: GameLoop;
  /** Snapshot producer. Called on every capture tick. Must be cheap. */
  snapshot: SnapshotSource<T>;
  /** Optional restore callback for `TimeScrubber.rewind()`. */
  restore?: RestoreCallback<T>;
  config?: DevtoolsConfig;
  children?: ReactNode;
}

const DEFAULT_CONFIG: Required<DevtoolsConfig> = {
  ringSize: 120,
  captureInterval: 1,
  enabledOnNative: true,
};

/**
 * DevtoolsProvider — mounts a devtools session for a given `World` + `GameLoop`.
 * Subscribes to `loop.onUpdate` and captures snapshots into a pre-allocated
 * ring buffer; exposes scrubber controls via `DevtoolsContext`.
 */
export function DevtoolsProvider<T>({
  world,
  loop,
  snapshot,
  restore,
  config,
  children,
}: DevtoolsProviderProps<T>): ReactNode {
  const ringSize = config?.ringSize ?? DEFAULT_CONFIG.ringSize;
  const captureInterval = config?.captureInterval ?? DEFAULT_CONFIG.captureInterval;
  const [selectedEntity, select] = useState<number | null>(null);

  // Capture snapshot + restore in refs so the buffer/scrubber identity is
  // stable across renders — the live callbacks are read each tick.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  const { buffer, scrubber } = useMemo(() => {
    const buf = createSnapshotRingBuffer<T>(ringSize, () => snapshotRef.current());
    const scrub = new TimeScrubber<T>({
      loop,
      buffer: buf,
      restore: (s: T) => restoreRef.current?.(s),
    });
    return { buffer: buf, scrubber: scrub };
  }, [loop, ringSize]);

  useEffect(() => {
    let ticks = 0;
    const unsub = loop.onUpdate.add(() => {
      ticks++;
      if (ticks % captureInterval === 0) buffer.capture();
    });
    return () => {
      unsub();
    };
  }, [loop, buffer, captureInterval]);

  const value: DevtoolsContextValue = {
    world,
    loop,
    buffer: buffer as SnapshotRingBufferUnknown,
    scrubber: scrubber as TimeScrubberUnknown,
    selectedEntity,
    select,
  };

  return <DevtoolsContext.Provider value={value}>{children}</DevtoolsContext.Provider>;
}

// Narrow aliases so the context value type stays concrete without exposing the
// provider's generic parameter in every downstream import.
type SnapshotRingBufferUnknown = DevtoolsContextValue['buffer'];
type TimeScrubberUnknown = DevtoolsContextValue['scrubber'];
