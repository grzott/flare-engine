import { useContext } from 'react';
import { DevtoolsContext, type DevtoolsContextValue } from './context.js';

/** Returns the active devtools context, or throws if no provider is mounted. */
export function useDevtools(): DevtoolsContextValue {
  const ctx = useContext(DevtoolsContext);
  if (!ctx) {
    throw new Error('useDevtools must be used inside a <DevtoolsProvider>');
  }
  return ctx;
}

export interface EntityInspectorView {
  selected: number | null;
  select(entity: number | null): void;
  /** Entity IDs present in the world at the moment the hook was read. */
  entities: readonly number[];
}

/** Entity-inspector hook. Never mutates the world — read-only snapshot. */
export function useEntityInspector(): EntityInspectorView {
  const { world, selectedEntity, select } = useDevtools();
  const entities: number[] = [];
  world.forEachEntity((id) => entities.push(id));
  return { selected: selectedEntity, select, entities };
}

export interface TimeScrubView {
  paused: boolean;
  scrubbing: boolean;
  available: number;
  pause(): void;
  resume(): void;
  step(): void;
  rewind(framesAgo: number): void;
}

/** Time-scrub hook — exposes the scrubber's imperative controls. */
export function useTimeScrub(): TimeScrubView {
  const { scrubber } = useDevtools();
  return {
    paused: scrubber.paused,
    scrubbing: scrubber.scrubbing,
    available: scrubber.available,
    pause: () => scrubber.pause(),
    resume: () => scrubber.resume(),
    step: () => scrubber.step(),
    rewind: (framesAgo: number) => {
      scrubber.rewind(framesAgo);
    },
  };
}
