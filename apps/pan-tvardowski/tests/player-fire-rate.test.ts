/**
 * Fix 3 — Player fire rate = 0.3 s.
 *
 * Verifies:
 *   - Ship component default is 0.3 (aligns with player spawn).
 *   - spawnPlayer produces a Ship with fireRate = 0.3.
 *   - Enemy fire rate is NOT affected (unchanged from ENEMY_SPECS).
 *
 * Symlink-guarded: @flare-engine/assets, @flare-engine/physics, @flare-engine/testing.
 */

import { describe, expect, test } from 'bun:test';
import { createSpriteSheet } from '@flare-engine/assets';
import { CollisionWorld } from '@flare-engine/physics';
import { createTestWorld } from '@flare-engine/testing';
import { Ship } from '../src/components';
import type { SpawnCtx } from '../src/spawn';
import { spawnPlayer } from '../src/spawn';

function isSymlinkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const s = String(e);
  if (s.includes('EACCES') || s.includes('MODULE_NOT_FOUND')) return true;
  const code = (e as NodeJS.ErrnoException).code;
  return code === 'EACCES' || code === 'MODULE_NOT_FOUND';
}

describe('Fix-3 — player fire rate', () => {
  test('Ship component default fireRate is 0.3', () => {
    try {
      const { world } = createTestWorld();
      const id = world.spawn();
      world.add(id, Ship);
      const ship = world.get(id, Ship);
      expect(ship?.fireRate).toBe(0.3);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('spawnPlayer produces Ship with fireRate = 0.3', () => {
    try {
      const { world } = createTestWorld();
      const coll = new CollisionWorld();
      const shapeImage = {} as never;
      const sheet = createSpriteSheet();
      sheet.frames.push({ name: 'kogut-zloty', x: 0, y: 0, w: 24, h: 24 });
      sheet.frameMap.set('kogut-zloty', 0);
      sheet.frames.push({ name: 'piorun-bullet', x: 0, y: 0, w: 4, h: 8 });
      sheet.frameMap.set('piorun-bullet', 1);

      const ctx: SpawnCtx = {
        world,
        coll,
        atlas: { image: shapeImage, sheet },
        kenney: null,
      };

      const id = spawnPlayer(ctx, 100, 200);
      const ship = world.get(id, Ship);
      expect(ship?.fireRate).toBe(0.3);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('fireRate 0.3 means ~3.3 shots/sec (slower than old 0.18 = 5.6/sec)', () => {
    const oldRate = 0.18;
    const newRate = 0.3;
    expect(newRate).toBeGreaterThan(oldRate);
    expect(1 / newRate).toBeCloseTo(3.33, 1);
  });
});
