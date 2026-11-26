import type { CompiledLive } from '../../src/core/live';
import type { RectLike } from '../../src/core/placement';
import type { SnapshotPreset } from '../../src/core/presets';
import type {
  FxImage,
  FxRunOptions,
  FxRuntime,
  FxTarget,
  LiveDriver,
  ProgressSource,
  ReducedMotionSource,
} from '../../src/runtime/contracts';

export interface FakePlay {
  c: CompiledLive;
  direction: 1 | -1;
  progress: ProgressSource | undefined;
  onEnd(finished: boolean): void;
}

export interface FakeDriver extends LiveDriver {
  plays: FakePlay[];
  presses: { pressed: boolean; c: CompiledLive | null }[];
  reversed: number;
  cancelled: number;
  disposed: number;
  hideSyncs: number;
  /** Ends the latest `play`, as the platform driver does when its animation stops. */
  end(finished: boolean): void;
}

export const createFakeDriver = (): FakeDriver => {
  const driver: FakeDriver = {
    plays: [],
    presses: [],
    reversed: 0,
    cancelled: 0,
    disposed: 0,
    hideSyncs: 0,
    hidden: { value: 0 },
    play(c, direction, o) {
      driver.plays.push({ c, direction, progress: o.progress, onEnd: o.onEnd });
    },
    reverse() {
      driver.reversed++;
    },
    setPressed(pressed, c) {
      driver.presses.push({ pressed, c });
    },
    hideSync() {
      driver.hideSyncs++;
    },
    cancel() {
      driver.cancelled++;
    },
    dispose() {
      driver.disposed++;
    },
    end(finished) {
      const latest = driver.plays.at(-1);
      if (latest === undefined) throw new Error('FakeDriver.end: nothing is playing');
      latest.onEnd(finished);
    },
  };
  return driver;
};

export interface FakeTarget extends FxTarget {
  /** One entry per `measure` call. */
  measures: number;
  /** The `maxPx` of every `capture` call. */
  captures: number[];
  /** The image of every `capture` call, in call order. */
  images: FxImage[];
  hideSyncs: number;
  /** With `deferCapture`, resolves every capture still in flight. */
  landCaptures(): void;
}

export const createFakeTarget = (
  o: { rect?: RectLike | null; deferCapture?: boolean } = {},
): FakeTarget => {
  const rect = o.rect === undefined ? { x: 10, y: 20, width: 100, height: 40 } : o.rect;
  const inFlight: (() => void)[] = [];
  const target: FakeTarget = {
    measures: 0,
    captures: [],
    images: [],
    hideSyncs: 0,
    hidden: { value: 0 },
    measure() {
      target.measures++;
      return Promise.resolve(rect);
    },
    capture(maxPx) {
      const image: FxImage = {
        width: 100,
        height: 40,
        pixelRatio: 1,
        padding: 0,
        handle: target.images.length,
      };
      target.captures.push(maxPx);
      target.images.push(image);
      if (o.deferCapture !== true) return Promise.resolve(image);
      return new Promise((resolve) => {
        inFlight.push(() => resolve(image));
      });
    },
    hideSync() {
      target.hideSyncs++;
    },
    landCaptures() {
      for (const land of inFlight.splice(0)) land();
    },
  };
  return target;
};

export interface FakeRun {
  target: FxTarget;
  preset: SnapshotPreset;
  options: FxRunOptions;
  rect: RectLike | null;
  image: FxImage | null;
  /** The capture landed and the run was not cancelled, so its layer is up. */
  mounted: boolean;
  handedOff: boolean;
  cancelled: boolean;
  /** What every `cancel()` returned. */
  cancelResults: boolean[];
}

export interface FakeFxRuntime extends FxRuntime {
  runs: FakeRun[];
  /** The overlay's first frame: hides the target, then `onHandoff`. Acts on the latest run. */
  handoff(): void;
  /** The latest run's `onEnd`. */
  end(finished: boolean): void;
  /** The latest run's `onFallback`. */
  fallback(): void;
}

/**
 * A snapshot runtime with the real one's order: `run` measures, then captures at 2048 px, then
 * mounts. A run cancelled before handoff never mounts and ends with `onEnd(false)`, once its
 * capture has landed.
 */
export const createFakeFxRuntime = (): FakeFxRuntime => {
  const latest = (): FakeRun => {
    const run = fx.runs.at(-1);
    if (run === undefined) throw new Error('FakeFxRuntime: no run was started');
    return run;
  };
  const fx: FakeFxRuntime = {
    runs: [],
    run(target, preset, options) {
      const run: FakeRun = {
        target,
        preset,
        options,
        rect: null,
        image: null,
        mounted: false,
        handedOff: false,
        cancelled: false,
        cancelResults: [],
      };
      fx.runs.push(run);
      let landed = false;
      target
        .measure()
        .then((rect) => {
          run.rect = rect;
          return target.capture(2048);
        })
        .then((image) => {
          landed = true;
          run.image = image;
          if (run.cancelled) options.onEnd(false);
          else run.mounted = true;
        });
      return {
        cancel() {
          const before = !run.handedOff && !run.cancelled;
          run.cancelResults.push(before);
          if (!before) return false;
          run.cancelled = true;
          run.mounted = false;
          if (landed) options.onEnd(false);
          return true;
        },
      };
    },
    handoff() {
      const run = latest();
      if (run.cancelled) throw new Error('FakeFxRuntime.handoff: the run was cancelled');
      run.handedOff = true;
      run.target.hidden.value = 1;
      run.target.hideSync();
      run.options.onHandoff();
    },
    end(finished) {
      latest().options.onEnd(finished);
    },
    fallback() {
      latest().options.onFallback();
    },
  };
  return fx;
};

export const staticReducedMotion = (reduced: boolean): ReducedMotionSource => ({
  get: () => reduced,
  subscribe: () => () => {},
});
