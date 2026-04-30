import { describe, expect, test } from 'bun:test';
import { Position, Velocity } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { createTestWorld } from '@flare-engine/testing';
import { Boss, Hp } from '../src/components';
import type { BossPattern } from '../src/components';
import { BORUTA_HP_MAX } from '../src/config/gameplay';
import type { BossPostFxKind } from '../src/fx/boss-postfx';
import { BOSS_POSTFX_CHAINS } from '../src/fx/boss-postfx';
import type { SpawnCtx } from '../src/spawn';
import { clearBossFsms, updateBoss } from '../src/systems/boss';

function makeSpawnCtx(world: ReturnType<typeof createTestWorld>['world']): SpawnCtx {
  const coll = new CollisionWorld();
  const atlas = {
    image: {} as never,
    sheet: { texture: {} as never, frames: {} },
  } as unknown as SpawnCtx['atlas'];
  return { world, coll, atlas };
}

function keepCooldownHigh(world: ReturnType<typeof createTestWorld>['world'], id: number): void {
  const b = world.get(id, Boss);
  if (b) b.fireCooldown = 999;
}

function spawnBoss(
  world: ReturnType<typeof createTestWorld>['world'],
  pattern: BossPattern,
  hp: number,
): number {
  const id = world.spawn();
  world.add(id, Position, { x: 180, y: 100 });
  world.add(id, Velocity, { x: 0, y: 0 });
  world.add(id, Boss, {
    pattern,
    phase: 'phase1',
    t: 0,
    phaseT: 0,
    fireCooldown: 999,
    dyingExplosions: 0,
    targetY: 100,
    shieldActive: false,
    minionsAlive: 0,
    shieldDownFor: 0,
    summonsSpawned: 0,
    teleportT: 0,
    twinId: -1,
    firepitCooldown: 0,
    shatterIdx: 0,
    shatterT: 0,
  });
  world.add(id, Hp, { current: hp, max: hp });
  return id;
}

describe('boss-postfx M2', () => {
  test('BOSS_POSTFX_CHAINS has correct entry for all 8 bosses', () => {
    const patterns = [
      'smok-krzemionkowski',
      'borowy-krol',
      'wodnik-wislanny',
      'boruta',
      'baba-jaga',
      'bazyliszek-warszawski',
      'mefistofeles',
      'lucyper-ksiezycowy',
    ];
    for (const pattern of patterns) {
      expect(BOSS_POSTFX_CHAINS[pattern]).toBeDefined();
    }
    expect(BOSS_POSTFX_CHAINS['lucyper-ksiezycowy']).toBe('bloom+flash+CRT');
  });

  test('boruta: onPhaseBreak + onPhasePostFx fired on phase2 enter', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const spawnCtx = makeSpawnCtx(world);
    const id = spawnBoss(world, 'boruta', BORUTA_HP_MAX);
    const query = world.query(Boss);

    const phaseBreaks: Array<{ x: number; y: number }> = [];
    const postFxChains: BossPostFxKind[] = [];

    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds: { width: 360, height: 640 },
      onPhaseBreak: (x: number, y: number) => phaseBreaks.push({ x, y }),
      onPhasePostFx: (chain: BossPostFxKind) => postFxChains.push(chain),
    };

    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(BORUTA_HP_MAX * 0.49);
    keepCooldownHigh(world, id);
    updateBoss(world, 0.016, deps);

    expect(world.get(id, Boss)?.phase).toBe('phase2');
    expect(phaseBreaks.length).toBeGreaterThan(0);
    expect(postFxChains).toContain('bloom+flash');
  });
});
