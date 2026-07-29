import type {
  ColorFilterFactoryLike,
  DrawSurfaceLike,
  FrameRendererModule,
  ImageFilterFactoryLike,
  PaintLike,
  PictureLike,
  PictureRecorderLike,
  RectLike,
  RSXformLike,
  RuntimeEffectFactoryLike,
  RuntimeEffectLike,
  SpriteBatch,
} from '@flare-engine/render';

/**
 * A counting, allocation-free stand-in for the Skia module the frame renderer
 * draws through.
 *
 * Why it exists: until this row the render benchmarks called
 * `batch.flush(() => {})`, so `createFrameRenderer` was never constructed and
 * `fillXforms` — the per-sprite RSXform transform build — never executed. A
 * flush callback cannot reach it; only the real frame renderer can. It is not
 * the largest single cost in a flush row (~16% of the 1000-sprite row as
 * measured), but it was 100% unmeasured, it is where the rotation branch lives,
 * and it is the part that grows with every future transform feature. Driving
 * the real renderer needs a Skia module, and a *counting* one additionally
 * turns the draw path into an observable surface: exact factory-call and
 * draw-call integers per frame.
 *
 * Two properties matter for measurement honesty:
 *
 *  - **Zero allocation per call.** Every method mutates preallocated state and
 *    returns a shared token, so nothing the stub does lands in the heap
 *    measurement of the code under test.
 *  - **Real setters.** `RectLike.setXYWH` and `RSXformLike.set` write their
 *    fields. A no-op setter (what every existing test stub uses) lets JSC
 *    eliminate the transform arithmetic in `fillXforms` as dead, which would
 *    make the bench measure nothing while appearing to measure the fix.
 */

/** Image stand-in — the frame renderer only ever passes it through. */
export type StubImage = { width(): number; height(): number };

type BatchImage = Parameters<SpriteBatch['drawRaw']>[0];

export function makeStubImage(w = 256, h = 256): BatchImage {
  const img: StubImage = { width: () => w, height: () => h };
  return img as unknown as BatchImage;
}

export type StubCounters = {
  // Draw-surface calls.
  drawAtlas: number;
  drawImageRect: number;
  drawRect: number;
  save: number;
  restore: number;
  translate: number;
  scale: number;
  rotate: number;
  clear: number;
  // Module-factory calls that are lazily cached forever by the renderer — these
  // must reach zero per frame once every exercised path is warm.
  xywhRect: number;
  rsxform: number;
  paint: number;
  pictureRecorder: number;
  runtimeEffectMake: number;
  // Per-call by design: the renderer rebuilds these on every drawAtlas.
  beginRecording: number;
  finishRecording: number;
  colorFilterBlend: number;
  colorFilterMatrix: number;
  imageFilterDropShadow: number;
  makeShader: number;
};

export type SkiaStub = {
  module: FrameRendererModule;
  counters: StubCounters;
  /** Zero every counter. Cheap; safe between frames. */
  reset(): void;
  /** Snapshot into a caller-owned object — no allocation. */
  copyInto(out: StubCounters): void;
};

export type SkiaStubOptions = {
  /**
   * Wrap the draw surface so any member the frame renderer touches that is not
   * part of the known `DrawSurfaceLike` set throws instead of silently
   * succeeding. A future draw path (the way `drawRect` arrived with zone-bg
   * backgrounds in 2026-07) then breaks the gate loudly rather than shipping
   * unmeasured. Costs one Proxy trap per draw call, so the timing benches
   * decide per scenario; the allocation gate always runs strict.
   */
  strict?: boolean;
};

export function emptyCounters(): StubCounters {
  return {
    drawAtlas: 0,
    drawImageRect: 0,
    drawRect: 0,
    save: 0,
    restore: 0,
    translate: 0,
    scale: 0,
    rotate: 0,
    clear: 0,
    xywhRect: 0,
    rsxform: 0,
    paint: 0,
    pictureRecorder: 0,
    runtimeEffectMake: 0,
    beginRecording: 0,
    finishRecording: 0,
    colorFilterBlend: 0,
    colorFilterMatrix: 0,
    imageFilterDropShadow: 0,
    makeShader: 0,
  };
}

/** Factory calls the renderer caches forever — the "must be zero when warm" set. */
export function cachedFactoryCalls(c: StubCounters): number {
  return c.xywhRect + c.rsxform + c.paint + c.pictureRecorder + c.runtimeEffectMake;
}

/** Factory calls the renderer repeats every frame by design (effect paths only). */
export function perFrameFactoryCalls(c: StubCounters): number {
  return c.colorFilterBlend + c.colorFilterMatrix + c.imageFilterDropShadow + c.makeShader;
}

/**
 * The draw-surface members the benchmark knows how to account for. A member the
 * frame renderer calls that is not on this list throws in strict mode: the
 * scenario matrix does not measure it, so it must be given a row (and an entry
 * here) rather than shipping unmeasured.
 */
export const KNOWN_SURFACE_MEMBERS: readonly string[] = [
  'save',
  'restore',
  'translate',
  'scale',
  'rotate',
  'clear',
  'drawAtlas',
  'drawImageRect',
  'drawRect',
];

export function createCountingSkiaStub(options: SkiaStubOptions = {}): SkiaStub {
  const counters = emptyCounters();

  // Shared tokens. The renderer only ever hands these straight back to Skia, so
  // identity is all that is required — and sharing them keeps the stub off the
  // allocation profile of the code under test.
  const shaderToken: unknown = { __stub: 'shader' };
  const colorFilterToken: unknown = { __stub: 'colorFilter' };
  const imageFilterToken: unknown = { __stub: 'imageFilter' };
  const picture: PictureLike = { __stub: 'picture' };

  const effect: RuntimeEffectLike = {
    makeShader(_uniforms: number[]): unknown {
      counters.makeShader++;
      return shaderToken;
    },
    getUniformCount: () => 0,
    getUniformFloatCount: () => 11,
    getUniformName: () => '',
    getUniform: (index: number) => ({ columns: 1, rows: 1, slot: index }),
  };

  const surfaceTarget: DrawSurfaceLike = {
    save(): number {
      counters.save++;
      return 0;
    },
    restore(): void {
      counters.restore++;
    },
    translate(): void {
      counters.translate++;
    },
    scale(): void {
      counters.scale++;
    },
    rotate(): void {
      counters.rotate++;
    },
    clear(): void {
      counters.clear++;
    },
    drawAtlas(): void {
      counters.drawAtlas++;
    },
    drawImageRect(): void {
      counters.drawImageRect++;
    },
    drawRect(): void {
      counters.drawRect++;
    },
  };

  const surface: DrawSurfaceLike =
    options.strict === true
      ? new Proxy(surfaceTarget, {
          get(target, prop, receiver): unknown {
            // Keyed on the frozen list, NOT on `prop in target`: adding a member
            // to DrawSurfaceLike forces it into `surfaceTarget` to typecheck, and
            // an `in`-based guard would then wave the new draw call through
            // unmeasured — disarming itself in precisely the case it exists for.
            if (typeof prop === 'symbol' || KNOWN_SURFACE_MEMBERS.includes(prop)) {
              return Reflect.get(target, prop, receiver);
            }
            throw new Error(
              `[bench-stub] frame renderer called unknown draw-surface member "${String(prop)}" — ` +
                'the benchmark does not measure this path. Add it to the scenario matrix, then to ' +
                'KNOWN_SURFACE_MEMBERS in benchmarks/src/skia-stub.ts.',
            );
          },
        })
      : surfaceTarget;

  const recorder: PictureRecorderLike = {
    beginRecording(): DrawSurfaceLike {
      counters.beginRecording++;
      return surface;
    },
    finishRecordingAsPicture(): PictureLike {
      counters.finishRecording++;
      return picture;
    },
  };

  const ColorFilter: ColorFilterFactoryLike = {
    MakeBlend(): unknown {
      counters.colorFilterBlend++;
      return colorFilterToken;
    },
    MakeMatrix(): unknown {
      counters.colorFilterMatrix++;
      return colorFilterToken;
    },
  };

  const RuntimeEffect: RuntimeEffectFactoryLike = {
    // Must never return null: the renderer does not cache a null result, so a
    // null-returning stub re-enters Make on every single drawAtlas and would
    // blow the zero-factory-calls gate for a reason unrelated to the engine.
    Make(): RuntimeEffectLike {
      counters.runtimeEffectMake++;
      return effect;
    },
  };

  const ImageFilter: ImageFilterFactoryLike = {
    MakeDropShadow(): unknown {
      counters.imageFilterDropShadow++;
      return imageFilterToken;
    },
  };

  const module: FrameRendererModule = {
    XYWHRect(x: number, y: number, w: number, h: number): RectLike {
      counters.xywhRect++;
      return {
        x,
        y,
        width: w,
        height: h,
        setXYWH(nx: number, ny: number, nw: number, nh: number): void {
          this.x = nx;
          this.y = ny;
          this.width = nw;
          this.height = nh;
        },
      };
    },
    RSXform(scos: number, ssin: number, tx: number, ty: number): RSXformLike {
      counters.rsxform++;
      return {
        scos,
        ssin,
        tx,
        ty,
        set(nscos: number, nssin: number, ntx: number, nty: number): void {
          this.scos = nscos;
          this.ssin = nssin;
          this.tx = ntx;
          this.ty = nty;
        },
      };
    },
    Paint(): PaintLike {
      counters.paint++;
      return {
        setAlphaf(): void {},
        setColorFilter(): void {},
        setShader(): void {},
        setImageFilter(): void {},
      };
    },
    PictureRecorder(): PictureRecorderLike {
      counters.pictureRecorder++;
      return recorder;
    },
    ColorFilter,
    RuntimeEffect,
    ImageFilter,
  };

  return {
    module,
    counters,
    reset(): void {
      for (const k of Object.keys(counters) as (keyof StubCounters)[]) counters[k] = 0;
    },
    copyInto(out: StubCounters): void {
      for (const k of Object.keys(counters) as (keyof StubCounters)[]) out[k] = counters[k];
    },
  };
}
