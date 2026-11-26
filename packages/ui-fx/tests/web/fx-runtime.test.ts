import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { CanvasKit } from 'canvaskit-wasm';
import { shatter } from '../../src/core/presets';
import type { FxImage, FxRuntime } from '../../src/runtime/contracts';
import type { AtlasPool } from '../../src/web/atlas';
import { captureView, setWebRasterizer } from '../../src/web/capture';
import {
  createWebFxRuntime,
  type WebEffect,
  type WebEffects,
  type WebRunState,
} from '../../src/web/fx-runtime';
import { settle, start } from '../fx/native/support';
import { flushFrames, installDom, pendingFrameCount } from '../support/dom';
import { createFakeTarget, type FakeTarget } from '../support/fakes';
import { type MockKit, makeMockKit } from '../support/mock-kit';

installDom();

const warn = spyOn(console, 'warn').mockImplementation(() => {});

interface TestEffect extends WebEffect {
  /** The `time` of every `frame` call. */
  times: number[];
  /** The state of every `frame` call's run. */
  states: WebRunState[];
}

/**
 * Draws the whole capture as one sprite, at rest on the element, for `frames` frames. The frame
 * after those reports the effect over.
 */
const spriteEffect = (frames = Number.POSITIVE_INFINITY, sprites = 1): TestEffect => {
  const effect: TestEffect = {
    times: [],
    states: [],
    sprites: () => sprites,
    frame(run: WebRunState, pool: AtlasPool, time: number) {
      effect.times.push(time);
      effect.states.push(run);
      pool.srcs[2] = run.image.width;
      pool.srcs[3] = run.image.height;
      pool.xforms[0] = 1 / run.image.pixelRatio;
      return effect.times.length <= frames;
    },
  };
  return effect;
};

interface Mounted {
  fx: FxRuntime & { dispose(): void };
  canvas: HTMLCanvasElement;
  mk: MockKit;
  kit: ReturnType<typeof mock<() => Promise<CanvasKit>>>;
}

const runtimes: (FxRuntime & { dispose(): void })[] = [];

function mount(
  effects: WebEffects | WebEffect = spriteEffect(),
  o: { kit?: () => Promise<CanvasKit> } = {},
): Mounted {
  const mk = makeMockKit();
  const kit = mock(o.kit ?? (() => Promise.resolve(mk.kit)));
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const table: WebEffects = typeof effects === 'function' ? effects : () => effects;
  const fx = createWebFxRuntime({ kit, canvas, effects: table });
  runtimes.push(fx);
  return { fx, canvas, mk, kit };
}

const methods = (mk: MockKit): string[] => mk.calls.map((call) => call.method);

beforeEach(() => {
  Reflect.set(globalThis, 'innerWidth', 400);
  Reflect.set(globalThis, 'innerHeight', 300);
  Reflect.set(globalThis, 'devicePixelRatio', 2);
  warn.mockClear();
});

afterEach(() => {
  for (const fx of runtimes.splice(0)) fx.dispose();
  for (const canvas of [...document.body.querySelectorAll('canvas')]) canvas.remove();
  setWebRasterizer(null);
});

describe('an idle runtime', () => {
  test('sizes the canvas to the window in device pixels, and schedules no frame', () => {
    const { canvas, kit, mk } = mount();

    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
    expect(pendingFrameCount()).toBe(0);
    // CanvasKit loads on the first snapshot effect, not before.
    expect(kit).not.toHaveBeenCalled();
    expect(mk.surfaces).toHaveLength(0);
  });

  test('schedules no frame once its only run has ended, and leaves the canvas clear', async () => {
    const { fx, mk } = mount(spriteEffect(2));
    const { events } = start(fx, shatter());
    await settle();
    await flushFrames(3);

    expect(events).toEqual(['handoff', 'end:true']);
    expect(pendingFrameCount()).toBe(0);
    // The last frame drew nothing over the clear.
    expect(methods(mk).slice(-2)).toEqual(['clear', 'flush']);
    await flushFrames(2);
    expect(mk.callsOf('flush')).toHaveLength(3);
  });
});

describe('a run', () => {
  test('measures, captures at 2048 px, loads the kit, draws, hands off and ends, in that order', async () => {
    const effect = spriteEffect(2);
    const { fx, mk, kit, canvas } = mount(effect);
    const preset = shatter();
    const { target, events } = start(fx, preset);

    expect(target.measures).toBe(1);
    expect(target.captures).toEqual([]);
    expect(kit).not.toHaveBeenCalled();

    await settle();
    expect(target.captures).toEqual([2048]);
    expect(kit).toHaveBeenCalledTimes(1);
    expect(mk.surfaces).toEqual([canvas]);
    expect(mk.images.map((image) => image.source)).toEqual([target.images[0]!.handle]);
    expect(mk.callsOf('drawAtlas')).toHaveLength(0);
    expect(events).toEqual([]);
    expect(target.hidden.value).toBe(0);
    expect(pendingFrameCount()).toBe(1);

    await flushFrames(1);
    expect(mk.callsOf('drawAtlas')).toHaveLength(1);
    expect(events).toEqual(['handoff']);
    expect(target.hidden.value).toBe(1);
    expect(target.hideSyncs).toBe(1);
    const state = effect.states[0]!;
    expect(state.preset).toBe(preset);
    expect(state.rect).toEqual({ x: 10, y: 20, width: 100, height: 40 });
    expect(state.image).toBe(target.images[0]!);
    expect(state.direction).toBe(-1);

    await flushFrames(2);
    expect(events).toEqual(['handoff', 'end:true']);
    expect(mk.images[0]?.deleted).toBe(true);
    // An exit leaves its element hidden: the element is released, not shown again.
    expect(target.hidden.value).toBe(1);
  });

  test('the first frame is flushed, then the target hidden, then onHandoff called, in one callback', async () => {
    const { fx, mk } = mount();
    const target = createFakeTarget();
    target.hideSync = () => {
      mk.calls.push({ method: 'hideSync', args: [target.hidden.value] });
    };
    fx.run(target, shatter(), {
      direction: -1,
      press: null,
      onHandoff: () => mk.calls.push({ method: 'onHandoff', args: [] }),
      onEnd: () => {},
      onFallback: () => {},
    });
    await settle();
    expect(pendingFrameCount()).toBe(1);

    await flushFrames(1);

    expect(methods(mk).slice(-4)).toEqual(['restore', 'flush', 'hideSync', 'onHandoff']);
    // `hidden` is already 1 when `hideSync` applies it.
    expect(mk.callsOf('hideSync')[0]?.args).toEqual([1]);
    expect(methods(mk).indexOf('drawAtlas')).toBeLessThan(methods(mk).indexOf('flush'));
  });

  test('the effect is given the seconds since its first frame', async () => {
    const effect = spriteEffect();
    const { fx } = mount(effect);
    start(fx, shatter());
    await settle();
    await flushFrames(3);

    expect(effect.times[0]).toBe(0);
    expect(effect.times[1]).toBeCloseTo(1 / 60, 10);
    expect(effect.times[2]).toBeCloseTo(2 / 60, 10);
  });

  test('frames 2 and 3 reach drawAtlas with the same typed arrays, so a frame allocates none', async () => {
    const { fx, mk } = mount();
    start(fx, shatter());
    await settle();
    await flushFrames(3);

    const [first, second, third] = mk.callsOf('drawAtlas');
    expect(second?.args[1]).toBeInstanceOf(Float32Array);
    expect(second?.args[2]).toBeInstanceOf(Float32Array);
    expect(second?.args[5]).toBeInstanceOf(Uint32Array);
    for (const index of [1, 2, 5]) {
      expect(third?.args[index]).toBe(second?.args[index]);
      expect(second?.args[index]).toBe(first?.args[index]);
    }
    // The same image and paint too.
    expect(third?.args[0]).toBe(second?.args[0]);
    expect(third?.args[3]).toBe(second?.args[3]);
    expect(mk.paints).toBe(1);
  });

  test('the blend mode is passed explicitly, as Modulate', async () => {
    const { fx, mk } = mount();
    start(fx, shatter());
    await settle();
    await flushFrames(1);

    expect(mk.callsOf('drawAtlas')[0]?.args[4]).toBe(mk.kit.BlendMode.Modulate);
  });

  test('sprites the effect does not use are at zero scale', async () => {
    const effect = spriteEffect();
    const write = effect.frame;
    effect.frame = (run, pool, time) => {
      // A sprite beyond the one the run asked for.
      pool.xforms[4] = 1;
      return write(run, pool, time);
    };
    const { fx, mk } = mount(effect);
    start(fx, shatter());
    await settle();
    await flushFrames(1);

    const xforms = mk.callsOf('drawAtlas')[0]?.args[2] as Float32Array;
    expect(xforms[0]).toBe(1);
    expect(xforms.subarray(4).every((value) => value === 0)).toBe(true);
  });

  test('the padded capture is drawn offset by its padding, so the element lands on its rect', async () => {
    const { fx, mk } = mount();
    const target = createFakeTarget();
    const image: FxImage = { width: 296, height: 176, pixelRatio: 2, padding: 24, handle: {} };
    target.capture = () => Promise.resolve(image);
    start(fx, shatter(), { target });
    await settle();
    await flushFrames(1);

    // Layout pixels to device pixels first, then to the capture's top left corner.
    const frame = methods(mk).slice(methods(mk).indexOf('save'));
    expect(frame.slice(0, 5)).toEqual(['save', 'scale', 'translate', 'drawAtlas', 'restore']);
    expect(mk.callsOf('scale')[0]?.args).toEqual([2, 2]);
    expect(mk.callsOf('translate')[0]?.args).toEqual([10 - 24, 20 - 24]);
    // One sprite, the whole capture at one layout pixel per `pixelRatio` image pixels: its
    // padding of 24 puts the element's own corner at (10, 20).
    const [, srcs, xforms] = mk.callsOf('drawAtlas')[0]!.args as [
      unknown,
      Float32Array,
      Float32Array,
    ];
    expect([...srcs.subarray(0, 4)]).toEqual([0, 0, 296, 176]);
    expect([...xforms.subarray(0, 4)]).toEqual([0.5, 0, 0, 0]);
  });

  test('two runs draw in one frame, with one clear and one flush', async () => {
    const { fx, mk } = mount();
    const a = start(fx, shatter());
    const b = start(fx, shatter());
    await settle();
    expect(pendingFrameCount()).toBe(1);
    await flushFrames(1);

    expect(methods(mk).filter((m) => m === 'clear' || m === 'drawAtlas' || m === 'flush')).toEqual([
      'clear',
      'drawAtlas',
      'drawAtlas',
      'flush',
    ]);
    expect(a.events).toEqual(['handoff']);
    expect(b.events).toEqual(['handoff']);
    expect(mk.surfaces).toHaveLength(1);
  });

  test('an enter shows its element again when it ends', async () => {
    const { fx } = mount(spriteEffect(1));
    const target = createFakeTarget();
    const events: string[] = [];
    fx.run(target, shatter(), {
      direction: 1,
      press: null,
      onHandoff: () => events.push(`handoff:${target.hidden.value}`),
      onEnd: (finished) => events.push(`end:${finished}:${target.hidden.value}`),
      onFallback: () => events.push('fallback'),
    });
    await settle();
    await flushFrames(2);

    expect(events).toEqual(['handoff:1', 'end:true:0']);
    expect(target.hideSyncs).toBe(2);
  });

  test('the canvas follows the window: a resize makes a new surface at the new size', async () => {
    const { fx, mk, canvas } = mount();
    start(fx, shatter());
    await settle();
    await flushFrames(1);

    Reflect.set(globalThis, 'innerWidth', 500);
    await flushFrames(1);

    expect(canvas.width).toBe(1000);
    expect(mk.surfaces).toHaveLength(2);
    expect(mk.deletedSurfaces).toBe(1);
    expect(mk.callsOf('drawAtlas')).toHaveLength(2);
  });
});

describe('cancel', () => {
  test('a capture that lands after the target unmounted draws nothing and ends unfinished', async () => {
    const { fx, mk, kit } = mount();
    const { target, run, events } = start(fx, shatter(), { deferCapture: true });
    await settle();
    expect(target.captures).toEqual([2048]);

    // An unmounting element cancels its run.
    expect(run.cancel()).toBe(true);
    expect(events).toEqual([]);

    target.landCaptures();
    await settle();
    await flushFrames(2);

    expect(events).toEqual(['end:false']);
    expect(target.hidden.value).toBe(0);
    expect(target.hideSyncs).toBe(0);
    expect(mk.calls).toEqual([]);
    expect(kit).not.toHaveBeenCalled();
    expect(pendingFrameCount()).toBe(0);
  });

  test('before the first frame it returns true, ends the run and takes its frame back', async () => {
    const { fx, mk } = mount();
    const { target, run, events } = start(fx, shatter());
    await settle();
    expect(pendingFrameCount()).toBe(1);

    expect(run.cancel()).toBe(true);

    expect(events).toEqual(['end:false']);
    expect(pendingFrameCount()).toBe(0);
    expect(mk.images[0]?.deleted).toBe(true);
    expect(target.hidden.value).toBe(0);
    expect(run.cancel()).toBe(false);
    expect(events).toEqual(['end:false']);
  });

  test('after onHandoff it returns false and leaves the run playing', async () => {
    const { fx, mk } = mount();
    const { target, run, events } = start(fx, shatter());
    await settle();
    await flushFrames(1);

    expect(run.cancel()).toBe(false);
    await flushFrames(1);

    expect(events).toEqual(['handoff']);
    expect(target.hidden.value).toBe(1);
    expect(mk.callsOf('drawAtlas')).toHaveLength(2);
  });

  test('from inside onHandoff it returns false: the overlay has already taken over', async () => {
    const { fx } = mount();
    const target = createFakeTarget();
    const results: boolean[] = [];
    const run = fx.run(target, shatter(), {
      direction: -1,
      press: null,
      onHandoff: () => results.push(run.cancel()),
      onEnd: () => {},
      onFallback: () => {},
    });
    await settle();
    await flushFrames(1);

    expect(results).toEqual([false]);
  });
});

describe('when capture or CanvasKit fails', () => {
  const liveTarget = (): FakeTarget => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => new DOMRect(10, 20, 100, 40);
    const target = createFakeTarget();
    target.capture = (maxPx) => captureView(el, maxPx);
    return target;
  };

  test('with no rasterizer set, every run falls back, and the warning appears once', async () => {
    const { fx, kit, mk } = mount();
    const a = start(fx, shatter(), { target: liveTarget() });
    const b = start(fx, shatter(), { target: liveTarget() });
    await settle();

    expect(a.events).toEqual(['fallback']);
    expect(b.events).toEqual(['fallback']);
    expect(warn).toHaveBeenCalledTimes(1);
    // Nothing to draw, so the 2.9 MB kit is never asked for.
    expect(kit).not.toHaveBeenCalled();
    expect(mk.calls).toEqual([]);
    expect(pendingFrameCount()).toBe(0);
  });

  test('a rasterizer throwing SecurityError falls back, warns once and does not throw', async () => {
    setWebRasterizer(() => {
      throw new DOMException('The canvas has been tainted', 'SecurityError');
    });
    const { fx } = mount();
    const a = start(fx, shatter(), { target: liveTarget() });
    const b = start(fx, shatter(), { target: liveTarget() });
    await settle();

    expect(a.events).toEqual(['fallback']);
    expect(b.events).toEqual(['fallback']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(a.target.hidden.value).toBe(0);
  });

  test('a capture whose promise rejects falls back', async () => {
    const { fx } = mount();
    const target = createFakeTarget();
    target.capture = () => Promise.reject(new DOMException('tainted', 'SecurityError'));
    const { events } = start(fx, shatter(), { target });
    await settle();

    expect(events).toEqual(['fallback']);
  });

  test('a target that measures null is never captured and falls back', async () => {
    const { fx } = mount();
    const target = createFakeTarget({ rect: null });
    const { events } = start(fx, shatter(), { target });
    await settle();

    expect(target.captures).toEqual([]);
    expect(events).toEqual(['fallback']);
  });

  test('a preset with no web effect falls back without loading the kit', async () => {
    const { fx, kit } = mount(() => null);
    const { events } = start(fx, shatter());
    await settle();

    expect(events).toEqual(['fallback']);
    expect(kit).not.toHaveBeenCalled();
  });

  test('a rejected kit load falls back, warns once, and is tried again by the next run', async () => {
    const mk = makeMockKit();
    let loads = 0;
    const { fx } = mount(spriteEffect(), {
      kit: () => (++loads <= 2 ? Promise.reject(new Error('offline')) : Promise.resolve(mk.kit)),
    });
    const a = start(fx, shatter());
    await settle();
    const b = start(fx, shatter());
    await settle();

    expect(a.events).toEqual(['fallback']);
    expect(b.events).toEqual(['fallback']);
    expect(a.target.hidden.value).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('offline');
    expect(pendingFrameCount()).toBe(0);

    const c = start(fx, shatter());
    await settle();
    await flushFrames(1);
    expect(c.events).toEqual(['handoff']);
  });

  test('a kit load rejecting with the number Infinity falls back, and the warning names the full binary', async () => {
    const { fx } = mount(spriteEffect(), {
      kit: () => Promise.reject(Number.POSITIVE_INFINITY),
    });
    const { events } = start(fx, shatter());
    await settle();

    expect(events).toEqual(['fallback']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('bin/full/canvaskit.wasm');
  });

  test('without WebGL no surface can be made, and the run falls back', async () => {
    const { fx, mk } = mount();
    mk.failSurface = true;
    const { events } = start(fx, shatter());
    await settle();

    expect(events).toEqual(['fallback']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(pendingFrameCount()).toBe(0);
  });

  test('a capture CanvasKit cannot upload, as a tainted canvas, falls back and does not throw', async () => {
    const { fx, mk } = mount();
    mk.uploadError = new DOMException('The canvas has been tainted', 'SecurityError');
    const { events, target } = start(fx, shatter());
    await settle();

    expect(events).toEqual(['fallback']);
    expect(target.hidden.value).toBe(0);
    expect(pendingFrameCount()).toBe(0);
  });

  test('an effect that throws on its first frame falls back; later, the run ends unfinished', async () => {
    const early = spriteEffect();
    early.frame = () => {
      throw new Error('bad frame');
    };
    const a = mount(early);
    const first = start(a.fx, shatter());
    await settle();
    await flushFrames(1);
    expect(first.events).toEqual(['fallback']);
    expect(first.target.hidden.value).toBe(0);

    const late = spriteEffect();
    const write = late.frame;
    late.frame = (run, pool, time) => {
      if (late.times.length === 1) throw new Error('bad frame');
      return write(run, pool, time);
    };
    const b = mount(late);
    const second = start(b.fx, shatter());
    await settle();
    await flushFrames(2);
    expect(second.events).toEqual(['handoff', 'end:false']);
    expect(pendingFrameCount()).toBe(0);
  });
});

describe('a lost WebGL context', () => {
  const lose = (canvas: HTMLCanvasElement): Event => {
    const event = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(event);
    return event;
  };

  test('mid-run it ends the run unfinished, and nothing more is drawn', async () => {
    const { fx, mk, canvas } = mount();
    const { events } = start(fx, shatter());
    await settle();
    await flushFrames(2);
    const drawn = mk.calls.length;

    const event = lose(canvas);

    expect(events).toEqual(['handoff', 'end:false']);
    // Kept restorable, as render-web's postfx surface does.
    expect(event.defaultPrevented).toBe(true);
    expect(pendingFrameCount()).toBe(0);
    await flushFrames(2);
    // A dead context is never drawn to.
    expect(mk.calls).toHaveLength(drawn);
    expect(mk.images[0]?.deleted).toBe(true);
  });

  test('once restored, the canvas is cleared on a new surface before anything else is drawn', async () => {
    const { fx, mk, canvas } = mount();
    start(fx, shatter());
    await settle();
    await flushFrames(2);
    lose(canvas);
    const drawn = mk.calls.length;

    canvas.dispatchEvent(new Event('webglcontextrestored'));

    expect(mk.surfaces).toHaveLength(2);
    expect(mk.deletedSurfaces).toBe(1);
    expect(methods(mk).slice(drawn)).toEqual(['clear', 'flush']);
    expect(pendingFrameCount()).toBe(0);

    const next = start(fx, shatter());
    await settle();
    await flushFrames(1);
    expect(next.events).toEqual(['handoff']);
  });

  test('before the first frame it makes the run fall back, with its element still showing', async () => {
    const { fx, canvas } = mount();
    const { events, target } = start(fx, shatter());
    await settle();

    lose(canvas);

    expect(events).toEqual(['fallback']);
    expect(target.hidden.value).toBe(0);
    expect(pendingFrameCount()).toBe(0);
  });

  test('while it is lost, a new run falls back', async () => {
    const { fx, canvas } = mount();
    const first = start(fx, shatter());
    await settle();
    await flushFrames(1);
    lose(canvas);

    const { events } = start(fx, shatter());
    await settle();

    expect(first.events).toEqual(['handoff', 'end:false']);
    expect(events).toEqual(['fallback']);
    expect(pendingFrameCount()).toBe(0);
  });

  test('an enter it interrupts shows its element again', async () => {
    const { fx, canvas } = mount();
    const target = createFakeTarget();
    const events: string[] = [];
    fx.run(target, shatter(), {
      direction: 1,
      press: null,
      onHandoff: () => events.push('handoff'),
      onEnd: (finished) => events.push(`end:${finished}`),
      onFallback: () => events.push('fallback'),
    });
    await settle();
    await flushFrames(1);
    expect(target.hidden.value).toBe(1);

    lose(canvas);

    expect(events).toEqual(['handoff', 'end:false']);
    expect(target.hidden.value).toBe(0);
  });
});

describe('dispose', () => {
  test('ends a playing run unfinished and frees the surface, the paint and the image', async () => {
    const { fx, mk } = mount();
    const { events } = start(fx, shatter());
    await settle();
    await flushFrames(1);

    fx.dispose();

    expect(events).toEqual(['handoff', 'end:false']);
    expect(pendingFrameCount()).toBe(0);
    expect(mk.deletedSurfaces).toBe(1);
    expect(mk.deletedPaints).toBe(1);
    expect(mk.images[0]?.deleted).toBe(true);
  });

  test('a capture that lands afterwards draws nothing and ends unfinished', async () => {
    const { fx, mk } = mount();
    const { target, events } = start(fx, shatter(), { deferCapture: true });
    await settle();

    fx.dispose();
    target.landCaptures();
    await settle();

    expect(events).toEqual(['end:false']);
    expect(mk.calls).toEqual([]);
    expect(pendingFrameCount()).toBe(0);
  });

  test('stops listening for the context, and a later run ends unfinished', async () => {
    const { fx, mk, canvas } = mount();
    start(fx, shatter());
    await settle();
    fx.dispose();
    fx.dispose();

    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(mk.surfaces).toHaveLength(1);

    const { events } = start(fx, shatter());
    await settle();
    expect(events).toEqual(['end:false']);
  });
});
