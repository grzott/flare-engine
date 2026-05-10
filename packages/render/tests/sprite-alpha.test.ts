import { describe, expect, it } from 'bun:test';
import type { SkImageLike, SpriteFrame } from '@flare-engine/assets';
import type { SpriteData } from '../src/render-system.js';
import { SpriteBatch } from '../src/sprite-batch.js';
import type { SpriteDrawCommand } from '../src/sprite-batch.js';

function mockImage(): SkImageLike {
  return { width: () => 64, height: () => 64 };
}

function frame(): SpriteFrame {
  return { name: 'f', x: 0, y: 0, w: 32, h: 32 };
}

describe('SpriteData alpha field', () => {
  it('alpha is optional — SpriteData without alpha field is valid', () => {
    const data: SpriteData = {
      image: mockImage(),
      frame: frame(),
      z: 0,
    };
    expect(data.alpha).toBeUndefined();
  });

  it('alpha can be set to 0.5', () => {
    const data: SpriteData = {
      image: mockImage(),
      frame: frame(),
      z: 0,
      alpha: 0.5,
    };
    expect(data.alpha).toBe(0.5);
  });

  it('alpha=0 is valid (fully transparent)', () => {
    const data: SpriteData = {
      image: mockImage(),
      frame: frame(),
      z: 0,
      alpha: 0,
    };
    expect(data.alpha).toBe(0);
  });
});

describe('SpriteBatch alpha passthrough', () => {
  it('draw() defaults alpha to 1 when not provided', () => {
    const batch = new SpriteBatch();
    batch.draw(mockImage(), frame(), 0, 0);
    const commands: SpriteDrawCommand[] = [];
    batch.flush((_, cmds) => commands.push(...cmds));
    expect(commands[0]?.alpha).toBe(1);
  });

  it('draw() stores the provided alpha on the command', () => {
    const batch = new SpriteBatch();
    batch.draw(mockImage(), frame(), 0, 0, undefined, undefined, undefined, 0, 0, 0.5);
    const commands: SpriteDrawCommand[] = [];
    batch.flush((_, cmds) => commands.push(...cmds));
    expect(commands[0]?.alpha).toBe(0.5);
  });

  it('draw() stores alpha=0 (fully transparent)', () => {
    const batch = new SpriteBatch();
    batch.draw(mockImage(), frame(), 0, 0, undefined, undefined, undefined, 0, 0, 0);
    const commands: SpriteDrawCommand[] = [];
    batch.flush((_, cmds) => commands.push(...cmds));
    expect(commands[0]?.alpha).toBe(0);
  });

  it('drawRaw() defaults alpha to 1', () => {
    const batch = new SpriteBatch();
    batch.drawRaw(mockImage(), 0, 0, 32, 32, 0, 0, 32, 32);
    const commands: SpriteDrawCommand[] = [];
    batch.flush((_, cmds) => commands.push(...cmds));
    expect(commands[0]?.alpha).toBe(1);
  });

  it('drawRaw() stores provided alpha', () => {
    const batch = new SpriteBatch();
    batch.drawRaw(mockImage(), 0, 0, 32, 32, 0, 0, 32, 32, undefined, 0, 0, 0.25);
    const commands: SpriteDrawCommand[] = [];
    batch.flush((_, cmds) => commands.push(...cmds));
    expect(commands[0]?.alpha).toBe(0.25);
  });

  it('sprites with same image+effect but different alphas are in separate batches', () => {
    const batch = new SpriteBatch();
    const img = mockImage();
    batch.draw(img, frame(), 0, 0, undefined, undefined, undefined, 0, 0, 1.0);
    batch.draw(img, frame(), 10, 0, undefined, undefined, undefined, 0, 0, 0.5);
    batch.draw(img, frame(), 20, 0, undefined, undefined, undefined, 0, 0, 1.0);

    const batches: { alpha: number; count: number }[] = [];
    batch.flush((_, cmds) => {
      batches.push({ alpha: cmds[0]?.alpha ?? -1, count: cmds.length });
    });

    expect(batches).toHaveLength(2);
    const fullBatch = batches.find((b) => b.alpha === 1.0);
    const halfBatch = batches.find((b) => b.alpha === 0.5);
    expect(fullBatch?.count).toBe(2);
    expect(halfBatch?.count).toBe(1);
  });

  it('sprites with same image+effect+alpha batch together', () => {
    const batch = new SpriteBatch();
    const img = mockImage();
    batch.draw(img, frame(), 0, 0, undefined, undefined, undefined, 0, 0, 0.7);
    batch.draw(img, frame(), 10, 0, undefined, undefined, undefined, 0, 0, 0.7);

    const batches: { count: number }[] = [];
    batch.flush((_, cmds) => batches.push({ count: cmds.length }));
    expect(batches).toHaveLength(1);
    expect(batches[0]?.count).toBe(2);
  });

  it('pooled command initialises alpha to 1', () => {
    const batch = new SpriteBatch();
    const img = mockImage();
    batch.draw(img, frame(), 0, 0, undefined, undefined, undefined, 0, 0, 0.3);
    batch.flush(() => {});

    batch.draw(img, frame(), 5, 5);
    const commands: SpriteDrawCommand[] = [];
    batch.flush((_, cmds) => commands.push(...cmds));
    expect(commands[0]?.alpha).toBe(1);
  });
});
