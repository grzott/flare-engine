import { FSM, Position, Velocity } from '@flare-engine/ecs';
import type { Query, World } from '@flare-engine/engine';
import { clamp } from '@flare-engine/math';
import { Bullet, Hp, Miniboss, type MinibossPattern, type MinibossPhase } from '../components';
import { BULLET_SPAWN_OFFSET, BULLET_SPEED } from '../config/gameplay';
import { Layer } from '../layers';
import { type SpawnCtx, spawnBullet } from '../spawn';
import { type Direction2D, normalizeDirection } from '../util/direction';
import { destroyEntity } from './entity-ops';

const DYING_INTERVAL = 0.16;
const DYING_TOTAL = 10;
const MINIBOSS_HALF_W = 40;
/** Time to reach full root extent (Rokita). */
const ROKITA_ROOT_GROW_SEC = 25;

const aim: Direction2D = { x: 0, y: 0 };

export interface MinibossDeps {
  spawnCtx: SpawnCtx;
  query: Query;
  playerX: number;
  playerY: number;
  bounds: { width: number; height: number };
  onPhaseChange?: (phase: MinibossPhase) => void;
  onDefeated?: () => void;
  onExplosion?: (x: number, y: number) => void;
}

export interface MinibossStatus {
  alive: boolean;
  hp: number;
  hpMax: number;
  phase: MinibossPhase;
  pattern: MinibossPattern | null;
  rootProgress: number;
}

export function computeMinibossStatus(world: World, query: Query): MinibossStatus {
  for (const id of query) {
    const m = world.get(id, Miniboss);
    const hp = world.get(id, Hp);
    if (!m || !hp) continue;
    return {
      alive: true,
      hp: hp.current,
      hpMax: hp.max,
      phase: m.phase,
      pattern: m.pattern,
      rootProgress: m.rootProgress,
    };
  }
  return {
    alive: false,
    hp: 0,
    hpMax: 0,
    phase: 'defeated',
    pattern: null,
    rootProgress: 0,
  };
}

interface MinibossCtx {
  world: World;
  id: number;
  deps: MinibossDeps;
}

function sweepMove(c: MinibossCtx, speed: number): void {
  const m = c.world.get(c.id, Miniboss);
  const pos = c.world.get(c.id, Position);
  const vel = c.world.get(c.id, Velocity);
  if (!m || !pos || !vel) return;
  vel.x = Math.cos(m.t * 0.9) * speed;
  vel.y = 0;
  if (pos.x < MINIBOSS_HALF_W) {
    pos.x = MINIBOSS_HALF_W;
    vel.x = Math.abs(vel.x);
  } else if (pos.x > c.deps.bounds.width - MINIBOSS_HALF_W) {
    pos.x = c.deps.bounds.width - MINIBOSS_HALF_W;
    vel.x = -Math.abs(vel.x);
  }
}

/** Rokita seed-shot — aimed, from one of the two advancing root tips. */
function rokitaFire(c: MinibossCtx): void {
  const pos = c.world.get(c.id, Position);
  const m = c.world.get(c.id, Miniboss);
  if (!pos || !m) return;
  // Root tips advance inward from the screen edges with rootProgress.
  const corridor = Math.max(40, c.deps.bounds.width * (0.5 - 0.45 * m.rootProgress));
  const leftTip = c.deps.bounds.width / 2 - corridor;
  const rightTip = c.deps.bounds.width / 2 + corridor;
  const yTip = c.deps.bounds.height * 0.55;
  for (const tipX of [leftTip, rightTip]) {
    normalizeDirection(c.deps.playerX - tipX, c.deps.playerY - yTip, BULLET_SPEED.enemy, aim);
    spawnBullet(c.deps.spawnCtx, tipX, yTip, aim.x, aim.y, Layer.enemy);
  }
  // Central aimed shot.
  normalizeDirection(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
  spawnBullet(c.deps.spawnCtx, pos.x, pos.y + BULLET_SPAWN_OFFSET.boss, aim.x, aim.y, Layer.enemy);
}

function clearEnemyBullets(c: MinibossCtx): void {
  const toDrop: number[] = [];
  const q = c.world.query(Bullet);
  for (const bid of q) {
    const b = c.world.get(bid, Bullet);
    if (b && b.ownerLayer === Layer.enemy) toDrop.push(bid);
  }
  for (const id of toDrop) destroyEntity(c.world, c.deps.spawnCtx.coll, id);
}

function buildMinibossFsm(context: MinibossCtx): FSM<MinibossCtx> {
  const fsm = new FSM<MinibossCtx>(context);

  fsm.addState({
    name: 'entering',
    onEnter(c) {
      const m = c.world.get(c.id, Miniboss);
      if (m) m.phase = 'entering';
    },
    onUpdate(_dt, c) {
      const m = c.world.get(c.id, Miniboss);
      const pos = c.world.get(c.id, Position);
      const vel = c.world.get(c.id, Velocity);
      if (!m || !pos || !vel) return;
      vel.x = 0;
      vel.y = 70;
      if (pos.y >= m.targetY) {
        pos.y = m.targetY;
        vel.y = 0;
        fsm.trigger('entered');
      }
    },
  });

  fsm.addState({
    name: 'active',
    onEnter(c) {
      const m = c.world.get(c.id, Miniboss);
      if (m) {
        m.phase = 'active';
        m.phaseT = 0;
        m.fireCooldown = 0.6;
      }
      c.deps.onPhaseChange?.('active');
    },
    onUpdate(dt, c) {
      const m = c.world.get(c.id, Miniboss);
      const hp = c.world.get(c.id, Hp);
      if (!m || !hp) return;
      if (hp.current <= 0) {
        fsm.trigger('killed');
        return;
      }
      m.rootProgress = clamp(m.phaseT / ROKITA_ROOT_GROW_SEC, 0, 1);
      sweepMove(c, 55);
      m.fireCooldown -= dt;
      if (m.fireCooldown <= 0) {
        rokitaFire(c);
        m.fireCooldown = 1.1;
      }
    },
    onExit(c) {
      clearEnemyBullets(c);
    },
  });

  fsm.addState({
    name: 'dying',
    onEnter(c) {
      const m = c.world.get(c.id, Miniboss);
      if (m) {
        m.phase = 'dying';
        m.phaseT = 0;
        m.fireCooldown = 0;
        m.dyingExplosions = 0;
      }
    },
    onUpdate(dt, c) {
      const m = c.world.get(c.id, Miniboss);
      const pos = c.world.get(c.id, Position);
      const vel = c.world.get(c.id, Velocity);
      if (!m || !pos || !vel) return;
      vel.x = 0;
      vel.y = 0;
      m.fireCooldown -= dt;
      if (m.fireCooldown <= 0 && m.dyingExplosions < DYING_TOTAL) {
        const ox = pos.x + (Math.random() - 0.5) * 72;
        const oy = pos.y + (Math.random() - 0.5) * 48;
        c.deps.onExplosion?.(ox, oy);
        m.dyingExplosions += 1;
        m.fireCooldown = DYING_INTERVAL;
      }
      if (m.dyingExplosions >= DYING_TOTAL) fsm.trigger('exploded');
    },
  });

  fsm.addState({
    name: 'defeated',
    onEnter(c) {
      const m = c.world.get(c.id, Miniboss);
      if (m) m.phase = 'defeated';
      c.deps.onDefeated?.();
      destroyEntity(c.world, c.deps.spawnCtx.coll, c.id);
    },
  });

  fsm.addTransition('entering', 'entered', 'active');
  fsm.addTransition('active', 'killed', 'dying');
  fsm.addTransition('dying', 'exploded', 'defeated');

  return fsm;
}

interface MinibossRuntime {
  fsm: FSM<MinibossCtx>;
  context: MinibossCtx;
}

const minibossRuntimes = new Map<number, MinibossRuntime>();
export function clearMinibossFsms(): void {
  minibossRuntimes.clear();
}

export function updateMiniboss(world: World, dt: number, deps: MinibossDeps): void {
  for (const id of deps.query) {
    const m = world.get(id, Miniboss);
    if (!m) continue;
    m.t += dt;
    m.phaseT += dt;

    let runtime = minibossRuntimes.get(id);
    if (!runtime || runtime.context.world !== world) {
      const context: MinibossCtx = { world, id, deps };
      const fsm = buildMinibossFsm(context);
      runtime = { fsm, context };
      minibossRuntimes.set(id, runtime);
      fsm.start(m.phase);
    } else {
      runtime.context.deps = deps;
      const currentName = runtime.fsm.current?.name;
      if (currentName !== m.phase) runtime.fsm.start(m.phase);
    }

    runtime.fsm.update(dt);
    if (m.phase === 'defeated') minibossRuntimes.delete(id);

    const pos = world.get(id, Position);
    if (pos) pos.x = clamp(pos.x, MINIBOSS_HALF_W, deps.bounds.width - MINIBOSS_HALF_W);
  }
}
