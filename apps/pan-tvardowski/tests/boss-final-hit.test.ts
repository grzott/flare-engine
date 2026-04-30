import { describe, expect, test } from 'bun:test';
import { Position, Velocity } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { createTestWorld } from '@flare-engine/testing';
import { Boss, Hp } from '../src/components';
import type { BossPattern, BossPhase } from '../src/components';
import { BABA_JAGA_HP_MAX, LUCYPER_HP_MAX } from '../src/config/gameplay';
import type { BossPostFxKind } from '../src/fx/boss-postfx';
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
    phase: 'phase2',
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

describe('boss-final-hit M3', () => {
  test('baba-jaga phase3 enter: white-out 0xffffffff + onPhaseBreak fires', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const spawnCtx = makeSpawnCtx(world);
    const id = spawnBoss(world, 'baba-jaga', BABA_JAGA_HP_MAX);
    const query = world.query(Boss);

    const paletteShifts: Array<{ phase: BossPhase; accent: number }> = [];
    const phaseBreaks: Array<{ x: number; y: number }> = [];

    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds: { width: 360, height: 640 },
      onPaletteShift: (phase: BossPhase, accent: number) => paletteShifts.push({ phase, accent }),
      onPhaseBreak: (x: number, y: number) => phaseBreaks.push({ x, y }),
    };

    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(BABA_JAGA_HP_MAX * 0.3);
    keepCooldownHigh(world, id);
    updateBoss(world, 0.016, deps);

    expect(world.get(id, Boss)?.phase).toBe('phase3');
    const p3 = paletteShifts.find((s) => s.phase === 'phase3');
    expect(p3?.accent).toBe(0xffffffff);
    expect(phaseBreaks.length).toBeGreaterThan(0);
  });

  test('lucyper phase3 enter: crimson 0xffd4213d + onPhaseBreak + bloom+flash+CRT', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const spawnCtx = makeSpawnCtx(world);
    const id = spawnBoss(world, 'lucyper-ksiezycowy', LUCYPER_HP_MAX);
    const query = world.query(Boss);

    const paletteShifts: Array<{ phase: BossPhase; accent: number }> = [];
    const phaseBreaks: Array<{ x: number; y: number }> = [];
    const postFxChains: BossPostFxKind[] = [];

    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds: { width: 360, height: 640 },
      onPaletteShift: (phase: BossPhase, accent: number) => paletteShifts.push({ phase, accent }),
      onPhaseBreak: (x: number, y: number) => phaseBreaks.push({ x, y }),
      onPhasePostFx: (chain: BossPostFxKind) => postFxChains.push(chain),
    };

    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(LUCYPER_HP_MAX * 0.3);
    keepCooldownHigh(world, id);
    updateBoss(world, 0.016, deps);

    expect(world.get(id, Boss)?.phase).toBe('phase3');
    const p3 = paletteShifts.find((s) => s.phase === 'phase3');
    expect(p3?.accent).toBe(0xffd4213d);
    expect(phaseBreaks.length).toBeGreaterThan(0);
    expect(postFxChains).toContain('bloom+flash+CRT');
  });
});
