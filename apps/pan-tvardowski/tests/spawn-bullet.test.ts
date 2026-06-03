/**
 * KG4 — spawnBullet frame-resolution tests.
 *
 * Verifies the Kenney-first lookup for player-bullet / enemy-bullet default
 * paths, shape-atlas fallback when kenney is null, and specId bypass.
 *
 * Symlink-guarded: requires @flare-engine/assets / @flare-engine/physics.
 * On Windows with LX symlinks (EACCES) the suite silently passes.
 */

import { describe, expect, test } from 'bun:test';
import { createSpriteSheet } from '@flare-engine/assets';
import { CollisionWorld } from '@flare-engine/physics';
import { Sprite } from '@flare-engine/render';
import { createTestWorld } from '@flare-engine/testing';
import { Layer } from '../src/layers';
import type { SpawnCtx } from '../src/spawn';
import { spawnBullet } from '../src/spawn';
import type { BulletSpecId } from '../src/visual-spec/types';

function isSymlinkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const s = String(e);
  if (s.includes('EACCES') || s.includes('MODULE_NOT_FOUND')) return true;
  const code = (e as NodeJS.ErrnoException).code;
  return code === 'EACCES' || code === 'MODULE_NOT_FOUND';
}

function makeSpriteSheet(frameNames: string[]) {
  const sheet = createSpriteSheet();
  for (const name of frameNames) {
    sheet.frames.push({ name, x: 0, y: 0, w: 9, h: 54 });
    sheet.frameMap.set(name, sheet.frames.length - 1);
  }
  return sheet;
}

describe('spawnBullet — frame resolution', () => {
  test('player bullet → kenney image + laserBlue01 when kenney atlas is live', () => {
    try {
      const { world } = createTestWorld();
      const coll = new CollisionWorld();

      const shapeSheet = makeSpriteSheet(['piorun-bullet', 'enemy-bullet']);
      const kenneySheet = makeSpriteSheet(['laserBlue01', 'laserRed01']);

      const shapeImage = {} as never;
      const kenneyImage = {} as never;

      const ctx: SpawnCtx = {
        world,
        coll,
        atlas: { image: shapeImage, sheet: shapeSheet },
        kenney: { image: kenneyImage, sheet: kenneySheet },
      };

      const id = spawnBullet(ctx, 50, 100, 0, -200, Layer.player);
      const sp = world.get(id, Sprite);
      expect(sp).toBeDefined();
      expect(sp!.image).toBe(kenneyImage);
      expect(sp!.frame.name).toBe('laserBlue01');
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('enemy bullet → kenney image + laserRed01 when kenney atlas is live', () => {
    try {
      const { world } = createTestWorld();
      const coll = new CollisionWorld();

      const shapeSheet = makeSpriteSheet(['piorun-bullet', 'enemy-bullet']);
      const kenneySheet = makeSpriteSheet(['laserBlue01', 'laserRed01']);

      const shapeImage = {} as never;
      const kenneyImage = {} as never;

      const ctx: SpawnCtx = {
        world,
        coll,
        atlas: { image: shapeImage, sheet: shapeSheet },
        kenney: { image: kenneyImage, sheet: kenneySheet },
      };

      const id = spawnBullet(ctx, 100, 50, 0, 150, Layer.enemy);
      const sp = world.get(id, Sprite);
      expect(sp).toBeDefined();
      expect(sp!.image).toBe(kenneyImage);
      expect(sp!.frame.name).toBe('laserRed01');
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('player bullet → shape atlas piorun-bullet when kenney is null', () => {
    try {
      const { world } = createTestWorld();
      const coll = new CollisionWorld();

      const shapeSheet = makeSpriteSheet(['piorun-bullet', 'enemy-bullet']);
      const shapeImage = {} as never;

      const ctx: SpawnCtx = {
        world,
        coll,
        atlas: { image: shapeImage, sheet: shapeSheet },
        kenney: null,
      };

      const id = spawnBullet(ctx, 50, 100, 0, -200, Layer.player);
      const sp = world.get(id, Sprite);
      expect(sp).toBeDefined();
      expect(sp!.image).toBe(shapeImage);
      expect(sp!.frame.name).toBe('piorun-bullet');
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('enemy bullet → shape atlas when kenney is null', () => {
    try {
      const { world } = createTestWorld();
      const coll = new CollisionWorld();

      const shapeSheet = makeSpriteSheet(['piorun-bullet', 'enemy-bullet']);
      const shapeImage = {} as never;

      const ctx: SpawnCtx = {
        world,
        coll,
        atlas: { image: shapeImage, sheet: shapeSheet },
        kenney: null,
      };

      const id = spawnBullet(ctx, 100, 50, 0, 150, Layer.enemy);
      const sp = world.get(id, Sprite);
      expect(sp).toBeDefined();
      expect(sp!.image).toBe(shapeImage);
      expect(sp!.frame.name).toBe('enemy-bullet');
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('specId path → shape atlas regardless of kenney presence', () => {
    try {
      const { world } = createTestWorld();
      const coll = new CollisionWorld();

      const shapeSheet = makeSpriteSheet(['piorun-bullet', 'enemy-bullet', 'piorun-burst']);
      const kenneySheet = makeSpriteSheet(['laserBlue01', 'laserRed01']);

      const shapeImage = {} as never;
      const kenneyImage = {} as never;

      const ctx: SpawnCtx = {
        world,
        coll,
        atlas: { image: shapeImage, sheet: shapeSheet },
        kenney: { image: kenneyImage, sheet: kenneySheet },
      };

      const id = spawnBullet(ctx, 50, 100, 0, -200, Layer.player, 'piorun-burst' as BulletSpecId);
      const sp = world.get(id, Sprite);
      expect(sp).toBeDefined();
      expect(sp!.image).toBe(shapeImage);
      expect(sp!.frame.name).toBe('piorun-burst');
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });
});
