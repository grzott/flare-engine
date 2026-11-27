import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { act } from 'react';
import { generateFracture } from '../../../src/core/fracture/generate';
import type { FractureMesh } from '../../../src/core/fracture/types';
import type { RectLike } from '../../../src/core/placement';
import {
  disintegrate,
  presetDuration,
  type SnapshotPreset,
  shatter,
} from '../../../src/core/presets';
import type { FxImage, FxRuntime, ProgressSource } from '../../../src/runtime/contracts';
import { installDom, type Rendered, render } from '../../support/dom';
import { createFakeTarget, type FakeTarget } from '../../support/fakes';
import { installReanimatedMock } from '../../support/mock-reanimated';
import { installRnMock } from '../../support/mock-rn';
import { createMockImage, installSkiaMock } from '../../support/mock-skia';
import { ContextProbe, settle } from './support';

installDom();
installRnMock();
const reanimated = installReanimatedMock();
const skia = installSkiaMock();

const warn = spyOn(console, 'warn').mockImplementation(() => {});

// Loaded after the mocks, so neither module reaches the real Reanimated or Skia.
const { FlareFxHost } = await import('../../../src/fx/native/host');
const { SPRITE_POOL_CAPACITY } = await import('../../../src/fx/native/pool');
const { fragmentEffect } = await import('../../../src/fx/native/layers/shatter');

interface Xform {
  scos: number;
  ssin: number;
  tx: number;
  ty: number;
}

interface SrcRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const RECT = { x: 10, y: 20, width: 100, height: 40 };
const PADDING = 8;
const PIXEL_RATIO = 2;

const rendered: Rendered[] = [];

beforeEach(() => {
  skia.reset();
  reanimated.reset();
});

afterEach(() => {
  for (const r of rendered.splice(0)) r.unmount();
});

function mount(): FxRuntime {
  let fx: FxRuntime | null = null;
  rendered.push(
    render(
      <FlareFxHost>
        <ContextProbe
          onContext={(ctx) => {
            fx = ctx.fx;
          }}
        />
      </FlareFxHost>,
    ),
  );
  if (fx === null) throw new Error('the host provided no runtime');
  return fx;
}

/** A capture of `rect` at `pixelRatio`, reaching 8 layout pixels beyond it. */
const capture = (rect: RectLike, pixelRatio: number): FxImage => {
  const width = (rect.width + 2 * PADDING) * pixelRatio;
  const height = (rect.height + 2 * PADDING) * pixelRatio;
  return { width, height, pixelRatio, padding: PADDING, handle: createMockImage(width, height) };
};

interface Played {
  target: FakeTarget;
  image: FxImage;
  /** `'handoff'`, `'end:true'`, `'end:false'` and `'fallback'`, in call order. */
  events: string[];
}

/** Starts a run of `preset` on the public host, and waits for its layer to mount. */
async function play(
  preset: SnapshotPreset,
  o: {
    direction?: 1 | -1;
    progress?: ProgressSource;
    fx?: FxRuntime;
    rect?: RectLike;
    pixelRatio?: number;
    hidden?: { value: number };
  } = {},
): Promise<Played> {
  const fx = o.fx ?? mount();
  const rect = o.rect ?? RECT;
  const image = capture(rect, o.pixelRatio ?? PIXEL_RATIO);
  const target: FakeTarget = { ...createFakeTarget({ rect }) };
  target.capture = () => Promise.resolve(image);
  if (o.hidden !== undefined) target.hidden = o.hidden;
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
  return { target, image, events };
}

/** One UI frame at `seconds` on the frame clock. */
const frame = (seconds: number): void => {
  act(() => {
    reanimated.frame(seconds * 1000);
  });
};

/** A prop of the pool's `<Atlas>`, the only one there is, evaluated now. */
const atlasProp = <T,>(name: string): T => {
  const props = skia.atlas.props;
  if (props === null) throw new Error('no <Atlas> was rendered');
  const value = props[name];
  return (
    typeof value === 'object' && value !== null && 'value' in value ? value.value : value
  ) as T;
};
const transforms = (): Xform[] => atlasProp<Xform[]>('transforms');
const sprites = (): SrcRect[] => atlasProp<SrcRect[]>('sprites');
const colors = (): Float32Array[] => atlasProp<Float32Array[]>('colors');

/** How many pool sprites draw: the others sit at zero scale. */
const drawn = (): number => transforms().filter((t) => t.scos !== 0 || t.ssin !== 0).length;

/** The cells a run of `preset` cuts `rect` into: the mesh is sized in image pixels. */
const meshOf = (
  preset: { fragment: Parameters<typeof generateFracture>[0] },
  rect: RectLike = RECT,
  pixelRatio = PIXEL_RATIO,
): FractureMesh =>
  generateFracture(preset.fragment, rect.width * pixelRatio, rect.height * pixelRatio);

function expectAtHome(mesh: FractureMesh, rect: RectLike = RECT, pixelRatio = PIXEL_RATIO): void {
  const at = transforms();
  for (let i = 0; i < mesh.count; i++) {
    expect(at[i]!.scos).toBeCloseTo(1 / pixelRatio, 5);
    expect(at[i]!.ssin).toBeCloseTo(0, 5);
    expect(at[i]!.tx).toBeCloseTo(rect.x + mesh.bounds[i * 4]! * rect.width, 3);
    expect(at[i]!.ty).toBeCloseTo(rect.y + mesh.bounds[i * 4 + 1]! * rect.height, 3);
  }
}

/** Whether sprite `i` has left its place in `rect`. */
const hasMoved = (mesh: FractureMesh, at: Xform[], i: number, rect: RectLike = RECT): boolean =>
  Math.abs(at[i]!.tx - (rect.x + mesh.bounds[i * 4]! * rect.width)) > 1e-3 ||
  Math.abs(at[i]!.ty - (rect.y + mesh.bounds[i * 4 + 1]! * rect.height)) > 1e-3;

describe('an oversized element', () => {
  const CARD = { x: 0, y: 100, width: 360, height: 64 };

  test('a 360x64 element at 3x with cell 4 draws at most 3,000 sprites, from larger cells', async () => {
    const preset = disintegrate();
    expect(preset.fragment.cell).toBe(4);
    expect(preset.maxFragments).toBe(3000);
    // 4 px cells would be 270 by 48 of them.
    expect(Math.ceil((CARD.width * 3) / 4) * Math.ceil((CARD.height * 3) / 4)).toBe(12960);

    const { image, events } = await play(preset, { rect: CARD, pixelRatio: 3 });
    frame(0);

    expect(events).toEqual(['handoff']);
    const count = fragmentEffect.sprites(preset, CARD, image);
    // The cell grew to 9 px: 120 columns by 22 rows.
    expect(count).toBe(2640);
    expect(count).toBeLessThanOrEqual(3000);
    expect(drawn()).toBe(count);
    const cut = sprites();
    for (let i = 0; i < count; i++) {
      expect(cut[i]!.width).toBeCloseTo(9, 3);
      expect(cut[i]!.height).toBeGreaterThan(4);
    }
    expect(cut[count]).toMatchObject({ width: 0, height: 0 });
  });

  test('a lower maxFragments grows the cell further', async () => {
    const preset = disintegrate({ maxFragments: 500 });
    const { image } = await play(preset, { rect: CARD, pixelRatio: 3 });
    frame(0);

    const count = fragmentEffect.sprites(preset, CARD, image);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(500);
    expect(drawn()).toBe(count);
  });
});

describe('the grains of a run', () => {
  test('at rest each sprite is its cell of the capture, drawn where the cell is', async () => {
    const preset = disintegrate();
    const mesh = meshOf(preset);
    expect(mesh.rectangular).toBe(true);
    await play(preset);
    frame(0);

    expect(drawn()).toBe(mesh.count);
    expectAtHome(mesh);
    const cut = sprites();
    for (let i = 0; i < mesh.count; i++) {
      const o = i * 4;
      const left = mesh.bounds[o]! * RECT.width;
      const top = mesh.bounds[o + 1]! * RECT.height;
      expect(cut[i]!.x).toBeCloseTo((PADDING + left) * PIXEL_RATIO, 3);
      expect(cut[i]!.y).toBeCloseTo((PADDING + top) * PIXEL_RATIO, 3);
      expect(cut[i]!.width).toBeCloseTo(4, 3);
      expect(cut[i]!.height).toBeCloseTo(4, 3);
    }
  });

  test('draws from the capture itself: nothing is baked, and no layer is mounted', async () => {
    const { image } = await play(disintegrate());
    frame(0);
    frame(0.1);

    expect(atlasProp<unknown>('image')).toBe(image.handle);
    expect(skia.surfaces).toHaveLength(0);
    expect(skia.atlas.mounts).toBe(1);
    expect(skia.vertices.mounts).toBe(0);
  });

  test('a sweep at angle 90 releases the leftmost cells first', async () => {
    const preset = disintegrate({ release: { timingRandomness: 0 } });
    expect(preset.release).toMatchObject({ order: 'sweep', angle: 90, duration: 0.5 });
    const mesh = meshOf(preset);
    await play(preset);
    frame(0);
    // Half way through the sweep.
    frame(0.25);

    const at = transforms();
    let lastMoved = Number.NEGATIVE_INFINITY;
    let firstUnmoved = Number.POSITIVE_INFINITY;
    let moved = 0;
    for (let i = 0; i < mesh.count; i++) {
      const x = mesh.centroids[i * 2]!;
      if (hasMoved(mesh, at, i)) {
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

  test('alpha goes through the atlas colours, blended with modulate', async () => {
    await play(disintegrate({ life: { opacity: [0.5, 0.5] } }));
    frame(0);
    frame(0.2);

    expect(atlasProp<string>('blendMode')).toBe('modulate');
    const tints = colors();
    expect(tints).toHaveLength(SPRITE_POOL_CAPACITY);
    const count = drawn();
    for (let i = 0; i < count; i++) expect([...tints[i]!]).toEqual([1, 1, 1, 0.5]);
    // A sprite no run holds is untinted.
    expect([...tints[count]!]).toEqual([1, 1, 1, 1]);
  });

  test('a grain fades over its life', async () => {
    const preset = disintegrate();
    await play(preset);
    frame(0);
    const count = drawn();
    for (let i = 0; i < count; i++) expect(colors()[i]![3]).toBe(1);

    frame(presetDuration(preset) - 0.01);
    const faded = colors();
    for (let i = 0; i < count; i++) expect(faded[i]![3]).toBeLessThan(0.2);
  });

  test('hands off on its first frame, and ends when the preset has run', async () => {
    const preset = disintegrate();
    const { events, target } = await play(preset);
    expect(events).toEqual([]);
    expect(target.hidden.value).toBe(0);
    expect(drawn()).toBe(0);

    frame(3);
    expect(events).toEqual(['handoff']);
    expect(target.hidden.value).toBe(1);

    frame(3 + presetDuration(preset) - 0.01);
    expect(events).toEqual(['handoff']);

    frame(3 + presetDuration(preset));
    expect(events).toEqual(['handoff', 'end:true']);
    // An exit leaves its element hidden: the element is on its way out.
    expect(target.hidden.value).toBe(1);

    frame(10);
    expect(events).toEqual(['handoff', 'end:true']);
    expect(drawn()).toBe(0);
  });

  test("waits out the preset's delay at home", async () => {
    const preset = disintegrate({ delay: 0.5 });
    const mesh = meshOf(preset);
    const { events } = await play(preset);
    frame(0);
    frame(0.5);
    expectAtHome(mesh);

    frame(presetDuration(preset) - 0.01);
    expect(events).toEqual(['handoff']);
    frame(presetDuration(preset));
    expect(events).toEqual(['handoff', 'end:true']);
  });

  test('follows an external progress, and has no end of its own', async () => {
    const preset = disintegrate();
    const mesh = meshOf(preset);
    const progress = { value: 0 };
    const { events } = await play(preset, { progress });
    frame(0);
    frame(60);
    expectAtHome(mesh);

    progress.value = 1;
    frame(61);
    const tints = colors();
    for (let i = 0; i < mesh.count; i++) expect(tints[i]![3]).toBeLessThan(0.2);
    expect(events).toEqual(['handoff']);
  });

  test("shatter({ pattern: 'grid' }) draws as grains too: the mesh picks, not the preset", async () => {
    const preset = shatter({ fragment: { pattern: 'grid' } });
    const mesh = generateFracture(preset.fragment, RECT.width, RECT.height);
    expect(mesh.rectangular).toBe(true);
    const { events } = await play(preset);
    frame(0);

    expect(events).toEqual(['handoff']);
    expect(drawn()).toBe(mesh.count);
    expectAtHome(mesh);
    expect(skia.vertices.mounts).toBe(0);
  });

  test('two runs draw their own sprites, side by side in the pool', async () => {
    const fx = mount();
    const preset = disintegrate();
    const mesh = meshOf(preset);
    const other = { x: 200, y: 300, width: RECT.width, height: RECT.height };
    await play(preset, { fx });
    await play(preset, { fx, rect: other });
    frame(0);

    expect(drawn()).toBe(2 * mesh.count);
    const at = transforms();
    expect(at[0]!.tx).toBeCloseTo(RECT.x, 3);
    expect(at[mesh.count]!.tx).toBeCloseTo(other.x, 3);
    expect(at[mesh.count]!.ty).toBeCloseTo(other.y, 3);
  });
});

describe('a 3,000-cell run', () => {
  // 60 by 50 cells of 4 px.
  const BOX = { x: 0, y: 0, width: 240, height: 200 };

  test('claims 3,000 pool sprites, mounts no <Atlas> of its own, and frees them after onEnd', async () => {
    const fx = mount();
    expect(skia.atlas.mounts).toBe(1);
    const preset = disintegrate();
    const first = await play(preset, { fx, rect: BOX, pixelRatio: 1 });
    expect(fragmentEffect.sprites(preset, BOX, first.image)).toBe(3000);

    frame(0);
    expect(drawn()).toBe(3000);
    expect(skia.atlas.mounts).toBe(1);
    expect(skia.vertices.mounts).toBe(0);

    // A second run of 3,000 does not fit beside the first.
    const crowded = await play(preset, { fx, rect: BOX, pixelRatio: 1 });
    expect(crowded.events).toEqual(['fallback']);
    expect(warn.mock.calls.some((call) => String(call[0]).includes('4096 sprites'))).toBe(true);

    frame(presetDuration(preset));
    expect(first.events).toEqual(['handoff', 'end:true']);
    expect(drawn()).toBe(0);
    expect(atlasProp<unknown>('image')).toBeNull();
    for (const tint of colors()) expect([...tint]).toEqual([1, 1, 1, 1]);

    const next = await play(preset, { fx, rect: BOX, pixelRatio: 1 });
    frame(20);
    expect(next.events).toEqual(['handoff']);
    expect(drawn()).toBe(3000);
    expect(transforms()[0]!.scos).toBe(1);
    expect(skia.atlas.mounts).toBe(1);
    expect(skia.atlas.unmounts).toBe(0);
  });
});

describe('an enter', () => {
  test("with reverse 'home' starts scattered, ends with every grain at home and reveals the element", async () => {
    const preset = disintegrate();
    expect(preset.reverse).toBe('home');
    const mesh = meshOf(preset);
    // The sprites as the last frame wrote them: the run's end, on that same frame, frees them.
    let last: Xform[] = [];
    let lastAlpha: number[] = [];
    let value = 0;
    const hidden = {
      get value(): number {
        return value;
      },
      set value(next: number) {
        if (next === 0) {
          last = transforms().map((t) => ({ ...t }));
          lastAlpha = colors().map((c) => c[3]!);
        }
        value = next;
      },
    };
    const { events, target } = await play(preset, { direction: 1, hidden });

    frame(0);
    expect(events).toEqual(['handoff']);
    expect(target.hidden.value).toBe(1);
    const scattered = transforms();
    let away = 0;
    for (let i = 0; i < mesh.count; i++) if (hasMoved(mesh, scattered, i)) away++;
    expect(away).toBeGreaterThan(mesh.count / 2);

    frame(presetDuration(preset));
    expect(last).toHaveLength(SPRITE_POOL_CAPACITY);
    for (let i = 0; i < mesh.count; i++) {
      expect(last[i]!.scos).toBeCloseTo(1 / PIXEL_RATIO, 5);
      expect(last[i]!.tx).toBeCloseTo(RECT.x + mesh.bounds[i * 4]! * RECT.width, 3);
      expect(last[i]!.ty).toBeCloseTo(RECT.y + mesh.bounds[i * 4 + 1]! * RECT.height, 3);
      expect(lastAlpha[i]).toBe(1);
    }
    expect(target.hidden.value).toBe(0);
    expect(events).toEqual(['handoff', 'end:true']);
  });
});
