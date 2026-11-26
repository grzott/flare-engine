import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { generateFracture } from '../../src/core/fracture/generate';
import { packShardsInto } from '../../src/core/fracture/pack';
import type { FractureMesh, ShardPacking } from '../../src/core/fracture/types';
import type { FragmentPose } from '../../src/core/motion/pose';
import { presetDuration, type SnapshotPreset, shatter } from '../../src/core/presets';
import { shardXformInto } from '../../src/fx/fragments';
import { bakeShardAtlas } from '../../src/fx/web/bake';
import { shatterEffect } from '../../src/fx/web/effects/shatter';
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
/** The element in image pixels. */
const WIDTH_PX = RECT.width * PIXEL_RATIO;
const HEIGHT_PX = RECT.height * PIXEL_RATIO;

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

/** A capture of `RECT` at pixel ratio 2, reaching 8 layout pixels beyond it. */
const capture = (): FxImage => ({
  width: (RECT.width + 2 * PADDING) * PIXEL_RATIO,
  height: (RECT.height + 2 * PADDING) * PIXEL_RATIO,
  pixelRatio: PIXEL_RATIO,
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

/** Starts a run of `preset` that draws with the shatter effect, up to its first frame request. */
async function play(
  preset: SnapshotPreset,
  o: { direction?: 1 | -1; progress?: ProgressSource; mk?: MockKit } = {},
): Promise<Played> {
  const mk = o.mk ?? makeMockKit();
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const fx = createWebFxRuntime({
    kit: () => Promise.resolve(mk.kit),
    canvas,
    effects: () => shatterEffect,
  });
  runtimes.push(fx);
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

/** The mesh a run of `preset` on `RECT` breaks into, without a press point. */
const meshOf = (preset: { fragment: Parameters<typeof generateFracture>[0] }): FractureMesh =>
  generateFracture(preset.fragment, RECT.width, RECT.height);

const packingOf = (mesh: FractureMesh): ShardPacking =>
  packShardsInto(mesh, WIDTH_PX, HEIGHT_PX, 2, 2048, {
    atlasW: 0,
    atlasH: 0,
    scale: 1,
    rects: new Float32Array(mesh.count * 4),
  });

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

/** Every sprite of `xforms` sits unturned on its piece's place in the capture's box. */
function expectAtHome(mesh: FractureMesh, xforms: Float32Array, scale: number): void {
  for (let i = 0; i < mesh.count; i++) {
    expect(xforms[i * 4]).toBeCloseTo(scale, 5);
    expect(xforms[i * 4 + 1]).toBeCloseTo(0, 5);
    expect(xforms[i * 4 + 2]).toBeCloseTo(PADDING + mesh.bounds[i * 4]! * RECT.width, 3);
    expect(xforms[i * 4 + 3]).toBeCloseTo(PADDING + mesh.bounds[i * 4 + 1]! * RECT.height, 3);
  }
}

describe('shardXformInto', () => {
  const pose: FragmentPose = { x: 30, y: 12, rotation: Math.PI / 2, scale: 1.5, alpha: 1 };

  /** Where the RSXform at `o` of `out` puts the source point (x, y). */
  const apply = (out: Float32Array, o: number, x: number, y: number): [number, number] => [
    out[o]! * x - out[o + 1]! * y + out[o + 2]!,
    out[o + 1]! * x + out[o]! * y + out[o + 3]!,
  ];

  test('with a quarter turn, the centroid lands on the pose', () => {
    const out = new Float64Array(8) as unknown as Float32Array;
    shardXformInto(pose, 7, 5, 0.5, out, 4);

    const [x, y] = apply(out, 4, 7, 5);
    expect(Math.abs(x - 30)).toBeLessThan(1e-6);
    expect(Math.abs(y - 12)).toBeLessThan(1e-6);
    expect([out[0], out[1], out[2], out[3]]).toEqual([0, 0, 0, 0]);
  });

  test('scos and ssin carry the pose scale times the output scale', () => {
    const out = new Float64Array(4) as unknown as Float32Array;
    shardXformInto(pose, 7, 5, 0.5, out, 0);
    expect(out[0]).toBeCloseTo(0, 6);
    expect(out[1]).toBeCloseTo(0.75, 6);

    shardXformInto({ ...pose, rotation: 0 }, 7, 5, 0.5, out, 0);
    expect(out[0]).toBeCloseTo(0.75, 6);
    expect(out[1]).toBeCloseTo(0, 6);
    // A source point one pixel right of the centroid lands 0.75 right of the pose.
    expect(apply(out, 0, 8, 5)[0]).toBeCloseTo(30.75, 6);
  });
});

describe('bakeShardAtlas', () => {
  test('draws each piece into its packed rect, clipped by its polygon', () => {
    const mk = makeMockKit();
    const mesh = meshOf(shatter());
    const packing = packingOf(mesh);
    const image = capture();
    const source = mk.kit.MakeImageFromCanvasImageSource(image.handle as CanvasImageSource);

    const atlas = bakeShardAtlas(mk.kit, source, image, mesh, packing, WIDTH_PX, HEIGHT_PX);

    expect(mk.offscreen).toHaveLength(1);
    const surface = mk.offscreen[0]!;
    expect([surface.width, surface.height]).toEqual([packing.atlasW, packing.atlasH]);
    expect(atlas as unknown).toBe(surface.snapshot);
    expect(surface.deleted).toBe(true);

    const clips = surface.calls.filter((call) => call.method === 'clipPath');
    const draws = surface.calls.filter((call) => call.method === 'drawImageOptions');
    expect(clips).toHaveLength(mesh.count);
    expect(draws).toHaveLength(mesh.count);
    for (const clip of clips) expect(clip.args[1]).toBe(mk.kit.ClipOp.Intersect);
    for (const draw of draws) expect(draw.args[0]).toBe(source);
    expect(mk.paths).toHaveLength(mesh.count);
    expect(mk.paths.every((path) => path.deleted)).toBe(true);
  });

  test("a piece's path is its polygon in atlas pixels, inside its packed rect", () => {
    const mk = makeMockKit();
    const mesh = meshOf(shatter());
    const packing = packingOf(mesh);
    const image = capture();
    const source = mk.kit.MakeImageFromCanvasImageSource(image.handle as CanvasImageSource);
    bakeShardAtlas(mk.kit, source, image, mesh, packing, WIDTH_PX, HEIGHT_PX);

    // The capture is drawn so that the element's corner, past the padding, is at the piece's
    // bounding box less its place in the element.
    const draws = mk.offscreen[0]!.calls.filter((call) => call.method === 'translate');
    for (let i = 0; i < mesh.count; i++) {
      const [tx, ty] = draws[i]!.args as [number, number];
      expect(tx).toBeCloseTo(
        packing.rects[i * 4]! - (mesh.bounds[i * 4]! * WIDTH_PX + PADDING * PIXEL_RATIO),
        3,
      );
      expect(ty).toBeCloseTo(
        packing.rects[i * 4 + 1]! - (mesh.bounds[i * 4 + 1]! * HEIGHT_PX + PADDING * PIXEL_RATIO),
        3,
      );
    }

    for (let i = 0; i < mesh.count; i++) {
      const n = mesh.vertexStart[i + 1]! - mesh.vertexStart[i]!;
      const cmds = mk.paths[i]!.cmds;
      // A move, a line per further vertex, and a close.
      expect(cmds).toHaveLength(n * 3 + 1);
      const [x, y, w, h] = packing.rects.subarray(i * 4, i * 4 + 4);
      for (let k = 0; k < n; k++) {
        const v = mesh.vertexStart[i]! + k;
        const px = cmds[k * 3 + 1]!;
        const py = cmds[k * 3 + 2]!;
        expect(px).toBeCloseTo(
          x! + (mesh.vertices[v * 2]! - mesh.bounds[i * 4]!) * WIDTH_PX * packing.scale,
          3,
        );
        expect(py).toBeCloseTo(
          y! + (mesh.vertices[v * 2 + 1]! - mesh.bounds[i * 4 + 1]!) * HEIGHT_PX * packing.scale,
          3,
        );
        expect(px).toBeGreaterThanOrEqual(x! - 1e-3);
        expect(px).toBeLessThanOrEqual(x! + w! + 1e-3);
        expect(py).toBeGreaterThanOrEqual(y! - 1e-3);
        expect(py).toBeLessThanOrEqual(y! + h! + 1e-3);
      }
    }
  });

  test('throws when no surface can be made', () => {
    const mk = makeMockKit();
    mk.failOffscreen = true;
    const mesh = meshOf(shatter());
    const image = capture();
    const source = mk.kit.MakeImageFromCanvasImageSource(image.handle as CanvasImageSource);

    expect(() =>
      bakeShardAtlas(mk.kit, source, image, mesh, packingOf(mesh), WIDTH_PX, HEIGHT_PX),
    ).toThrow();
  });
});

describe('the shatter effect', () => {
  test('draws a sprite per shard, and leaves the rest of the pool at zero scale', async () => {
    const preset = shatter();
    const mesh = meshOf(preset);
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
    expect(shatterEffect.sprites(state)).toBe(mesh.count);

    const { srcs, xforms } = drawOf(mk, 0);
    expect(xforms.length).toBeGreaterThanOrEqual(mesh.count * 4);
    expect(srcs).toHaveLength(xforms.length);
    let drawn = 0;
    for (let i = 0; i < xforms.length / 4; i++) {
      if (xforms[i * 4] !== 0 || xforms[i * 4 + 1] !== 0) drawn++;
    }
    expect(drawn).toBe(mesh.count);
    for (let o = mesh.count * 4; o < xforms.length; o++) expect(xforms[o]).toBe(0);
  });

  test('bakes the capture into a shard atlas once, and draws from that', async () => {
    const preset = shatter();
    const packing = packingOf(meshOf(preset));
    const { mk } = await play(preset);
    await flushFrames(3);

    expect(mk.offscreen).toHaveLength(1);
    const surface = mk.offscreen[0]!;
    expect([surface.width, surface.height]).toEqual([packing.atlasW, packing.atlasH]);
    for (let n = 0; n < 3; n++) expect(drawOf(mk, n).atlas).toBe(surface.snapshot);
    // The capture is only read by the bake.
    expect(mk.images).toHaveLength(1);
    expect(mk.images[0]!.deleted).toBe(true);
    expect(surface.snapshot?.deleted).toBe(false);
  });

  test('each source rect is the packed rect of its piece', async () => {
    const preset = shatter();
    const mesh = meshOf(preset);
    const packing = packingOf(mesh);
    const { mk } = await play(preset);
    await flushFrames(1);

    const { srcs } = drawOf(mk, 0);
    for (let i = 0; i < mesh.count; i++) {
      const [x, y, w, h] = packing.rects.subarray(i * 4, i * 4 + 4);
      expect([...srcs.subarray(i * 4, i * 4 + 4)]).toEqual([x!, y!, x! + w!, y! + h!]);
    }
  });

  test('at rest every shard sits on its place in the element, so the card is whole', async () => {
    const preset = shatter();
    const mesh = meshOf(preset);
    const { mk } = await play(preset);
    await flushFrames(1);

    expect(packingOf(mesh).scale).toBe(1);
    expectAtHome(mesh, drawOf(mk, 0).xforms, 1 / PIXEL_RATIO);
  });

  test('with a quarter turn, a shard turns about its centroid, which lands on its pose', async () => {
    // No force, no gravity and no shrink: each piece stays home and only spins.
    const preset = shatter({
      forces: [],
      physics: { gravity: 0, spin: 720, angularDrag: 0, randomness: 1 },
      life: { scale: [1, 1] },
    });
    const mesh = meshOf(preset);
    const packing = packingOf(mesh);
    const { mk } = await play(preset);
    await flushFrames(40);

    const { xforms } = drawOf(mk, 39);
    let turned = 0;
    for (let i = 0; i < mesh.count; i++) {
      const scos = xforms[i * 4]!;
      const ssin = xforms[i * 4 + 1]!;
      if (Math.abs(ssin) > 0.05) turned++;
      // The centroid in the piece's source rect, in atlas pixels from the rect's corner.
      const cx = (mesh.centroids[i * 2]! - mesh.bounds[i * 4]!) * WIDTH_PX * packing.scale;
      const cy = (mesh.centroids[i * 2 + 1]! - mesh.bounds[i * 4 + 1]!) * HEIGHT_PX * packing.scale;
      const x = scos * cx - ssin * cy + xforms[i * 4 + 2]!;
      const y = ssin * cx + scos * cy + xforms[i * 4 + 3]!;
      expect(x).toBeCloseTo(PADDING + mesh.centroids[i * 2]! * RECT.width, 3);
      expect(y).toBeCloseTo(PADDING + mesh.centroids[i * 2 + 1]! * RECT.height, 3);
    }
    expect(turned).toBeGreaterThan(mesh.count / 2);
  });

  test('an alpha of 0.5 gives a colour of 0x7fffffff', async () => {
    const preset = shatter({ life: { opacity: [0.5, 0.5] } });
    const mesh = meshOf(preset);
    const { mk } = await play(preset);
    await flushFrames(2);

    const { colors } = drawOf(mk, 1);
    for (let i = 0; i < mesh.count; i++) expect(colors[i]).toBe(0x7fffffff);
  });

  test('an opaque shard is 0xffffffff, and a spent one 0x00ffffff', async () => {
    const preset = shatter();
    const mesh = meshOf(preset);
    const { mk } = await play(preset);
    await flushFrames(1);
    for (let i = 0; i < mesh.count; i++) expect(drawOf(mk, 0).colors[i]).toBe(0xffffffff);

    const progress = { value: 1 };
    const second = await play(preset, { progress });
    await flushFrames(1);
    for (let i = 0; i < mesh.count; i++) expect(drawOf(second.mk, 0).colors[i]).toBe(0x00ffffff);
  });

  test('the blend mode passed is Modulate', async () => {
    const { mk } = await play(shatter());
    await flushFrames(2);

    expect(drawOf(mk, 0).blend).toBe(mk.kit.BlendMode.Modulate);
    expect(drawOf(mk, 1).blend).toBe(mk.kit.BlendMode.Modulate);
  });

  test('frames 2 and 3 draw from the same buffers', async () => {
    const { mk } = await play(shatter());
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

  test('hands off on its first frame, ends when the preset has run and frees the atlas', async () => {
    const preset = shatter();
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
    expect(mk.offscreen[0]!.snapshot?.deleted).toBe(true);
    // An exit leaves its element hidden: the element is on its way out.
    expect(target.hidden.value).toBe(1);
  });

  test("waits out the preset's delay at home", async () => {
    const preset = shatter({ delay: 0.5 });
    const mesh = meshOf(preset);
    const { mk, events } = await play(preset);
    await flushFrames(30);
    expectAtHome(mesh, drawOf(mk, 29).xforms, 1 / PIXEL_RATIO);

    await flushFrames(Math.ceil(presetDuration(preset) * 60) - 30);
    expect(events).toEqual(['handoff']);
    await flushFrames(2);
    expect(events).toEqual(['handoff', 'end:true']);
  });

  test('follows an external progress, and has no end of its own', async () => {
    const preset = shatter();
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

  test('a bake that cannot be made falls back, with one warning', async () => {
    const mk = makeMockKit();
    mk.failOffscreen = true;
    const { events, target } = await play(shatter(), { mk });

    expect(events).toEqual(['fallback']);
    expect(target.hidden.value).toBe(0);
    expect(mk.images[0]!.deleted).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test('keeps at most maxFragments pieces', async () => {
    const preset = shatter({ fragment: { count: 40 }, maxFragments: 12 });
    const kept = generateFracture({ ...preset.fragment, count: 12 }, RECT.width, RECT.height);
    const { mk } = await play(preset);
    await flushFrames(1);

    const clips = mk.offscreen[0]!.calls.filter((call) => call.method === 'clipPath');
    expect(clips).toHaveLength(kept.count);
    expect(kept.count).toBeLessThanOrEqual(12);
    expect(meshOf(preset).count).toBeGreaterThan(12);
  });
});

describe('an enter', () => {
  test("with reverse 'home' starts scattered, ends with every piece at home and reveals the element", async () => {
    const preset = shatter();
    expect(preset.reverse).toBe('home');
    const mesh = meshOf(preset);
    const { mk, events, target } = await play(preset, { direction: 1 });

    await flushFrames(1);
    expect(events).toEqual(['handoff']);
    expect(target.hidden.value).toBe(1);
    const { xforms, colors } = drawOf(mk, 0);
    let away = 0;
    for (let i = 0; i < mesh.count; i++) {
      if (Math.abs(xforms[i * 4 + 2]! - (PADDING + mesh.bounds[i * 4]! * RECT.width)) > 1) away++;
    }
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
