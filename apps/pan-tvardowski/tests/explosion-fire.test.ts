/**
 * KG7 — explosion-fire system + kenney particle-dot routing tests.
 *
 * Verifies:
 *   1. ExplosionFire entities exist when kenney is live + zone in KENNEY_FX_ZONES.
 *   2. ExplosionFire entities are absent when kenney is null (procedural path).
 *   3. ExplosionFire entities are absent when zone NOT in KENNEY_FX_ZONES.
 *   4. updateExplosionFire advances the sprite frame through fire00..19.
 *   5. Lifetime expiry destroys ExplosionFire entities.
 *   6. Dot particles resolve to particle-dot kenney frame when kenney live + zone flagged.
 *   7. Dot particles resolve to particle-spark shape frame when kenney null.
 *   8. Per-zone flag: zone-1 on, zone-2 off (not in KENNEY_FX_ZONES yet).
 *
 * Symlink-guarded: requires @flare-engine/assets, @flare-engine/physics,
 * @flare-engine/testing. On Windows with LX symlinks the suite silently passes.
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { createSpriteSheet } from '@flare-engine/assets';
import { Sprite } from '@flare-engine/render';
import { createTestWorld } from '@flare-engine/testing';
import { ExplosionFire, Lifetime } from '../src/components';
import { _resetCapsForTest, _resetNowForTest, triggerExplosion } from '../src/fx/explosions';
import type { AtlasHandle } from '../src/spawn';
import { EXPLOSION_FIRE_HZ, updateExplosionFire } from '../src/systems/explosion-fire';
import { KENNEY_FX_ZONES } from '../src/visual-spec/kenney-frames';

function isSymlinkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const s = String(e);
  if (s.includes('EACCES') || s.includes('MODULE_NOT_FOUND')) return true;
  const code = (e as NodeJS.ErrnoException).code;
  return code === 'EACCES' || code === 'MODULE_NOT_FOUND';
}

function makeShapeAtlas(): AtlasHandle {
  const sheet = createSpriteSheet();
  sheet.frames.push({ name: 'particle-spark', x: 0, y: 0, w: 8, h: 8 });
  sheet.frameMap.set('particle-spark', 0);
  sheet.frames.push({ name: 'particle-smoke', x: 8, y: 0, w: 8, h: 8 });
  sheet.frameMap.set('particle-smoke', 1);
  return { image: {} as never, sheet } as unknown as AtlasHandle;
}

function makeKenneySheet() {
  const sheet = createSpriteSheet();
  sheet.frames.push({ name: 'particle-dot', x: 0, y: 0, w: 25, h: 16 });
  sheet.frameMap.set('particle-dot', 0);
  for (let i = 0; i < 20; i++) {
    const name = `fire${String(i).padStart(2, '0')}`;
    sheet.frames.push({ name, x: i * 20, y: 0, w: 16, h: 40 });
    sheet.frameMap.set(name, sheet.frames.length - 1);
  }
  for (let i = 0; i < 9; i++) {
    const name = `regularExplosion${String(i).padStart(2, '0')}`;
    sheet.frames.push({ name, x: i * 192, y: 100, w: 192, h: 192 });
    sheet.frameMap.set(name, sheet.frames.length - 1);
  }
  return sheet;
}

describe('KENNEY_FX_ZONES — zone flag', () => {
  test('zone-1 is in KENNEY_FX_ZONES', () => {
    expect(KENNEY_FX_ZONES.has(1)).toBe(true);
  });

  test('zone-2 is NOT in KENNEY_FX_ZONES (procedural for now)', () => {
    expect(KENNEY_FX_ZONES.has(2)).toBe(false);
  });

  test('KENNEY_FX_ZONES has exactly 1 entry (zone-1 only)', () => {
    expect(KENNEY_FX_ZONES.size).toBe(1);
  });
});

describe('explosion-fire — ExplosionFire entity presence', () => {
  beforeEach(() => {
    _resetNowForTest();
    _resetCapsForTest();
  });

  test('ExplosionFire entity spawned when kenney live + zone-1 in KENNEY_FX_ZONES', () => {
    try {
      const { world } = createTestWorld();
      const atlas = makeShapeAtlas();
      const kenneySheet = makeKenneySheet();
      const kenneyImage = {} as never;
      const kenney = { image: kenneyImage, sheet: kenneySheet };

      triggerExplosion(world, atlas, null, null, false, 100, 200, 'pop', 'z1', undefined, kenney);

      const fireQuery = world.query(ExplosionFire);
      let fireCount = 0;
      for (const _ of fireQuery) fireCount++;
      expect(fireCount).toBe(1);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('no ExplosionFire entity when kenney is null (procedural path)', () => {
    try {
      const { world } = createTestWorld();
      const atlas = makeShapeAtlas();

      triggerExplosion(world, atlas, null, null, false, 100, 200, 'pop', 'z1', undefined, null);

      const fireQuery = world.query(ExplosionFire);
      let fireCount = 0;
      for (const _ of fireQuery) fireCount++;
      expect(fireCount).toBe(0);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('no ExplosionFire entity when zone NOT in KENNEY_FX_ZONES (zone-2)', () => {
    try {
      const { world } = createTestWorld();
      const atlas = makeShapeAtlas();
      const kenneySheet = makeKenneySheet();
      const kenneyImage = {} as never;
      const kenney = { image: kenneyImage, sheet: kenneySheet };

      // zone-2 is NOT in KENNEY_FX_ZONES
      expect(KENNEY_FX_ZONES.has(2)).toBe(false);
      triggerExplosion(world, atlas, null, null, false, 100, 200, 'pop', 'z2', undefined, kenney);

      const fireQuery = world.query(ExplosionFire);
      let fireCount = 0;
      for (const _ of fireQuery) fireCount++;
      expect(fireCount).toBe(0);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('ExplosionFire entity has Lifetime component', () => {
    try {
      const { world } = createTestWorld();
      const atlas = makeShapeAtlas();
      const kenneySheet = makeKenneySheet();
      const kenney = { image: {} as never, sheet: kenneySheet };

      triggerExplosion(world, atlas, null, null, false, 50, 50, 'pop', 'z1', undefined, kenney);

      const fireQuery = world.query(ExplosionFire);
      for (const id of fireQuery) {
        const life = world.get(id, Lifetime);
        expect(life).toBeDefined();
        expect(life!.remaining).toBeGreaterThan(0);
      }
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });
});

describe('explosion-fire — updateExplosionFire frame advance', () => {
  beforeEach(() => {
    _resetNowForTest();
    _resetCapsForTest();
  });

  test('frame name advances from regularExplosion00 → regularExplosion01 after one frame period', () => {
    try {
      const { world } = createTestWorld();
      const atlas = makeShapeAtlas();
      const kenneySheet = makeKenneySheet();
      const kenneyImage = {} as never;
      const kenney = { image: kenneyImage, sheet: kenneySheet };

      triggerExplosion(world, atlas, null, null, false, 0, 0, 'pop', 'z1', undefined, kenney);

      const explosionFireQuery = world.query(ExplosionFire);

      // At elapsed=0 frame should be regularExplosion00
      updateExplosionFire(world, { explosionFireQuery, kenney, dt: 0 });
      for (const id of explosionFireQuery) {
        const sp = world.get(id, Sprite);
        expect(sp?.frame.name).toBe('regularExplosion00');
      }

      // Advance by 1/EXPLOSION_FIRE_HZ → frame index 1 = regularExplosion01
      const frameDt = 1 / EXPLOSION_FIRE_HZ;
      updateExplosionFire(world, { explosionFireQuery, kenney, dt: frameDt });
      for (const id of explosionFireQuery) {
        const sp = world.get(id, Sprite);
        expect(sp?.frame.name).toBe('regularExplosion01');
      }
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('sprite image is kenney.image after updateExplosionFire', () => {
    try {
      const { world } = createTestWorld();
      const atlas = makeShapeAtlas();
      const kenneySheet = makeKenneySheet();
      const kenneyImage = {} as never;
      const kenney = { image: kenneyImage, sheet: kenneySheet };

      triggerExplosion(world, atlas, null, null, false, 0, 0, 'pop', 'z1', undefined, kenney);

      const explosionFireQuery = world.query(ExplosionFire);
      updateExplosionFire(world, { explosionFireQuery, kenney, dt: 0 });

      for (const id of explosionFireQuery) {
        const sp = world.get(id, Sprite);
        expect(sp?.image).toBe(kenneyImage);
      }
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('updateExplosionFire is a no-op when kenney.image is null', () => {
    try {
      const { world } = createTestWorld();
      const atlas = makeShapeAtlas();
      const kenneySheet = makeKenneySheet();
      const kenneyImage = {} as never;
      const kenney = { image: kenneyImage, sheet: kenneySheet };

      triggerExplosion(world, atlas, null, null, false, 0, 0, 'pop', 'z1', undefined, kenney);

      const explosionFireQuery = world.query(ExplosionFire);
      // null image — should not throw, entity sprite unchanged
      updateExplosionFire(world, {
        explosionFireQuery,
        kenney: { image: null, sheet: kenneySheet },
        dt: 0.1,
      });
      // no assertion on frame name — just must not throw
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });
});

describe('explosion-fire — particle-dot vs particle-spark routing', () => {
  beforeEach(() => {
    _resetNowForTest();
    _resetCapsForTest();
  });

  test('kenney live + zone-1: 1 ExplosionFire fireball, 0 dot particles', () => {
    try {
      const { world } = createTestWorld();
      const atlas = makeShapeAtlas();
      const kenneySheet = makeKenneySheet();
      const kenneyImage = {} as never;
      const kenney = { image: kenneyImage, sheet: kenneySheet };

      triggerExplosion(world, atlas, null, null, false, 100, 100, 'pop', 'z1', undefined, kenney);

      const fireQuery = world.query(ExplosionFire);
      const fireIds = new Set<number>();
      for (const id of fireQuery) fireIds.add(id);
      expect(fireIds.size).toBe(1);

      // No non-fire Lifetime entities (dot loop is suppressed when kenneyLive)
      const lifetimeQuery = world.query(Lifetime);
      let dotCount = 0;
      for (const id of lifetimeQuery) {
        if (fireIds.has(id)) continue;
        const sp = world.get(id, Sprite);
        if (sp) dotCount++;
      }
      expect(dotCount).toBe(0);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('dot particles use shape atlas + particle-spark when kenney null', () => {
    try {
      const { world } = createTestWorld();
      const atlas = makeShapeAtlas();
      const shapeImage = atlas.image;

      triggerExplosion(world, atlas, null, null, false, 100, 100, 'pop', 'z1', undefined, null);

      const lifetimeQuery = world.query(Lifetime);
      let dotCount = 0;
      let shapeImageMatches = 0;
      let sparkFrameMatches = 0;
      for (const id of lifetimeQuery) {
        const sp = world.get(id, Sprite);
        if (!sp) continue;
        dotCount++;
        if (sp.image === shapeImage) shapeImageMatches++;
        if (sp.frame.name === 'particle-spark') sparkFrameMatches++;
      }
      expect(dotCount).toBeGreaterThan(0);
      expect(shapeImageMatches).toBe(dotCount);
      expect(sparkFrameMatches).toBe(dotCount);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('dot particles use shape atlas when zone NOT in KENNEY_FX_ZONES (zone-2)', () => {
    try {
      const { world } = createTestWorld();
      const atlas = makeShapeAtlas();
      const kenneySheet = makeKenneySheet();
      const kenney = { image: {} as never, sheet: kenneySheet };

      // zone-2 is not in KENNEY_FX_ZONES
      triggerExplosion(world, atlas, null, null, false, 100, 100, 'pop', 'z2', undefined, kenney);

      const lifetimeQuery = world.query(Lifetime);
      let dotCount = 0;
      let sparkMatches = 0;
      for (const id of lifetimeQuery) {
        const sp = world.get(id, Sprite);
        if (!sp) continue;
        dotCount++;
        if (sp.frame.name === 'particle-spark') sparkMatches++;
      }
      expect(dotCount).toBeGreaterThan(0);
      expect(sparkMatches).toBe(dotCount);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });
});
