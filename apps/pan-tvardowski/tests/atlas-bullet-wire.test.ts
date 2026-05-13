import { describe, expect, test } from 'bun:test';
import { createSpriteSheet } from '@flare-engine/assets';
import { CollisionWorld } from '@flare-engine/physics';
import { createTestWorld } from '@flare-engine/testing';
import { Layer } from '../src/layers';
import type { SpawnCtx } from '../src/spawn';
import { spawnBullet } from '../src/spawn';
import { hexToArgb } from '../src/util/hex';
import { BULLET_DEFS } from '../src/visual-spec/bullets';
import type { BulletSpecId } from '../src/visual-spec/types';

// ---- helpers ----------------------------------------------------------------

function makeCtxWithFrames(
  world: ReturnType<typeof createTestWorld>['world'],
  frameNames: readonly string[],
): SpawnCtx {
  const sheet = createSpriteSheet();
  for (let i = 0; i < frameNames.length; i++) {
    const name = frameNames[i] as string;
    sheet.frames.push({ name, x: i * 10, y: 0, w: 6, h: 12 });
    sheet.frameMap.set(name, i);
  }
  const coll = new CollisionWorld();
  const atlas = { image: {} as never, sheet } as SpawnCtx['atlas'];
  return { world, coll, atlas };
}

// ---- atlas-bullet-wire ------------------------------------------------------

describe('atlas-bullet-wire', () => {
  test('BULLET_DEFS has 5 entries with unique ids', () => {
    expect(BULLET_DEFS.length).toBe(5);
    const ids = BULLET_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(5);
  });

  test('expected 6 atlas frames are present (5 primary + enemy-bullet-b)', () => {
    // Primary frames: one per BULLET_DEF, named String(def.id).
    // Extra flicker variant: 'enemy-bullet-b' (stroke variant of 'enemy-bullet').
    const primary = BULLET_DEFS.map((d) => String(d.id));
    const expected = [...primary, 'enemy-bullet-b'];
    expect(expected).toHaveLength(6);

    // Verify no duplicates in the expected list itself.
    expect(new Set(expected).size).toBe(6);

    // Spot-check the primary names contain both player and enemy bullets.
    expect(primary).toContain('piorun-bullet');
    expect(primary).toContain('enemy-bullet');
  });
});

// ---- spawn-bullet-by-id -----------------------------------------------------

describe('spawn-bullet-by-id', () => {
  test('spawnBullet with explicit specId uses that frame name', () => {
    const { world } = createTestWorld();
    const specId = 'piorun-bullet' as BulletSpecId;
    const ctx = makeCtxWithFrames(world, [String(specId)]);
    expect(() => spawnBullet(ctx, 100, 200, 0, -400, Layer.player, specId)).not.toThrow();
  });

  test('spawnBullet without specId defaults to piorun-bullet for player layer', () => {
    const { world } = createTestWorld();
    const ctx = makeCtxWithFrames(world, ['piorun-bullet']);
    expect(() => spawnBullet(ctx, 100, 200, 0, -400, Layer.player)).not.toThrow();
  });

  test('spawnBullet without specId defaults to enemy-bullet for enemy layer', () => {
    const { world } = createTestWorld();
    const ctx = makeCtxWithFrames(world, ['enemy-bullet']);
    expect(() => spawnBullet(ctx, 100, 200, 0, 300, Layer.enemy)).not.toThrow();
  });
});

// ---- color-parity -----------------------------------------------------------

describe('color-parity', () => {
  test('piorun-bullet fill resolves to 0xfffff7a6', () => {
    const def = BULLET_DEFS.find((d) => d.id === ('piorun-bullet' as BulletSpecId));
    expect(def).toBeDefined();
    expect(hexToArgb(def!.fill)).toBe(0xfffff7a6);
  });

  test('enemy-bullet fill resolves to 0xffe84b2a', () => {
    const def = BULLET_DEFS.find((d) => d.id === ('enemy-bullet' as BulletSpecId));
    expect(def).toBeDefined();
    expect(hexToArgb(def!.fill)).toBe(0xffe84b2a);
  });
});
