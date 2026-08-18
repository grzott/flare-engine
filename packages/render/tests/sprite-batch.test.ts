import { describe, expect, it } from 'bun:test';
import type { SkImageLike, SpriteFrame } from '@flare-engine/assets';
import { Renderer } from '../src/renderer.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import { SpriteBatch } from '../src/sprite-batch.js';
import type { SpriteColor } from '../src/sprite-effects.js';
import { grayscale, tint } from '../src/sprite-effects.js';

function mockImage(id: string): SkImageLike & { id: string } {
  return { id, width: () => 256, height: () => 256, readPixels: () => null };
}

function frame(x: number, y: number, w: number, h: number): SpriteFrame {
  return { name: 'f', x, y, w, h };
}

describe('SpriteBatch', () => {
  it('queues draw commands', () => {
    const batch = new SpriteBatch();
    const img = mockImage('a');
    batch.draw(img, frame(0, 0, 32, 32), 100, 200);
    expect(batch.count).toBe(1);
  });

  it('flush calls drawAtlas once per texture', () => {
    const batch = new SpriteBatch();
    const imgA = mockImage('a');
    const imgB = mockImage('b');
    batch.draw(imgA, frame(0, 0, 32, 32), 0, 0);
    batch.draw(imgA, frame(32, 0, 32, 32), 32, 0);
    batch.draw(imgB, frame(0, 0, 16, 16), 0, 0);

    const calls: { image: SkImageLike; count: number }[] = [];
    batch.flush((image, commands) => {
      calls.push({ image, count: commands.length });
    });

    expect(calls).toHaveLength(2);
    // imgA has 2 draws, imgB has 1
    const callA = calls.find((c) => (c.image as unknown as { id: string }).id === 'a');
    const callB = calls.find((c) => (c.image as unknown as { id: string }).id === 'b');
    expect(callA?.count).toBe(2);
    expect(callB?.count).toBe(1);
  });

  it('flush clears the queue', () => {
    const batch = new SpriteBatch();
    batch.draw(mockImage('a'), frame(0, 0, 16, 16), 0, 0);
    batch.flush(() => {});
    expect(batch.count).toBe(0);
  });

  it('flush with empty queue is no-op', () => {
    const batch = new SpriteBatch();
    let called = false;
    batch.flush(() => {
      called = true;
    });
    expect(called).toBe(false);
  });

  it('draw uses frame dimensions as default dst size', () => {
    const batch = new SpriteBatch();
    const img = mockImage('a');
    batch.draw(img, frame(0, 0, 48, 24), 10, 20);

    const commands: SpriteDrawCommand[] = [];
    batch.flush((_, cmds) => commands.push(...cmds));
    expect(commands[0]?.dstW).toBe(48);
    expect(commands[0]?.dstH).toBe(24);
  });

  it('draw accepts custom dst size', () => {
    const batch = new SpriteBatch();
    batch.draw(mockImage('a'), frame(0, 0, 32, 32), 0, 0, 64, 64);

    const commands: SpriteDrawCommand[] = [];
    batch.flush((_, cmds) => commands.push(...cmds));
    expect(commands[0]?.dstW).toBe(64);
    expect(commands[0]?.dstH).toBe(64);
  });

  it('drawRaw queues with explicit rects', () => {
    const batch = new SpriteBatch();
    batch.drawRaw(mockImage('a'), 10, 20, 30, 40, 50, 60, 70, 80);

    const commands: SpriteDrawCommand[] = [];
    batch.flush((_, cmds) => commands.push(...cmds));
    expect(commands[0]?.srcX).toBe(10);
    expect(commands[0]?.srcY).toBe(20);
    expect(commands[0]?.dstX).toBe(50);
    expect(commands[0]?.dstW).toBe(70);
  });

  it('clear discards queued commands', () => {
    const batch = new SpriteBatch();
    batch.draw(mockImage('a'), frame(0, 0, 16, 16), 0, 0);
    batch.draw(mockImage('a'), frame(0, 0, 16, 16), 0, 0);
    batch.clear();
    expect(batch.count).toBe(0);
  });

  describe('anchor', () => {
    it('defaults to top-left when omitted', () => {
      const batch = new SpriteBatch();
      batch.draw(mockImage('a'), frame(0, 0, 32, 32), 100, 200);
      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      expect(commands[0]?.dstX).toBe(100);
      expect(commands[0]?.dstY).toBe(200);
    });

    it('centers the sprite on the given position with anchor (0.5, 0.5)', () => {
      const batch = new SpriteBatch();
      batch.draw(
        mockImage('a'),
        frame(0, 0, 32, 32),
        100,
        200,
        undefined,
        undefined,
        undefined,
        0.5,
        0.5,
      );
      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      expect(commands[0]?.dstX).toBe(84);
      expect(commands[0]?.dstY).toBe(184);
      expect(commands[0]?.dstW).toBe(32);
      expect(commands[0]?.dstH).toBe(32);
    });

    it('respects custom dst size when computing anchor offset', () => {
      const batch = new SpriteBatch();
      batch.draw(mockImage('a'), frame(0, 0, 32, 32), 100, 200, 64, 48, undefined, 0.5, 1);
      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      expect(commands[0]?.dstX).toBe(68);
      expect(commands[0]?.dstY).toBe(152);
    });

    it('drawRaw applies anchor to explicit rects', () => {
      const batch = new SpriteBatch();
      batch.drawRaw(mockImage('a'), 0, 0, 16, 16, 100, 200, 40, 20, undefined, 0.5, 0.5);
      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      expect(commands[0]?.dstX).toBe(80);
      expect(commands[0]?.dstY).toBe(190);
    });
  });

  it('pools command objects for reuse', () => {
    const batch = new SpriteBatch();
    const img = mockImage('a');
    batch.draw(img, frame(0, 0, 16, 16), 0, 0);
    batch.flush(() => {}); // Returns 1 to pool

    batch.draw(img, frame(0, 0, 32, 32), 5, 5);
    const commands: SpriteDrawCommand[] = [];
    batch.flush((_, cmds) => commands.push(...cmds));
    // Reuses pooled object — should have new values
    expect(commands[0]?.srcW).toBe(32);
    expect(commands[0]?.dstX).toBe(5);
  });

  describe('effect passthrough', () => {
    const white: SpriteColor = { r: 1, g: 1, b: 1, a: 1 };

    it('draw stores the effect on the command', () => {
      const batch = new SpriteBatch();
      const fx = tint(white, 0.5);
      batch.draw(mockImage('a'), frame(0, 0, 32, 32), 0, 0, undefined, undefined, fx);

      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      expect(commands[0]?.effect).toBe(fx);
    });

    it('drawRaw stores the effect on the command', () => {
      const batch = new SpriteBatch();
      const fx = grayscale(0.8);
      batch.drawRaw(mockImage('a'), 0, 0, 16, 16, 0, 0, 16, 16, fx);

      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      expect(commands[0]?.effect).toBe(fx);
    });

    it('defaults effect to undefined when omitted', () => {
      const batch = new SpriteBatch();
      batch.draw(mockImage('a'), frame(0, 0, 32, 32), 0, 0);

      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      expect(commands[0]?.effect).toBeUndefined();
    });

    it('clears effect on pool reuse (no stale references)', () => {
      const batch = new SpriteBatch();
      const img = mockImage('a');
      const fx = tint(white, 0.5);
      batch.draw(img, frame(0, 0, 16, 16), 0, 0, undefined, undefined, fx);
      batch.flush(() => {}); // Returns 1 command to pool

      batch.draw(img, frame(0, 0, 16, 16), 10, 10);
      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      expect(commands[0]?.effect).toBeUndefined();
    });
  });

  describe('rotation', () => {
    it('draw with no rotation arg stores rotation=0 (back-compat)', () => {
      const batch = new SpriteBatch();
      batch.draw(mockImage('a'), frame(0, 0, 32, 32), 100, 200);
      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      expect(commands[0]?.rotation).toBe(0);
      expect(commands[0]?.anchorX).toBe(0);
      expect(commands[0]?.anchorY).toBe(0);
    });

    it('draw with rotation=Math.PI stores rotation and anchor fractions', () => {
      const batch = new SpriteBatch();
      batch.draw(
        mockImage('a'),
        frame(0, 0, 32, 32),
        100,
        200,
        undefined,
        undefined,
        undefined,
        0.5,
        0.5,
        1,
        Math.PI,
      );
      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      expect(commands[0]?.rotation).toBe(Math.PI);
      expect(commands[0]?.anchorX).toBe(0.5);
      expect(commands[0]?.anchorY).toBe(0.5);
    });

    it('drawRaw with trailing rotation stores it on the command', () => {
      const batch = new SpriteBatch();
      batch.drawRaw(mockImage('a'), 0, 0, 16, 16, 50, 60, 32, 32, undefined, 0, 0, 1, Math.PI / 4);
      const commands: SpriteDrawCommand[] = [];
      batch.flush((_, cmds) => commands.push(...cmds));
      expect(commands[0]?.rotation).toBeCloseTo(Math.PI / 4);
    });
  });

  describe('compound batching (image, effect)', () => {
    const red: SpriteColor = { r: 1, g: 0, b: 0, a: 1 };

    it('same image + same effect = one batch', () => {
      const batch = new SpriteBatch();
      const img = mockImage('a');
      const fx = tint(red, 0.5);
      batch.draw(img, frame(0, 0, 16, 16), 0, 0, undefined, undefined, fx);
      batch.draw(img, frame(0, 0, 16, 16), 20, 0, undefined, undefined, fx);
      batch.draw(img, frame(0, 0, 16, 16), 40, 0, undefined, undefined, fx);

      const calls: { count: number }[] = [];
      batch.flush((_image, commands) => {
        calls.push({ count: commands.length });
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.count).toBe(3);
    });

    it('interleaved effects produce 3 consecutive runs (z-order preserved, not merged)', () => {
      // fxA, fxB, fxA are not consecutive → 3 separate drawAtlas calls in order.
      // Old global-bucket code merged non-consecutive fxA into one call (broke z-order).
      const batch = new SpriteBatch();
      const img = mockImage('a');
      const fxA = tint(red, 0.5);
      const fxB = grayscale(0.8);
      batch.draw(img, frame(0, 0, 16, 16), 0, 0, undefined, undefined, fxA);
      batch.draw(img, frame(0, 0, 16, 16), 20, 0, undefined, undefined, fxB);
      batch.draw(img, frame(0, 0, 16, 16), 40, 0, undefined, undefined, fxA);

      const runs: unknown[] = [];
      batch.flush((_image, commands) => {
        runs.push(commands[0]?.effect);
      });
      expect(runs).toHaveLength(3);
      expect(runs[0]).toBe(fxA);
      expect(runs[1]).toBe(fxB);
      expect(runs[2]).toBe(fxA);
    });

    it('interleaved no-effect sprites produce 3 consecutive runs in insertion order', () => {
      // no-fx, fx, no-fx are not consecutive → 3 runs. Old code merged the two no-fx into one.
      const batch = new SpriteBatch();
      const img = mockImage('a');
      const fx = tint(red, 0.5);
      batch.draw(img, frame(0, 0, 16, 16), 0, 0);
      batch.draw(img, frame(0, 0, 16, 16), 20, 0, undefined, undefined, fx);
      batch.draw(img, frame(0, 0, 16, 16), 40, 0);

      const runs: unknown[] = [];
      batch.flush((_image, commands) => {
        runs.push(commands[0]?.effect);
      });
      expect(runs).toHaveLength(3);
      expect(runs[0]).toBeUndefined();
      expect(runs[1]).toBe(fx);
      expect(runs[2]).toBeUndefined();
    });

    it('different images with the same effect do not cross-batch', () => {
      const batch = new SpriteBatch();
      const imgA = mockImage('a');
      const imgB = mockImage('b');
      const fx = tint(red, 0.5);
      batch.draw(imgA, frame(0, 0, 16, 16), 0, 0, undefined, undefined, fx);
      batch.draw(imgB, frame(0, 0, 16, 16), 0, 0, undefined, undefined, fx);

      const batches: { count: number }[] = [];
      batch.flush((_image, commands) => {
        batches.push({ count: commands.length });
      });
      expect(batches).toHaveLength(2);
    });
  });
});

// ---------------------------------------------------------------------------
// Z-order preservation (consecutive-run grouping)
// ---------------------------------------------------------------------------

describe('SpriteBatch — z-order / consecutive-run flush', () => {
  it('interleaved textures produce 3 ordered drawAtlas calls, not 2', () => {
    // tex1(z=1), tex2(z=2), tex1(z=3) — must draw in that order.
    // Old global-bucket code drew tex1 batch then tex2 batch, breaking z-order.
    const batch = new SpriteBatch();
    const tex1 = mockImage('tex1');
    const tex2 = mockImage('tex2');
    batch.draw(tex1, frame(0, 0, 16, 16), 0, 0);
    batch.draw(tex2, frame(0, 0, 16, 16), 0, 0);
    batch.draw(tex1, frame(0, 0, 16, 16), 32, 0);

    const order: string[] = [];
    batch.flush((img) => {
      order.push((img as unknown as { id: string }).id);
    });

    expect(order).toHaveLength(3);
    expect(order[0]).toBe('tex1');
    expect(order[1]).toBe('tex2');
    expect(order[2]).toBe('tex1');
  });

  it('consecutive same-texture sprites still batch into one call', () => {
    const batch = new SpriteBatch();
    const tex1 = mockImage('tex1');
    const tex2 = mockImage('tex2');
    batch.draw(tex1, frame(0, 0, 16, 16), 0, 0);
    batch.draw(tex1, frame(0, 0, 16, 16), 16, 0);
    batch.draw(tex2, frame(0, 0, 16, 16), 0, 0);

    const calls: { id: string; count: number }[] = [];
    batch.flush((img, commands) => {
      calls.push({ id: (img as unknown as { id: string }).id, count: commands.length });
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.id).toBe('tex1');
    expect(calls[0]?.count).toBe(2);
    expect(calls[1]?.id).toBe('tex2');
    expect(calls[1]?.count).toBe(1);
  });

  it('stretch=true and stretch=false with same key form separate runs', () => {
    const batch = new SpriteBatch();
    const img = mockImage('img');
    batch.draw(img, frame(0, 0, 32, 32), 0, 0, undefined, undefined, undefined, 0, 0, 1, 0, false);
    batch.draw(img, frame(0, 0, 32, 32), 40, 0, undefined, undefined, undefined, 0, 0, 1, 0, true);

    const runs: boolean[] = [];
    batch.flush((_image, commands) => {
      runs.push(commands[0]?.stretch ?? false);
    });

    expect(runs).toHaveLength(2);
    expect(runs[0]).toBe(false);
    expect(runs[1]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// allocCount — cumulative pool-miss counter
// ---------------------------------------------------------------------------

describe('SpriteBatch — allocCount', () => {
  it('fresh SpriteBatch has allocCount of 0', () => {
    const batch = new SpriteBatch();
    expect(batch.allocCount).toBe(0);
  });

  it('draw 1 sprite + flush increments allocCount to 1', () => {
    const batch = new SpriteBatch();
    batch.draw(mockImage('a'), frame(0, 0, 16, 16), 0, 0);
    batch.flush(() => {});
    expect(batch.allocCount).toBe(1);
  });

  it('second draw+flush reuses pooled command — allocCount stays 1', () => {
    const batch = new SpriteBatch();
    batch.draw(mockImage('a'), frame(0, 0, 16, 16), 0, 0);
    batch.flush(() => {});
    // Command returned to pool; next draw must not increment allocCount.
    batch.draw(mockImage('a'), frame(0, 0, 16, 16), 0, 0);
    batch.flush(() => {});
    expect(batch.allocCount).toBe(1);
  });

  it('draw 5 sprites into a fresh batch — allocCount === 5', () => {
    const batch = new SpriteBatch();
    for (let i = 0; i < 5; i++) {
      batch.draw(mockImage('a'), frame(0, 0, 16, 16), i * 20, 0);
    }
    batch.flush(() => {});
    expect(batch.allocCount).toBe(5);
  });

  it('clear() does not reset allocCount', () => {
    const batch = new SpriteBatch();
    batch.draw(mockImage('a'), frame(0, 0, 16, 16), 0, 0);
    batch.draw(mockImage('a'), frame(0, 0, 16, 16), 20, 0);
    batch.flush(() => {});
    const countBefore = batch.allocCount;
    batch.draw(mockImage('a'), frame(0, 0, 16, 16), 40, 0);
    batch.clear();
    expect(batch.allocCount).toBe(countBefore);
  });

  it('drawCalls === batchCount after a multi-run flush with Renderer', () => {
    const batch = new SpriteBatch();
    const renderer = new Renderer();
    const imgA = mockImage('a');
    const imgB = mockImage('b');
    // Three interleaved textures produce 3 runs.
    batch.draw(imgA, frame(0, 0, 16, 16), 0, 0);
    batch.draw(imgB, frame(0, 0, 16, 16), 20, 0);
    batch.draw(imgA, frame(0, 0, 16, 16), 40, 0);
    batch.flush(() => {}, renderer);
    expect(renderer.stats.drawCalls).toBe(3);
    expect(renderer.stats.batchCount).toBe(3);
    expect(renderer.stats.drawCalls).toBe(renderer.stats.batchCount);
  });
});

// ---------------------------------------------------------------------------
// Dead-zone follow
// ---------------------------------------------------------------------------

describe('SpriteBatch — draw order follows insertion order (regression)', () => {
  it('four interleaved textures arrive in insertion sequence', () => {
    const batch = new SpriteBatch();
    const a = mockImage('a');
    const b = mockImage('b');
    // Simulate z-sorted sequence: a(z=1), b(z=2), a(z=3), b(z=4)
    batch.draw(a, frame(0, 0, 8, 8), 0, 0);
    batch.draw(b, frame(0, 0, 8, 8), 8, 0);
    batch.draw(a, frame(0, 0, 8, 8), 16, 0);
    batch.draw(b, frame(0, 0, 8, 8), 24, 0);

    const order: string[] = [];
    batch.flush((img) => {
      order.push((img as unknown as { id: string }).id);
    });

    expect(order).toEqual(['a', 'b', 'a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// Bucket pooling — zero-alloc guard (OSS-B29)
//
// The B24 streaming refactor replaced the old multi-bucket-per-key allocator
// with a single reused run-bucket. This locks that invariant: an effect /
// alpha / texture-interleaved frame (many distinct runs — the worst case for
// the old per-key allocator) must never grow the internal bucket pool or
// re-allocate the bucket or its `commands` array after warm-up. Pre-B24 code
// grew `_batches` to one entry per run and discarded it each flush, so these
// assertions would fail against it.
// ---------------------------------------------------------------------------

describe('SpriteBatch — bucket pooling (zero-alloc)', () => {
  const red: SpriteColor = { r: 1, g: 0, b: 0, a: 1 };

  function internals(batch: SpriteBatch): { _batches: { commands: SpriteDrawCommand[] }[] } {
    return batch as unknown as { _batches: { commands: SpriteDrawCommand[] }[] };
  }

  // Eight sprites where no two consecutive share (image, effect, alpha) → the
  // flush forms eight distinct runs, exercising the mid-loop run reset.
  function queueHeavyFrame(batch: SpriteBatch): void {
    const imgA = mockImage('a');
    const imgB = mockImage('b');
    const fxA = tint(red, 0.5);
    const fxB = grayscale(0.8);
    const f = frame(0, 0, 16, 16);
    batch.draw(imgA, f, 0, 0, undefined, undefined, fxA, 0, 0, 1);
    batch.draw(imgB, f, 0, 0, undefined, undefined, fxB, 0, 0, 0.5);
    batch.draw(imgA, f, 0, 0, undefined, undefined, undefined, 0, 0, 0.5);
    batch.draw(imgB, f, 0, 0, undefined, undefined, fxA, 0, 0, 1);
    batch.draw(imgA, f, 0, 0, undefined, undefined, fxB, 0, 0, 1);
    batch.draw(imgB, f, 0, 0, undefined, undefined, undefined, 0, 0, 1);
    batch.draw(imgA, f, 0, 0, undefined, undefined, fxA, 0, 0, 0.5);
    batch.draw(imgB, f, 0, 0, undefined, undefined, fxB, 0, 0, 1);
  }

  it('an effect/alpha-heavy frame really forms 8 runs from 1 bucket', () => {
    const batch = new SpriteBatch();
    let runs = 0;
    queueHeavyFrame(batch);
    batch.flush(() => {
      runs++;
    });
    expect(runs).toBe(8); // sanity — the worst case genuinely fans into 8 runs
    expect(internals(batch)._batches).toHaveLength(1);
  });

  it('allocates zero new buckets after warm-up across many frames', () => {
    const batch = new SpriteBatch();
    queueHeavyFrame(batch);
    batch.flush(() => {}); // warm-up allocates the single bucket

    const bucket = internals(batch)._batches[0];
    const commandsArray = bucket?.commands;
    expect(bucket).toBeDefined();
    expect(commandsArray).toBeDefined();

    for (let i = 0; i < 100; i++) {
      queueHeavyFrame(batch);
      batch.flush(() => {});
      // Pool never grows; bucket + its commands array keep their identity —
      // proof that no bucket or inner array is re-allocated per frame.
      expect(internals(batch)._batches).toHaveLength(1);
      expect(internals(batch)._batches[0]).toBe(bucket);
      expect(internals(batch)._batches[0]?.commands).toBe(commandsArray);
    }
  });
});
