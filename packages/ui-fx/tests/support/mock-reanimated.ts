import { mock } from 'bun:test';
import { useRef } from 'react';

type TimingCallback = (finished?: boolean) => void;

interface TimingRequest {
  isTiming: true;
  toValue: number;
  config: { duration?: number; easing?: unknown } | undefined;
  callback: TimingCallback | undefined;
}

/** One `withTiming` assigned to a shared value. */
export interface RecordedTiming {
  from: number;
  toValue: number;
  duration: number | undefined;
  easing: unknown;
  /** `null` while it runs, then what its callback was called with. */
  finished: boolean | null;
}

interface Running {
  record: RecordedTiming;
  callback: TimingCallback | undefined;
  set(value: number): void;
}

type StyleWorklet = () => Record<string, unknown>;

const linear = (x: number): number => x;

const running = new Map<object, Running>();
const worklets = new WeakMap<object, StyleWorklet>();

const isTimingRequest = (value: unknown): value is TimingRequest =>
  typeof value === 'object' && value !== null && 'isTiming' in value;

function end(shared: object, finished: boolean): void {
  const run = running.get(shared);
  if (run === undefined) return;
  running.delete(shared);
  run.record.finished = finished;
  run.callback?.(finished);
}

interface Shared<T> {
  value: T;
  modify(modifier: (value: T) => T): void;
}

function createShared<T>(initial: T): Shared<T> {
  let current = initial;
  const shared = {
    // As on the UI thread: the modifier gets the value itself, to change in place.
    modify(modifier: (value: T) => T): void {
      current = modifier(current);
    },
    get value(): T {
      return current;
    },
    set value(next: T) {
      // As in Reanimated: assigning over a running animation ends it unfinished.
      end(shared, false);
      if (!isTimingRequest(next)) {
        current = next;
        return;
      }
      const record: RecordedTiming = {
        from: Number(current),
        toValue: next.toValue,
        duration: next.config?.duration,
        easing: next.config?.easing,
        finished: null,
      };
      reanimated.timings.push(record);
      running.set(shared, {
        record,
        callback: next.callback,
        set(value) {
          current = value as T;
        },
      });
    },
  };
  return shared;
}

/** What the tests drive and read. */
export const reanimated = {
  /** Every `withTiming` assigned to a shared value, oldest first. */
  timings: [] as RecordedTiming[],
  /** The argument of every `createAnimatedComponent` call. */
  created: [] as unknown[],
  /** How many times a `useAnimatedStyle` worklet ran during a render. */
  styleRenders: 0,
  linear,
  /** Moves every running timing `fraction` of the way from where it started to its target. */
  advance(fraction: number): void {
    for (const run of running.values()) {
      run.set(run.record.from + (run.record.toValue - run.record.from) * fraction);
    }
  },
  /** Runs every timing to its end and calls its callback with `true`, synchronously. */
  flush(): void {
    while (running.size > 0) {
      for (const [shared, run] of [...running]) {
        if (running.get(shared) !== run) continue;
        run.set(run.record.toValue);
        end(shared, true);
      }
    }
  },
  /** The animated part of a `style` prop, evaluated now. */
  styleOf(style: unknown): Record<string, unknown> {
    const parts = Array.isArray(style) ? style.flat(Number.POSITIVE_INFINITY) : [style];
    for (const part of parts) {
      if (typeof part !== 'object' || part === null) continue;
      const worklet = worklets.get(part);
      if (worklet !== undefined) return worklet();
    }
    throw new Error('mock-reanimated: the style prop holds no animated style');
  },
  reset(): void {
    running.clear();
    reanimated.timings = [];
    reanimated.styleRenders = 0;
  },
};

const reanimatedModule = {
  makeMutable: createShared,
  useSharedValue<T>(initial: T): Shared<T> {
    const ref = useRef<Shared<T> | null>(null);
    ref.current ??= createShared(initial);
    return ref.current;
  },
  useAnimatedStyle(worklet: StyleWorklet): Record<string, unknown> {
    reanimated.styleRenders++;
    const style = worklet();
    worklets.set(style, worklet);
    return style;
  },
  withTiming(
    toValue: number,
    config?: TimingRequest['config'],
    callback?: TimingCallback,
  ): TimingRequest {
    return { isTiming: true, toValue, config, callback };
  },
  cancelAnimation(shared: object): void {
    end(shared, false);
  },
  createAnimatedComponent<C>(component: C): C {
    reanimated.created.push(component);
    return component;
  },
  Easing: { linear },
};

const workletsModule = {
  scheduleOnRN<A extends unknown[]>(fn: (...args: A) => void, ...args: A): void {
    fn(...args);
  },
};

/**
 * Replaces `react-native-reanimated` and `react-native-worklets`. Call it before importing the
 * module under test.
 *
 * A shared value is a plain `{ value }`. A `withTiming` assigned to one stays where it is until
 * `advance` or `flush`; `scheduleOnRN` calls straight through.
 */
export const installReanimatedMock = (): typeof reanimated => {
  mock.module('react-native-reanimated', () => reanimatedModule);
  mock.module('react-native-worklets', () => workletsModule);
  return reanimated;
};
