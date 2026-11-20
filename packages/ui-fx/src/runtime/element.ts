import { useLayoutEffect, useReducer, useRef } from 'react';
import type { Vec2Out } from '../core/conventions';
import { type CompiledLive, compileLive } from '../core/live';
import type { RectLike } from '../core/placement';
import {
  type FlarePreset,
  isSnapshotPreset,
  type LivePreset,
  liveFallbackOf,
  type PresetCommon,
  type SnapshotPreset,
} from '../core/presets';
import type { PresetRef } from '../core/registry';
import { liveEntries, snapshotEntry } from '../core/timeline';
import type { FxEvent, FxImage, FxRun, FxTarget, LiveDriver, ProgressSource } from './contracts';
import { usePresence } from './presence';
import { type FlareContextValue, useFlareContext } from './provider-context';

export interface FlareElementOptions {
  enter?: PresetRef;
  exit?: PresetRef;
  press?: PresetRef;
  exitOn?: 'press' | 'never';
  /** Keep the element mounted and hidden, holding its space, until a snapshot exit ends. */
  holdSpace?: boolean;
  progress?: ProgressSource;
  reduceMotion?: 'system' | 'always' | 'never';
  onEntered?(): void;
  /** `true` when the exit completed, `false` when the element came back instead. */
  onExited?(finished: boolean): void;
  onFx?(e: FxEvent): void;
}

export interface ElementPlatform {
  driver: LiveDriver | null;
  target: FxTarget | null;
  /** The element's laid-out size in pixels, or `null` before layout. */
  size(): { w: number; h: number } | null;
}

export interface FlareElementHandle {
  /**
   * `'exiting'` from the render that starts the exit until the element is released. For that time
   * the element takes no touches.
   */
  phase: 'entering' | 'present' | 'exiting' | 'released';
  /** Whether the element is now the hidden placeholder of a `holdSpace` exit. */
  holdSpace: boolean;
  /** `point` is the press point in element pixels. */
  onPressIn(point: Vec2Out | null): void;
  onPressOut(): void;
  /** The press completed. With `exitOn: 'press'` this starts the exit. */
  onPress(): void;
  /** Play a preset on the element in the exit direction. Resolves with whether it finished. */
  play(ref: PresetRef): Promise<boolean>;
  /** Measure and capture now, for the next snapshot effect. Resolves with whether a capture is held. */
  prepare(): Promise<boolean>;
}

declare const process: { env: { NODE_ENV?: string } } | undefined;

// The default cap on a capture's longer side (C32).
const CAPTURE_MAX_PX = 2048;

type SnapshotStep = SnapshotPreset & PresetCommon;

interface Prepared {
  rect: Promise<RectLike | null>;
  image: Promise<FxImage | null>;
  fromPress: boolean;
}

/**
 * One enter, exit or play. `stage` says who owns the element: `'pending'` while it is measured,
 * `'live'` while the driver animates it, `'run'` while a snapshot run has not handed off, and
 * `'handed'` once the overlay has replaced it.
 */
interface Op {
  cause: FxEvent['cause'];
  direction: 1 | -1;
  stage: 'pending' | 'live' | 'run' | 'handed';
  settled: boolean;
  run: FxRun | null;
  /** The driver has moved the element, so an earlier capture is stale and a cancel must reverse. */
  led: boolean;
  byPress: boolean;
  press: Vec2Out | null;
  resolve: ((finished: boolean) => void) | null;
}

interface Machine {
  o: FlareElementOptions;
  p: ElementPlatform;
  ctx: FlareContextValue;
  release: () => void;
  isPresent: boolean;
  rerender: () => void;
  alive: boolean;
  entered: boolean;
  pressExit: boolean;
  released: boolean;
  held: boolean;
  op: Op | null;
  prepared: Prepared | null;
  pressPoint: Vec2Out;
  hasPress: boolean;
  pressPreset: LivePreset | null;
  pressPose: CompiledLive | null;
}

type Api = Pick<FlareElementHandle, 'onPressIn' | 'onPressOut' | 'onPress' | 'play' | 'prepare'>;

let warnedNoRuntime = false;

function warnNoRuntime(): void {
  if (warnedNoRuntime) return;
  if (typeof process === 'undefined' || process.env.NODE_ENV === 'production') return;
  warnedNoRuntime = true;
  console.warn(
    'ui-fx: a snapshot preset needs a <FlareFxHost> above the element. Playing its live fallback.',
  );
}

function emit(m: Machine, phase: FxEvent['phase'], cause: FxEvent['cause'], finished: boolean) {
  m.o.onFx?.({ phase, cause, finished });
}

function isReduced(m: Machine, mode: PresetCommon['reduceMotion']): boolean {
  const resolved = mode ?? m.o.reduceMotion ?? 'system';
  return resolved === 'always' || (resolved === 'system' && m.ctx.reducedMotion.get());
}

function canSnapshot(m: Machine, preset: SnapshotStep): boolean {
  if (isReduced(m, preset.reduceMotion)) return false;
  if (m.ctx.fx === null) {
    warnNoRuntime();
    return false;
  }
  return m.p.target !== null;
}

/** The preset itself, or its live fallback when it is a snapshot preset or motion is reduced. */
function liveOf(m: Machine, preset: FlarePreset): LivePreset {
  return isSnapshotPreset(preset) || isReduced(m, preset.reduceMotion)
    ? liveFallbackOf(preset)
    : preset;
}

function compile(
  m: Machine,
  input: LivePreset | readonly { start: number; preset: LivePreset }[],
): CompiledLive {
  const size = m.p.size();
  return compileLive(input, size?.w ?? 0, size?.h ?? 0, m.ctx.rtl);
}

/** A compiled entry list that holds its last pose until `seconds`, when it would end sooner. */
function lasting(c: CompiledLive, seconds: number): CompiledLive {
  if (seconds <= c.duration) return c;
  return { ...c, duration: seconds, timing: { ...c.timing, duration: seconds } };
}

function releaseElement(m: Machine): void {
  if (m.released) return;
  m.released = true;
  m.held = false;
  m.release();
  if (m.alive) m.rerender();
}

function finish(m: Machine, op: Op, finished: boolean): void {
  op.settled = true;
  if (m.op === op) m.op = null;
  if (op.cause === 'exit') {
    if (m.alive && m.isPresent && !m.pressExit) {
      // The key came back after handoff, while the element was held as a placeholder: show it.
      m.held = false;
      const target = m.p.target;
      if (target !== null) {
        target.hidden.value = 0;
        target.hideSync();
      }
      m.rerender();
    } else {
      releaseElement(m);
    }
    m.o.onExited?.(true);
  } else if (op.cause === 'enter') {
    m.entered = true;
    if (m.alive) m.rerender();
    if (finished) m.o.onEntered?.();
  } else {
    op.resolve?.(finished);
  }
  emit(m, 'end', op.cause, finished);
}

function live(m: Machine, op: Op, c: CompiledLive, then: SnapshotStep | null): void {
  const driver = m.p.driver;
  if (driver === null) {
    if (then !== null) snapshot(m, op, then);
    else finish(m, op, true);
    return;
  }
  op.stage = 'live';
  op.led = true;
  driver.play(c, op.direction, {
    progress: m.o.progress,
    onEnd(finished) {
      if (op.settled) return;
      if (then !== null && finished) snapshot(m, op, then);
      else finish(m, op, finished);
    },
  });
}

function fallback(m: Machine, op: Op, preset: SnapshotStep): void {
  op.run = null;
  live(m, op, compile(m, liveFallbackOf(preset)), null);
}

function snapshot(m: Machine, op: Op, preset: SnapshotStep): void {
  const target = m.p.target;
  if (m.ctx.fx === null || target === null) {
    fallback(m, op, preset);
    return;
  }
  op.stage = 'pending';
  let prepared = m.prepared;
  m.prepared = null;
  // A capture taken at press-in belongs to that press, and none survives the driver moving the
  // element.
  if (prepared !== null && (op.led || (prepared.fromPress && !op.byPress))) prepared = null;
  const held = prepared;
  const rect = held !== null ? held.rect : target.measure().catch(() => null);

  rect.then((box) => {
    if (op.settled) return;
    if (box === null || box.width <= 0 || box.height <= 0) {
      finish(m, op, true);
      return;
    }
    const fx = m.ctx.fx;
    if (fx === null) {
      fallback(m, op, preset);
      return;
    }
    op.stage = 'run';
    // The run measures and captures through this, so it reuses what is already known.
    const known: FxTarget = {
      measure: () => rect,
      capture: held !== null ? () => held.image : (maxPx) => target.capture(maxPx),
      hidden: target.hidden,
      hideSync: () => target.hideSync(),
    };
    op.run = fx.run(known, preset, {
      direction: op.direction,
      press: op.press,
      progress: m.o.progress,
      onHandoff() {
        if (op.settled || op.stage !== 'run') return;
        op.stage = 'handed';
        if (op.cause !== 'exit') return;
        if (m.o.holdSpace === true) {
          m.held = true;
          if (m.alive) m.rerender();
        } else {
          releaseElement(m);
        }
      },
      onEnd(finished) {
        if (op.settled) return;
        finish(m, op, finished);
      },
      onFallback() {
        if (op.settled || op.stage !== 'run') return;
        fallback(m, op, preset);
      },
    });
  });
}

/** End an enter or a play that something else is about to replace. */
function supersede(m: Machine): void {
  const op = m.op;
  if (op === null || op.settled) return;
  op.settled = true;
  m.op = null;
  if (op.stage === 'run') op.run?.cancel();
  if (op.cause === 'enter') m.entered = true;
  op.resolve?.(false);
  emit(m, 'end', op.cause, false);
}

function start(
  m: Machine,
  cause: FxEvent['cause'],
  direction: 1 | -1,
  ref: PresetRef,
  byPress: boolean,
  resolve: ((finished: boolean) => void) | null,
): void {
  const resolved = m.ctx.registry.resolve(ref);
  supersede(m);
  const op: Op = {
    cause,
    direction,
    stage: 'pending',
    settled: false,
    run: null,
    led: false,
    byPress,
    press: (byPress || cause === 'play') && m.hasPress ? m.pressPoint : null,
    resolve,
  };
  m.op = op;
  emit(m, 'start', cause, false);

  if (resolved.kind !== 'timeline') {
    if (isSnapshotPreset(resolved) && canSnapshot(m, resolved)) snapshot(m, op, resolved);
    else live(m, op, compile(m, liveOf(m, resolved)), null);
    return;
  }
  const step = snapshotEntry(resolved);
  if (step !== null && canSnapshot(m, step.preset)) {
    const lead = liveEntries(resolved);
    if (lead.length === 0 && step.start <= 0) snapshot(m, op, step.preset);
    else live(m, op, lasting(compile(m, lead), step.start), step.preset);
    return;
  }
  const entries = resolved.entries.map((entry) => ({
    start: entry.start,
    preset: liveOf(m, entry.preset),
  }));
  live(m, op, lasting(compile(m, entries), resolved.duration), null);
}

const exitActive = (m: Machine): boolean => m.op !== null && m.op.cause === 'exit';

function startExit(m: Machine): void {
  if (exitActive(m) || m.released) return;
  const ref = m.o.exit;
  if (ref === undefined) {
    supersede(m);
    m.prepared = null;
    releaseElement(m);
    m.o.onExited?.(true);
    return;
  }
  start(m, 'exit', -1, ref, m.pressExit, null);
}

/** The element is wanted again. An exit the tree still owns is undone; a handed-off one plays on. */
function represent(m: Machine): void {
  const op = m.op;
  if (op === null || op.cause !== 'exit' || op.stage === 'handed') return;
  // Settled before the cancel, so the `onEnd(false)` a cancelled run answers with is ignored.
  op.settled = true;
  if (op.stage === 'run' && op.run !== null && !op.run.cancel()) {
    op.settled = false;
    return;
  }
  m.op = null;
  m.prepared = null;
  if (op.led) m.p.driver?.reverse();
  m.o.onExited?.(false);
  emit(m, 'end', 'exit', false);
}

function unmount(m: Machine): void {
  m.alive = false;
  m.prepared = null;
  const op = m.op;
  if (op === null || op.stage === 'handed') return;
  if (op.cause !== 'exit') {
    supersede(m);
    return;
  }
  // An ancestor took the element away mid-exit: the exit ends here, with nothing left to draw (C40).
  op.settled = true;
  m.op = null;
  m.p.driver?.dispose();
  op.run?.cancel();
  m.o.onExited?.(true);
  emit(m, 'end', 'exit', true);
}

function prepare(m: Machine, fromPress: boolean): Promise<boolean> {
  const target = m.p.target;
  if (target === null || m.ctx.fx === null) return Promise.resolve(false);
  const rect = target.measure().catch(() => null);
  const image = rect
    .then((box) =>
      box === null || box.width <= 0 || box.height <= 0 ? null : target.capture(CAPTURE_MAX_PX),
    )
    .catch(() => null);
  const prepared: Prepared = { rect, image, fromPress };
  m.prepared = prepared;
  return image.then((captured) => captured !== null && m.prepared === prepared);
}

function pressPoseOf(m: Machine, ref: PresetRef): CompiledLive {
  const resolved = m.ctx.registry.resolve(ref);
  if (resolved.kind === 'timeline') {
    return compile(
      m,
      resolved.entries.map((entry) => ({ start: entry.start, preset: liveOf(m, entry.preset) })),
    );
  }
  const preset = liveOf(m, resolved);
  if (m.pressPose === null || m.pressPreset !== preset) {
    m.pressPreset = preset;
    m.pressPose = compile(m, preset);
  }
  return m.pressPose;
}

function createApi(m: Machine): Api {
  return {
    onPressIn(point) {
      if (!m.alive || exitActive(m) || m.released) return;
      m.hasPress = point !== null;
      if (point !== null) {
        m.pressPoint.x = point.x;
        m.pressPoint.y = point.y;
      }
      const driver = m.p.driver;
      if (driver !== null && m.o.press !== undefined) {
        driver.setPressed(true, pressPoseOf(m, m.o.press));
      }
      if (m.o.exitOn !== 'press' || m.o.exit === undefined) return;
      // A timeline's capture has to include the final pose of its live part, so it cannot be
      // taken this early.
      const exit = m.ctx.registry.resolve(m.o.exit);
      if (exit.kind !== 'timeline' && isSnapshotPreset(exit) && canSnapshot(m, exit)) {
        prepare(m, true);
      }
    },
    onPressOut() {
      m.p.driver?.setPressed(false, null);
    },
    onPress() {
      if (!m.alive || m.o.exitOn !== 'press' || m.pressExit || exitActive(m) || m.released) return;
      m.pressExit = true;
      m.rerender();
    },
    play(ref) {
      if (!m.alive || exitActive(m) || m.released) return Promise.resolve(false);
      return new Promise((resolve) => start(m, 'play', -1, ref, false, resolve));
    },
    prepare: () => prepare(m, false),
  };
}

/**
 * The lifecycle of one animated element: `entering → present → exiting → released`. It plays
 * `enter` on mount and `exit` when the nearest `FlarePresence` loses the element or, with
 * `exitOn: 'press'`, when it is pressed. Live presets go to `p.driver`, snapshot presets to the
 * context's FX runtime. Every transition comes from a driver or run callback, never from a timer.
 *
 * `onExited` fires once per exit: `true` when the exit completed, including when an ancestor
 * unmounted the element mid-exit, and `false` when the element came back before handoff.
 */
export function useFlareElement(o: FlareElementOptions, p: ElementPlatform): FlareElementHandle {
  const ctx = useFlareContext();
  const [isPresent, release] = usePresence();
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const machine = useRef<{ m: Machine; api: Api } | null>(null);
  if (machine.current === null) {
    const created: Machine = {
      o,
      p,
      ctx,
      release,
      isPresent,
      rerender,
      alive: false,
      entered: o.enter === undefined,
      pressExit: false,
      released: false,
      held: false,
      op: null,
      prepared: null,
      pressPoint: { x: 0, y: 0 },
      hasPress: false,
      pressPreset: null,
      pressPose: null,
    };
    machine.current = { m: created, api: createApi(created) };
  }
  const { m, api } = machine.current;
  const exiting = !isPresent || m.pressExit;

  // Declared first, so the effects below and every later callback read this render's inputs.
  useLayoutEffect(() => {
    m.o = o;
    m.p = p;
    m.ctx = ctx;
    m.release = release;
    m.isPresent = isPresent;
  });

  useLayoutEffect(() => {
    m.alive = true;
    if (m.o.enter !== undefined && m.isPresent) start(m, 'enter', 1, m.o.enter, false, null);
    return () => unmount(m);
  }, [m]);

  useLayoutEffect(() => {
    if (exiting) startExit(m);
    else represent(m);
  }, [m, exiting]);

  let phase: FlareElementHandle['phase'] = 'entering';
  if (m.released) phase = 'released';
  else if (exiting) phase = 'exiting';
  else if (m.entered) phase = 'present';

  return { phase, holdSpace: m.held, ...api };
}
