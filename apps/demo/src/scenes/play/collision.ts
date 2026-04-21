import type { GameContextValue, SFXPool } from '@flare-engine/engine';
import type { BeepKey } from '../../audio';
import { Boss, Bullet, type BulletData, Enemy, Hp, Ship } from '../../components';
import { SFX_VOLUME } from '../../config/audio';
import { Layer } from '../../layers';
import { gameState, notifyStateChanged } from '../../state';
import { destroyEntity } from '../../systems/entity-ops';
import type { PlayState } from './deps';

type World = GameContextValue['world'];

function playSfx(sfx: SFXPool | null, key: BeepKey, volume: number = SFX_VOLUME[key]): void {
  sfx?.play(key, { volume });
}

function isBossInvulnerable(world: World, id: number): boolean {
  const boss = world.get(id, Boss);
  if (!boss) return false;
  return boss.phase === 'entering' || boss.phase === 'dying' || boss.phase === 'defeated';
}

/** Player bullet hit something (non-player). Applies damage unless the target
 *  is an invulnerable boss phase, and destroys the bullet. */
function handlePlayerBullet(
  world: World,
  state: PlayState,
  bulletId: number,
  targetId: number,
  bullet: BulletData,
  sfx: SFXPool | null,
): void {
  if (world.has(targetId, Boss) && isBossInvulnerable(world, targetId)) {
    destroyEntity(world, state.coll, bulletId);
    return;
  }
  const hp = world.get(targetId, Hp);
  if (hp) {
    hp.current -= bullet.damage;
    playSfx(sfx, 'hit', 0.5);
  }
  destroyEntity(world, state.coll, bulletId);
}

/** Enemy bullet hit something. If the target is a Ship, mirror the HP to
 *  `gameState.playerHp` and accumulate damage into run stats. */
function handleEnemyBullet(
  world: World,
  state: PlayState,
  bulletId: number,
  targetId: number,
  bullet: BulletData,
  sfx: SFXPool | null,
): void {
  const hp = world.get(targetId, Hp);
  if (hp) {
    hp.current -= bullet.damage;
    playSfx(sfx, 'hit', 0.8);
    if (world.has(targetId, Ship)) {
      gameState.playerHp = Math.max(0, hp.current);
      gameState.runStats.damageTaken += bullet.damage;
      notifyStateChanged();
    }
  }
  destroyEntity(world, state.coll, bulletId);
}

/** Ship vs enemy/boss contact. Ship loses 1 HP; non-boss bodies are destroyed;
 *  a shake-request is flagged for the next frame. */
function handleShipContact(
  world: World,
  state: PlayState,
  shipId: number,
  otherId: number,
  sfx: SFXPool | null,
): void {
  const shipHp = world.get(shipId, Hp);
  if (shipHp) {
    shipHp.current -= 1;
    gameState.playerHp = Math.max(0, shipHp.current);
    gameState.runStats.damageTaken += 1;
    notifyStateChanged();
  }
  if (!world.has(otherId, Boss)) {
    destroyEntity(world, state.coll, otherId);
  }
  playSfx(sfx, 'explode', 0.6);
  state.playerHitShake = true;
}

/**
 * Dispatches a collision pair to one of three handlers based on what
 * components the entities carry. Three cases cover the gameplay rules:
 * player-bullet→target, enemy-bullet→target, ship↔enemy-body.
 */
export function resolveCollision(
  world: World,
  state: PlayState,
  a: number,
  b: number,
  sfx: SFXPool | null,
): void {
  const bulletA = world.get(a, Bullet);
  const bulletB = world.get(b, Bullet);
  const bullet = bulletA ?? bulletB;
  if (bullet) {
    const bulletId = bulletA ? a : b;
    const targetId = bulletA ? b : a;
    if (bullet.ownerLayer === Layer.player) {
      handlePlayerBullet(world, state, bulletId, targetId, bullet, sfx);
    } else {
      handleEnemyBullet(world, state, bulletId, targetId, bullet, sfx);
    }
    return;
  }

  const shipA = world.has(a, Ship);
  const shipB = world.has(b, Ship);
  if (!shipA && !shipB) return;
  const shipId = shipA ? a : b;
  const otherId = shipA ? b : a;
  const otherIsBody = world.has(otherId, Enemy) || world.has(otherId, Boss);
  if (!otherIsBody) return;
  handleShipContact(world, state, shipId, otherId, sfx);
}
