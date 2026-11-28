import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { generateFracture } from '../../../src/core/fracture/generate';
import type { FractureMesh } from '../../../src/core/fracture/types';
import type { FragmentPose } from '../../../src/core/motion/pose';
import {
  disintegrate,
  emerge,
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

// Loaded after the mocks, so neither module reaches the real Reanimated or Skia.
const { FlareFxHost } = await import('../../../src/fx/native/host');
const { fragmentEffect, shardVertexInto } = await import('../../../src/fx/native/layers/shatter');

interface Point {
  x: number;
  y: number;
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

/** A capture of `RECT` at pixel ratio 2, reaching 8 layout pixels beyond it. */
const capture = (): FxImage => {
  const width = (RECT.width + 2 * PADDING) * PIXEL_RATIO;
  const height = (RECT.height + 2 * PADDING) * PIXEL_RATIO;
  return {
    width,
    height,
    pixelRatio: PIXEL_RATIO,
    padding: PADDING,
    handle: createMockImage(width, height),
  };
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
  o: { direction?: 1 | -1; progress?: ProgressSource; fx?: FxRuntime } = {},
): Promise<Played> {
  const fx = o.fx ?? mount();
  const image = capture();
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

/** An animated or plain prop of the latest `<Vertices>`, evaluated now. */
const prop = <T,>(name: string): T => {
  const props = skia.vertices.props;
  if (props === null) throw new Error('no <Vertices> was rendered');
  const value = props[name];
  return (
    typeof value === 'object' && value !== null && 'value' in value ? value.value : value
  ) as T;
};

/** The capture the pool's `<Atlas>` draws from: `null` unless a run holds pool sprites. */
const poolImage = (): unknown => {
  const props = skia.atlas.props;
  if (props === null) throw new Error('no <Atlas> was rendered');
  return (props.image as { value: unknown }).value;
};

const positions = (): Point[] => prop<Point[]>('vertices');
const colors = (): Float32Array[] => prop<Float32Array[]>('colors');

/** The mesh a run of `preset` on `RECT` breaks into, without a press point. */
const meshOf = (preset: { fragment: Parameters<typeof generateFracture>[0] }): FractureMesh =>
  generateFracture(preset.fragment, RECT.width, RECT.height);

const vertexCount = (mesh: FractureMesh): number => mesh.vertexStart[mesh.count]!;

function expectAtHome(mesh: FractureMesh): void {
  const at = positions();
  expect(at).toHaveLength(vertexCount(mesh));
  for (let v = 0; v < at.length; v++) {
    expect(at[v]!.x).toBeCloseTo(RECT.x + mesh.vertices[v * 2]! * RECT.width, 3);
    expect(at[v]!.y).toBeCloseTo(RECT.y + mesh.vertices[v * 2 + 1]! * RECT.height, 3);
  }
}

describe('shardVertexInto', () => {
  const pose: FragmentPose = { x: 30, y: 12, rotation: Math.PI / 2, scale: 1.5, alpha: 1 };
  const out = { x: 0, y: 0 };

  test('the centroid lands on the pose', () => {
    shardVertexInto(pose, 7, 5, 7, 5, out);
    expect(out.x).toBeCloseTo(30, 6);
    expect(out.y).toBeCloseTo(12, 6);
  });

  test('a quarter turn carries a vertex one to the right of the centroid one scale below it', () => {
    shardVertexInto(pose, 7, 5, 8, 5, out);
    expect(Math.abs(out.x - 30)).toBeLessThan(1e-6);
    expect(Math.abs(out.y - (12 + 1.5))).toBeLessThan(1e-6);
  });

  test('without a turn, a vertex keeps its offset from the centroid, scaled', () => {
    shardVertexInto({ ...pose, rotation: 0, scale: 2 }, 7, 5, 9, 4, out);
    expect(out.x).toBeCloseTo(34, 6);
    expect(out.y).toBeCloseTo(10, 6);
  });
});

describe('routing by the mesh', () => {
  test('shatter() mounts a <Vertices> layer, and claims no pool sprites', async () => {
    const preset = shatter();
    expect(meshOf(preset).rectangular).toBe(false);

    const { image } = await play(preset);

    expect(skia.vertices.mounts).toBe(1);
    expect(fragmentEffect.sprites(preset, RECT, image)).toBe(0);
    expect(poolImage()).toBeNull();
  });

  test("shatter({ pattern: 'grid' }) claims a pool sprite per piece, and mounts no <Vertices>", async () => {
    const preset = shatter({ fragment: { pattern: 'grid' } });
    const mesh = meshOf(preset);
    expect(mesh.rectangular).toBe(true);

    const { image } = await play(preset);

    expect(fragmentEffect.sprites(preset, RECT, image)).toBe(mesh.count);
    expect(mesh.count).toBeGreaterThan(0);
    expect(skia.vertices.mounts).toBe(0);
  });

  test("disintegrate({ pattern: 'triangles' }) mounts a <Vertices> layer", async () => {
    const preset = disintegrate({ fragment: { pattern: 'triangles' } });
    const { image } = await play(preset);

    expect(skia.vertices.mounts).toBe(1);
    expect(fragmentEffect.sprites(preset, RECT, image)).toBe(0);
  });

  test('disintegrate() has a rectangular mesh, so it claims sprites and mounts no <Vertices>', async () => {
    const preset = disintegrate();
    const { image } = await play(preset);

    // Its cells are pixels of the capture, so the mesh is sized in image pixels.
    const cells = generateFracture(
      preset.fragment,
      RECT.width * PIXEL_RATIO,
      RECT.height * PIXEL_RATIO,
    );
    expect(cells.rectangular).toBe(true);
    expect(fragmentEffect.sprites(preset, RECT, image)).toBe(cells.count);
    expect(skia.vertices.mounts).toBe(0);
  });

  test('on the public host a rectangular run draws from the pool, off the capture', async () => {
    for (const preset of [shatter({ fragment: { pattern: 'grid' } }), disintegrate()]) {
      const { events, target, image } = await play(preset);
      expect(poolImage()).toBe(image.handle);

      frame(0);
      expect(events).toEqual(['handoff']);
      expect(target.hidden.value).toBe(1);
      expect(skia.vertices.mounts).toBe(0);
    }
  });

  test('a preset that is not a fragment preset still falls back', async () => {
    const { events } = await play(emerge({ variant: 'shader' }));
    expect(events).toEqual(['fallback']);
    expect(skia.vertices.mounts).toBe(0);
  });
});

describe('the shard layer', () => {
  test('has a vertex per piece vertex, and a triangle fan per piece', async () => {
    const preset = shatter();
    const mesh = meshOf(preset);
    await play(preset);

    let fans = 0;
    for (let i = 0; i < mesh.count; i++) {
      fans += 3 * (mesh.vertexStart[i + 1]! - mesh.vertexStart[i]! - 2);
    }
    expect(positions()).toHaveLength(vertexCount(mesh));
    expect(prop<Point[]>('textures')).toHaveLength(vertexCount(mesh));
    expect(colors()).toHaveLength(vertexCount(mesh));
    expect(prop<number[]>('indices')).toHaveLength(fans);
    expect(prop<string>('mode')).toBe('triangles');
  });

  test('each fan turns about the first vertex of its piece, and stays inside the piece', async () => {
    const preset = shatter();
    const mesh = meshOf(preset);
    await play(preset);

    const indices = prop<number[]>('indices');
    let k = 0;
    for (let i = 0; i < mesh.count; i++) {
      const first = mesh.vertexStart[i]!;
      const n = mesh.vertexStart[i + 1]! - first;
      for (let t = 1; t < n - 1; t++) {
        expect([indices[k], indices[k + 1], indices[k + 2]]).toEqual([
          first,
          first + t,
          first + t + 1,
        ]);
        k += 3;
      }
    }
    expect(k).toBe(indices.length);
  });

  test('at rest every vertex is at home in the measured rect, and samples that point of the capture', async () => {
    const preset = shatter();
    const mesh = meshOf(preset);
    await play(preset);

    expectAtHome(mesh);
    const textures = prop<Point[]>('textures');
    for (let v = 0; v < textures.length; v++) {
      const x = mesh.vertices[v * 2]! * RECT.width;
      const y = mesh.vertices[v * 2 + 1]! * RECT.height;
      expect(textures[v]!.x).toBeCloseTo((PADDING + x) * PIXEL_RATIO, 3);
      expect(textures[v]!.y).toBeCloseTo((PADDING + y) * PIXEL_RATIO, 3);
    }

    frame(5);
    expectAtHome(mesh);
  });

  test('draws from the capture with the multiply blend, and bakes nothing', async () => {
    const { image } = await play(shatter());
    frame(0);
    frame(0.1);

    expect(prop<string>('blendMode')).toBe('multiply');
    expect(skia.imageShader.mounts).toBe(1);
    expect(skia.imageShader.props?.image).toBe(image.handle);
    expect(skia.surfaces).toHaveLength(0);
  });

  test('the pieces move once released', async () => {
    const preset = shatter();
    const mesh = meshOf(preset);
    await play(preset);
    frame(1);
    frame(1.5);

    const at = positions();
    let moved = 0;
    for (let v = 0; v < at.length; v++) {
      if (Math.abs(at[v]!.x - (RECT.x + mesh.vertices[v * 2]! * RECT.width)) > 1) moved++;
    }
    expect(moved).toBeGreaterThan(at.length / 2);
  });

  test('gives new points every frame, and the same colour arrays', async () => {
    await play(shatter());
    frame(1);
    frame(1.1);
    const secondPoints = positions();
    const second = [...colors()];
    frame(1.2);
    const third = colors();

    expect(positions()).not.toBe(secondPoints);
    expect(third).toHaveLength(second.length);
    for (let v = 0; v < third.length; v++) {
      expect(third[v]).toBeInstanceOf(Float32Array);
      expect(third[v]).toHaveLength(4);
      expect(third[v]).toBe(second[v]!);
    }
  });

  test("a vertex colour is white at its piece's alpha", async () => {
    await play(shatter({ life: { opacity: [0.5, 0.5] } }));
    frame(0);
    frame(0.2);

    for (const color of colors()) expect([...color]).toEqual([1, 1, 1, 0.5]);
  });

  test('a piece fades over its life', async () => {
    const preset = shatter();
    await play(preset);
    frame(0);
    for (const color of colors()) expect(color[3]).toBe(1);

    frame(presetDuration(preset) - 0.01);
    for (const color of colors()) expect(color[3]).toBeLessThan(0.2);
  });

  test('hands off on its first frame, and ends when the preset has run', async () => {
    const preset = shatter();
    const { events, target } = await play(preset);
    expect(events).toEqual([]);
    expect(target.hidden.value).toBe(0);

    frame(3);
    expect(events).toEqual(['handoff']);
    expect(target.hidden.value).toBe(1);

    frame(3 + presetDuration(preset) - 0.01);
    expect(events).toEqual(['handoff']);

    frame(3 + presetDuration(preset));
    expect(events).toEqual(['handoff', 'end:true']);
    // An exit leaves its element hidden: the element is on its way out.
    expect(target.hidden.value).toBe(1);
    expect(skia.vertices.unmounts).toBe(1);

    frame(10);
    expect(events).toEqual(['handoff', 'end:true']);
  });

  test("waits out the preset's delay at home", async () => {
    const preset = shatter({ delay: 0.5 });
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
    const preset = shatter();
    const mesh = meshOf(preset);
    const progress = { value: 0 };
    const { events } = await play(preset, { progress });
    frame(0);
    frame(60);
    expectAtHome(mesh);

    progress.value = 1;
    frame(61);
    for (const color of colors()) expect(color[3]).toBeLessThan(0.2);
    expect(events).toEqual(['handoff']);
  });

  test('two runs draw on a layer each', async () => {
    const fx = mount();
    await play(shatter(), { fx });
    await play(shatter(), { fx });

    expect(skia.vertices.mounts).toBe(2);
    expect(skia.imageShader.mounts).toBe(2);
  });

  test('keeps at most maxFragments pieces', async () => {
    const preset = shatter({ fragment: { count: 40 }, maxFragments: 12 });
    await play(preset);

    const kept = generateFracture({ ...preset.fragment, count: 12 }, RECT.width, RECT.height);
    expect(kept.count).toBeLessThanOrEqual(12);
    expect(meshOf(preset).count).toBeGreaterThan(12);
    expect(positions()).toHaveLength(vertexCount(kept));
  });
});

describe('an enter', () => {
  test("with reverse 'home' starts scattered, ends with every piece at home and reveals the element", async () => {
    const preset = shatter();
    expect(preset.reverse).toBe('home');
    const mesh = meshOf(preset);
    const { events, target } = await play(preset, { direction: 1 });

    frame(0);
    expect(events).toEqual(['handoff']);
    expect(target.hidden.value).toBe(1);
    const scattered = positions();
    let away = 0;
    for (let v = 0; v < scattered.length; v++) {
      if (Math.abs(scattered[v]!.x - (RECT.x + mesh.vertices[v * 2]! * RECT.width)) > 1) away++;
    }
    expect(away).toBeGreaterThan(scattered.length / 2);

    frame(presetDuration(preset));
    expectAtHome(mesh);
    for (const color of colors()) expect(color[3]).toBe(1);
    expect(target.hidden.value).toBe(0);
    expect(events).toEqual(['handoff', 'end:true']);
  });

  test("with reverse 'rewind' also ends at home, revealed", async () => {
    const preset = shatter({ reverse: 'rewind' });
    const { events, target } = await play(preset, { direction: 1 });
    frame(0);
    frame(presetDuration(preset) + 0.1);

    expectAtHome(meshOf(preset));
    expect(target.hidden.value).toBe(0);
    expect(events).toEqual(['handoff', 'end:true']);
  });
});
