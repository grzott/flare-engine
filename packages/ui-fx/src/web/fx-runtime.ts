import { createWebSurface, type WebSurface } from '@flare-engine/render-web';
import type { CanvasKit, Canvas as CKCanvas, Image as CKImage, Paint } from 'canvaskit-wasm';
import type { Vec2Out } from '../core/conventions';
import type { RectLike } from '../core/placement';
import type { SnapshotPreset } from '../core/presets';
import type {
  FxImage,
  FxRun,
  FxRunOptions,
  FxRuntime,
  FxTarget,
  ProgressSource,
} from '../runtime/contracts';
import { CAPTURE_MAX_PX } from '../runtime/element';
import { type AtlasPool, createAtlasPool } from './atlas';

declare const process: { env: { NODE_ENV?: string } } | undefined;

/** What one run's effect draws from. Made once per run. */
export interface WebRunState {
  preset: SnapshotPreset;
  /** The element's box in window coordinates. */
  rect: RectLike;
  /** The capture. It reaches `image.padding` layout pixels beyond `rect` on every side. */
  image: FxImage;
  direction: 1 | -1;
  /** The press point in element pixels, or `null` without one. */
  press: Vec2Out | null;
  progress: ProgressSource | undefined;
}

/** How one snapshot preset draws on the web: as sprites cut from the capture. */
export interface WebEffect {
  /** How many sprites a run draws, at least one. Called once per run. */
  sprites(run: WebRunState): number;
  /**
   * Write the run's sprites into `pool` as they are `time` seconds after its first frame, and
   * return whether the effect is still playing. On `false` nothing is drawn and the run ends.
   *
   * Source rects are in image pixels. Transforms are in layout pixels from the capture's top left
   * corner, so the element's own box starts at (`image.padding`, `image.padding`), and a scale of
   * `1 / image.pixelRatio` draws the capture at rest. Sprites past the run's own count are drawn
   * at zero scale whatever is written to them.
   *
   * Runs share the pool, so every frame has to write each sprite's source rect, transform and
   * colour again. It runs every frame: allocate nothing.
   */
  frame(run: WebRunState, pool: AtlasPool, time: number): boolean;
}

/** The effect a preset plays with, or `null` when the web has none: the run then falls back. */
export type WebEffects = (preset: SnapshotPreset) => WebEffect | null;

/** A run from the frame its capture is uploaded until it ends. */
interface Drawing {
  state: WebRunState;
  effect: WebEffect;
  count: number;
  pool: AtlasPool;
  atlas: CKImage;
  /** The timestamp of the run's first frame in milliseconds, or -1 before it. */
  startedAt: number;
  /** The effect reported its end on the frame just drawn. */
  over: boolean;
  /** The frame just drawn threw. */
  failed: boolean;
  /** Once the frame is flushed: hand off, and end the run when it is over or failed. */
  settle(): void;
  /** The surface is gone: fall back before handoff, end unfinished after it. */
  interrupt(): void;
}

const NO_EFFECTS: WebEffects = () => null;

const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  if (typeof process === 'undefined' || process.env.NODE_ENV === 'production') return;
  warned.add(key);
  console.warn(`ui-fx: ${message} Snapshot effects play their live fallback.`);
}

/**
 * The snapshot runtime of one web FX host: it draws every run of the host on `canvas` through
 * CanvasKit, in one `requestAnimationFrame` loop that runs only while a run is drawing.
 *
 * `kit` is called on the first run that has something to draw, and again by a later run when it
 * rejected. The WebGL surface is made then too, so a host whose elements play only live presets
 * loads no CanvasKit and holds no context. The canvas's backing store is kept at the window's
 * size in device pixels.
 *
 * A run measures, captures at 2048 px, uploads the capture and waits for a frame. In that frame's
 * callback it draws, flushes, hides the target and calls `onHandoff`, in that order, so `cancel()`
 * returns `false` exactly from `onHandoff` on. When the capture, the kit or WebGL is missing the
 * run calls `onFallback`. A lost WebGL context ends every run that was handed off with
 * `onEnd(false)`; the canvas is cleared when the context comes back.
 */
export function createWebFxRuntime(o: {
  kit: () => Promise<CanvasKit>;
  canvas: HTMLCanvasElement;
  /** How each preset draws. Without it every run falls back. */
  effects?: WebEffects;
}): FxRuntime & { dispose(): void } {
  const { canvas } = o;
  const effects = o.effects ?? NO_EFFECTS;
  let kit: CanvasKit | null = null;
  let surface: WebSurface | null = null;
  let paint: Paint | null = null;
  let lost = false;
  let disposed = false;
  let frameId = 0;
  /** Device pixels per layout pixel. */
  let scale = 1;
  const drawing: Drawing[] = [];
  /** One per run that has not ended: ends it unfinished, for when the runtime goes away. */
  const aborts = new Set<() => void>();

  /** Size the backing store to the window. `true` when it changed, which empties the canvas. */
  const fit = (): boolean => {
    scale = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
    const width = Math.max(1, Math.round(innerWidth * scale));
    const height = Math.max(1, Math.round(innerHeight * scale));
    if (canvas.width === width && canvas.height === height) return false;
    canvas.width = width;
    canvas.height = height;
    return true;
  };

  // A `WebSurface` has the size its canvas had when it was made, so a new size needs a new one.
  const open = (k: CanvasKit): WebSurface | null => {
    surface?.dispose();
    surface = createWebSurface(k, canvas);
    return surface;
  };

  const interruptAll = (): void => {
    for (let i = drawing.length - 1; i >= 0; i--) drawing[i]?.interrupt();
  };

  const draw = (d: Drawing, ck: CKCanvas, k: CanvasKit, p: Paint, now: number): void => {
    if (d.startedAt < 0) d.startedAt = now;
    const { state, pool } = d;
    try {
      d.over = !d.effect.frame(state, pool, (now - d.startedAt) / 1000);
      if (d.over) return;
      // The pool is as long as its tier, and `drawAtlas` draws all of it.
      pool.xforms.fill(0, d.count * 4);
    } catch (error) {
      d.failed = true;
      warnOnce('frame', `An effect threw while drawing. ${String(error)}`);
      return;
    }
    ck.save();
    ck.scale(scale, scale);
    ck.translate(state.rect.x - state.image.padding, state.rect.y - state.image.padding);
    try {
      // CanvasKit's default blend is SrcOver, which would ignore the colours.
      ck.drawAtlas(d.atlas, pool.srcs, pool.xforms, p, k.BlendMode.Modulate, pool.colors);
    } catch (error) {
      d.failed = true;
      warnOnce('frame', `A capture could not be drawn. ${String(error)}`);
    }
    ck.restore();
  };

  function tick(now: number): void {
    frameId = 0;
    if (kit === null || paint === null || surface === null || lost) return;
    let target: WebSurface | null = surface;
    if (fit()) target = open(kit);
    if (target === null) {
      interruptAll();
      return;
    }
    const ck = target.ckCanvas;
    ck.clear(kit.TRANSPARENT);
    for (let i = 0; i < drawing.length; i++) draw(drawing[i]!, ck, kit, paint, now);
    target.flush();
    // Backwards, so a run that ends, and one it cancels, leave the rest of the walk alone.
    for (let i = drawing.length - 1; i >= 0; i--) drawing[i]?.settle();
    schedule();
  }

  function schedule(): void {
    if (frameId !== 0 || drawing.length === 0 || lost || disposed) return;
    frameId = requestAnimationFrame(tick);
  }

  const unschedule = (): void => {
    if (frameId === 0) return;
    cancelAnimationFrame(frameId);
    frameId = 0;
  };

  /** The kit, with a surface and a paint to draw with, or `null` when there is none to be had. */
  const ready = async (): Promise<CanvasKit | null> => {
    if (kit === null) {
      try {
        const loaded = await o.kit();
        kit ??= loaded;
      } catch (error) {
        // The full glue rejects with a bare value, seen as `Infinity`, when the wasm it was
        // served is not the full build (C37).
        if (error instanceof Error) warnOnce('kit', `CanvasKit did not load: ${error.message}.`);
        else {
          warnOnce(
            'binary',
            'CanvasKit did not start. The wasm it was served is likely not the full binary: serve canvaskit-wasm/bin/full/canvaskit.wasm.',
          );
        }
        return null;
      }
    }
    if (disposed || lost) return null;
    if (surface === null) {
      fit();
      if (open(kit) === null) {
        warnOnce('webgl', 'No WebGL surface could be made.');
        return null;
      }
    }
    paint ??= new kit.Paint();
    return kit;
  };

  function run(t: FxTarget, p: SnapshotPreset, options: FxRunOptions): FxRun {
    let stage: 'capturing' | 'ready' | 'handed' | 'ended' = 'capturing';
    let cancelled = false;
    let mine: Drawing | null = null;

    const leave = (): void => {
      stage = 'ended';
      aborts.delete(abort);
      if (mine === null) return;
      const index = drawing.indexOf(mine);
      if (index >= 0) drawing.splice(index, 1);
      mine.atlas.delete();
      mine = null;
      if (drawing.length === 0) unschedule();
    };

    const end = (finished: boolean): void => {
      if (stage === 'ended') return;
      // An enter hid its element at handoff, and nothing else is left to show it.
      const reveal = stage === 'handed' && options.direction === 1;
      leave();
      if (reveal) {
        t.hidden.value = 0;
        t.hideSync();
      }
      options.onEnd(finished);
    };

    function abort(): void {
      end(false);
    }

    const fallBack = (): void => {
      if (stage === 'ended') return;
      leave();
      options.onFallback();
    };

    const settle = (): void => {
      if (mine === null || mine.startedAt < 0) return;
      if (mine.failed) {
        if (stage === 'ready') fallBack();
        else end(false);
        return;
      }
      const over = mine.over;
      if (stage === 'ready') {
        stage = 'handed';
        t.hidden.value = 1;
        t.hideSync();
        options.onHandoff();
      }
      if (over) end(true);
    };

    const interrupt = (): void => {
      if (stage === 'ready') fallBack();
      else end(false);
    };

    const play = async (): Promise<void> => {
      let rect: RectLike | null = null;
      let image: FxImage | null = null;
      try {
        rect = await t.measure();
        if (rect !== null && rect.width > 0 && rect.height > 0) {
          image = await t.capture(CAPTURE_MAX_PX);
        }
      } catch {
        image = null;
      }
      if (cancelled || disposed) {
        end(false);
        return;
      }
      const effect = rect === null || image === null ? null : effects(p);
      if (rect === null || image === null || effect === null) {
        fallBack();
        return;
      }

      const k = await ready();
      if (cancelled || disposed) {
        end(false);
        return;
      }
      if (k === null) {
        fallBack();
        return;
      }

      const state: WebRunState = {
        preset: p,
        rect,
        image,
        direction: options.direction,
        press: options.press,
        progress: options.progress,
      };
      try {
        const count = effect.sprites(state);
        const pool = createAtlasPool(k, count);
        // `captureView` puts a canvas or a bitmap in `handle`. A tainted one throws here.
        const atlas = k.MakeImageFromCanvasImageSource(image.handle as CanvasImageSource);
        mine = {
          state,
          effect,
          count,
          pool,
          atlas,
          startedAt: -1,
          over: false,
          failed: false,
          settle,
          interrupt,
        };
      } catch (error) {
        warnOnce('upload', `A capture could not be uploaded. ${String(error)}`);
        fallBack();
        return;
      }
      stage = 'ready';
      drawing.push(mine);
      schedule();
    };

    aborts.add(abort);
    play();

    return {
      cancel() {
        if (cancelled || stage === 'handed' || stage === 'ended') return false;
        cancelled = true;
        // A capture or a kit still on its way ends the run when it lands.
        if (stage === 'ready') abort();
        return true;
      },
    };
  }

  // preventDefault() keeps the context restorable. Nothing touches a dead context: the runs end
  // here, and the frame loop stops until the context is back.
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    lost = true;
    unschedule();
    interruptAll();
  };
  const onContextRestored = (): void => {
    lost = false;
    if (kit === null || surface === null) return;
    fit();
    const restored = open(kit);
    if (restored === null) return;
    // Whatever frame the old context last showed must not come back with the new one.
    restored.ckCanvas.clear(kit.TRANSPARENT);
    restored.flush();
  };
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);
  fit();

  return {
    run,
    dispose() {
      if (disposed) return;
      disposed = true;
      unschedule();
      for (const abort of [...aborts]) abort();
      canvas.removeEventListener('webglcontextlost', onContextLost, false);
      canvas.removeEventListener('webglcontextrestored', onContextRestored, false);
      paint?.delete();
      paint = null;
      surface?.dispose();
      surface = null;
    },
  };
}
