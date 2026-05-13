import { describe, expect, test } from 'bun:test';
import { createSpriteSheet } from '@flare-engine/assets';
import { CollisionWorld } from '@flare-engine/physics';
import { createTestWorld } from '@flare-engine/testing';
import { Pickup } from '../src/components';
import type { SpawnCtx } from '../src/spawn';
import { spawnPickup } from '../src/spawn';
import { PICKUP_DEFS } from '../src/visual-spec/pickups';

function makeCtxWithFrame(
  world: ReturnType<typeof createTestWorld>['world'],
  frameName: string,
): SpawnCtx {
  const sheet = createSpriteSheet();
  sheet.frames.push({ name: frameName, x: 0, y: 0, w: 16, h: 16 });
  sheet.frameMap.set(frameName, 0);
  const coll = new CollisionWorld();
  const atlas = { image: {} as never, sheet } as SpawnCtx['atlas'];
  return { world, coll, atlas };
}

describe('spawnPickup', () => {
  test('spawns an entity with Pickup component carrying pickupId and effect', () => {
    const { world } = createTestWorld();
    const def = PICKUP_DEFS[0]; // pickup-iskry, weapon-swap
    const ctx = makeCtxWithFrame(world, String(def?.id));
    const id = spawnPickup(ctx, def!, 100, 200);
    const data = world.get(id, Pickup);
    expect(data).toBeDefined();
    expect(String(data?.pickupId)).toBe(String(def?.id));
    expect(data?.effect.kind).toBe('weapon-swap');
  });

  test('spawns an upgrade pickup with correct effect kind', () => {
    const { world } = createTestWorld();
    const def = PICKUP_DEFS.find((d) => d.effect.kind === 'shield');
    expect(def).toBeDefined();
    const ctx = makeCtxWithFrame(world, String(def!.id));
    const id = spawnPickup(ctx, def!, 50, 80);
    const data = world.get(id, Pickup);
    expect(data?.effect.kind).toBe('shield');
  });

  test('each PICKUP_DEF can be spawned without throwing', () => {
    for (const def of PICKUP_DEFS) {
      const { world } = createTestWorld();
      const ctx = makeCtxWithFrame(world, String(def.id));
      expect(() => spawnPickup(ctx, def, 0, 0)).not.toThrow();
    }
  });
});
