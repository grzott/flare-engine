import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { generateFracture } from '../../src/core/fracture/generate';
import type { FractureMesh } from '../../src/core/fracture/types';
import type { RectLike } from '../../src/core/placement';
import { disintegrate, presetDuration, type SnapshotPreset, shatter } from '../../src/core/presets';
import { grainsEffect } from '../../src/fx/web/effects/grains';
import type { FxImage, FxRuntime, ProgressSource } from '../../src/runtime/contracts';
import { createWebFxRuntime, type WebRunState } from '../../src/web/fx-runtime';
import { settle } from '../fx/native/support';
import { flushFrames, installDom } from '../support/dom';
import { createFakeTarget, type FakeTarget } from '../support/fakes';
import { type MockKit, makeMockKit } from '../support/mock-kit';

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

/** A capture of `rect` at `pixelRatio`, reaching 8 layout pixels beyond it. */
const capture = (rect: RectLike, pixelRatio: number): FxImage => ({
  width: (rect.width + 2 * PADDING) * pixelRatio,
  height: (rect.height + 2 * PADDING) * pixelRatio,
  pixelRatio,
  padding: PADDING,
  handle: document.createElement('canvas'),
});

interface Played {
  mk: MockKit;
  target: FakeTarget;
  image: FxImage;
  /** `'handoff'`, `'end:true'`, `'end:false'` and `'fallback'`, in call order. */
  events: string[];
}

/** Starts a run of `preset` that draws with the grains effect, up to its first frame request. */
async function play(
  preset: SnapshotPreset,
  o: { direction?: 1 | -1; progress?: ProgressSource; rect?: RectLike; pixelRatio?: number } = {},
): Promise<Played> {
  const mk = makeMockKit();
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const fx = createWebFxRuntime({
    kit: () => Promise.resolve(mk.kit),
    canvas,
    effects: () => grainsEffect,
  });
  runtimes.push(fx);
  const rect = o.rect ?? RECT;
  const image = capture(rect, o.pixelRatio ?? PIXEL_RATIO);
  const target: FakeTarget = { ...createFakeTarget({ rect }) };
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

/** The cells a run of `preset` cuts `rect` into: the mesh is sized in image pixels. */
const meshOf = (
  preset: { fragment: Parameters<typeof generateFracture>[0] },
  rect: RectLike = RECT,
  pixelRatio = PIXEL_RATIO,
): FractureMesh =>
  generateFracture(preset.fragment, rect.width * pixelRatio, rect.height * pixelRatio);

interface AtlasDraw {
  atlas: unknown;
  srcs: Float32Array;
  xforms: Float32Array;
  blend: unknown;
  colors: Uint32Array;
}

/** The arguments of the `n`th `drawAtlas` call. */
const drawOf = (mk: MockKit, n: number): AtlasDraw => {
  const call = mk.callsOf('drawAtlas')[n];
  if (call === undefined) throw new Error(`there was no drawAtlas call ${n}`);
  const [atlas, srcs, xforms, , blend, colors] = call.args;
  return {
    atlas,
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

/** Every sprite of `xforms` sits unturned on its cell's place in the capture's box. */
function expectAtHome(mesh: FractureMesh, xforms: Float32Array, scale: number): void {
  for (let i = 0; i < mesh.count; i++) {
    expect(xforms[i * 4]).toBeCloseTo(scale, 5);
    expect(xforms[i * 4 + 1]).toBeCloseTo(0, 5);
    expect(xforms[i * 4 + 2]).toBeCloseTo(PADDING + mesh.bounds[i * 4]! * RECT.width, 3);
    expect(xforms[i * 4 + 3]).toBeCloseTo(PADDING + mesh.bounds[i * 4 + 1]! * RECT.height, 3);
  }
}

/** Whether sprite `i` has left its place. */
const hasMoved = (mesh: FractureMesh, xforms: Float32Array, i: number): boolean =>
  Math.abs(xforms[i * 4 + 2]! - (PADDING + mesh.bounds[i * 4]! * RECT.width)) > 1e-3 ||
  Math.abs(xforms[i * 4 + 3]! - (PADDING + mesh.bounds[i * 4 + 1]! * RECT.height)) > 1e-3;

describe('an oversized element', () => {
  const CARD = { x: 0, y: 100, width: 360, height: 64 };

  test('a 360x64 element at 3x with cell 4 draws at most 3,000 sprites, from larger cells', async () => {
    const preset = disintegrate();
    expect(preset.fragment.cell).toBe(4);
    expect(preset.maxFragments).toBe(3000);
    // 4 px cells would be 270 by 48 of them.
    expect(Math.ceil((CARD.width * 3) / 4) * Math.ceil((CARD.height * 3) / 4)).toBe(12960);

    const { mk, events } = await play(preset, { rect: CARD, pixelRatio: 3 });
    await flushFrames(1);

    expect(events).toEqual(['handoff']);
    const { srcs, xforms } = drawOf(mk, 0);
    // The cell grew to 9 px: 120 columns by 22 rows.
    const count = drawn(xforms);
    expect(count).toBe(2640);
    expect(count).toBeLessThanOrEqual(3000);
    for (let i = 0; i < count; i++) {
      expect(srcs[i * 4 + 2]! - srcs[i * 4]!).toBeCloseTo(9, 3);
      expect(srcs[i * 4 + 3]! - srcs[i * 4 + 1]!).toBeGreaterThan(4);
    }
  });

  test('a lower maxFragments grows the cell further', async () => {
    const { mk } = await play(disintegrate({ maxFragments: 500 }), { rect: CARD, pixelRatio: 3 });
    await flushFrames(1);

    const count = drawn(drawOf(mk, 0).xforms);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(500);
  });
});

describe('the grains effect', () => {
  test('draws one sprite per cell', async () => {
    const preset = disintegrate();
    const mesh = meshOf(preset);
    expect(mesh.rectangular).toBe(true);
    const { mk, image } = await play(preset);
    await flushFrames(1);

    const state: WebRunState = {
      preset,
      rect: RECT,
      image,
      direction: -1,
      press: null,
      progress: undefined,
    };
    expect(grainsEffect.sprites(state)).toBe(mesh.count);
    expect(drawn(drawOf(mk, 0).xforms)).toBe(mesh.count);
  });

  test('at rest each sprite is its cell of the capture, drawn where the cell is', async () => {
    const preset = disintegrate();
    const mesh = meshOf(preset);
    const { mk } = await play(preset);
    await flushFrames(1);

    const { srcs, xforms } = drawOf(mk, 0);
    expectAtHome(mesh, xforms, 1 / PIXEL_RATIO);
    for (let i = 0; i < mesh.count; i++) {
      const o = i * 4;
      expect(srcs[o]).toBeCloseTo((PADDING + mesh.bounds[o]! * RECT.width) * PIXEL_RATIO, 3);
      expect(srcs[o + 1]).toBeCloseTo(
        (PADDING + mesh.bounds[o + 1]! * RECT.height) * PIXEL_RATIO,
        3,
      );
      expect(srcs[o + 2]! - srcs[o]!).toBeCloseTo(4, 3);
      expect(srcs[o + 3]! - srcs[o + 1]!).toBeCloseTo(4, 3);
    }
  });

  test('cuts its sprites from the capture itself: nothing is baked', async () => {
    const { mk } = await play(disintegrate());
    await flushFrames(2);

    expect(grainsEffect.bake).toBeUndefined();
    expect(mk.offscreen).toHaveLength(0);
    expect(mk.images).toHaveLength(1);
    expect(mk.images[0]!.deleted).toBe(false);
  });

  test('a sweep at angle 90 releases the leftmost cells first', async () => {
    const preset = disintegrate({ release: { timingRandomness: 0 } });
    expect(preset.release).toMatchObject({ order: 'sweep', angle: 90, duration: 0.5 });
    const mesh = meshOf(preset);
    const { mk } = await play(preset);
    // The 16th frame is a quarter of a second in: half way through the sweep.
    await flushFrames(16);

    const { xforms } = drawOf(mk, 15);
    let lastMoved = Number.NEGATIVE_INFINITY;
    let firstUnmoved = Number.POSITIVE_INFINITY;
    let moved = 0;
    for (let i = 0; i < mesh.count; i++) {
      const x = mesh.centroids[i * 2]!;
      if (hasMoved(mesh, xforms, i)) {
        moved++;
        lastMoved = Math.max(lastMoved, x);
      } else {
        firstUnmoved = Math.min(firstUnmoved, x);
      }
    }
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(mesh.count);
    expect(lastMoved).toBeLessThan(firstUnmoved);
    expect(lastMoved).toBeLessThan(0.5);
  });

  test('alpha goes through the colours: 0.5 is 0x7fffffff, blended with Modulate', async () => {
    const preset = disintegrate({ life: { opacity: [0.5, 0.5] } });
    const mesh = meshOf(preset);
    const { mk } = await play(preset);
    await flushFrames(2);

    const { colors, blend } = drawOf(mk, 1);
    for (let i = 0; i < mesh.count; i++) expect(colors[i]).toBe(0x7fffffff);
    expect(blend).toBe(mk.kit.BlendMode.Modulate);
    expect(drawOf(mk, 0).blend).toBe(mk.kit.BlendMode.Modulate);
  });

  test('frames 2 and 3 draw from the same buffers', async () => {
    const { mk } = await play(disintegrate());
    await flushFrames(3);

    const second = drawOf(mk, 1);
    const third = drawOf(mk, 2);
    expect(third.srcs).toBe(second.srcs);
    expect(third.xforms).toBe(second.xforms);
    expect(third.colors).toBe(second.colors);
    expect(second.srcs).toBeInstanceOf(Float32Array);
    expect(second.xforms).toBeInstanceOf(Float32Array);
    expect(second.colors).toBeInstanceOf(Uint32Array);
  });

  test('hands off on its first frame, ends when the preset has run and frees the capture', async () => {
    const preset = disintegrate();
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
    // An exit leaves its element hidden: the element is on its way out.
    expect(target.hidden.value).toBe(1);
  });

  test('follows an external progress, and has no end of its own', async () => {
    const preset = disintegrate();
    const mesh = meshOf(preset);
    const progress = { value: 0 };
    const { mk, events } = await play(preset, { progress });
    await flushFrames(200);
    expectAtHome(mesh, drawOf(mk, 199).xforms, 1 / PIXEL_RATIO);

    progress.value = 1;
    await flushFrames(1);
    expect(drawOf(mk, 200).colors[0]).toBe(0x00ffffff);
    expect(events).toEqual(['handoff']);
  });

  test("draws a shatter({ pattern: 'grid' }) mesh too", async () => {
    const preset = shatter({ fragment: { pattern: 'grid' } });
    const mesh = generateFracture(preset.fragment, RECT.width, RECT.height);
    expect(mesh.rectangular).toBe(true);
    const { mk, events } = await play(preset);
    await flushFrames(1);

    expect(events).toEqual(['handoff']);
    const { xforms } = drawOf(mk, 0);
    expect(drawn(xforms)).toBe(mesh.count);
    expectAtHome(mesh, xforms, 1 / PIXEL_RATIO);
  });

  test('a mesh that is not rectangular falls back, with one warning', async () => {
    const { events, target } = await play(shatter());

    expect(events).toEqual(['fallback']);
    expect(target.hidden.value).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('an enter', () => {
  test("with reverse 'home' starts scattered, ends with every grain at home and reveals the element", async () => {
    const preset = disintegrate();
    expect(preset.reverse).toBe('home');
    const mesh = meshOf(preset);
    const { mk, events, target } = await play(preset, { direction: 1 });

    await flushFrames(1);
    expect(events).toEqual(['handoff']);
    expect(target.hidden.value).toBe(1);
    const { xforms, colors } = drawOf(mk, 0);
    let away = 0;
    for (let i = 0; i < mesh.count; i++) if (hasMoved(mesh, xforms, i)) away++;
    expect(away).toBeGreaterThan(mesh.count / 2);

    await flushFrames(Math.ceil(presetDuration(preset) * 60) + 1);
    // The final frame wrote the pool the earlier frames drew from.
    expectAtHome(mesh, xforms, 1 / PIXEL_RATIO);
    for (let i = 0; i < mesh.count; i++) expect(colors[i]).toBe(0xffffffff);
    expect(target.hidden.value).toBe(0);
    expect(target.hideSyncs).toBe(2);
    expect(events).toEqual(['handoff', 'end:true']);
  });
});
