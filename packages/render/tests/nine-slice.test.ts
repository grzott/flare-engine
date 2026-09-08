/**
 * Behavioural tests for drawNineSlice.
 */
import { describe, expect, it } from 'bun:test';
import type { SkImageLike, SpriteFrame } from '@flare-engine/assets';
import { drawNineSlice } from '../src/nine-slice.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import { SpriteBatch } from '../src/sprite-batch.js';
import { tint } from '../src/sprite-effects.js';

function mockImage(): SkImageLike {
  return { width: () => 64, height: () => 64, readPixels: () => null };
}

function frame(w = 64, h = 64): SpriteFrame {
  return { name: 'f', x: 0, y: 0, w, h };
}

function collectCmds(fn: (batch: SpriteBatch) => void): SpriteDrawCommand[] {
  const batch = new SpriteBatch();
  fn(batch);
  const cmds: SpriteDrawCommand[] = [];
  batch.flush((_, c) => cmds.push(...c));
  return cmds;
}

// ---------------------------------------------------------------------------
// Slice count
// ---------------------------------------------------------------------------

describe('drawNineSlice — slice count', () => {
  it('emits exactly 9 draw commands for a regular sprite', () => {
    const img = mockImage();
    const cmds = collectCmds((b) => drawNineSlice(b, img, frame(), 0, 0, 128, 64, 8));
    expect(cmds).toHaveLength(9);
  });

  it('all commands use stretch=true (drawImageRect path)', () => {
    const img = mockImage();
    const cmds = collectCmds((b) => drawNineSlice(b, img, frame(), 0, 0, 128, 64, 8));
    expect(cmds.every((c) => c.stretch)).toBe(true);
  });

  it('skips the centre slice when dst is exactly 2×inset (zero-area centre)', () => {
    const img = mockImage();
    // dst 16×16 with inset 8 → dstMidW = 0, dstMidH = 0 → 4 slices skipped (edges + centre)
    const cmds = collectCmds((b) => drawNineSlice(b, img, frame(), 0, 0, 16, 16, 8));
    // corners: 4, edges: 0 (dstMidW=0), centre: 0 → 4
    expect(cmds).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Source rectangle correctness
// ---------------------------------------------------------------------------

describe('drawNineSlice — source rects', () => {
  it('top-left corner srcX/srcY matches frame origin', () => {
    const img = mockImage();
    const fr: SpriteFrame = { name: 'f', x: 10, y: 20, w: 64, h: 64 };
    const cmds = collectCmds((b) => drawNineSlice(b, img, fr, 0, 0, 128, 128, 8));
    // First command should be the top-left corner slice
    const tl = cmds[0]!;
    expect(tl.srcX).toBe(10);
    expect(tl.srcY).toBe(20);
    expect(tl.srcW).toBe(8);
    expect(tl.srcH).toBe(8);
  });

  it('top-right corner srcX is frame.x + frame.w - inset', () => {
    const img = mockImage();
    const fr: SpriteFrame = { name: 'f', x: 0, y: 0, w: 64, h: 64 };
    const cmds = collectCmds((b) => drawNineSlice(b, img, fr, 0, 0, 128, 128, 8));
    const tr = cmds[2]!;
    expect(tr.srcX).toBe(56); // 0 + 64 - 8
    expect(tr.srcY).toBe(0);
    expect(tr.srcW).toBe(8);
  });

  it('centre srcW and srcH equal frame dimensions minus 2×inset', () => {
    const img = mockImage();
    const fr: SpriteFrame = { name: 'f', x: 0, y: 0, w: 64, h: 48 };
    const cmds = collectCmds((b) => drawNineSlice(b, img, fr, 0, 0, 200, 100, 10));
    const centre = cmds[4]!;
    expect(centre.srcW).toBe(44); // 64 - 2*10
    expect(centre.srcH).toBe(28); // 48 - 2*10
  });
});

// ---------------------------------------------------------------------------
// Destination rectangle correctness
// ---------------------------------------------------------------------------

describe('drawNineSlice — destination rects', () => {
  it('top-left corner dst matches (x, y, inset, inset)', () => {
    const img = mockImage();
    const cmds = collectCmds((b) => drawNineSlice(b, img, frame(), 50, 30, 200, 100, 10));
    const tl = cmds[0]!;
    expect(tl.dstX).toBe(50);
    expect(tl.dstY).toBe(30);
    expect(tl.dstW).toBe(10);
    expect(tl.dstH).toBe(10);
  });

  it('centre dst covers the middle area', () => {
    const img = mockImage();
    const cmds = collectCmds((b) => drawNineSlice(b, img, frame(), 0, 0, 200, 100, 10));
    const centre = cmds[4]!;
    expect(centre.dstX).toBe(10);
    expect(centre.dstY).toBe(10);
    expect(centre.dstW).toBe(180); // 200 - 2*10
    expect(centre.dstH).toBe(80); // 100 - 2*10
  });

  it('bottom-right corner dst aligns to the far corner', () => {
    const img = mockImage();
    const cmds = collectCmds((b) => drawNineSlice(b, img, frame(), 0, 0, 200, 100, 10));
    const br = cmds[8]!;
    expect(br.dstX).toBe(190); // 200 - 10
    expect(br.dstY).toBe(90); // 100 - 10
    expect(br.dstW).toBe(10);
    expect(br.dstH).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Effect and alpha passthrough
// ---------------------------------------------------------------------------

describe('drawNineSlice — effect and alpha', () => {
  it('passes the effect to every slice', () => {
    const img = mockImage();
    const fx = tint({ r: 1, g: 0, b: 0, a: 1 }, 0.5);
    const cmds = collectCmds((b) => drawNineSlice(b, img, frame(), 0, 0, 128, 128, 8, fx));
    expect(cmds.every((c) => c.effect === fx)).toBe(true);
  });

  it('passes alpha to every slice (default 1)', () => {
    const img = mockImage();
    const cmds = collectCmds((b) => drawNineSlice(b, img, frame(), 0, 0, 128, 128, 8));
    expect(cmds.every((c) => c.alpha === 1)).toBe(true);
  });

  it('passes explicit alpha to every slice', () => {
    const img = mockImage();
    const cmds = collectCmds((b) =>
      drawNineSlice(b, img, frame(), 0, 0, 128, 128, 8, undefined, 0.5),
    );
    expect(cmds.every((c) => c.alpha === 0.5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cullBounds coarse AABB precheck
// ---------------------------------------------------------------------------

describe('drawNineSlice — cullBounds coarse precheck', () => {
  it('draws all 9 slices when cullBounds is null', () => {
    const img = mockImage();
    const cmds = collectCmds((b) => drawNineSlice(b, img, frame(), 0, 0, 128, 128, 8));
    expect(cmds).toHaveLength(9);
  });

  it('skips all slices when dst rect is fully outside cullBounds', () => {
    const img = mockImage();
    const cmds = collectCmds((b) => {
      b.setCullBounds(0, 0, 400, 400);
      drawNineSlice(b, img, frame(), 500, 500, 128, 128, 8);
    });
    expect(cmds).toHaveLength(0);
  });

  it('draws all slices when dst rect is inside cullBounds', () => {
    const img = mockImage();
    const cmds = collectCmds((b) => {
      b.setCullBounds(0, 0, 400, 400);
      drawNineSlice(b, img, frame(), 10, 10, 128, 128, 8);
    });
    expect(cmds).toHaveLength(9);
  });

  it('draws all slices when dst rect partially overlaps cullBounds', () => {
    const img = mockImage();
    const cmds = collectCmds((b) => {
      b.setCullBounds(0, 0, 50, 50);
      drawNineSlice(b, img, frame(), 20, 20, 128, 128, 8);
    });
    expect(cmds).toHaveLength(9);
  });

  it('skips when dst is exactly at the right edge (x >= maxX)', () => {
    const img = mockImage();
    const cmds = collectCmds((b) => {
      b.setCullBounds(0, 0, 100, 100);
      drawNineSlice(b, img, frame(), 100, 0, 64, 64, 8);
    });
    expect(cmds).toHaveLength(0);
  });

  it('does not skip when dst right edge just touches cull left edge', () => {
    const img = mockImage();
    const cmds = collectCmds((b) => {
      b.setCullBounds(50, 0, 400, 400);
      // sprite from x=10 to x=74 — right edge 74 > minX 50
      drawNineSlice(b, img, frame(), 10, 0, 64, 64, 8);
    });
    expect(cmds).toHaveLength(9);
  });
});

// ---------------------------------------------------------------------------
// Inset clamping
// ---------------------------------------------------------------------------

describe('drawNineSlice — inset clamping', () => {
  it('inset larger than half the frame is clamped — still emits 4 corners', () => {
    const img = mockImage();
    // frame 64×64, inset 50 → clamped to 32, dst must also accommodate
    const cmds = collectCmds((b) => drawNineSlice(b, img, frame(), 0, 0, 200, 200, 50));
    // srcInset = min(50, 32, 32) = 32; dstInset = min(32, 100, 100) = 32
    // srcMidW = 64-64 = 0; edges/centre skipped → 4 corners
    expect(cmds).toHaveLength(4);
  });
});
