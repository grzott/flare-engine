import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { disintegrate } from '../../../src/core/presets';
import type { NativeEffects } from '../../../src/fx/native/host';
import type { FxRuntime } from '../../../src/runtime/contracts';
import { installDom, type Rendered, render } from '../../support/dom';
import { installReanimatedMock } from '../../support/mock-reanimated';
import { installRnMock } from '../../support/mock-rn';
import { installSkiaMock } from '../../support/mock-skia';
import {
  ContextProbe,
  cancel,
  done,
  firstFrame,
  layerEffects,
  layers,
  settle,
  start,
} from './support';

installDom();
installRnMock();
installReanimatedMock();
const skia = installSkiaMock();

// Loaded after the mocks, so neither module reaches the real Reanimated or Skia.
const { createSpritePool, SPRITE_POOL_CAPACITY } = await import('../../../src/fx/native/pool');
const { NativeFxHost } = await import('../../../src/fx/native/host');

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

const rendered: Rendered[] = [];

beforeEach(() => {
  skia.reset();
});

afterEach(() => {
  for (const r of rendered.splice(0)) r.unmount();
  layers.length = 0;
});

function mount(effects: NativeEffects): FxRuntime {
  let fx: FxRuntime | null = null;
  rendered.push(
    render(
      <NativeFxHost effects={effects}>
        <ContextProbe
          onContext={(ctx) => {
            fx = ctx.fx;
          }}
        />
      </NativeFxHost>,
    ),
  );
  if (fx === null) throw new Error('the host provided no runtime');
  return fx;
}

/** An animated prop of the mounted `<Atlas>`, evaluated now. */
const atlasProp = (name: string): unknown => {
  const props = skia.atlas.props;
  if (props === null) throw new Error('no <Atlas> was rendered');
  return (props[name] as { value: unknown }).value;
};
const atlasTransforms = (): Xform[] => atlasProp('transforms') as Xform[];
const atlasSprites = (): SrcRect[] => atlasProp('sprites') as SrcRect[];

describe('createSpritePool', () => {
  test('starts with every sprite idle, at zero scale', () => {
    const pool = createSpritePool(8);
    expect(pool.capacity).toBe(8);
    expect(pool.transforms.value).toHaveLength(32);
    expect(pool.rects.value).toHaveLength(32);
    expect(pool.transforms.value.every((v) => v === 0)).toBe(true);
  });

  test('starts with every sprite white, and a freed range is white again', () => {
    const pool = createSpritePool(4);
    const colors = pool.colors.value;
    expect(colors).toHaveLength(16);
    expect(colors.every((v) => v === 1)).toBe(true);

    const start = pool.claim(2);
    colors.fill(0.25);
    pool.free(start, 2);

    expect(pool.colors.value).toBe(colors);
    expect([...colors]).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25,
    ]);
  });

  test('claims contiguous ranges that never overlap', () => {
    const pool = createSpritePool(10);
    expect(pool.claim(4)).toBe(0);
    expect(pool.claim(3)).toBe(4);
    expect(pool.claim(3)).toBe(7);
    expect(pool.claim(1)).toBe(-1);
  });

  test('a freed range is claimed again, first fit', () => {
    const pool = createSpritePool(10);
    pool.claim(4);
    pool.claim(3);
    pool.claim(3);
    pool.free(4, 3);

    expect(pool.claim(4)).toBe(-1);
    expect(pool.claim(2)).toBe(4);
    expect(pool.claim(1)).toBe(6);
  });

  test('free sprites that are not contiguous do not make a range', () => {
    const pool = createSpritePool(6);
    pool.claim(2);
    pool.claim(2);
    pool.claim(2);
    pool.free(0, 2);
    pool.free(4, 2);

    expect(pool.claim(3)).toBe(-1);
    expect(pool.claim(2)).toBe(0);
  });

  test('refuses a claim of nothing, or of more than it holds', () => {
    const pool = createSpritePool(4);
    expect(pool.claim(0)).toBe(-1);
    expect(pool.claim(-1)).toBe(-1);
    expect(pool.claim(5)).toBe(-1);
    expect(pool.claim(4)).toBe(0);
  });

  test('freeing a range puts its sprites back at zero scale, in the same buffers', () => {
    const pool = createSpritePool(4);
    const transforms = pool.transforms.value;
    const rects = pool.rects.value;
    const start = pool.claim(2);
    transforms.fill(1);
    rects.fill(7);

    pool.free(start, 2);

    expect(pool.transforms.value).toBe(transforms);
    expect(pool.rects.value).toBe(rects);
    expect([...transforms]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect([...rects]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 7, 7, 7, 7, 7]);
  });
});

describe('the host pool', () => {
  test('one <Atlas> of 4,096 sprites is mounted for the life of the host, across runs', async () => {
    const fx = mount(layerEffects(100));
    expect(SPRITE_POOL_CAPACITY).toBe(4096);
    expect(skia.atlas.mounts).toBe(1);
    expect(atlasTransforms()).toHaveLength(4096);
    expect(atlasSprites()).toHaveLength(4096);

    for (let i = 0; i < 3; i++) {
      start(fx, disintegrate());
      await settle();
      const layer = layers[0]!;
      firstFrame(layer);
      done(layer, true);
    }

    expect(skia.atlas.mounts).toBe(1);
    expect(skia.atlas.unmounts).toBe(0);
    expect(atlasTransforms()).toHaveLength(4096);
  });

  test('two concurrent runs claim disjoint ranges', async () => {
    const fx = mount(layerEffects(1000));
    start(fx, disintegrate());
    start(fx, disintegrate());
    await settle();

    expect(layers).toHaveLength(2);
    const [a, b] = [layers[0]!.run, layers[1]!.run];
    expect([a.spriteStart, a.spriteCount]).toEqual([0, 1000]);
    expect([b.spriteStart, b.spriteCount]).toEqual([1000, 1000]);
  });

  test('sprites outside every claimed range draw at zero scale', async () => {
    const fx = mount(layerEffects(3));
    start(fx, disintegrate());
    start(fx, disintegrate());
    await settle();

    // What a run's worklet does each frame: write its own sprites, and no others.
    for (const { run } of layers) {
      run.pool.transforms.modify((buffer) => {
        buffer.fill(2, run.spriteStart * 4, (run.spriteStart + run.spriteCount) * 4);
        return buffer;
      });
      run.pool.rects.modify((buffer) => {
        buffer.fill(5, run.spriteStart * 4, (run.spriteStart + run.spriteCount) * 4);
        return buffer;
      });
    }

    const transforms = atlasTransforms();
    for (let i = 0; i < 6; i++) expect(transforms[i]).toMatchObject({ scos: 2, ssin: 2 });
    for (let i = 6; i < transforms.length; i++) {
      expect(transforms[i]).toMatchObject({ scos: 0, ssin: 0, tx: 0, ty: 0 });
    }
    expect(atlasSprites()[5]).toMatchObject({ x: 5, y: 5, width: 5, height: 5 });
    expect(atlasSprites()[6]).toMatchObject({ x: 0, y: 0, width: 0, height: 0 });
  });

  test('a run without pool sprites claims none', async () => {
    const fx = mount(layerEffects(0));
    start(fx, disintegrate());
    await settle();

    expect(layers[0]!.run.spriteStart).toBe(-1);
    expect(layers[0]!.run.spriteCount).toBe(0);
  });

  test("a range is free again, and idle, after its run's onEnd", async () => {
    const fx = mount(layerEffects(4096));
    const first = start(fx, disintegrate());
    await settle();
    const layer = layers[0]!;
    layer.run.pool.transforms.modify((buffer) => buffer.fill(1));
    firstFrame(layer);
    done(layer, true);
    expect(first.events).toEqual(['handoff', 'end:true']);
    expect(atlasTransforms().every((t) => t.scos === 0)).toBe(true);

    const second = start(fx, disintegrate());
    await settle();
    expect(layers).toHaveLength(1);
    expect(layers[0]!.run.spriteStart).toBe(0);
    expect(second.events).toEqual([]);
  });

  test('a cancelled run frees its range', async () => {
    const fx = mount(layerEffects(4096));
    const first = start(fx, disintegrate());
    await settle();
    expect(cancel(first.run)).toBe(true);
    await settle();

    start(fx, disintegrate());
    await settle();
    expect(layers).toHaveLength(1);
    expect(layers[0]!.run.spriteStart).toBe(0);
  });

  test('the atlas draws from the capture of the run that claimed, and lets go of it after', async () => {
    const fx = mount(layerEffects(10));
    const image = (): unknown => atlasProp('image');
    expect(image()).toBeNull();

    const { target } = start(fx, disintegrate());
    await settle();
    expect(image()).toBe(target.images[0]!.handle);

    done(layers[0]!, true);
    expect(image()).toBeNull();
  });

  test('a claim beyond the free sprites falls back once, and warns once', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const fx = mount(layerEffects(3000));
      const first = start(fx, disintegrate());
      const second = start(fx, disintegrate());
      const third = start(fx, disintegrate());
      await settle();

      expect(layers).toHaveLength(1);
      expect(first.events).toEqual([]);
      expect(second.events).toEqual(['fallback']);
      expect(third.events).toEqual(['fallback']);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('4096');
    } finally {
      warn.mockRestore();
    }
  });
});
