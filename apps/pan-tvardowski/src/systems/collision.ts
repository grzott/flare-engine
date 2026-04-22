import type { World } from '@flare-engine/engine';
import type { CollisionWorld } from '@flare-engine/physics';
import { Boss, Bullet, type BulletData, Hp, Miniboss, Ship } from '../components';
import { Layer } from '../layers';
import { gameState, notifyStateChanged } from '../state';
import { destroyEntity } from './entity-ops';

function isBossInvulnerable(world: World, id: number): boolean {
  const boss = world.get(id, Boss);
  if (!boss) return false;
  return boss.phase === 'entering' || boss.phase === 'dying' || boss.phase === 'defeated';
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
): void {
  const hp = world.get(targetId, Hp);
  if (hp) {
    hp.current -= bullet.damage;
    if (world.has(targetId, Ship)) {
      gameState.playerHp = Math.max(0, hp.current);
      gameState.runStats.damageTaken += bullet.damage;
      notifyStateChanged();
    }
  }
  destroyEntity(world, coll, bulletId);
}

function handleShipContact(
  world: World,
  coll: CollisionWorld,
  shipId: number,
  otherId: number,
): { shake: boolean } {
  const shipHp = world.get(shipId, Hp);
  if (shipHp) {
    shipHp.current -= 10;
    gameState.playerHp = Math.max(0, shipHp.current);
    gameState.runStats.damageTaken += 10;
    notifyStateChanged();
  }
  if (!world.has(otherId, Boss) && !world.has(otherId, Miniboss))
    destroyEntity(world, coll, otherId);
  return { shake: true };
}

export interface CollisionCtx {
  requestShake: () => void;
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
    else handleEnemyBullet(world, coll, a, b, bulletA);
    return;
  }
  if (bulletB && !bulletA) {
    if (bulletB.ownerLayer === Layer.player) handlePlayerBullet(world, coll, b, a, bulletB);
    else handleEnemyBullet(world, coll, b, a, bulletB);
    return;
  }
  if (bulletA && bulletB) return; // bullets shouldn't touch per masks; guard anyway

  if (world.has(a, Ship)) {
    const r = handleShipContact(world, coll, a, b);
    if (r.shake) ctx.requestShake();
    return;
  }
  if (world.has(b, Ship)) {
    const r = handleShipContact(world, coll, b, a);
    if (r.shake) ctx.requestShake();
  }
}
