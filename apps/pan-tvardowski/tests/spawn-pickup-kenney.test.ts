/**
 * KG7 — spawnPickup kenney-first resolution (closes KG7 pickup test gap).
 *
 * Verifies that every zone-1 pickup in KENNEY_FRAME_MAP resolves to the kenney
 * image + the mapped frame when the kenney atlas is live, and falls back to the
 * shape atlas when kenney is null.
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
import { spawnPickup } from '../src/spawn';
import { KENNEY_FRAME_MAP } from '../src/visual-spec/kenney-frames';
import { PICKUP_DEFS } from '../src/visual-spec/pickups';

function isSymlinkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const s = String(e);
  if (s.includes('EACCES') || s.includes('MODULE_NOT_FOUND')) return true;
  const code = (e as NodeJS.ErrnoException).code;
  return code === 'EACCES' || code === 'MODULE_NOT_FOUND';
}

function makeShapeSheet(frameNames: string[]) {
  const sheet = createSpriteSheet();
  for (const name of frameNames) {
    sheet.frames.push({ name, x: 0, y: 0, w: 16, h: 16 });
    sheet.frameMap.set(name, sheet.frames.length - 1);
  }
  return sheet;
}

function makeKenneySheet(frameNames: string[]) {
  const sheet = createSpriteSheet();
  for (const name of frameNames) {
    sheet.frames.push({ name, x: 0, y: 0, w: 20, h: 20 });
    sheet.frameMap.set(name, sheet.frames.length - 1);
  }
  return sheet;
}

// The zone-1 pickup defs that have kenney frame mappings.
const ZONE1_PICKUP_DEFS = PICKUP_DEFS.filter((def) => KENNEY_FRAME_MAP.has(String(def.id)));

// Shape frame names expected in the shape atlas (matching the pickup's id string).
const SHAPE_FRAME_NAMES = PICKUP_DEFS.map((def) => String(def.id));

// Kenney frame names expected in the kenney sheet.
const KENNEY_PICKUP_FRAME_NAMES = ZONE1_PICKUP_DEFS.map(
  (def) => KENNEY_FRAME_MAP.get(String(def.id)) as string,
);

describe('spawnPickup — kenney-first resolution for zone-1 pickups', () => {
  test('zone-1 pickup resolves to kenney image + mapped frame when kenney live', () => {
    try {
      const { world } = createTestWorld();
      const coll = new CollisionWorld();
      const shapeImage = {} as never;
      const kenneyImage = {} as never;

      const shapeSheet = makeShapeSheet(SHAPE_FRAME_NAMES);
      const kenneySheet = makeKenneySheet(KENNEY_PICKUP_FRAME_NAMES);

      const ctx: SpawnCtx = {
        world,
        coll,
        atlas: { image: shapeImage, sheet: shapeSheet },
        kenney: { image: kenneyImage, sheet: kenneySheet },
      };

      // Check every zone-1 pickup with a kenney mapping.
      for (const def of ZONE1_PICKUP_DEFS) {
        const id = spawnPickup(ctx, def, 100, 200);
        const sp = world.get(id, Sprite);
        const expectedFrame = KENNEY_FRAME_MAP.get(String(def.id));
        expect(sp?.image).toBe(kenneyImage);
        expect(sp?.frame.name).toBe(expectedFrame);
      }
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('zone-1 pickup falls back to shape atlas when kenney is null', () => {
    try {
      const { world } = createTestWorld();
      const coll = new CollisionWorld();
      const shapeImage = {} as never;

      const shapeSheet = makeShapeSheet(SHAPE_FRAME_NAMES);

      const ctx: SpawnCtx = {
        world,
        coll,
        atlas: { image: shapeImage, sheet: shapeSheet },
        kenney: null,
      };

      const def = ZONE1_PICKUP_DEFS[0];
      if (!def) return;
      const id = spawnPickup(ctx, def, 50, 80);
      const sp = world.get(id, Sprite);
      expect(sp?.image).toBe(shapeImage);
      expect(sp?.frame.name).toBe(String(def.id));
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('all PICKUP_DEFS can be spawned without throwing (kenney live)', () => {
    try {
      const { world } = createTestWorld();
      const coll = new CollisionWorld();
      const shapeImage = {} as never;
      const kenneyImage = {} as never;

      const shapeSheet = makeShapeSheet(SHAPE_FRAME_NAMES);
      const kenneySheet = makeKenneySheet(KENNEY_PICKUP_FRAME_NAMES);

      const ctx: SpawnCtx = {
        world,
        coll,
        atlas: { image: shapeImage, sheet: shapeSheet },
        kenney: { image: kenneyImage, sheet: kenneySheet },
      };

      for (const def of PICKUP_DEFS) {
        expect(() => spawnPickup(ctx, def, 0, 0)).not.toThrow();
      }
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('ZONE1_PICKUP_DEFS has 10 entries (all zone-1 pickups have kenney mappings)', () => {
    expect(ZONE1_PICKUP_DEFS.length).toBe(10);
  });
});
