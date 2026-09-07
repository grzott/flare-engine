import type { GameLoop } from '@flare-engine/core';
import type { World } from '@flare-engine/ecs';
import { createContext } from 'react';
import type { SnapshotRingBuffer } from './ring-buffer.js';
import type { TimeScrubber } from './time-scrubber.js';

/** Devtools configuration. */
export interface DevtoolsConfig {
  /** Ring-buffer depth in frames. Default 120 (~2 s @ 60 fps). */
  ringSize?: number;
  /** Capture every Nth `onUpdate`. Default 1 (every frame). */
  captureInterval?: number;
  /** Enable the native HUD surface. Default true. */
  enabledOnNative?: boolean;
}

/** Value exposed via `DevtoolsContext`. */
export interface DevtoolsContextValue {
  world: World;
  loop: GameLoop;
  buffer: SnapshotRingBuffer<unknown>;
  scrubber: TimeScrubber<unknown>;
  selectedEntity: number | null;
  select(entity: number | null): void;
}

export const DevtoolsContext = createContext<DevtoolsContextValue | null>(null);
