import type {
  ColorFilterFactoryLike,
  DrawSurfaceLike,
  FrameRendererModule,
  ImageFilterFactoryLike,
  PaintLike,
  PictureLike,
  PictureRecorderLike,
  RSXformLike,
  RectLike,
  RuntimeEffectFactoryLike,
  RuntimeEffectLike,
} from '@flare-engine/render';
import type {
  Canvas as CKCanvas,
  Image as CKImage,
  Paint as CKPaint,
  CanvasKit,
  ColorFilter,
  ImageFilter,
  RuntimeEffect,
  Shader,
} from 'canvaskit-wasm';

// Internal interface: extends PaintLike with the raw CK Paint handle.
// Only used within this module so CK-specific types do not leak into PaintLike.
interface CKPaintLike extends PaintLike {
  readonly _ckPaint: CKPaint;
}

// Numeric BlendMode constants inlined (stable CK ABI).
// CK's BlendMode enum values: SrcOver=3, SrcIn=5.
const BLEND_SRC_OVER = 3;
const BLEND_SRC_IN = 5;

// Grow-only flat Float32Array scratch buffers for flattening drawAtlas args.
// Each instance of createWebSkiaModule gets its own pair.
function makeAtlasBuffers(): {
  srcs: Float32Array;
  xforms: Float32Array;
  ensureCapacity(n: number): void;
} {
  let srcs = new Float32Array(32 * 4);
  let xforms = new Float32Array(32 * 4);

  return {
    get srcs() {
      return srcs;
    },
    get xforms() {
      return xforms;
    },
    ensureCapacity(n: number): void {
      if (n * 4 > srcs.length) {
        let cap = srcs.length;
        while (cap < n * 4) cap *= 2;
        srcs = new Float32Array(cap);
        xforms = new Float32Array(cap);
      }
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

function wrapCKCanvas(
  ck: CKCanvas,
  atlasBuffers: ReturnType<typeof makeAtlasBuffers>,
): DrawSurfaceLike {
  // Pre-allocated LTRB scratch buffers for zero-alloc drawImageRect / drawRect.
  // CK accepts a Float32Array as InputRect (LTRB layout).
  const imgSrcScratch = new Float32Array(4);
  const imgDstScratch = new Float32Array(4);

  return {
    save: () => ck.save(),
    restore: () => ck.restore(),
    translate: (x, y) => ck.translate(x, y),
    scale: (sx, sy) => ck.scale(sx, sy),
    // Forwarded verbatim to match the native bridge (no radians→degrees conversion).
    // Both RN-Skia and CanvasKit Canvas.rotate take degrees; the engine labels the
    // param "radians" — a pre-existing dormant mismatch tracked for a cross-backend fix.
    rotate: (radians, cx, cy) => ck.rotate(radians, cx, cy),
    clear: (color) => ck.clear(color),
    drawAtlas(image, srcRects, dstXforms, paint) {
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
      ck.drawAtlas(
        image as CKImage,
        atlasBuffers.srcs.subarray(0, n * 4),
        atlasBuffers.xforms.subarray(0, n * 4),
        rawPaint(paint),
        null,
        null,
      );
    },
    drawImageRect(image, src, dst, paint) {
      const s = src as RectLike;
      imgSrcScratch[0] = s.x;
      imgSrcScratch[1] = s.y;
      imgSrcScratch[2] = s.x + s.width;
      imgSrcScratch[3] = s.y + s.height;
      const d = dst as RectLike;
      imgDstScratch[0] = d.x;
      imgDstScratch[1] = d.y;
      imgDstScratch[2] = d.x + d.width;
      imgDstScratch[3] = d.y + d.height;
      ck.drawImageRect(image as CKImage, imgSrcScratch, imgDstScratch, rawPaint(paint), false);
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
}

function wrapRuntimeEffect(eff: RuntimeEffect): RuntimeEffectLike {
  return {
    makeShader: (uniforms) => eff.makeShader(uniforms) as Shader,
    getUniformCount: () => eff.getUniformCount(),
    getUniformFloatCount: () => eff.getUniformFloatCount(),
    getUniformName: (i) => eff.getUniformName(i),
    getUniform: (i) => {
      const u = eff.getUniform(i);
      return { columns: u.columns, rows: u.rows, slot: u.slot };
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
 * - `rotate` is forwarded verbatim (no radians→degrees conversion) to match
 *   the native bridge; the dormant radians/degrees mismatch is tracked separately.
 * - `ColorFilter.MakeBlend(color, mode)` takes an EmbindEnumEntity — the
 *   wrapper maps the numeric literal (3=SrcOver, 5=SrcIn) to the CK enum.
 * - `RSXform` objects carry `scos/ssin/tx/ty` fields for flat-array flattening.
 */
export function createWebSkiaModule(kit: CanvasKit): FrameRendererModule {
  const atlasBuffers = makeAtlasBuffers();

  const colorFilterFactory: ColorFilterFactoryLike = {
    MakeBlend(color, mode) {
      const blendMode =
        mode === BLEND_SRC_OVER
          ? kit.BlendMode.SrcOver
          : mode === BLEND_SRC_IN
            ? kit.BlendMode.SrcIn
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
      };
      return paint;
    },

    PictureRecorder() {
      const rec = new kit.PictureRecorder();
      const recorder: PictureRecorderLike = {
        beginRecording(bounds) {
          const r = bounds as RectLike;
          const ck = rec.beginRecording(kit.XYWHRect(r.x, r.y, r.width, r.height));
          return wrapCKCanvas(ck, atlasBuffers);
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
