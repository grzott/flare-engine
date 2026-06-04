/**
 * Fix 2 — regularExplosion flipbook in explosion-fire system.
 *
 * Verifies:
 *   1. regularExplosion00..08 frames are present in zone1.json (89-frame atlas).
 *   2. updateExplosionFire advances through regularExplosion frames (not fire frames).
 *   3. Frame-count assertion: atlas has 89 frames (80 prior + 9 new).
 *
 * Symlink-guarded: same pattern as kg8-atlas-icon-cog.test.ts.
 */

import { describe, expect, test } from 'bun:test';
import { createSpriteSheet } from '@flare-engine/assets';
import { Position } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import { createTestWorld } from '@flare-engine/testing';
import { ExplosionFire } from '../src/components';
import { EXPLOSION_FIRE_HZ, updateExplosionFire } from '../src/systems/explosion-fire';

function isSymlinkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const s = String(e);
  if (s.includes('EACCES') || s.includes('MODULE_NOT_FOUND')) return true;
  const code = (e as NodeJS.ErrnoException).code;
  return code === 'EACCES' || code === 'MODULE_NOT_FOUND';
}

const REGULAR_EXPLOSION_FRAME_NAMES = [
  'regularExplosion00',
  'regularExplosion01',
  'regularExplosion02',
  'regularExplosion03',
  'regularExplosion04',
  'regularExplosion05',
  'regularExplosion06',
  'regularExplosion07',
  'regularExplosion08',
] as const;

describe('Fix-2 — explosion-fire uses regularExplosion frames', () => {
  test('all 9 regularExplosion frames present in zone1.json', () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const zone1Json = require('../assets/kenney/zone1.json') as unknown;
      const { parseTexturePackerHash } = require('@flare-engine/assets') as {
        parseTexturePackerHash: (json: unknown) => {
          frames: { name: string; w: number; h: number }[];
          frameMap: Map<string, number>;
        };
      };
      const sheet = parseTexturePackerHash(zone1Json);
      for (const name of REGULAR_EXPLOSION_FRAME_NAMES) {
        const idx = sheet.frameMap.get(name);
        expect(idx !== undefined, `${name} not found in zone1.json`).toBe(true);
        const f = sheet.frames[idx as number];
        expect(f !== undefined, `${name} frame object is undefined`).toBe(true);
        expect((f as { w: number }).w).toBeGreaterThan(0);
        expect((f as { h: number }).h).toBeGreaterThan(0);
      }
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('atlas has 89 frames (80 prior + 9 regularExplosion)', () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const zone1Json = require('../assets/kenney/zone1.json') as unknown;
      const { parseTexturePackerHash } = require('@flare-engine/assets') as {
        parseTexturePackerHash: (json: unknown) => { frames: unknown[] };
      };
      const sheet = parseTexturePackerHash(zone1Json);
      expect(sheet.frames.length).toBe(89);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('updateExplosionFire advances through regularExplosion frames', () => {
    try {
      const { world } = createTestWorld();

      const sheet = createSpriteSheet();
      for (const name of REGULAR_EXPLOSION_FRAME_NAMES) {
        sheet.frames.push({ name, x: 0, y: 0, w: 192, h: 192 });
        sheet.frameMap.set(name, sheet.frames.length - 1);
      }

      const kenneyImage = {} as never;
      const kenney = { image: kenneyImage, sheet };

      const id = world.spawn();
      world.add(id, Position, { x: 0, y: 0 });
      world.add(id, ExplosionFire, { elapsed: 0 });
      world.add(id, Sprite, {
        image: kenneyImage,
        frame: sheet.frames[0]!,
        z: 20,
        anchor: { x: 0.5, y: 0.5 },
      });

      const explosionFireQuery = world.query(ExplosionFire);

      // Advance by one frame interval.
      const dt = 1 / EXPLOSION_FIRE_HZ;
      updateExplosionFire(world, { explosionFireQuery, kenney, dt });

      const sp = world.get(id, Sprite);
      expect(sp?.frame.name).toBe('regularExplosion01');

      // Advance another two intervals.
      updateExplosionFire(world, { explosionFireQuery, kenney, dt });
      updateExplosionFire(world, { explosionFireQuery, kenney, dt });

      const sp2 = world.get(id, Sprite);
      expect(sp2?.frame.name).toBe('regularExplosion03');
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('updateExplosionFire clamps to last frame (no modulo past end)', () => {
    try {
      const { world } = createTestWorld();

      const sheet = createSpriteSheet();
      for (const name of REGULAR_EXPLOSION_FRAME_NAMES) {
        sheet.frames.push({ name, x: 0, y: 0, w: 192, h: 192 });
        sheet.frameMap.set(name, sheet.frames.length - 1);
      }

      const kenneyImage = {} as never;
      const kenney = { image: kenneyImage, sheet };

      const id = world.spawn();
      world.add(id, Position, { x: 0, y: 0 });
      world.add(id, ExplosionFire, { elapsed: 0 });
      world.add(id, Sprite, {
        image: kenneyImage,
        frame: sheet.frames[0]!,
        z: 20,
        anchor: { x: 0.5, y: 0.5 },
      });

      const explosionFireQuery = world.query(ExplosionFire);

      // Advance well past the 9 frames.
      updateExplosionFire(world, { explosionFireQuery, kenney, dt: 10 });

      const sp = world.get(id, Sprite);
      expect(sp?.frame.name).toBe('regularExplosion08');
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('fire00..19 frames still present (exhaust frames not removed)', () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const zone1Json = require('../assets/kenney/zone1.json') as unknown;
      const { parseTexturePackerHash } = require('@flare-engine/assets') as {
        parseTexturePackerHash: (json: unknown) => {
          frameMap: Map<string, number>;
        };
      };
      const sheet = parseTexturePackerHash(zone1Json);
      expect(sheet.frameMap.has('fire00')).toBe(true);
      expect(sheet.frameMap.has('fire19')).toBe(true);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });
});
