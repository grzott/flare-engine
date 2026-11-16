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
} from '@flare-engine/render';
import type {
  BlendMode,
  CanvasKit,
  Canvas as CKCanvas,
  Image as CKImage,
  Paint as CKPaint,
  ColorFilter,
  FilterOptions,
  ImageFilter,
  Shader,
} from 'canvaskit-wasm';
import { wrapRuntimeEffect } from './runtime-effect.js';

// Internal interface: extends PaintLike with the raw CK Paint handle.
// Only used within this module so CK-specific types do not leak into PaintLike.
interface CKPaintLike extends PaintLike {
  readonly _ckPaint: CKPaint;
}

// Numeric BlendMode constants inlined (stable CK ABI).
// CK's BlendMode enum values: SrcOver=3, SrcIn=5, SrcATop=9, Plus=12.
const BLEND_SRC_OVER = 3;
const BLEND_SRC_IN = 5;
const BLEND_SRC_ATOP = 9;
const BLEND_PLUS = 12;

// Grow-only flat scratch buffers for flattening drawAtlas args: Float32Array for
// the rects and transforms, Uint32Array (one packed ARGB each) for the colours.
// Each instance of createWebSkiaModule gets its own set.
// srcView(n) / xformView(n) / colorView(n) cache the view over the first n sprites
// per n; a view is tied to the buffer it was cut from, so growing the buffers drops
// them all.
function makeAtlasBuffers(): {
  srcs: Float32Array;
  xforms: Float32Array;
  colors: Uint32Array;
  ensureCapacity(n: number): void;
  srcView(n: number): Float32Array;
  xformView(n: number): Float32Array;
  colorView(n: number): Uint32Array;
} {
  let srcs = new Float32Array(32 * 4);
  let xforms = new Float32Array(32 * 4);
  let colors = new Uint32Array(32);
  const srcViews = new Map<number, Float32Array>();
  const xformViews = new Map<number, Float32Array>();
  const colorViews = new Map<number, Uint32Array>();

  return {
    get srcs() {
      return srcs;
    },
    get xforms() {
      return xforms;
    },
    get colors() {
      return colors;
    },
    ensureCapacity(n: number): void {
      if (n * 4 > srcs.length) {
        let cap = srcs.length;
        while (cap < n * 4) cap *= 2;
        srcs = new Float32Array(cap);
        xforms = new Float32Array(cap);
        colors = new Uint32Array(cap / 4);
        srcViews.clear();
        xformViews.clear();
        colorViews.clear();
      }
    },
    colorView(n: number): Uint32Array {
      let view = colorViews.get(n);
      if (view === undefined) {
        view = colors.subarray(0, n);
        colorViews.set(n, view);
      }
      return view;
    },
    srcView(n: number): Float32Array {
      let view = srcViews.get(n);
      if (view === undefined) {
        view = srcs.subarray(0, n * 4);
        srcViews.set(n, view);
      }
      return view;
    },
    xformView(n: number): Float32Array {
      let view = xformViews.get(n);
      if (view === undefined) {
        view = xforms.subarray(0, n * 4);
        xformViews.set(n, view);
      }
      return view;
    },
  };
}

// Extract the raw CK Paint from a PaintLike produced by createWebSkiaModule.
// If the paint was created by our Paint() factory it carries a _ckPaint field.
// Falls back to a direct cast only when called from within this module (the only
// code path that reaches wrapCKCanvas is createFrameRenderer via createWebSkiaModule).
function rawPaint(paint: PaintLike): CKPaint {
  return (paint as CKPaintLike)._ckPaint;
}

// The two CK sampling objects, pre-created once per module so the frame loop
// hands the same instances to drawAtlas instead of building one per call.
interface CKSampling {
  readonly nearest: FilterOptions;
  readonly linear: FilterOptions;
}

interface CKCanvasWrapper {
  readonly surface: DrawSurfaceLike;
  bind(next: CKCanvas): void;
}

// Built once per PictureRecorder; bind() re-points the surface at the canvas of
// each new recording, so it always draws into the most recently bound one.
function wrapCKCanvas(
  initial: CKCanvas,
  atlasBuffers: ReturnType<typeof makeAtlasBuffers>,
  kit: CanvasKit,
  ckSampling: CKSampling,
): CKCanvasWrapper {
  let ck = initial;
  // Pre-allocated LTRB scratch buffers for zero-alloc drawImageRect / drawRect.
  // CK accepts a Float32Array as InputRect (LTRB layout).
  const imgSrcScratch = new Float32Array(4);
  const imgDstScratch = new Float32Array(4);

  function fillImageScratch(src: RectLike, dst: RectLike): void {
    imgSrcScratch[0] = src.x;
    imgSrcScratch[1] = src.y;
    imgSrcScratch[2] = src.x + src.width;
    imgSrcScratch[3] = src.y + src.height;
    imgDstScratch[0] = dst.x;
    imgDstScratch[1] = dst.y;
    imgDstScratch[2] = dst.x + dst.width;
    imgDstScratch[3] = dst.y + dst.height;
  }

  const surface: DrawSurfaceLike = {
    save: () => ck.save(),
    restore: () => ck.restore(),
    translate: (x, y) => ck.translate(x, y),
    scale: (sx, sy) => ck.scale(sx, sy),
    // DrawSurfaceLike.rotate is degrees (contract); CanvasKit Canvas.rotate takes degrees — pass-through.
    rotate: (degrees, cx, cy) => ck.rotate(degrees, cx, cy),
    clear: (color) => ck.clear(color),
    // `_blendMode` is not read: the renderer passes colours only ever with
    // Modulate, so the presence of `colors` selects it.
    drawAtlas(image, srcRects, dstXforms, paint, _blendMode, colors, sampling) {
      const n = srcRects.length;
      if (n === 0) return;
      atlasBuffers.ensureCapacity(n);
      for (let i = 0; i < n; i++) {
        const r = srcRects[i]!;
        const o = i * 4;
        // CK drawAtlas srcRects are LTRB (left, top, right, bottom).
        atlasBuffers.srcs[o] = r.x;
        atlasBuffers.srcs[o + 1] = r.y;
        atlasBuffers.srcs[o + 2] = r.x + r.width;
        atlasBuffers.srcs[o + 3] = r.y + r.height;
        const xf = dstXforms[i]!;
        // CK RSXform flat layout: [scos, ssin, tx, ty]
        atlasBuffers.xforms[o] = xf.scos;
        atlasBuffers.xforms[o + 1] = xf.ssin;
        atlasBuffers.xforms[o + 2] = xf.tx;
        atlasBuffers.xforms[o + 3] = xf.ty;
      }
      const img = image as CKImage;
      const srcs = atlasBuffers.srcView(n);
      const xforms = atlasBuffers.xformView(n);
      let blendMode: BlendMode | null = null;
      let ckColors: Uint32Array | null = null;
      if (colors !== undefined) {
        // CanvasKit takes one packed ARGB per sprite. A reused Uint32Array is
        // copied to the wasm heap as is; any other form allocates per call.
        for (let i = 0; i < n; i++) {
          const c = colors[i]!;
          atlasBuffers.colors[i] =
            ((Math.round(c[3]! * 255) << 24) |
              (Math.round(c[0]! * 255) << 16) |
              (Math.round(c[1]! * 255) << 8) |
              Math.round(c[2]! * 255)) >>>
            0;
        }
        blendMode = kit.BlendMode.Modulate;
        ckColors = atlasBuffers.colorView(n);
      }
      if (sampling === undefined) {
        ck.drawAtlas(img, srcs, xforms, rawPaint(paint), blendMode, ckColors);
      } else {
        ck.drawAtlas(
          img,
          srcs,
          xforms,
          rawPaint(paint),
          blendMode,
          ckColors,
          sampling.filter === 0 ? ckSampling.nearest : ckSampling.linear,
        );
      }
    },
    drawImageRect(image, src, dst, paint) {
      fillImageScratch(src, dst);
      ck.drawImageRect(image as CKImage, imgSrcScratch, imgDstScratch, rawPaint(paint), false);
    },
    drawImageRectOptions(image, src, dst, filterMode, mipmapMode, paint) {
      fillImageScratch(src, dst);
      const fm = filterMode === 0 ? kit.FilterMode.Nearest : kit.FilterMode.Linear;
      const mm =
        mipmapMode === 0
          ? kit.MipmapMode.None
          : mipmapMode === 1
            ? kit.MipmapMode.Nearest
            : kit.MipmapMode.Linear;
      ck.drawImageRectOptions(
        image as CKImage,
        imgSrcScratch,
        imgDstScratch,
        fm,
        mm,
        paint == null ? null : rawPaint(paint),
      );
    },
    drawRect(rect, paint) {
      const r = rect as RectLike;
      // Reuse imgSrcScratch — drawRect is never interleaved with drawImageRect in the same call.
      imgSrcScratch[0] = r.x;
      imgSrcScratch[1] = r.y;
      imgSrcScratch[2] = r.x + r.width;
      imgSrcScratch[3] = r.y + r.height;
      ck.drawRect(imgSrcScratch, rawPaint(paint));
    },
  };

  return {
    surface,
    bind(next) {
      ck = next;
    },
  };
}

/**
 * Create a `FrameRendererModule` backed by CanvasKit.
 *
 * The returned module satisfies the same structural interface that the
 * real RN-Skia module satisfies, so `createFrameRenderer` can accept it.
 *
 * CK differences handled here:
 * - `drawAtlas` takes flat Float32Arrays — the wrapper flattens object pools.
 *   Per-sprite colours arrive as `[r, g, b, a]` floats and leave as one packed
 *   ARGB `Uint32Array`, with `BlendMode.Modulate`; an uncoloured run still
 *   passes `null` for both.
 * - `PictureRecorder().beginRecording()` returns one surface object per recorder,
 *   re-pointed at each new recording. Use it only between `beginRecording` and the
 *   matching `finishRecordingAsPicture`; do not keep it across recordings.
 * - `rotate` is forwarded verbatim (no radians→degrees conversion) to match
 *   the native bridge; the dormant radians/degrees mismatch is tracked separately.
 * - `ColorFilter.MakeBlend(color, mode)` takes an EmbindEnumEntity — the
 *   wrapper maps the numeric literal (3=SrcOver, 5=SrcIn, 9=SrcATop) to the CK enum.
 * - `RSXform` objects carry `scos/ssin/tx/ty` fields for flat-array flattening.
 * - Sampling: `drawAtlas`'s 7th argument and `drawImageRectOptions` take the
 *   renderer's numeric FilterMode/MipmapMode (0=Nearest, 1=Linear) — the wrapper
 *   maps them to the CK enum entries, with the two `FilterOptions` pre-created.
 */
export function createWebSkiaModule(kit: CanvasKit): FrameRendererModule {
  const atlasBuffers = makeAtlasBuffers();
  const ckSampling: CKSampling = {
    nearest: { filter: kit.FilterMode.Nearest, mipmap: kit.MipmapMode.None },
    linear: { filter: kit.FilterMode.Linear, mipmap: kit.MipmapMode.None },
  };

  const colorFilterFactory: ColorFilterFactoryLike = {
    MakeBlend(color, mode) {
      const blendMode =
        mode === BLEND_SRC_OVER
          ? kit.BlendMode.SrcOver
          : mode === BLEND_SRC_IN
            ? kit.BlendMode.SrcIn
            : mode === BLEND_SRC_ATOP
              ? kit.BlendMode.SrcATop
              : kit.BlendMode.SrcOver;
      return kit.ColorFilter.MakeBlend(color, blendMode) as ColorFilter;
    },
    MakeMatrix(matrix) {
      return kit.ColorFilter.MakeMatrix(matrix) as ColorFilter;
    },
  };

  const runtimeEffectFactory: RuntimeEffectFactoryLike = {
    Make(sksl) {
      const eff = kit.RuntimeEffect.Make(sksl);
      if (!eff) return null;
      return wrapRuntimeEffect(eff);
    },
  };

  const imageFilterFactory: ImageFilterFactoryLike = {
    MakeDropShadow(dx, dy, sigmaX, sigmaY, color, _input) {
      return kit.ImageFilter.MakeDropShadow(dx, dy, sigmaX, sigmaY, color, null) as ImageFilter;
    },
  };

  return {
    XYWHRect(x, y, w, h) {
      const r: RectLike = {
        x,
        y,
        width: w,
        height: h,
        setXYWH(nx, ny, nw, nh) {
          r.x = nx;
          r.y = ny;
          r.width = nw;
          r.height = nh;
        },
      };
      return r;
    },

    RSXform(scos, ssin, tx, ty) {
      // Carries the 4 fields so the drawAtlas wrapper can read them without allocation.
      const xf = {
        scos,
        ssin,
        tx,
        ty,
        set(s: number, si: number, nx: number, ny: number) {
          xf.scos = s;
          xf.ssin = si;
          xf.tx = nx;
          xf.ty = ny;
        },
      };
      return xf as RSXformLike;
    },

    Paint() {
      const p = new kit.Paint();
      const paint: CKPaintLike = {
        _ckPaint: p,
        setAlphaf: (a) => p.setAlphaf(a),
        setColor: (c) => p.setColor(c),
        setColorFilter: (f) => p.setColorFilter(f as ColorFilter | null),
        setShader: (s) => p.setShader(s as Shader | null),
        setImageFilter: (f) => p.setImageFilter(f as ImageFilter | null),
        setBlendMode: (m) => {
          const bm =
            m === BLEND_SRC_IN
              ? kit.BlendMode.SrcIn
              : m === BLEND_PLUS
                ? kit.BlendMode.Plus
                : kit.BlendMode.SrcOver;
          p.setBlendMode(bm);
        },
      };
      return paint;
    },

    PictureRecorder() {
      const rec = new kit.PictureRecorder();
      let wrapper: CKCanvasWrapper | null = null;
      const recorder: PictureRecorderLike = {
        beginRecording(bounds) {
          const r = bounds as RectLike;
          const ck = rec.beginRecording(kit.XYWHRect(r.x, r.y, r.width, r.height));
          if (wrapper === null) wrapper = wrapCKCanvas(ck, atlasBuffers, kit, ckSampling);
          else wrapper.bind(ck);
          return wrapper.surface;
        },
        finishRecordingAsPicture(): PictureLike {
          return rec.finishRecordingAsPicture();
        },
      };
      return recorder;
    },

    ColorFilter: colorFilterFactory,
    RuntimeEffect: runtimeEffectFactory,
    ImageFilter: imageFilterFactory,
  };
}
