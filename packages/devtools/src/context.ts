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
  /**
   * Enable devtools on native. Default true. When false on a native platform,
   * `DevtoolsHUD` renders nothing and the provider captures no snapshots. Ignored on web.
   */
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
  /**
   * False only when the platform is native and the config sets
   * `enabledOnNative: false`. Set by `DevtoolsProvider`; absent means enabled.
   */
  enabled?: boolean;
}

export const DevtoolsContext = createContext<DevtoolsContextValue | null>(null);
