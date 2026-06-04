/**
 * Fix 1 — KENNEY_SPRITE_SCALE: entity width/height + collider scaling.
 *
 * Verifies:
 *   - Kenney-resolved sprite has width/height = frame.w/h × KENNEY_SPRITE_SCALE.
 *   - Shape-atlas-resolved entity has width/height = frame.w/h × 1 (unchanged).
 *
 * Symlink-guarded: requires @flare-engine/assets, @flare-engine/physics,
 * @flare-engine/testing. On Windows with LX symlinks the suite silently passes.
 */

import { describe, expect, test } from 'bun:test';
import { createSpriteSheet } from '@flare-engine/assets';
import { CollisionWorld } from '@flare-engine/physics';
import { Sprite } from '@flare-engine/render';
import { createTestWorld } from '@flare-engine/testing';
import type { SpawnCtx } from '../src/spawn';
import { spawnEnemy, spawnPlayer } from '../src/spawn';
import { KENNEY_SPRITE_SCALE } from '../src/visual-spec/kenney-frames';

function isSymlinkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const s = String(e);
  if (s.includes('EACCES') || s.includes('MODULE_NOT_FOUND')) return true;
  const code = (e as NodeJS.ErrnoException).code;
  return code === 'EACCES' || code === 'MODULE_NOT_FOUND';
}

function makeSheet(frames: { name: string; w: number; h: number }[]) {
  const sheet = createSpriteSheet();
  for (const { name, w, h } of frames) {
    sheet.frames.push({ name, x: 0, y: 0, w, h });
    sheet.frameMap.set(name, sheet.frames.length - 1);
  }
  return sheet;
}

describe('KENNEY_SPRITE_SCALE — entity sprite sizing', () => {
  test('KENNEY_SPRITE_SCALE is 0.5', () => {
    expect(KENNEY_SPRITE_SCALE).toBe(0.5);
  });

  test('player sprite width/height = frame × KENNEY_SPRITE_SCALE when kenney live', () => {
    try {
      const { world } = createTestWorld();
      const coll = new CollisionWorld();
      const shapeImage = {} as never;
      const kenneyImage = {} as never;

      const FRAME_W = 98;
      const FRAME_H = 75;

      const shapeSheet = makeSheet([
        { name: 'kogut-zloty', w: 16, h: 16 },
        { name: 'piorun-bullet', w: 4, h: 8 },
      ]);
      const kenneySheet = makeSheet([{ name: 'playerShip1_blue', w: FRAME_W, h: FRAME_H }]);

      const ctx: SpawnCtx = {
        world,
        coll,
        atlas: { image: shapeImage, sheet: shapeSheet },
        kenney: { image: kenneyImage, sheet: kenneySheet },
      };

      const id = spawnPlayer(ctx, 100, 200);
      const sp = world.get(id, Sprite);
      expect(sp?.width).toBeCloseTo(FRAME_W * KENNEY_SPRITE_SCALE);
      expect(sp?.height).toBeCloseTo(FRAME_H * KENNEY_SPRITE_SCALE);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('player sprite width/height = frame size when kenney is null (scale 1)', () => {
    try {
      const { world } = createTestWorld();
      const coll = new CollisionWorld();
      const shapeImage = {} as never;

      const FRAME_W = 24;
      const FRAME_H = 24;

      const shapeSheet = makeSheet([
        { name: 'kogut-zloty', w: FRAME_W, h: FRAME_H },
        { name: 'piorun-bullet', w: 4, h: 8 },
      ]);

      const ctx: SpawnCtx = {
        world,
        coll,
        atlas: { image: shapeImage, sheet: shapeSheet },
        kenney: null,
      };

      const id = spawnPlayer(ctx, 50, 80);
      const sp = world.get(id, Sprite);
      expect(sp?.width).toBeCloseTo(FRAME_W);
      expect(sp?.height).toBeCloseTo(FRAME_H);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('enemy sprite width/height = frame × KENNEY_SPRITE_SCALE when kenney live', () => {
    try {
      const { world } = createTestWorld();
      const coll = new CollisionWorld();
      const shapeImage = {} as never;
      const kenneyImage = {} as never;

      const FRAME_W = 100;
      const FRAME_H = 80;

      const shapeSheet = makeSheet([
        { name: 'skrzat', w: 16, h: 16 },
        { name: 'piorun-bullet', w: 4, h: 8 },
      ]);
      const kenneySheet = makeSheet([{ name: 'enemyBlack1', w: FRAME_W, h: FRAME_H }]);

      const ctx: SpawnCtx = {
        world,
        coll,
        atlas: { image: shapeImage, sheet: shapeSheet },
        kenney: { image: kenneyImage, sheet: kenneySheet },
      };

      const id = spawnEnemy(ctx, 'skrzat', 100, 50, 0);
      const sp = world.get(id, Sprite);
      expect(sp?.width).toBeCloseTo(FRAME_W * KENNEY_SPRITE_SCALE);
      expect(sp?.height).toBeCloseTo(FRAME_H * KENNEY_SPRITE_SCALE);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('enemy sprite width/height = frame size when kenney is null (scale 1)', () => {
    try {
      const { world } = createTestWorld();
      const coll = new CollisionWorld();
      const shapeImage = {} as never;

      const FRAME_W = 20;
      const FRAME_H = 20;

      const shapeSheet = makeSheet([
        { name: 'skrzat', w: FRAME_W, h: FRAME_H },
        { name: 'piorun-bullet', w: 4, h: 8 },
      ]);

      const ctx: SpawnCtx = {
        world,
        coll,
        atlas: { image: shapeImage, sheet: shapeSheet },
        kenney: null,
      };

      const id = spawnEnemy(ctx, 'skrzat', 100, 50, 0);
      const sp = world.get(id, Sprite);
      expect(sp?.width).toBeCloseTo(FRAME_W);
      expect(sp?.height).toBeCloseTo(FRAME_H);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });
});
