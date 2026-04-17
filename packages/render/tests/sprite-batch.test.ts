import { describe, expect, it } from 'bun:test';
import type { SkImageLike } from '@flare-engine/assets';
import type { SpriteFrame } from '@flare-engine/assets';
import { SpriteBatch } from '../src/sprite-batch.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';
import { grayscale, tint } from '../src/sprite-effects.js';
import type { SpriteColor } from '../src/sprite-effects.js';

function mockImage(id: string): SkImageLike & { id: string } {
  return { id, width: () => 256, height: () => 256 };
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

    it('same image + different effects = separate batches', () => {
      const batch = new SpriteBatch();
      const img = mockImage('a');
      const fxA = tint(red, 0.5);
      const fxB = grayscale(0.8);
      batch.draw(img, frame(0, 0, 16, 16), 0, 0, undefined, undefined, fxA);
      batch.draw(img, frame(0, 0, 16, 16), 20, 0, undefined, undefined, fxB);
      batch.draw(img, frame(0, 0, 16, 16), 40, 0, undefined, undefined, fxA);

      const batches: { effect: unknown; count: number }[] = [];
      batch.flush((_image, commands) => {
        batches.push({ effect: commands[0]?.effect, count: commands.length });
      });
      expect(batches).toHaveLength(2);
      const aBatch = batches.find((b) => b.effect === fxA);
      const bBatch = batches.find((b) => b.effect === fxB);
      expect(aBatch?.count).toBe(2);
      expect(bBatch?.count).toBe(1);
    });

    it('sprites without effects batch together, separate from effected ones', () => {
      const batch = new SpriteBatch();
      const img = mockImage('a');
      const fx = tint(red, 0.5);
      batch.draw(img, frame(0, 0, 16, 16), 0, 0); // no effect
      batch.draw(img, frame(0, 0, 16, 16), 20, 0, undefined, undefined, fx);
      batch.draw(img, frame(0, 0, 16, 16), 40, 0); // no effect

      const batches: { effect: unknown; count: number }[] = [];
      batch.flush((_image, commands) => {
        batches.push({ effect: commands[0]?.effect, count: commands.length });
      });
      expect(batches).toHaveLength(2);
      const plain = batches.find((b) => b.effect === undefined);
      const withFx = batches.find((b) => b.effect === fx);
      expect(plain?.count).toBe(2);
      expect(withFx?.count).toBe(1);
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
