import { type Tween, tween, updateTween } from '@flare-engine/animation';
import type { Query, World } from '@flare-engine/ecs';
import { easeOutQuad } from '@flare-engine/math';
import type { CollisionWorld } from '@flare-engine/physics';
import type { Camera2D } from '@flare-engine/render';
import { Boss, Bullet, Enemy, Hp } from '../components';
import { Layer } from '../layers';
import { destroyEntity } from './entity-ops';

const BOSS_DAMAGE_RATIO = 0.25;
const FLASH_DURATION = 0.35;
const CAMERA_SHAKE_INTENSITY = 12;
const CAMERA_SHAKE_DURATION = 0.4;
/** Minimum gap between bomb fires. Prevents spam presses from stacking flashes. */
const BOMB_COOLDOWN = 0.45;

export interface BombFlashState {
  /** Seconds remaining for the flash. Kept for test/introspection compat. */
  remaining: number;
  /** Total flash duration in seconds. */
  duration: number;
  /** Eased tween that drives `alpha` while active. */
  tween: Tween | null;
  /** Seconds remaining before another bomb may fire. */
  cooldown: number;
}

export function createBombFlashState(): BombFlashState {
  return { remaining: 0, duration: FLASH_DURATION, tween: null, cooldown: 0 };
}

export function tickBombFlash(state: BombFlashState, dt: number): void {
  if (state.remaining > 0) {
    state.remaining = Math.max(0, state.remaining - dt);
  }
  if (state.cooldown > 0) {
    state.cooldown = Math.max(0, state.cooldown - dt);
  }
  if (state.tween) {
    updateTween(state.tween, dt);
    if (state.tween.done) state.tween = null;
  }
}

export function bombFlashAlpha(state: BombFlashState): number {
  if (state.tween) return state.tween.value;
  if (state.remaining <= 0 || state.duration <= 0) return 0;
  return state.remaining / state.duration;
}

export interface BombDeps {
  coll: CollisionWorld;
  enemyQuery: Query;
  bulletQuery: Query;
  bossQuery: Query;
  flash: BombFlashState;
  /** Optional camera — screen shake fires if provided. */
  camera?: Camera2D;
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
  if (deps.flash.cooldown > 0) return charges;

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

  // Eased flash fade: alpha 1 → 0 with easeOutQuad.
  deps.flash.remaining = deps.flash.duration;
  deps.flash.tween = tween(1, 0, deps.flash.duration, easeOutQuad);
  deps.flash.cooldown = BOMB_COOLDOWN;

  // Camera shake for bomb feel.
  deps.camera?.shake(CAMERA_SHAKE_INTENSITY, CAMERA_SHAKE_DURATION);

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
