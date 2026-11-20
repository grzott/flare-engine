import type { Vec2Out } from '../core/conventions';
import type { CompiledLive } from '../core/live';
import type { RectLike } from '../core/placement';
import type { SnapshotPreset } from '../core/presets';

/** An external clock in 0..1 that replaces an effect's own: a Reanimated shared value, or a box. */
export type ProgressSource = { readonly value: number };

/** Plays compiled live presets on one element. */
export interface LiveDriver {
  /** `direction` 1 enters, -1 exits. `onEnd` reports whether the animation ran to its end. */
  play(
    c: CompiledLive,
    direction: 1 | -1,
    o: { progress?: ProgressSource; onEnd(finished: boolean): void },
  ): void;
  /** Reverse the running animation from its current pose. */
  reverse(): void;
  /** Blend the press pose of `c` in or out. `null` keeps the pose last given. */
  setPressed(pressed: boolean, c: CompiledLive | null): void;
  /** 1 hides the element. A shared value on native, a plain box on the web. */
  hidden: { value: number };
  /** Web: apply `hidden` immediately. Native: a no-op, the shared value is already live. */
  hideSync(): void;
  /** Hold the current pose and end with `finished` false. */
  cancel(): void;
  dispose(): void;
}

/** A capture of an element. `handle` is the platform's image. */
export interface FxImage {
  width: number;
  height: number;
  pixelRatio: number;
  handle: unknown;
}

/** The element a snapshot effect measures, captures and hides. */
export interface FxTarget {
  /** The element's box in window coordinates, or `null` when it is not laid out. */
  measure(): Promise<RectLike | null>;
  /** A capture no longer than `maxPx` on its longer side, or `null` when none can be taken. */
  capture(maxPx: number): Promise<FxImage | null>;
  hidden: { value: number };
  hideSync(): void;
}

export interface FxRunOptions {
  direction: 1 | -1;
  /** The press point in element pixels, or `null` without one. */
  press: Vec2Out | null;
  progress?: ProgressSource;
  /** The overlay drew its first frame and the element is hidden. */
  onHandoff(): void;
  onEnd(finished: boolean): void;
  /** The capture or the kit is unavailable before handoff: the element plays its live fallback. */
  onFallback(): void;
}

export interface FxRun {
  /** Stop the run. `true` only when it was cancelled before handoff. */
  cancel(): boolean;
}

/** Plays snapshot presets on an overlay. A `FlareFxHost` provides it through context. */
export interface FxRuntime {
  run(t: FxTarget, p: SnapshotPreset, o: FxRunOptions): FxRun;
}

export type FxEvent = {
  phase: 'start' | 'end';
  cause: 'enter' | 'exit' | 'play';
  finished: boolean;
};

/** Whether the user asked for reduced motion, and a way to hear it change. */
export interface ReducedMotionSource {
  get(): boolean;
  subscribe(cb: (v: boolean) => void): () => void;
}
