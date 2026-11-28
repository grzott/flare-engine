import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { dust, presetDuration, type SnapshotPreset, shatter } from '../../src/core/presets';
import {
  DUST_SKSL,
  DUST_UNIFORM_FLOATS,
  DUST_UNIFORMS,
  packDustUniformsInto,
} from '../../src/core/sksl';
import { dustEffect } from '../../src/fx/web/effects/dust';
import type { FxImage, FxRuntime, ProgressSource } from '../../src/runtime/contracts';
import { createWebFxRuntime, type WebRunState } from '../../src/web/fx-runtime';
import { settle } from '../fx/native/support';
import { flushFrames, installDom } from '../support/dom';
import { createFakeTarget, type FakeTarget } from '../support/fakes';
import { type CallRecord, type MockKit, makeMockKit } from '../support/mock-kit';

installDom();

const warn = spyOn(console, 'warn').mockImplementation(() => {});

const RECT = { x: 10, y: 20, width: 100, height: 40 };
const PADDING = 8;
const PIXEL_RATIO = 2;

const runtimes: (FxRuntime & { dispose(): void })[] = [];

beforeEach(() => {
  Reflect.set(globalThis, 'innerWidth', 400);
  Reflect.set(globalThis, 'innerHeight', 300);
  Reflect.set(globalThis, 'devicePixelRatio', 2);
  warn.mockClear();
});

afterEach(() => {
  for (const fx of runtimes.splice(0)) fx.dispose();
  for (const canvas of [...document.body.querySelectorAll('canvas')]) canvas.remove();
});

/** A capture of the element at 2x, reaching 8 layout pixels beyond it. */
const capture = (): FxImage => ({
  width: (RECT.width + 2 * PADDING) * PIXEL_RATIO,
  height: (RECT.height + 2 * PADDING) * PIXEL_RATIO,
  pixelRatio: PIXEL_RATIO,
  padding: PADDING,
  handle: document.createElement('canvas'),
});

interface Stage {
  mk: MockKit;
  fx: FxRuntime;
}

function stage(mk: MockKit = makeMockKit()): Stage {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const fx = createWebFxRuntime({
    kit: () => Promise.resolve(mk.kit),
    canvas,
    effects: () => dustEffect,
  });
  runtimes.push(fx);
  return { mk, fx };
}

interface Played {
  mk: MockKit;
  target: FakeTarget;
  image: FxImage;
  /** `'handoff'`, `'end:true'`, `'end:false'` and `'fallback'`, in call order. */
  events: string[];
}

/** Starts a run of `preset` that draws with the dust effect, up to its first frame request. */
async function play(
  preset: SnapshotPreset,
  o: { direction?: 1 | -1; progress?: ProgressSource; on?: Stage } = {},
): Promise<Played> {
  const { mk, fx } = o.on ?? stage();
  const image = capture();
  const target: FakeTarget = { ...createFakeTarget({ rect: RECT }) };
  target.capture = () => Promise.resolve(image);
  target.hideSync = () => {
    target.hideSyncs++;
  };
  const events: string[] = [];
  fx.run(target, preset, {
    direction: o.direction ?? -1,
    press: null,
    progress: o.progress,
    onHandoff: () => events.push('handoff'),
    onEnd: (finished) => events.push(`end:${finished}`),
    onFallback: () => events.push('fallback'),
  });
  await settle();
  return { mk, target, image, events };
}

/** The `n`th call of `method`. */
const callOf = (mk: MockKit, method: string, n: number): CallRecord => {
  const call = mk.callsOf(method)[n];
  if (call === undefined) throw new Error(`there was no ${method} call ${n}`);
  return call;
};

/** The uniforms the `n`th frame's shader was made with. */
const uniformsOf = (mk: MockKit, n: number): Float32Array =>
  callOf(mk, 'makeShaderWithChildren', n).args[0] as Float32Array;

/** `u_progress` on the `n`th frame. The buffer is reused, so read it before the next frame. */
const progressOf = (mk: MockKit, n: number): number => uniformsOf(mk, n)[0]!;

interface AtlasDraw {
  srcs: Float32Array;
  xforms: Float32Array;
  blend: unknown;
  colors: Uint32Array;
}

const atlasOf = (mk: MockKit, n: number): AtlasDraw => {
  const [, srcs, xforms, , blend, colors] = callOf(mk, 'drawAtlas', n).args;
  return {
    srcs: srcs as Float32Array,
    xforms: xforms as Float32Array,
    blend,
    colors: colors as Uint32Array,
  };
};

/** How many sprites of `xforms` draw: the others sit at zero scale. */
const drawn = (xforms: Float32Array): number => {
  let count = 0;
  for (let o = 0; o < xforms.length; o += 4) if (xforms[o] !== 0 || xforms[o + 1] !== 0) count++;
  return count;
};

const stateOf = (preset: SnapshotPreset, image: FxImage): WebRunState => ({
  preset,
  rect: RECT,
  image,
  direction: -1,
  press: null,
  progress: undefined,
});

describe('the dust effect', () => {
  test('compiles DUST_SKSL through RuntimeEffect.Make, which returns an effect', async () => {
    const { mk, events } = await play(dust());
    expect(mk.effects).toEqual([DUST_SKSL]);

    await flushFrames(1);
    expect(events).toEqual(['handoff']);
    // The shader of the frame came from the effect `Make` returned.
    expect(mk.callsOf('makeShaderWithChildren')).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
  });

  test('compiles once per kit, however many runs there are', async () => {
    const on = stage();
    await play(dust(), { on });
    await play(dust({ sweepAngle: 0 }), { on });
    await flushFrames(2);

    expect(on.mk.effects).toEqual([DUST_SKSL]);
    expect(on.mk.callsOf('makeShaderWithChildren')).toHaveLength(4);
  });

  test("draws a rect: the element's box grown by spread on every side", async () => {
    const { mk } = await play(dust({ spread: 30 }));
    await flushFrames(1);

    expect(mk.callsOf('drawRect')).toHaveLength(1);
    const [box] = callOf(mk, 'drawRect', 0).args;
    // The shader measures from the rect's corner, so the rect starts at the origin.
    expect([...(box as Float32Array)]).toEqual([0, 0, RECT.width + 60, RECT.height + 60]);
    // The runtime moves to the capture's corner, and the effect on to the rect's.
    const moves = mk.callsOf('translate');
    expect(moves).toHaveLength(2);
    const left = (moves[0]!.args[0] as number) + (moves[1]!.args[0] as number);
    const top = (moves[0]!.args[1] as number) + (moves[1]!.args[1] as number);
    expect(left).toBe(RECT.x - 30);
    expect(top).toBe(RECT.y - 30);
    const order = mk.calls.map((call) => call.method);
    expect(order.indexOf('translate')).toBeLessThan(order.indexOf('drawRect'));
    expect(order.lastIndexOf('translate')).toBeLessThan(order.indexOf('drawRect'));
    expect(mk.callsOf('save')).toHaveLength(mk.callsOf('restore').length);
  });

  test('fills the rect with the shader, made from the packed uniforms', async () => {
    const preset = dust({ sweepAngle: 37, edgeColor: '#ff0000', spread: 32, seed: 7 });
    const { mk } = await play(preset);
    await flushFrames(2);

    const given = uniformsOf(mk, 1);
    expect(given).toBeInstanceOf(Float32Array);
    expect(given).toHaveLength(DUST_UNIFORM_FLOATS);
    expect(DUST_UNIFORMS[0]).toBe('u_progress');
    const expected = packDustUniformsInto(
      preset,
      1 / 60 / presetDuration(preset),
      RECT.width,
      RECT.height,
      new Float32Array(DUST_UNIFORM_FLOATS),
    );
    for (let i = 0; i < DUST_UNIFORM_FLOATS; i++) expect(given[i]).toBeCloseTo(expected[i]!, 5);

    // The paint of the rect holds the shader of that frame.
    const shader = mk.callsOf('setShader')[1]!.args[0];
    expect(shader).toMatchObject({ sksl: DUST_SKSL });
    const [, paint] = callOf(mk, 'drawRect', 1).args;
    expect(paint).toBeDefined();
  });

  test('gives the shader the capture as its one child, cut off at its edges', async () => {
    const { mk } = await play(dust());
    await flushFrames(1);

    expect(mk.callsOf('makeShaderOptions')).toHaveLength(1);
    const [tx, ty, filter, mipmap, matrix] = callOf(mk, 'makeShaderOptions', 0).args;
    expect(tx).toBe(mk.kit.TileMode.Decal);
    expect(ty).toBe(mk.kit.TileMode.Decal);
    expect(filter).toBe(mk.kit.FilterMode.Linear);
    expect(mipmap).toBe(mk.kit.MipmapMode.None);
    // Image pixels to layout pixels from the element's corner.
    expect(matrix).toEqual([1 / PIXEL_RATIO, 0, -PADDING, 0, 1 / PIXEL_RATIO, -PADDING, 0, 0, 1]);

    const [, children] = callOf(mk, 'makeShaderWithChildren', 0).args;
    expect(children).toHaveLength(1);
    expect((children as { image: unknown }[])[0]!.image).toBe(mk.images[0]);
  });

  test('frames 2 and 3 pack into the same buffer, and free the shader of each frame', async () => {
    const { mk } = await play(dust());
    await flushFrames(3);

    expect(uniformsOf(mk, 2)).toBe(uniformsOf(mk, 1));
    expect(callOf(mk, 'drawRect', 2).args[0]).toBe(callOf(mk, 'drawRect', 1).args[0]);
    expect(callOf(mk, 'drawRect', 2).args[1]).toBe(callOf(mk, 'drawRect', 1).args[1]);
    expect(mk.callsOf('makeShaderOptions')).toHaveLength(1);
    // Only the capture's shader outlives a frame.
    expect(mk.liveShaders).toBe(1);
  });

  test('u_progress runs from 0 to 1 over the duration', async () => {
    const { mk } = await play(dust({ duration: 2 }));
    await flushFrames(1);
    expect(progressOf(mk, 0)).toBe(0);
    await flushFrames(30);
    expect(progressOf(mk, 30)).toBeCloseTo(0.25, 5);
    await flushFrames(60);
    expect(progressOf(mk, 90)).toBeCloseTo(0.75, 5);
  });

  test('follows the easing of the preset, after its delay', async () => {
    const { mk } = await play(dust({ delay: 0.5, duration: 1, easing: 'easeInQuad' }));
    await flushFrames(31);
    // The 60 Hz clock lands a rounding error past the delay.
    expect(progressOf(mk, 30)).toBeCloseTo(0, 9);
    await flushFrames(30);
    expect(progressOf(mk, 60)).toBeCloseTo(0.25, 3);
  });

  test('without grains it draws no sprite', async () => {
    const preset = dust();
    expect(preset.grainsAtFront).toBe(0);
    const { mk, image } = await play(preset);
    await flushFrames(3);

    expect(dustEffect.sprites(stateOf(preset, image))).toBe(0);
    expect(mk.callsOf('drawAtlas')).toHaveLength(0);
    expect(mk.callsOf('drawRect')).toHaveLength(3);
  });

  test('hands off on its first frame, ends when the preset has run and frees what it made', async () => {
    const preset = dust();
    const frames = Math.ceil(presetDuration(preset) * 60);
    const { mk, events, target } = await play(preset);
    expect(events).toEqual([]);

    await flushFrames(1);
    expect(events).toEqual(['handoff']);
    expect(target.hidden.value).toBe(1);

    await flushFrames(frames - 1);
    expect(events).toEqual(['handoff']);

    await flushFrames(2);
    expect(events).toEqual(['handoff', 'end:true']);
    expect(mk.images[0]!.deleted).toBe(true);
    expect(mk.liveShaders).toBe(0);
    // The runtime's paint is still up; the run's own is gone.
    expect(mk.paints).toBe(2);
    expect(mk.deletedPaints).toBe(1);
    // An exit leaves its element hidden: the element is on its way out.
    expect(target.hidden.value).toBe(1);
  });

  test('follows an external progress, and has no end of its own', async () => {
    const progress = { value: 0 };
    const { mk, events } = await play(dust(), { progress });
    await flushFrames(200);
    expect(progressOf(mk, 199)).toBe(0);

    progress.value = 0.5;
    await flushFrames(1);
    expect(progressOf(mk, 200)).toBeCloseTo(0.5, 5);

    progress.value = 1;
    await flushFrames(1);
    expect(progressOf(mk, 201)).toBe(1);
    expect(events).toEqual(['handoff']);
  });

  test('SkSL that does not compile plays the live fallback, with one warning', async () => {
    const mk = makeMockKit();
    mk.failEffect = true;
    const { events, target } = await play(dust(), { on: stage(mk) });
    await flushFrames(1);

    expect(mk.effects).toEqual([DUST_SKSL]);
    expect(events).toEqual(['fallback']);
    expect(target.hidden.value).toBe(0);
    expect(mk.callsOf('drawRect')).toHaveLength(0);
    expect(mk.images[0]!.deleted).toBe(true);
    expect(mk.liveShaders).toBe(0);
    expect(mk.deletedPaints).toBe(mk.paints - 1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test('a preset that is not dust falls back', async () => {
    const { events } = await play(shatter());
    expect(events).toEqual(['fallback']);
  });
});

describe('grains at the front', () => {
  test('are drawn over the rect, one sprite per cell and at most grainsAtFront', async () => {
    const preset = dust({ grainsAtFront: 200 });
    const { mk, image } = await play(preset);
    await flushFrames(1);

    const count = dustEffect.sprites(stateOf(preset, image));
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(200);
    expect(mk.callsOf('drawAtlas')).toHaveLength(1);
    const { xforms, blend } = atlasOf(mk, 0);
    expect(drawn(xforms)).toBe(count);
    expect(blend).toBe(mk.kit.BlendMode.Modulate);
    const order = mk.calls.map((call) => call.method);
    expect(order.indexOf('drawRect')).toBeLessThan(order.indexOf('drawAtlas'));
    // Cut from the capture itself: nothing is baked.
    expect(mk.offscreen).toHaveLength(0);
  });

  test('each grain is a cell of the capture, at home and unseen until the front reaches it', async () => {
    const preset = dust({ grainsAtFront: 200 });
    const { mk, image } = await play(preset);
    await flushFrames(1);

    const count = dustEffect.sprites(stateOf(preset, image));
    const { srcs, xforms, colors } = atlasOf(mk, 0);
    for (let i = 0; i < count; i++) {
      const o = i * 4;
      expect(xforms[o]).toBeCloseTo(1 / PIXEL_RATIO, 5);
      expect(xforms[o + 1]).toBeCloseTo(0, 5);
      // The cell's place in the capture is its place in the capture's box.
      expect(xforms[o + 2]).toBeCloseTo(srcs[o]! / PIXEL_RATIO, 3);
      expect(xforms[o + 3]).toBeCloseTo(srcs[o + 1]! / PIXEL_RATIO, 3);
      expect(srcs[o + 2]!).toBeGreaterThan(srcs[o]!);
      expect(colors[i]).toBe(0x00ffffff);
    }
  });

  test('a sweep releases them: at angle 90 the leftmost first', async () => {
    const preset = dust({ sweepAngle: 90, grainsAtFront: 200 });
    const { mk, image } = await play(preset);
    await flushFrames(1);
    const count = dustEffect.sprites(stateOf(preset, image));
    const home = atlasOf(mk, 0).xforms.slice();

    // The 37th frame is 0.6 s in: half way through the run.
    await flushFrames(36);
    const { xforms, colors } = atlasOf(mk, 36);
    let released = 0;
    let drift = 0;
    for (let i = 0; i < count; i++) {
      const o = i * 4;
      const moved =
        Math.abs(xforms[o + 2]! - home[o + 2]!) > 1e-3 ||
        Math.abs(xforms[o + 3]! - home[o + 3]!) > 1e-3;
      // Where the cell starts, as a share of the element's width.
      const x = (home[o + 2]! - PADDING) / RECT.width;
      if (moved) {
        released++;
        drift += xforms[o + 2]! - home[o + 2]!;
      } else expect(colors[i]).toBe(0x00ffffff);
      if (x < 0.4) expect(moved).toBe(true);
      if (x > 0.8) expect(moved).toBe(false);
    }
    expect(released).toBeGreaterThan(0);
    expect(released).toBeLessThan(count);
    // 90° is +x: the released grains drift along the sweep.
    expect(drift / released).toBeGreaterThan(1);
  });

  test('frames 2 and 3 draw from the same buffers', async () => {
    const { mk } = await play(dust({ grainsAtFront: 200 }));
    await flushFrames(3);

    const second = atlasOf(mk, 1);
    const third = atlasOf(mk, 2);
    expect(third.srcs).toBe(second.srcs);
    expect(third.xforms).toBe(second.xforms);
    expect(third.colors).toBe(second.colors);
  });

  test('grainsAtFront is a budget: at most 3,000 cells, however many are asked for', async () => {
    const preset = dust({ grainsAtFront: 100000 });
    const { mk, image } = await play(preset);
    await flushFrames(1);

    const count = dustEffect.sprites(stateOf(preset, image));
    expect(count).toBeGreaterThan(200);
    expect(count).toBeLessThanOrEqual(3000);
    expect(drawn(atlasOf(mk, 0).xforms)).toBe(count);
  });
});

describe('an enter', () => {
  test('starts dissolved, ends whole and reveals the element', async () => {
    const preset = dust({ duration: 1, grainsAtFront: 100 });
    const { mk, events, target } = await play(preset, { direction: 1 });

    await flushFrames(1);
    expect(events).toEqual(['handoff']);
    expect(target.hidden.value).toBe(1);
    expect(progressOf(mk, 0)).toBe(1);

    await flushFrames(45);
    expect(progressOf(mk, 45)).toBeCloseTo(0.25, 5);

    await flushFrames(16);
    expect(target.hidden.value).toBe(0);
    expect(target.hideSyncs).toBe(2);
    expect(events).toEqual(['handoff', 'end:true']);
  });
});
