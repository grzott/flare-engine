import { describe, expect, it } from 'bun:test';
import { Position, World } from '@flare-engine/ecs';
import { CollisionWorld } from '@flare-engine/physics';
import { Boss, Bullet, Enemy, Hp, Ship } from '../../components';
import { Layer } from '../../layers';
import { gameState } from '../../state';
import { createBombFlashState } from '../../systems/bomb';
import { createSpawnerState } from '../../systems/spawner';
import { createStubAtlas } from '../../test-utils';
import { resolveCollision } from './collision';
import type { PlayState } from './deps';

function mkState(world: World): PlayState {
  const coll = new CollisionWorld();
  return {
    coll,
    spawner: createSpawnerState(),
    playerId: -1,
    bossId: -1,
    bossSpawned: false,
    spawnEvents: [],
    spawnCtx: { world, coll, atlas: createStubAtlas() },
    flash: createBombFlashState(),
    shipQuery: world.query(Ship),
    enemyQuery: world.query(Enemy),
    bulletQuery: world.query(Bullet),
    posQuery: world.query(Position),
    bossQuery: world.query(Boss),
    playerHitShake: false,
    bounds: { width: 360, height: 640 },
  };
}

function mkBullet(world: World, ownerLayer: number, damage = 1): number {
  const id = world.spawn();
  world.add(id, Position, { x: 0, y: 0 });
  world.add(id, Bullet, { damage, ownerLayer });
  return id;
}

function mkEnemy(world: World, hp = 2): number {
  const id = world.spawn();
  world.add(id, Position, { x: 0, y: 0 });
  world.add(id, Enemy);
  world.add(id, Hp, { current: hp, max: hp });
  return id;
}

function mkShip(world: World, hp = 3): number {
  const id = world.spawn();
  world.add(id, Position, { x: 0, y: 0 });
  world.add(id, Ship);
  world.add(id, Hp, { current: hp, max: hp });
  return id;
}

function mkBoss(
  world: World,
  phase: 'entering' | 'phase1' | 'defeated' = 'phase1',
  hp = 40,
): number {
  const id = world.spawn();
  world.add(id, Position, { x: 0, y: 0 });
  world.add(id, Boss, {
    phase,
    t: 0,
    phaseT: 0,
    fireCooldown: 0,
    dyingExplosions: 0,
    targetY: 0,
  });
  world.add(id, Hp, { current: hp, max: hp });
  return id;
}

describe('resolveCollision', () => {
  it('player bullet damages enemy and is destroyed', () => {
    const world = new World();
    const state = mkState(world);
    const bullet = mkBullet(world, Layer.player, 2);
    const enemy = mkEnemy(world, 5);
    resolveCollision(world, state, bullet, enemy, null);
    expect(world.get(enemy, Hp)?.current).toBe(3);
    expect(world.has(bullet, Bullet)).toBe(false);
  });

  it('player bullet hitting invulnerable boss is destroyed without damage', () => {
    const world = new World();
    const state = mkState(world);
    const bullet = mkBullet(world, Layer.player, 3);
    const boss = mkBoss(world, 'entering', 40);
    resolveCollision(world, state, bullet, boss, null);
    expect(world.get(boss, Hp)?.current).toBe(40);
    expect(world.has(bullet, Bullet)).toBe(false);
  });

  it('enemy bullet mirrors ship damage into gameState.playerHp', () => {
    const world = new World();
    const state = mkState(world);
    gameState.playerHp = 3;
    gameState.runStats.damageTaken = 0;
    const bullet = mkBullet(world, Layer.enemy, 1);
    const ship = mkShip(world, 3);
    resolveCollision(world, state, bullet, ship, null);
    expect(world.get(ship, Hp)?.current).toBe(2);
    expect(gameState.playerHp).toBe(2);
    expect(gameState.runStats.damageTaken).toBe(1);
  });

  it('ship-vs-enemy contact damages ship and destroys enemy', () => {
    const world = new World();
    const state = mkState(world);
    gameState.playerHp = 3;
    const ship = mkShip(world, 3);
    const enemy = mkEnemy(world, 5);
    resolveCollision(world, state, ship, enemy, null);
    expect(world.get(ship, Hp)?.current).toBe(2);
    expect(world.has(enemy, Enemy)).toBe(false);
    expect(state.playerHitShake).toBe(true);
  });

  it('ship-vs-boss contact damages ship but keeps boss alive', () => {
    const world = new World();
    const state = mkState(world);
    const ship = mkShip(world, 3);
    const boss = mkBoss(world, 'phase1', 40);
    resolveCollision(world, state, ship, boss, null);
    expect(world.get(ship, Hp)?.current).toBe(2);
    expect(world.has(boss, Boss)).toBe(true);
    expect(world.get(boss, Hp)?.current).toBe(40);
  });

  it('no-op for two plain bodies with no bullet or ship', () => {
    const world = new World();
    const state = mkState(world);
    const a = mkEnemy(world, 2);
    const b = mkEnemy(world, 2);
    resolveCollision(world, state, a, b, null);
    expect(world.get(a, Hp)?.current).toBe(2);
    expect(world.get(b, Hp)?.current).toBe(2);
  });
});
