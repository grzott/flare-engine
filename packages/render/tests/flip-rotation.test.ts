/**
 * A flipped sprite draws with its `rotation`: the frame renderer rotates
 * about the anchor pivot (as the atlas path does), then mirrors about the
 * sprite centre. The recording canvas below keeps a real 2D affine matrix so
 * the assertions are on where the dst rect's corners land, not on op names.
 */
import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { FrameRendererModule, PaintLike, RectLike } from '../src/frame-renderer.js';
import { createFrameRenderer } from '../src/frame-renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';

// ---------------------------------------------------------------------------
// 2D affine helpers — x' = a*x + c*y + e, y' = b*x + d*y + f
// ---------------------------------------------------------------------------

interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

type Point = readonly [number, number];
type Corners = readonly [Point, Point, Point, Point];

function identity(): Affine {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

/** M ∘ N — the result applies N to geometry first, then M (canvas concat). */
function concat(m: Affine, n: Affine): Affine {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

function apply(m: Affine, p: Point): Point {
  return [m.a * p[0] + m.c * p[1] + m.e, m.b * p[0] + m.d * p[1] + m.f];
}

function rectCorners(x: number, y: number, w: number, h: number): Corners {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

function expectCornersClose(actual: Corners, expected: Corners): void {
  for (let i = 0; i < 4; i++) {
    expect(Math.abs(actual[i]![0] - expected[i]![0])).toBeLessThan(1e-9);
    expect(Math.abs(actual[i]![1] - expected[i]![1])).toBeLessThan(1e-9);
  }
}

// ---------------------------------------------------------------------------
// Recording module — tracks the canvas matrix and the RSXforms it is handed
// ---------------------------------------------------------------------------

type Op = 'save' | 'restore' | 'translate' | 'scale' | 'rotate' | 'imageRect' | 'atlas';

interface Recorded {
  ops: Op[];
  /** The dst rect's four corners, mapped through the canvas matrix, per drawImageRect. */
  imageRects: Corners[];
  /** The (scos, ssin, tx, ty) each RSXform last received via `set`. */
  xforms: Array<{ scos: number; ssin: number; tx: number; ty: number }>;
  /** The src rects handed to drawAtlas, in order. */
  atlasSrcs: RectLike[];
}

function makeRecordingModule(): { mod: FrameRendererModule; rec: Recorded } {
  const rec: Recorded = { ops: [], imageRects: [], xforms: [], atlasSrcs: [] };
  let matrix = identity();
  const stack: Affine[] = [];

  function makePaint(): PaintLike {
    return {
      setAlphaf() {},
      setColorFilter() {},
      setShader() {},
      setImageFilter() {},
      setBlendMode() {},
    };
  }

  const canvas = {
    save() {
      rec.ops.push('save');
      stack.push(matrix);
      return stack.length;
    },
    restore() {
      rec.ops.push('restore');
      matrix = stack.pop() ?? identity();
    },
    translate(x: number, y: number) {
      rec.ops.push('translate');
      matrix = concat(matrix, { a: 1, b: 0, c: 0, d: 1, e: x, f: y });
    },
    scale(sx: number, sy: number) {
      rec.ops.push('scale');
      matrix = concat(matrix, { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 });
    },
    rotate(degrees: number, cx: number, cy: number) {
      rec.ops.push('rotate');
      const r = (degrees * Math.PI) / 180;
      const c = Math.cos(r);
      const s = Math.sin(r);
      matrix = concat(matrix, { a: 1, b: 0, c: 0, d: 1, e: cx, f: cy });
      matrix = concat(matrix, { a: c, b: s, c: -s, d: c, e: 0, f: 0 });
      matrix = concat(matrix, { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy });
    },
    clear() {},
    drawAtlas(_image: unknown, srcs: RectLike[]) {
      rec.ops.push('atlas');
      rec.atlasSrcs.push(...srcs);
    },
    drawImageRect(_image: unknown, _src: RectLike, dst: RectLike) {
      rec.ops.push('imageRect');
      const corners = rectCorners(dst.x, dst.y, dst.width, dst.height);
      rec.imageRects.push([
        apply(matrix, corners[0]),
        apply(matrix, corners[1]),
        apply(matrix, corners[2]),
        apply(matrix, corners[3]),
      ]);
    },
    drawRect() {},
  };

  const mod: FrameRendererModule = {
    XYWHRect(x, y, w, h) {
      const r = {
        x,
        y,
        width: w,
        height: h,
        setXYWH(nx: number, ny: number, nw: number, nh: number) {
          r.x = nx;
          r.y = ny;
          r.width = nw;
          r.height = nh;
        },
      };
      return r;
    },
    RSXform(scos, ssin, tx, ty) {
      const entry = { scos, ssin, tx, ty };
      rec.xforms.push(entry);
      return {
        scos,
        ssin,
        tx,
        ty,
        set(nscos: number, nssin: number, ntx: number, nty: number) {
          entry.scos = nscos;
          entry.ssin = nssin;
          entry.tx = ntx;
          entry.ty = nty;
        },
      };
    },
    Paint: makePaint,
    PictureRecorder() {
      return {
        beginRecording() {
          return canvas;
        },
        finishRecordingAsPicture() {
          return {};
        },
      };
    },
    ColorFilter: {
      MakeBlend() {
        return {};
      },
      MakeMatrix() {
        return {};
      },
    },
  };

  return { mod, rec };
}

function cmdOf(o: Partial<SpriteDrawCommand>): SpriteDrawCommand {
  return {
    image: {} as SkImageLike,
    srcX: 0,
    srcY: 0,
    srcW: 16,
    srcH: 16,
    dstX: 0,
    dstY: 0,
    dstW: 16,
    dstH: 16,
    effect: undefined,
    alpha: 1,
    rotation: 0,
    anchorX: 0,
    anchorY: 0,
    stretch: false,
    blend: 'normal',
    flipX: false,
    flipY: false,
    ...o,
  };
}

function drawOne(cmd: SpriteDrawCommand): Recorded {
  const { mod, rec } = makeRecordingModule();
  const renderer = createFrameRenderer(mod);
  renderer.beginFrame(128, 128);
  renderer.drawAtlas({} as SkImageLike, [cmd]);
  return rec;
}

/** Independent model: mirror about the dst centre, then rotate about the anchor pivot. */
function expectedFlippedCorners(cmd: SpriteDrawCommand): Corners {
  const cx = cmd.dstX + cmd.dstW * 0.5;
  const cy = cmd.dstY + cmd.dstH * 0.5;
  const px = cmd.dstX + cmd.anchorX * cmd.dstW;
  const py = cmd.dstY + cmd.anchorY * cmd.dstH;
  const c = Math.cos(cmd.rotation);
  const s = Math.sin(cmd.rotation);
  const map = (p: Point): Point => {
    const mx = cmd.flipX ? 2 * cx - p[0] : p[0];
    const my = cmd.flipY ? 2 * cy - p[1] : p[1];
    const dx = mx - px;
    const dy = my - py;
    return [px + c * dx - s * dy, py + s * dx + c * dy];
  };
  const src = rectCorners(cmd.dstX, cmd.dstY, cmd.dstW, cmd.dstH);
  return [map(src[0]), map(src[1]), map(src[2]), map(src[3])];
}

// ---------------------------------------------------------------------------

describe('frame-renderer — flipped sprite honours rotation', () => {
  it('flipY + 90° CW about the centre is a transpose (Tiled D-alone)', () => {
    const rec = drawOne(cmdOf({ flipY: true, rotation: Math.PI / 2, anchorX: 0.5, anchorY: 0.5 }));
    expect(rec.imageRects).toHaveLength(1);
    expectCornersClose(rec.imageRects[0]!, [
      [0, 0],
      [0, 16],
      [16, 16],
      [16, 0],
    ]);
  });

  it('non-centre anchor with offset dst: mirror about centre, then rotate about the pivot', () => {
    const cmd = cmdOf({
      srcW: 32,
      srcH: 32,
      dstX: 10,
      dstY: 20,
      dstW: 32,
      dstH: 32,
      flipX: true,
      rotation: Math.PI / 2,
    });
    const rec = drawOne(cmd);
    expect(rec.imageRects).toHaveLength(1);
    const got = rec.imageRects[0]!;
    expectCornersClose(got, expectedFlippedCorners(cmd));
    // Spelled out: centre (26,36), pivot (10,20).
    expectCornersClose(got, [
      [10, 52],
      [10, 20],
      [-22, 20],
      [-22, 52],
    ]);
  });

  it('matches the atlas path for the same command with the flip off (mirrored corner order)', () => {
    const base = cmdOf({
      srcW: 32,
      srcH: 32,
      dstX: 10,
      dstY: 20,
      dstW: 32,
      dstH: 32,
      rotation: Math.PI / 2,
    });
    const atlas = drawOne(base);
    expect(atlas.ops).toContain('atlas');
    expect(atlas.atlasSrcs).toHaveLength(1);
    const xf = atlas.xforms[0]!;
    const src = atlas.atlasSrcs[0]!;
    const viaXform = (p: Point): Point => [
      xf.scos * p[0] - xf.ssin * p[1] + xf.tx,
      xf.ssin * p[0] + xf.scos * p[1] + xf.ty,
    ];
    const local = rectCorners(0, 0, src.width, src.height);
    const atlasCorners: Corners = [
      viaXform(local[0]),
      viaXform(local[1]),
      viaXform(local[2]),
      viaXform(local[3]),
    ];

    const flipped = drawOne({ ...base, flipX: true }).imageRects[0]!;
    // flipX swaps TL<->TR and BL<->BR.
    expectCornersClose(flipped, [
      atlasCorners[1],
      atlasCorners[0],
      atlasCorners[3],
      atlasCorners[2],
    ]);
  });

  it('a flip with zero rotation records exactly the previous op sequence (no rotate)', () => {
    const rec = drawOne(cmdOf({ flipX: true, dstX: 10, dstY: 20 }));
    expect(rec.ops).toEqual(['save', 'translate', 'scale', 'translate', 'imageRect', 'restore']);
  });

  it('a flipped command with rotation still uses exactly one save and one restore', () => {
    const rec = drawOne(
      cmdOf({ flipX: true, flipY: true, rotation: 0.3, anchorX: 0.5, anchorY: 1 }),
    );
    expect(rec.ops.filter((o) => o === 'save')).toHaveLength(1);
    expect(rec.ops.filter((o) => o === 'restore')).toHaveLength(1);
    expect(rec.ops.filter((o) => o === 'rotate')).toHaveLength(1);
    expect(rec.ops[0]).toBe('save');
    expect(rec.ops[rec.ops.length - 1]).toBe('restore');
  });
});
