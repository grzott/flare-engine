import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { act } from 'react';
import { directionInto } from '../../../src/core/conventions';
import type { RectLike } from '../../../src/core/placement';
import { dust, presetDuration, type SnapshotPreset } from '../../../src/core/presets';
import { DUST_SKSL, DUST_UNIFORMS } from '../../../src/core/sksl';
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

spyOn(console, 'warn').mockImplementation(() => {});

// Loaded after the mocks, so neither module reaches the real Reanimated or Skia.
const { FlareFxHost } = await import('../../../src/fx/native/host');
const { dustEffect } = await import('../../../src/fx/native/layers/dust');

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

type Uniforms = Record<(typeof DUST_UNIFORMS)[number], number | number[]>;

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
  o: { direction?: 1 | -1; progress?: ProgressSource } = {},
): Promise<Played> {
  const fx = mount();
  const image = capture(RECT, PIXEL_RATIO);
  const target: FakeTarget = { ...createFakeTarget({ rect: RECT }) };
  target.capture = () => Promise.resolve(image);
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

/** A prop of the latest node of one kind, evaluated now. */
const propOf = <T,>(props: Record<string, unknown> | null, name: string): T => {
  if (props === null) throw new Error(`nothing was rendered to read ${name} from`);
  const value = props[name];
  return (
    typeof value === 'object' && value !== null && 'value' in value ? value.value : value
  ) as T;
};
const uniforms = (): Uniforms => propOf<Uniforms>(skia.shader.props, 'uniforms');
const transforms = (): Xform[] => propOf<Xform[]>(skia.atlas.props, 'transforms');
const sprites = (): SrcRect[] => propOf<SrcRect[]>(skia.atlas.props, 'sprites');
const colors = (): Float32Array[] => propOf<Float32Array[]>(skia.atlas.props, 'colors');

/** How many pool sprites draw: the others sit at zero scale. */
const drawn = (): number => transforms().filter((t) => t.scos !== 0 || t.ssin !== 0).length;

/** The offset a list of `translateX` and `translateY` transforms adds up to. */
const offsetOf = (transform: Record<string, number>[]): { x: number; y: number } => {
  const at = { x: 0, y: 0 };
  for (const step of transform) {
    at.x += step.translateX ?? 0;
    at.y += step.translateY ?? 0;
  }
  return at;
};

// First in the file: the compiled effect is kept for the life of the module once it is made.
describe('SkSL that does not compile', () => {
  test('plays the live fallback, and mounts nothing', async () => {
    skia.failEffect = true;
    const { events, target } = await play(dust());

    expect(skia.effects).toEqual([DUST_SKSL]);
    expect(events).toEqual(['fallback']);
    expect(target.hidden.value).toBe(0);
    expect(skia.rect.mounts).toBe(0);
    expect(skia.shader.mounts).toBe(0);
  });
});

describe('the dust layer', () => {
  test('compiles DUST_SKSL, and fills its rect through <Shader>', async () => {
    await play(dust());
    frame(0);

    expect(skia.rect.mounts).toBe(1);
    expect(skia.shader.mounts).toBe(1);
    expect(propOf<unknown>(skia.shader.props, 'source')).toEqual({ source: DUST_SKSL });
  });

  test('never mounts the RuntimeShader image filter', async () => {
    const preset = dust({ grainsAtFront: 100 });
    await play(preset);
    frame(0);
    frame(0.5);
    frame(presetDuration(preset));

    expect(skia.runtimeShader.mounts).toBe(0);
    expect(skia.runtimeShader.props).toBeNull();
  });

  test("the rect is the element's box grown by spread on every side", async () => {
    const preset = dust({ spread: 30 });
    await play(preset);
    frame(0);

    const corner = offsetOf(propOf<Record<string, number>[]>(skia.group.props, 'transform'));
    const left = corner.x + propOf<number>(skia.rect.props, 'x');
    const top = corner.y + propOf<number>(skia.rect.props, 'y');
    expect(left).toBe(RECT.x - 30);
    expect(top).toBe(RECT.y - 30);
    expect(propOf<number>(skia.rect.props, 'width')).toBe(RECT.width + 60);
    expect(propOf<number>(skia.rect.props, 'height')).toBe(RECT.height + 60);
    // The shader measures from the rect's corner, so the rect starts at the group's origin.
    expect(propOf<number>(skia.rect.props, 'x')).toBe(0);
    expect(propOf<number>(skia.rect.props, 'y')).toBe(0);
  });

  test('gives the shader every uniform of DUST_UNIFORMS, by name', async () => {
    const preset = dust({
      sweepAngle: 37,
      softness: 0.25,
      noiseScale: 12,
      noiseAmount: 0.5,
      edgeWidth: 0.125,
      edgeColor: '#ff0000',
      spread: 32,
      seed: 7,
    });
    await play(preset);
    frame(0);

    const given = uniforms();
    expect(Object.keys(given)).toEqual([...DUST_UNIFORMS]);
    const dir = directionInto(37, { x: 0, y: 0 });
    const [dx, dy] = given.u_dir as number[];
    expect(dx).toBeCloseTo(dir.x, 6);
    expect(dy).toBeCloseTo(dir.y, 6);
    expect(given).toMatchObject({
      u_progress: 0,
      u_softness: 0.25,
      u_noiseScale: 12,
      u_noiseAmount: 0.5,
      u_edgeWidth: 0.125,
      u_edgeColor: [1, 0, 0, 1],
      u_size: [RECT.width, RECT.height],
      u_spread: 32,
      u_seed: 7,
    });
  });

  test('samples the capture where the element is in it, and nothing beyond it', async () => {
    const { image } = await play(dust());
    frame(0);

    expect(skia.imageShader.mounts).toBe(1);
    expect(propOf<unknown>(skia.imageShader.props, 'image')).toBe(image.handle);
    expect(propOf<string>(skia.imageShader.props, 'tx')).toBe('decal');
    expect(propOf<string>(skia.imageShader.props, 'ty')).toBe('decal');
    // Image pixels to layout pixels from the element's corner: scaled down, then moved back by
    // the padding.
    expect(propOf<unknown>(skia.imageShader.props, 'transform')).toEqual([
      { translateX: -PADDING },
      { translateY: -PADDING },
      { scale: 1 / PIXEL_RATIO },
    ]);
  });

  test('u_progress runs from 0 to 1 over the duration', async () => {
    const preset = dust({ duration: 2 });
    await play(preset);
    frame(5);
    expect(uniforms().u_progress).toBe(0);
    frame(5.5);
    expect(uniforms().u_progress as number).toBeCloseTo(0.25, 5);
    frame(6.5);
    expect(uniforms().u_progress as number).toBeCloseTo(0.75, 5);
  });

  test('follows the easing of the preset', async () => {
    await play(dust({ duration: 1, easing: 'easeInQuad' }));
    frame(0);
    frame(0.5);
    expect(uniforms().u_progress as number).toBeCloseTo(0.25, 3);
  });

  test('rewrites the same uniforms on frames 2 and 3', async () => {
    await play(dust());
    frame(0);
    frame(0.1);
    const second = uniforms();
    frame(0.2);
    expect(uniforms()).toBe(second);
    expect(second.u_progress as number).toBeCloseTo(0.2 / 1.2, 5);
  });

  test('hands off on its first frame, and ends when the preset has run', async () => {
    const preset = dust();
    expect(presetDuration(preset)).toBe(1.2);
    const { events, target } = await play(preset);
    expect(events).toEqual([]);
    expect(target.hidden.value).toBe(0);

    frame(3);
    expect(events).toEqual(['handoff']);
    expect(target.hidden.value).toBe(1);

    frame(3 + 1.19);
    expect(events).toEqual(['handoff']);

    frame(3 + 1.2);
    expect(events).toEqual(['handoff', 'end:true']);
    // An exit leaves its element hidden: the element is on its way out.
    expect(target.hidden.value).toBe(1);
    expect(skia.rect.unmounts).toBe(1);

    frame(10);
    expect(events).toEqual(['handoff', 'end:true']);
  });

  test("waits out the preset's delay undissolved", async () => {
    const preset = dust({ delay: 0.5, duration: 1 });
    const { events } = await play(preset);
    frame(0);
    frame(0.5);
    expect(uniforms().u_progress).toBe(0);
    frame(1);
    expect(uniforms().u_progress as number).toBeCloseTo(0.5, 5);

    frame(1.49);
    expect(events).toEqual(['handoff']);
    frame(1.5);
    expect(events).toEqual(['handoff', 'end:true']);
  });

  test('follows an external progress, and has no end of its own', async () => {
    const progress = { value: 0 };
    const { events } = await play(dust(), { progress });
    frame(0);
    frame(60);
    expect(uniforms().u_progress).toBe(0);

    progress.value = 0.5;
    frame(61);
    expect(uniforms().u_progress as number).toBeCloseTo(0.5, 5);

    progress.value = 1;
    frame(62);
    expect(uniforms().u_progress).toBe(1);
    expect(events).toEqual(['handoff']);
  });

  test('without grains it claims no pool sprite', async () => {
    const preset = dust();
    expect(preset.grainsAtFront).toBe(0);
    const { image } = await play(preset);
    frame(0);
    frame(0.5);

    expect(dustEffect()?.sprites(preset, RECT, image)).toBe(0);
    expect(drawn()).toBe(0);
    expect(propOf<unknown>(skia.atlas.props, 'image')).toBeNull();
  });
});

describe('grains at the front', () => {
  test('are claimed from the pool: no layer of their own is mounted', async () => {
    const preset = dust({ grainsAtFront: 200 });
    const { image, events } = await play(preset);
    frame(0);

    const count = dustEffect()?.sprites(preset, RECT, image) ?? 0;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(200);
    expect(events).toEqual(['handoff']);
    expect(drawn()).toBe(count);
    expect(propOf<unknown>(skia.atlas.props, 'image')).toBe(image.handle);
    // The pool's one <Atlas>, mounted with the host.
    expect(skia.atlas.mounts).toBe(1);
    expect(skia.vertices.mounts).toBe(0);
    expect(skia.surfaces).toHaveLength(0);
    // The shader rect is the only layer.
    expect(skia.rect.mounts).toBe(1);
  });

  test('each grain is a cell of the capture, at home and unseen until the front reaches it', async () => {
    const preset = dust({ grainsAtFront: 200 });
    const { image } = await play(preset);
    frame(0);

    const count = dustEffect()?.sprites(preset, RECT, image) ?? 0;
    const at = transforms();
    const cut = sprites();
    const tints = colors();
    for (let i = 0; i < count; i++) {
      expect(at[i]!.scos).toBeCloseTo(1 / PIXEL_RATIO, 5);
      expect(at[i]!.ssin).toBeCloseTo(0, 5);
      // The cell's place in the capture is its place on screen.
      expect(at[i]!.tx).toBeCloseTo(RECT.x - PADDING + cut[i]!.x / PIXEL_RATIO, 3);
      expect(at[i]!.ty).toBeCloseTo(RECT.y - PADDING + cut[i]!.y / PIXEL_RATIO, 3);
      expect(cut[i]!.width).toBeGreaterThan(0);
      expect(tints[i]![3]).toBe(0);
    }
    expect(cut[count]).toMatchObject({ width: 0, height: 0 });
  });

  test('a sweep releases them: at angle 90 the leftmost first', async () => {
    const preset = dust({ sweepAngle: 90, grainsAtFront: 200 });
    const { image } = await play(preset);
    frame(0);
    const count = dustEffect()?.sprites(preset, RECT, image) ?? 0;
    const home = transforms().map((t) => ({ ...t }));

    frame(0.6);
    const at = transforms();
    const tints = colors();
    let released = 0;
    for (let i = 0; i < count; i++) {
      const moved =
        Math.abs(at[i]!.tx - home[i]!.tx) > 1e-3 || Math.abs(at[i]!.ty - home[i]!.ty) > 1e-3;
      // Where the cell starts, as a share of the element's width.
      const x = (home[i]!.tx - RECT.x) / RECT.width;
      if (moved) released++;
      else expect(tints[i]![3]).toBe(0);
      if (x < 0.4) expect(moved).toBe(true);
      if (x > 0.8) expect(moved).toBe(false);
    }
    expect(released).toBeGreaterThan(0);
    expect(released).toBeLessThan(count);
  });

  test('a released grain is seen, and drifts along the sweep', async () => {
    const preset = dust({ sweepAngle: 90, grainsAtFront: 200 });
    const { image } = await play(preset);
    frame(0);
    const count = dustEffect()?.sprites(preset, RECT, image) ?? 0;
    const home = transforms().map((t) => ({ ...t }));

    frame(0.1);
    const at = transforms();
    const tints = colors();
    let seen = 0;
    let drift = 0;
    for (let i = 0; i < count; i++) {
      if (tints[i]![3]! === 0) continue;
      seen++;
      drift += at[i]!.tx - home[i]!.tx;
    }
    expect(seen).toBeGreaterThan(0);
    // 90° is +x. A grain turns as it flies, so one alone may sit a little left of its home.
    expect(drift / seen).toBeGreaterThan(1);
  });

  test('every grain is gone by the end, and the sprites are free after it', async () => {
    const preset = dust({ grainsAtFront: 200 });
    const { image, events } = await play(preset);
    frame(0);
    const count = dustEffect()?.sprites(preset, RECT, image) ?? 0;

    frame(1.19);
    const tints = colors();
    for (let i = 0; i < count; i++) expect(tints[i]![3]).toBeLessThan(0.2);

    frame(1.2);
    expect(events).toEqual(['handoff', 'end:true']);
    expect(drawn()).toBe(0);
    expect(propOf<unknown>(skia.atlas.props, 'image')).toBeNull();
    for (const tint of colors()) expect([...tint]).toEqual([1, 1, 1, 1]);
    expect(skia.atlas.mounts).toBe(1);
    expect(skia.atlas.unmounts).toBe(0);
  });

  test('grainsAtFront is a budget: at most 3,000 cells, however many are asked for', async () => {
    const preset = dust({ grainsAtFront: 100000 });
    const { image, events } = await play(preset);
    frame(0);

    const count = dustEffect()?.sprites(preset, RECT, image) ?? 0;
    expect(count).toBeGreaterThan(200);
    expect(count).toBeLessThanOrEqual(3000);
    expect(events).toEqual(['handoff']);
    expect(drawn()).toBe(count);
  });
});

describe('an enter', () => {
  test('starts dissolved, ends whole and reveals the element', async () => {
    const preset = dust({ duration: 1, grainsAtFront: 100 });
    const { events, target } = await play(preset, { direction: 1 });

    frame(0);
    expect(events).toEqual(['handoff']);
    expect(target.hidden.value).toBe(1);
    expect(uniforms().u_progress).toBe(1);

    frame(0.75);
    expect(uniforms().u_progress as number).toBeCloseTo(0.25, 5);
    expect(target.hidden.value).toBe(1);

    frame(1);
    expect(target.hidden.value).toBe(0);
    expect(events).toEqual(['handoff', 'end:true']);
  });
});
