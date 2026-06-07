import type { World } from '@flare-engine/engine';
import type { CollisionWorld } from '@flare-engine/physics';
import { Boss, Bullet, type BulletData, Hp, Miniboss, Ship } from '../components';
import { PLAYER_HP_MAX } from '../config/gameplay';
import { Layer } from '../layers';
import { gameState, notifyStateChanged } from '../state';
import { destroyEntity } from './entity-ops';

function isBossInvulnerable(world: World, id: number): boolean {
  const boss = world.get(id, Boss);
  if (!boss) return false;
  return (
    boss.phase === 'entering' ||
    boss.phase === 'dying' ||
    boss.phase === 'defeated' ||
    boss.shieldActive
  );
}

function isMinibossInvulnerable(world: World, id: number): boolean {
  const m = world.get(id, Miniboss);
  if (!m) return false;
  return m.phase === 'entering' || m.phase === 'dying' || m.phase === 'defeated';
}

function handlePlayerBullet(
  world: World,
  coll: CollisionWorld,
  bulletId: number,
  targetId: number,
  bullet: BulletData,
): void {
  if (world.has(targetId, Boss) && isBossInvulnerable(world, targetId)) {
    destroyEntity(world, coll, bulletId);
    return;
  }
  if (world.has(targetId, Miniboss) && isMinibossInvulnerable(world, targetId)) {
    destroyEntity(world, coll, bulletId);
    return;
  }
  const hp = world.get(targetId, Hp);
  if (hp) hp.current -= bullet.damage;
  destroyEntity(world, coll, bulletId);
}

function handleEnemyBullet(
  world: World,
  coll: CollisionWorld,
  bulletId: number,
  targetId: number,
  bullet: BulletData,
): { shakeLevel: 'x1' | null } {
  const hp = world.get(targetId, Hp);
  let shakeLevel: 'x1' | null = null;
  if (hp) {
    hp.current -= bullet.damage;
    if (world.has(targetId, Ship)) {
      gameState.playerHp = Math.max(0, hp.current);
      gameState.runStats.damageTaken += bullet.damage;
      notifyStateChanged();
      shakeLevel = 'x1';
    }
  }
  destroyEntity(world, coll, bulletId);
  return { shakeLevel };
}

function handleShipContact(
  world: World,
  coll: CollisionWorld,
  shipId: number,
  otherId: number,
): { shakeLevel: 'x2' } {
  const damage = Math.round(PLAYER_HP_MAX * 0.1);
  const shipHp = world.get(shipId, Hp);
  if (shipHp) {
    shipHp.current -= damage;
    gameState.playerHp = Math.max(0, shipHp.current);
    gameState.runStats.damageTaken += damage;
    notifyStateChanged();
  }
  const isBoss = world.has(otherId, Boss);
  const isMiniboss = world.has(otherId, Miniboss);
  if (!isBoss && !isMiniboss) {
    const enemyHp = world.get(otherId, Hp);
    if (enemyHp) {
      enemyHp.current = 0;
    } else {
      destroyEntity(world, coll, otherId);
    }
  }
  return { shakeLevel: 'x2' };
}

export interface CollisionCtx {
  requestShake: (level: 'x1' | 'x2') => void;
}

/**
 * Resolve a collision pair into the correct handler based on what each
 * entity carries (bullet vs ship vs body). Three cases cover the rules.
 */
export function resolveCollision(
  world: World,
  coll: CollisionWorld,
  a: number,
  b: number,
  ctx: CollisionCtx,
): void {
  const bulletA = world.get(a, Bullet);
  const bulletB = world.get(b, Bullet);

  if (bulletA && !bulletB) {
    if (bulletA.ownerLayer === Layer.player) handlePlayerBullet(world, coll, a, b, bulletA);
    else {
      const r = handleEnemyBullet(world, coll, a, b, bulletA);
      if (r.shakeLevel) ctx.requestShake(r.shakeLevel);
    }
    return;
  }
  if (bulletB && !bulletA) {
    if (bulletB.ownerLayer === Layer.player) handlePlayerBullet(world, coll, b, a, bulletB);
    else {
      const r = handleEnemyBullet(world, coll, b, a, bulletB);
      if (r.shakeLevel) ctx.requestShake(r.shakeLevel);
    }
    return;
  }
  if (bulletA && bulletB) return; // bullets shouldn't touch per masks; guard anyway

  if (world.has(a, Ship)) {
    const r = handleShipContact(world, coll, a, b);
    ctx.requestShake(r.shakeLevel);
    return;
  }
  if (world.has(b, Ship)) {
    const r = handleShipContact(world, coll, b, a);
    ctx.requestShake(r.shakeLevel);
  }
}
