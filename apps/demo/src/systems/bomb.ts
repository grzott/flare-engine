import type { Query, World } from '@flare/ecs';
import type { CollisionWorld } from '@flare/physics';
import { Boss, Bullet, Enemy, Hp } from '../components';
import { Layer } from '../layers';
import { destroyEntity } from './entity-ops';

const BOSS_DAMAGE_RATIO = 0.25;
const FLASH_DURATION = 0.35;

export interface BombFlashState {
  remaining: number;
  duration: number;
}

export function createBombFlashState(): BombFlashState {
  return { remaining: 0, duration: FLASH_DURATION };
}

export function tickBombFlash(state: BombFlashState, dt: number): void {
  if (state.remaining > 0) {
    state.remaining = Math.max(0, state.remaining - dt);
  }
}

export function bombFlashAlpha(state: BombFlashState): number {
  if (state.remaining <= 0 || state.duration <= 0) return 0;
  return state.remaining / state.duration;
}

export interface BombDeps {
  coll: CollisionWorld;
  enemyQuery: Query;
  bulletQuery: Query;
  bossQuery: Query;
  flash: BombFlashState;
  onBossHit?: (newHp: number) => void;
  onEnemyCleared?: (count: number) => void;
}

export function tryBomb(
  world: World,
  charges: number,
  justPressed: boolean,
  deps: BombDeps,
): number {
  if (!justPressed || charges <= 0) return charges;

  const enemyIds: number[] = [];
  for (const id of deps.enemyQuery) enemyIds.push(id);
  for (const id of enemyIds) destroyEntity(world, deps.coll, id);

  const bulletIds: number[] = [];
  for (const id of deps.bulletQuery) {
    const b = world.get(id, Bullet);
    if (b && b.ownerLayer === Layer.enemy) bulletIds.push(id);
  }
  for (const id of bulletIds) destroyEntity(world, deps.coll, id);

  for (const id of deps.bossQuery) {
    const boss = world.get(id, Boss);
    const hp = world.get(id, Hp);
    if (!boss || !hp) continue;
    if (boss.phase === 'entering' || boss.phase === 'dying' || boss.phase === 'defeated') continue;
    const dmg = Math.ceil(hp.max * BOSS_DAMAGE_RATIO);
    hp.current = Math.max(0, hp.current - dmg);
    deps.onBossHit?.(hp.current);
  }

  deps.flash.remaining = deps.flash.duration;
  deps.onEnemyCleared?.(enemyIds.length);

  return charges - 1;
}

export function bombEnemyCount(world: World, query: Query): number {
  let n = 0;
  for (const id of query) {
    if (world.has(id, Enemy)) n += 1;
  }
  return n;
}
