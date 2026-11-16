import type { FrameRenderer } from '@flare-engine/render';
import type {
  CanvasKit,
  Canvas as CKCanvas,
  Paint as CKPaint,
  Path as CKPath,
  PathBuilder,
} from 'canvaskit-wasm';

/** Paint handle of a `WebShapeSkia`. `setStyle` takes 0 (fill) or 1 (stroke). */
export interface WebShapePaint {
  setColor(color: Float32Array): void;
  setStyle(style: number): void;
  setStrokeWidth(width: number): void;
}

/** Mutable path handle of a `WebShapeSkia`. `addArc` takes degrees. */
export interface WebShapePath {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  close(): void;
  addArc(oval: Float32Array, startDeg: number, sweepDeg: number): void;
}

/** Canvas of a `WebShapeSurface`. `rotate` takes degrees. */
export interface WebShapeCanvas {
  save(): number;
  restore(): void;
  translate(dx: number, dy: number): void;
  scale(sx: number, sy: number): void;
  rotate(degrees: number, rx: number, ry: number): void;
  clear(color: Float32Array): void;
  drawCircle(cx: number, cy: number, r: number, paint: WebShapePaint): void;
  drawRect(rect: Float32Array, paint: WebShapePaint): void;
  drawPath(path: WebShapePath, paint: WebShapePaint): void;
}

/** A CPU-raster CanvasKit surface made by `WebShapeSkia.Surface.Make`. */
export interface WebShapeSurface {
  getCanvas(): WebShapeCanvas;
  /** Flush and snapshot. The image owns its pixels and outlives `dispose()`. */
  makeImageSnapshot(): Parameters<FrameRenderer['drawAtlas']>[0];
  /**
   * Free the surface, and every paint and path the handle has created so far.
   * Neither the surface nor those may be used afterwards.
   */
  dispose(): void;
}

/**
 * A CanvasKit-backed stand-in for the react-native-skia `Skia` handle, limited
 * to what `@flare-engine/shapes` reads: `drawShape` and `bakeShapeAtlas`.
 */
export interface WebShapeSkia {
  Surface: { Make(width: number, height: number): WebShapeSurface | null };
  Paint(): WebShapePaint;
  Path: {
    Make(): WebShapePath;
    /** `null` when CanvasKit cannot parse `d`. */
    MakeFromSVGString(d: string): WebShapePath | null;
  };
  /** An LTRB `Float32Array`, as CanvasKit takes rects. */
  XYWHRect(x: number, y: number, w: number, h: number): Float32Array;
}

// The path-building calls shared by CanvasKit's PathBuilder (0.41+) and its
// Path, which was itself mutable up to 0.40.
interface PathSink {
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  close(): unknown;
  addArc(oval: Float32Array, startDeg: number, sweepDeg: number): unknown;
  delete(): void;
}

interface CKShapePaint extends WebShapePaint {
  readonly _ckPaint: CKPaint;
}

interface CKShapePath extends WebShapePath {
  _draw(canvas: CKCanvas, paint: CKPaint): void;
}

/**
 * Create a `WebShapeSkia` over CanvasKit, so `bakeShapeAtlas` from
 * `@flare-engine/shapes` can rasterize on web:
 * `bakeShapeAtlas(createWebShapeSkia(kit), specs, scale)`.
 *
 * `Surface.Make` is CanvasKit's offscreen CPU surface (`MakeSurface`), so the
 * bake needs no WebGL context. Paints are anti-aliased, as react-native-skia's
 * are by default.
 *
 * CanvasKit objects are not garbage-collected. The handle remembers every
 * paint and path it creates and frees them when a surface is disposed, which
 * `bakeShapeAtlas` does after its snapshot. It is meant for baking: a
 * handle used to draw shapes every frame with no surface to dispose keeps
 * all of those objects alive.
 */
export function createWebShapeSkia(kit: CanvasKit): WebShapeSkia {
  const live: { delete(): void }[] = [];
  const hasBuilder = typeof kit.PathBuilder === 'function';

  function wrapPath(sink: PathSink, draw: (canvas: CKCanvas, paint: CKPaint) => void): CKShapePath {
    live.push(sink);
    return {
      _draw: draw,
      moveTo: (x, y) => {
        sink.moveTo(x, y);
      },
      lineTo: (x, y) => {
        sink.lineTo(x, y);
      },
      close: () => {
        sink.close();
      },
      addArc: (oval, startDeg, sweepDeg) => {
        sink.addArc(oval, startDeg, sweepDeg);
      },
    };
  }

  function wrapBuilder(builder: PathBuilder): CKShapePath {
    return wrapPath(builder, (canvas, paint) => {
      const path = builder.snapshot();
      canvas.drawPath(path, paint);
      path.delete();
    });
  }

  // CanvasKit 0.40: the Path is the builder and is drawn as it stands.
  function wrapMutablePath(path: CKPath): CKShapePath {
    return wrapPath(path as CKPath & PathSink, (canvas, paint) => canvas.drawPath(path, paint));
  }

  const rawPaint = (paint: WebShapePaint): CKPaint => (paint as CKShapePaint)._ckPaint;

  return {
    Surface: {
      Make(width, height) {
        const surface = kit.MakeSurface(width, height);
        if (!surface) return null;
        const ck = surface.getCanvas();
        const canvas: WebShapeCanvas = {
          save: () => ck.save(),
          restore: () => ck.restore(),
          translate: (dx, dy) => ck.translate(dx, dy),
          scale: (sx, sy) => ck.scale(sx, sy),
          rotate: (degrees, rx, ry) => ck.rotate(degrees, rx, ry),
          clear: (color) => ck.clear(color),
          drawCircle: (cx, cy, r, paint) => ck.drawCircle(cx, cy, r, rawPaint(paint)),
          drawRect: (rect, paint) => ck.drawRect(rect, rawPaint(paint)),
          drawPath: (path, paint) => (path as CKShapePath)._draw(ck, rawPaint(paint)),
        };
        return {
          getCanvas: () => canvas,
          makeImageSnapshot() {
            surface.flush();
            return surface.makeImageSnapshot() as unknown as ReturnType<
              WebShapeSurface['makeImageSnapshot']
            >;
          },
          dispose() {
            surface.delete();
            for (const object of live) object.delete();
            live.length = 0;
          },
        };
      },
    },

    Paint() {
      const p = new kit.Paint();
      p.setAntiAlias(true);
      live.push(p);
      const paint: CKShapePaint = {
        _ckPaint: p,
        setColor: (color) => p.setColor(color),
        // CanvasKit takes its enum entries, not the 0/1 react-native-skia accepts.
        setStyle: (style) => p.setStyle(style === 1 ? kit.PaintStyle.Stroke : kit.PaintStyle.Fill),
        setStrokeWidth: (width) => p.setStrokeWidth(width),
      };
      return paint;
    },

    Path: {
      Make() {
        return hasBuilder ? wrapBuilder(new kit.PathBuilder()) : wrapMutablePath(new kit.Path());
      },
      MakeFromSVGString(d) {
        const parsed = kit.Path.MakeFromSVGString(d);
        if (parsed === null) return null;
        if (!hasBuilder) return wrapMutablePath(parsed);
        const builder = new kit.PathBuilder(parsed);
        parsed.delete();
        return wrapBuilder(builder);
      },
    },

    XYWHRect: (x, y, w, h) => kit.XYWHRect(x, y, w, h),
  };
}
