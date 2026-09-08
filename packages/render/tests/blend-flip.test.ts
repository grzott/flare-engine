/**
 * Behavioural tests for additive blending and flipX/flipY rendering paths.
 */
import { describe, expect, it } from 'bun:test';
import type { SkImageLike, SpriteFrame } from '@flare-engine/assets';
import type { FrameRendererModule, PaintLike } from '../src/frame-renderer.js';
import { createFrameRenderer } from '../src/frame-renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import { SpriteBatch } from '../src/sprite-batch.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function mockImage(): SkImageLike {
  return { width: () => 64, height: () => 64, readPixels: () => null };
}

function frame(x = 0, y = 0, w = 32, h = 32): SpriteFrame {
  return { name: 'f', x, y, w, h };
}

type TrackPaint = PaintLike & {
  _alphaf: number;
  _blendMode: number | null;
};

type DrawRecord = { op: 'atlas' | 'imageRect' | 'save' | 'restore' | 'translate' | 'scale' };

function makeTrackingModule(): {
  mod: FrameRendererModule;
  draws: DrawRecord[];
  blendModes: number[];
} {
  const draws: DrawRecord[] = [];
  const blendModes: number[] = [];

  function makePaint(): TrackPaint {
    const p: TrackPaint = {
      _alphaf: 1,
      _blendMode: null,
      setAlphaf(a) {
        p._alphaf = a;
      },
      setColorFilter() {},
      setShader() {},
      setImageFilter() {},
      setBlendMode(mode) {
        blendModes.push(mode);
        p._blendMode = mode;
      },
    };
    return p;
  }

  const fakeCanvas = {
    save() {
      draws.push({ op: 'save' });
      return 0;
    },
    restore() {
      draws.push({ op: 'restore' });
    },
    translate() {
      draws.push({ op: 'translate' });
    },
    scale() {
      draws.push({ op: 'scale' });
    },
    rotate() {},
    clear() {},
    drawAtlas() {
      draws.push({ op: 'atlas' });
    },
    drawImageRect() {
      draws.push({ op: 'imageRect' });
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
    RSXform(_sc, _ss, _tx, _ty) {
      return { scos: 0, ssin: 0, tx: 0, ty: 0, set() {} };
    },
    Paint: makePaint,
    PictureRecorder() {
      return {
        beginRecording() {
          return fakeCanvas;
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

  return { mod, draws, blendModes };
}

// ---------------------------------------------------------------------------
// SpriteBatch — blend as batch key
// ---------------------------------------------------------------------------

describe('SpriteBatch — blend field', () => {
  it('draw() defaults blend to "normal"', () => {
    const batch = new SpriteBatch();
    batch.draw(mockImage(), frame(), 0, 0);
    const cmds: SpriteDrawCommand[] = [];
    batch.flush((_, c) => cmds.push(...c));
    expect(cmds[0]?.blend).toBe('normal');
  });

  it('draw() stores explicit blend value', () => {
    const batch = new SpriteBatch();
    batch.draw(
      mockImage(),
      frame(),
      0,
      0,
      undefined,
      undefined,
      undefined,
      0,
      0,
      1,
      0,
      false,
      'additive',
    );
    const cmds: SpriteDrawCommand[] = [];
    batch.flush((_, c) => cmds.push(...c));
    expect(cmds[0]?.blend).toBe('additive');
  });

  it('drawRaw() defaults blend to "normal"', () => {
    const batch = new SpriteBatch();
    batch.drawRaw(mockImage(), 0, 0, 16, 16, 0, 0, 16, 16);
    const cmds: SpriteDrawCommand[] = [];
    batch.flush((_, c) => cmds.push(...c));
    expect(cmds[0]?.blend).toBe('normal');
  });

  it('normal and additive sprites form separate runs (blend is a batch key)', () => {
    const batch = new SpriteBatch();
    const img = mockImage();
    // normal, additive, normal — three runs (not two)
    batch.draw(img, frame(), 0, 0, undefined, undefined, undefined, 0, 0, 1, 0, false, 'normal');
    batch.draw(img, frame(), 32, 0, undefined, undefined, undefined, 0, 0, 1, 0, false, 'additive');
    batch.draw(img, frame(), 64, 0, undefined, undefined, undefined, 0, 0, 1, 0, false, 'normal');
    const runs: string[] = [];
    batch.flush((_, c) => runs.push(c[0]?.blend ?? ''));
    expect(runs).toHaveLength(3);
    expect(runs[0]).toBe('normal');
    expect(runs[1]).toBe('additive');
    expect(runs[2]).toBe('normal');
  });

  it('consecutive additive sprites batch together', () => {
    const batch = new SpriteBatch();
    const img = mockImage();
    batch.draw(img, frame(), 0, 0, undefined, undefined, undefined, 0, 0, 1, 0, false, 'additive');
    batch.draw(img, frame(), 32, 0, undefined, undefined, undefined, 0, 0, 1, 0, false, 'additive');
    const runs: number[] = [];
    batch.flush((_, c) => runs.push(c.length));
    expect(runs).toHaveLength(1);
    expect(runs[0]).toBe(2);
  });

  it('blend field survives pool reuse', () => {
    const batch = new SpriteBatch();
    const img = mockImage();
    // First draw: additive; flush returns to pool
    batch.draw(img, frame(), 0, 0, undefined, undefined, undefined, 0, 0, 1, 0, false, 'additive');
    batch.flush(() => {});
    // Second draw: normal; must not carry the stale 'additive'
    batch.draw(img, frame(), 0, 0);
    const cmds: SpriteDrawCommand[] = [];
    batch.flush((_, c) => cmds.push(...c));
    expect(cmds[0]?.blend).toBe('normal');
  });
});

// ---------------------------------------------------------------------------
// SpriteBatch — flipX / flipY as batch key
// ---------------------------------------------------------------------------

describe('SpriteBatch — flipX / flipY fields', () => {
  it('draw() defaults flipX and flipY to false', () => {
    const batch = new SpriteBatch();
    batch.draw(mockImage(), frame(), 0, 0);
    const cmds: SpriteDrawCommand[] = [];
    batch.flush((_, c) => cmds.push(...c));
    expect(cmds[0]?.flipX).toBe(false);
    expect(cmds[0]?.flipY).toBe(false);
  });

  it('flipX=true sprites form a separate run from non-flipped', () => {
    const batch = new SpriteBatch();
    const img = mockImage();
    batch.draw(
      img,
      frame(),
      0,
      0,
      undefined,
      undefined,
      undefined,
      0,
      0,
      1,
      0,
      false,
      'normal',
      false,
      false,
    );
    batch.draw(
      img,
      frame(),
      32,
      0,
      undefined,
      undefined,
      undefined,
      0,
      0,
      1,
      0,
      false,
      'normal',
      true,
      false,
    );
    const runs: boolean[] = [];
    batch.flush((_, c) => runs.push(c[0]?.flipX ?? false));
    expect(runs).toHaveLength(2);
    expect(runs[0]).toBe(false);
    expect(runs[1]).toBe(true);
  });

  it('flipY=true sprites form a separate run from non-flipped', () => {
    const batch = new SpriteBatch();
    const img = mockImage();
    batch.draw(
      img,
      frame(),
      0,
      0,
      undefined,
      undefined,
      undefined,
      0,
      0,
      1,
      0,
      false,
      'normal',
      false,
      false,
    );
    batch.draw(
      img,
      frame(),
      32,
      0,
      undefined,
      undefined,
      undefined,
      0,
      0,
      1,
      0,
      false,
      'normal',
      false,
      true,
    );
    const runs: boolean[] = [];
    batch.flush((_, c) => runs.push(c[0]?.flipY ?? false));
    expect(runs).toHaveLength(2);
    expect(runs[0]).toBe(false);
    expect(runs[1]).toBe(true);
  });

  it('consecutive flipX=true sprites batch together', () => {
    const batch = new SpriteBatch();
    const img = mockImage();
    batch.draw(
      img,
      frame(),
      0,
      0,
      undefined,
      undefined,
      undefined,
      0,
      0,
      1,
      0,
      false,
      'normal',
      true,
      false,
    );
    batch.draw(
      img,
      frame(),
      32,
      0,
      undefined,
      undefined,
      undefined,
      0,
      0,
      1,
      0,
      false,
      'normal',
      true,
      false,
    );
    const runs: number[] = [];
    batch.flush((_, c) => runs.push(c.length));
    expect(runs).toHaveLength(1);
    expect(runs[0]).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// SpriteBatch — cullBounds accessor
// ---------------------------------------------------------------------------

describe('SpriteBatch — cullBounds', () => {
  it('cullBounds is null by default', () => {
    const batch = new SpriteBatch();
    expect(batch.cullBounds).toBeNull();
  });

  it('setCullBounds sets the bounds', () => {
    const batch = new SpriteBatch();
    batch.setCullBounds(10, 20, 300, 400);
    const cb = batch.cullBounds;
    expect(cb?.minX).toBe(10);
    expect(cb?.minY).toBe(20);
    expect(cb?.maxX).toBe(300);
    expect(cb?.maxY).toBe(400);
  });

  it('setCullBounds mutates the same object (zero-alloc in steady state)', () => {
    const batch = new SpriteBatch();
    batch.setCullBounds(0, 0, 100, 100);
    const ref1 = batch.cullBounds;
    batch.setCullBounds(5, 5, 200, 200);
    const ref2 = batch.cullBounds;
    expect(ref1).toBe(ref2);
    expect(ref2?.minX).toBe(5);
  });

  it('clearCullBounds resets to null', () => {
    const batch = new SpriteBatch();
    batch.setCullBounds(0, 0, 100, 100);
    batch.clearCullBounds();
    expect(batch.cullBounds).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// frame-renderer — additive blend triggers setBlendMode
// ---------------------------------------------------------------------------

describe('frame-renderer — additive blend', () => {
  it('normal blend does not call setBlendMode (stays SrcOver by default)', () => {
    const { mod, blendModes } = makeTrackingModule();
    const renderer = createFrameRenderer(mod);
    renderer.beginFrame(128, 128);
    const cmd: SpriteDrawCommand = {
      image: {} as SkImageLike,
      srcX: 0,
      srcY: 0,
      srcW: 32,
      srcH: 32,
      dstX: 0,
      dstY: 0,
      dstW: 32,
      dstH: 32,
      effect: undefined,
      alpha: 1,
      rotation: 0,
      anchorX: 0,
      anchorY: 0,
      stretch: false,
      blend: 'normal',
      flipX: false,
      flipY: false,
    };
    renderer.drawAtlas({} as SkImageLike, [cmd]);
    // No setBlendMode calls for normal blend
    expect(blendModes).toHaveLength(0);
  });

  it('additive blend calls setBlendMode with Plus (12) before draw and resets to SrcOver (3) after', () => {
    const { mod, blendModes } = makeTrackingModule();
    const renderer = createFrameRenderer(mod);
    renderer.beginFrame(128, 128);
    const cmd: SpriteDrawCommand = {
      image: {} as SkImageLike,
      srcX: 0,
      srcY: 0,
      srcW: 32,
      srcH: 32,
      dstX: 0,
      dstY: 0,
      dstW: 32,
      dstH: 32,
      effect: undefined,
      alpha: 1,
      rotation: 0,
      anchorX: 0,
      anchorY: 0,
      stretch: false,
      blend: 'additive',
      flipX: false,
      flipY: false,
    };
    renderer.drawAtlas({} as SkImageLike, [cmd]);
    expect(blendModes).toHaveLength(2);
    expect(blendModes[0]).toBe(12); // BLEND_PLUS before
    expect(blendModes[1]).toBe(3); // BLEND_SRC_OVER after
  });

  it('additive blend on stretch path also calls setBlendMode', () => {
    const { mod, blendModes } = makeTrackingModule();
    const renderer = createFrameRenderer(mod);
    renderer.beginFrame(128, 128);
    const cmd: SpriteDrawCommand = {
      image: {} as SkImageLike,
      srcX: 0,
      srcY: 0,
      srcW: 32,
      srcH: 32,
      dstX: 0,
      dstY: 0,
      dstW: 64,
      dstH: 32,
      effect: undefined,
      alpha: 1,
      rotation: 0,
      anchorX: 0,
      anchorY: 0,
      stretch: true,
      blend: 'additive',
      flipX: false,
      flipY: false,
    };
    renderer.drawAtlas({} as SkImageLike, [cmd]);
    expect(blendModes).toHaveLength(2);
    expect(blendModes[0]).toBe(12);
    expect(blendModes[1]).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// frame-renderer — flipX / flipY draw path
// ---------------------------------------------------------------------------

describe('frame-renderer — flipX / flipY', () => {
  it('non-flipped sprite uses drawAtlas (no save/restore)', () => {
    const { mod, draws } = makeTrackingModule();
    const renderer = createFrameRenderer(mod);
    renderer.beginFrame(128, 128);
    const cmd: SpriteDrawCommand = {
      image: {} as SkImageLike,
      srcX: 0,
      srcY: 0,
      srcW: 32,
      srcH: 32,
      dstX: 0,
      dstY: 0,
      dstW: 32,
      dstH: 32,
      effect: undefined,
      alpha: 1,
      rotation: 0,
      anchorX: 0,
      anchorY: 0,
      stretch: false,
      blend: 'normal',
      flipX: false,
      flipY: false,
    };
    renderer.drawAtlas({} as SkImageLike, [cmd]);
    expect(draws.some((d) => d.op === 'atlas')).toBe(true);
    expect(draws.some((d) => d.op === 'save')).toBe(false);
    expect(draws.some((d) => d.op === 'imageRect')).toBe(false);
  });

  it('flipX=true uses drawImageRect with save/restore/translate/scale sequence', () => {
    const { mod, draws } = makeTrackingModule();
    const renderer = createFrameRenderer(mod);
    renderer.beginFrame(128, 128);
    const cmd: SpriteDrawCommand = {
      image: {} as SkImageLike,
      srcX: 0,
      srcY: 0,
      srcW: 32,
      srcH: 32,
      dstX: 10,
      dstY: 20,
      dstW: 32,
      dstH: 32,
      effect: undefined,
      alpha: 1,
      rotation: 0,
      anchorX: 0,
      anchorY: 0,
      stretch: false,
      blend: 'normal',
      flipX: true,
      flipY: false,
    };
    renderer.drawAtlas({} as SkImageLike, [cmd]);
    expect(draws.some((d) => d.op === 'save')).toBe(true);
    expect(draws.some((d) => d.op === 'scale')).toBe(true);
    expect(draws.some((d) => d.op === 'imageRect')).toBe(true);
    expect(draws.some((d) => d.op === 'restore')).toBe(true);
    expect(draws.some((d) => d.op === 'atlas')).toBe(false);
  });

  it('flipY=true uses drawImageRect with save/restore/translate/scale sequence', () => {
    const { mod, draws } = makeTrackingModule();
    const renderer = createFrameRenderer(mod);
    renderer.beginFrame(128, 128);
    const cmd: SpriteDrawCommand = {
      image: {} as SkImageLike,
      srcX: 0,
      srcY: 0,
      srcW: 32,
      srcH: 32,
      dstX: 0,
      dstY: 0,
      dstW: 32,
      dstH: 32,
      effect: undefined,
      alpha: 1,
      rotation: 0,
      anchorX: 0,
      anchorY: 0,
      stretch: false,
      blend: 'normal',
      flipX: false,
      flipY: true,
    };
    renderer.drawAtlas({} as SkImageLike, [cmd]);
    expect(draws.some((d) => d.op === 'save')).toBe(true);
    expect(draws.some((d) => d.op === 'imageRect')).toBe(true);
  });

  it('two flipX=true sprites each get their own save/restore pair', () => {
    const { mod, draws } = makeTrackingModule();
    const renderer = createFrameRenderer(mod);
    renderer.beginFrame(128, 128);
    const mkCmd = (x: number): SpriteDrawCommand => ({
      image: {} as SkImageLike,
      srcX: 0,
      srcY: 0,
      srcW: 32,
      srcH: 32,
      dstX: x,
      dstY: 0,
      dstW: 32,
      dstH: 32,
      effect: undefined,
      alpha: 1,
      rotation: 0,
      anchorX: 0,
      anchorY: 0,
      stretch: false,
      blend: 'normal',
      flipX: true,
      flipY: false,
    });
    renderer.drawAtlas({} as SkImageLike, [mkCmd(0), mkCmd(40)]);
    const saveCount = draws.filter((d) => d.op === 'save').length;
    const restoreCount = draws.filter((d) => d.op === 'restore').length;
    const rectCount = draws.filter((d) => d.op === 'imageRect').length;
    expect(saveCount).toBe(2);
    expect(restoreCount).toBe(2);
    expect(rectCount).toBe(2);
  });

  it('flipX=true on stretch=true sprite also uses the flip canvas transform', () => {
    const { mod, draws } = makeTrackingModule();
    const renderer = createFrameRenderer(mod);
    renderer.beginFrame(128, 128);
    const cmd: SpriteDrawCommand = {
      image: {} as SkImageLike,
      srcX: 0,
      srcY: 0,
      srcW: 32,
      srcH: 32,
      dstX: 0,
      dstY: 0,
      dstW: 64,
      dstH: 32,
      effect: undefined,
      alpha: 1,
      rotation: 0,
      anchorX: 0,
      anchorY: 0,
      stretch: true,
      blend: 'normal',
      flipX: true,
      flipY: false,
    };
    renderer.drawAtlas({} as SkImageLike, [cmd]);
    expect(draws.some((d) => d.op === 'save')).toBe(true);
    expect(draws.some((d) => d.op === 'imageRect')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SpriteBatch integration — new fields round-trip through flush
// ---------------------------------------------------------------------------

describe('SpriteBatch — blend/flip round-trip', () => {
  it('drawRaw passes blend and flip to the command', () => {
    const batch = new SpriteBatch();
    batch.drawRaw(
      mockImage(),
      0,
      0,
      16,
      16,
      0,
      0,
      16,
      16,
      undefined,
      0,
      0,
      1,
      0,
      false,
      'additive',
      true,
      true,
    );
    const cmds: SpriteDrawCommand[] = [];
    batch.flush((_, c) => cmds.push(...c));
    expect(cmds[0]?.blend).toBe('additive');
    expect(cmds[0]?.flipX).toBe(true);
    expect(cmds[0]?.flipY).toBe(true);
  });
});
