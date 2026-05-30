import { describe, expect, test } from 'bun:test';
import { Position, Velocity } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { createTestWorld } from '@flare-engine/testing';
import { Boss, Hp } from '../src/components';
import type { BossPattern, BossPhase } from '../src/components';
import { BORUTA_HP_MAX, SMOK_HP_MAX } from '../src/config/gameplay';
import type { BossPostFxKind } from '../src/fx/boss-postfx';
import { createPanTvardowskiPostFx } from '../src/fx/postfx';
import type { SpawnCtx } from '../src/spawn';
import type { BossDeps } from '../src/systems/boss';
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

describe('boss-palette-shift wire M1', () => {
  test('BossDeps accepts onPaletteShift and onPhasePostFx without TS error', () => {
    const { world } = createTestWorld();
    const spawnCtx = makeSpawnCtx(world);
    const query = world.query(Boss);
    const fixture = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds: { width: 360, height: 640 },
      onPaletteShift: (_phase: BossPhase, _accent: number): void => {},
      onPhasePostFx: (_kind: BossPostFxKind): void => {},
    } satisfies BossDeps;
    expect(fixture.onPaletteShift).toBeDefined();
    expect(fixture.onPhasePostFx).toBeDefined();
  });

  test('smok: phase1→phase2 fires onPaletteShift with phase2 and 0xff8b3a1f', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const spawnCtx = makeSpawnCtx(world);
    const id = spawnBoss(world, 'smok-krzemionkowski', SMOK_HP_MAX);
    const query = world.query(Boss);

    const calls: Array<{ phase: BossPhase; accent: number }> = [];
    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds: { width: 360, height: 640 },
      onPaletteShift: (phase: BossPhase, accent: number) => calls.push({ phase, accent }),
    };

    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(SMOK_HP_MAX * 0.49);
    keepCooldownHigh(world, id);
    updateBoss(world, 0.016, deps);

    const p2Call = calls.find((c) => c.phase === 'phase2');
    expect(p2Call).toBeDefined();
    expect(p2Call?.accent).toBe(0xff8b3a1f);
  });

  test('boruta: phase1→phase2 fires onPhasePostFx with bloom+flash', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const spawnCtx = makeSpawnCtx(world);
    const id = spawnBoss(world, 'boruta', BORUTA_HP_MAX);
    const query = world.query(Boss);

    const postFxChains: BossPostFxKind[] = [];
    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds: { width: 360, height: 640 },
      onPhasePostFx: (kind: BossPostFxKind) => postFxChains.push(kind),
    };

    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(BORUTA_HP_MAX * 0.49);
    keepCooldownHigh(world, id);
    updateBoss(world, 0.016, deps);

    expect(world.get(id, Boss)?.phase).toBe('phase2');
    expect(postFxChains).toContain('bloom+flash');
  });

  test('smok: FSM re-entry fires onPaletteShift again for phase1', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const spawnCtx = makeSpawnCtx(world);
    const id = spawnBoss(world, 'smok-krzemionkowski', SMOK_HP_MAX);
    const query = world.query(Boss);

    const calls: Array<{ phase: BossPhase; accent: number }> = [];
    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds: { width: 360, height: 640 },
      onPaletteShift: (phase: BossPhase, accent: number) => calls.push({ phase, accent }),
    };

    keepCooldownHigh(world, id);
    updateBoss(world, 0.016, deps);

    const firstCount = calls.filter((c) => c.phase === 'phase1').length;
    expect(firstCount).toBeGreaterThan(0);

    clearBossFsms();
    const b = world.get(id, Boss);
    if (b) b.phase = 'phase1';
    keepCooldownHigh(world, id);
    updateBoss(world, 0.016, deps);

    const secondCount = calls.filter((c) => c.phase === 'phase1').length;
    expect(secondCount).toBeGreaterThan(firstCount);
  });

  test('updateBoss does not throw when both callbacks are undefined', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const spawnCtx = makeSpawnCtx(world);
    const id = spawnBoss(world, 'smok-krzemionkowski', SMOK_HP_MAX);
    const query = world.query(Boss);

    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds: { width: 360, height: 640 },
    };

    const hp = world.get(id, Hp);
    expect(() => {
      keepCooldownHigh(world, id);
      updateBoss(world, 0.016, deps);
      if (hp) hp.current = Math.floor(SMOK_HP_MAX * 0.49);
      keepCooldownHigh(world, id);
      updateBoss(world, 0.016, deps);
    }).not.toThrow();
    expect(world.get(id, Boss)?.phase).toBe('phase2');
  });
});

describe('vignette-tint wire M2', () => {
  test('ARGB bit-extraction: 0xff8b3a1f → r≈0.545, g≈0.227, b≈0.122', () => {
    const accent = 0xff8b3a1f;
    const r = ((accent >>> 16) & 0xff) / 255;
    const g = ((accent >>> 8) & 0xff) / 255;
    const b = (accent & 0xff) / 255;
    expect(r).toBeCloseTo(0x8b / 255, 3);
    expect(g).toBeCloseTo(0x3a / 255, 3);
    expect(b).toBeCloseTo(0x1f / 255, 3);
  });

  test('onPaletteShift calls setVignetteColor with extracted [r,g,b] for smok accent 0xff8b3a1f', () => {
    clearBossFsms();
    const { world } = createTestWorld();
    const spawnCtx = makeSpawnCtx(world);
    const id = spawnBoss(world, 'smok-krzemionkowski', SMOK_HP_MAX);
    const query = world.query(Boss);

    const calls: [number, number, number][] = [];
    const fakePostfx = {
      setVignetteColor: (r: number, g: number, b: number) => calls.push([r, g, b]),
    };

    const accent = 0xff8b3a1f;
    const deps = {
      spawnCtx,
      query,
      playerX: 180,
      playerY: 540,
      bounds: { width: 360, height: 640 },
      onPaletteShift: (_phase: BossPhase, acc: number) => {
        const r = ((acc >>> 16) & 0xff) / 255;
        const g = ((acc >>> 8) & 0xff) / 255;
        const b = (acc & 0xff) / 255;
        fakePostfx.setVignetteColor(r, g, b);
      },
    };

    const hp = world.get(id, Hp);
    if (hp) hp.current = Math.floor(SMOK_HP_MAX * 0.49);
    keepCooldownHigh(world, id);
    updateBoss(world, 0.016, deps);

    expect(calls.length).toBeGreaterThan(0);
    const last = calls[calls.length - 1];
    expect(last).toBeDefined();
    if (last) {
      expect(last[0]).toBeCloseTo(((accent >>> 16) & 0xff) / 255, 3);
      expect(last[1]).toBeCloseTo(((accent >>> 8) & 0xff) / 255, 3);
      expect(last[2]).toBeCloseTo((accent & 0xff) / 255, 3);
    }
  });

  test('no-accent fallback: onPaletteShift with accent 0 → setVignetteColor(0, 0, 0)', () => {
    const calls: [number, number, number][] = [];
    const fakePostfx = {
      setVignetteColor: (r: number, g: number, b: number) => calls.push([r, g, b]),
    };

    const onPaletteShift = (_phase: BossPhase, accent: number) => {
      const r = ((accent >>> 16) & 0xff) / 255;
      const g = ((accent >>> 8) & 0xff) / 255;
      const b = (accent & 0xff) / 255;
      fakePostfx.setVignetteColor(r, g, b);
    };

    onPaletteShift('phase1', 0);

    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual([0, 0, 0]);
  });

  test('setVignetteColor mutates vignetteColor on the composite uniforms', () => {
    const postfx = createPanTvardowskiPostFx(null);
    postfx.setVignetteColor(0.5, 0.1, 0.9);
    const effect = postfx.chain.get('composite');
    expect(effect).not.toBeNull();
    if (effect && effect.uniforms.kind === 'composite') {
      expect(effect.uniforms.vignetteColor).toEqual([0.5, 0.1, 0.9]);
    }
  });
});
