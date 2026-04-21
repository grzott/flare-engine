import type { Query, World } from '@flare-engine/ecs';
import { FSM, Position, Velocity } from '@flare-engine/ecs';
import { clamp } from '@flare-engine/math';
import { Boss, type BossPhase, Hp } from '../components';
import { BULLET_SPAWN_OFFSET } from '../config/gameplay';
import { Layer } from '../layers';
import type { SpawnCtx } from '../spawn';
import { spawnBullet } from '../spawn';
import { type Direction2D, normalizeDirection } from '../util/direction';
import { destroyEntity } from './entity-ops';

const BOSS_BULLET_SPEED = 260;
const PHASE2_HP_RATIO = 0.5;
const DYING_INTERVAL = 0.18;
const DYING_TOTAL = 12;
const BOSS_HALF_W = 48;

/** Reused output for normalizeDirection inside phase-2 fire. */
const aim: Direction2D = { x: 0, y: 0 };

export interface BossDeps {
  spawnCtx: SpawnCtx;
  query: Query;
  playerX: number;
  playerY: number;
  bounds: { width: number; height: number };
  onPhaseChange?: (phase: BossPhase) => void;
  onDefeated?: () => void;
  onExplosion?: (x: number, y: number) => void;
}

export interface BossStatus {
  alive: boolean;
  hp: number;
  hpMax: number;
  phase: BossPhase;
  invulnerable: boolean;
}

export function computeBossStatus(world: World, query: Query): BossStatus {
  for (const id of query) {
    const b = world.get(id, Boss);
    const hp = world.get(id, Hp);
    if (!b || !hp) continue;
    const invulnerable = b.phase === 'entering' || b.phase === 'dying' || b.phase === 'defeated';
    return {
      alive: true,
      hp: hp.current,
      hpMax: hp.max,
      phase: b.phase,
      invulnerable,
    };
  }
  return {
    alive: false,
    hp: 0,
    hpMax: 0,
    phase: 'defeated',
    invulnerable: true,
  };
}

interface BossCtx {
  world: World;
  id: number;
  deps: BossDeps;
}

function firePhase1(c: BossCtx): void {
  const pos = c.world.get(c.id, Position);
  const b = c.world.get(c.id, Boss);
  if (!pos || !b) return;
  const sweep = Math.sin(b.t * 1.8) * 160;
  spawnBullet(
    c.deps.spawnCtx,
    pos.x,
    pos.y + BULLET_SPAWN_OFFSET.boss,
    sweep,
    BOSS_BULLET_SPEED,
    Layer.enemy,
  );
}

function firePhase2(c: BossCtx): void {
  const pos = c.world.get(c.id, Position);
  if (!pos) return;
  normalizeDirection(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BOSS_BULLET_SPEED, aim);
  const baseVx = aim.x;
  const baseVy = aim.y;
  for (const angle of [-0.25, 0, 0.25]) {
    const cs = Math.cos(angle);
    const sn = Math.sin(angle);
    const vx = baseVx * cs - baseVy * sn;
    const vy = baseVx * sn + baseVy * cs;
    spawnBullet(c.deps.spawnCtx, pos.x, pos.y + BULLET_SPAWN_OFFSET.boss, vx, vy, Layer.enemy);
  }
}

function sweepMove(c: BossCtx, speed: number): void {
  const b = c.world.get(c.id, Boss);
  const pos = c.world.get(c.id, Position);
  const vel = c.world.get(c.id, Velocity);
  if (!b || !pos || !vel) return;
  vel.x = Math.cos(b.t * 1.1) * speed;
  vel.y = 0;
  if (pos.x < BOSS_HALF_W) {
    pos.x = BOSS_HALF_W;
    vel.x = Math.abs(vel.x);
  } else if (pos.x > c.deps.bounds.width - BOSS_HALF_W) {
    pos.x = c.deps.bounds.width - BOSS_HALF_W;
    vel.x = -Math.abs(vel.x);
  }
}

function buildBossFsm(context: BossCtx): FSM<BossCtx> {
  const fsm = new FSM<BossCtx>(context);

  fsm.addState({
    name: 'entering',
    onEnter(c) {
      const b = c.world.get(c.id, Boss);
      if (b) b.phase = 'entering';
    },
    onUpdate(_dt, c) {
      const b = c.world.get(c.id, Boss);
      const pos = c.world.get(c.id, Position);
      const vel = c.world.get(c.id, Velocity);
      if (!b || !pos || !vel) return;
      vel.x = 0;
      vel.y = 60;
      if (pos.y >= b.targetY) {
        pos.y = b.targetY;
        vel.y = 0;
        fsm.trigger('entered');
      }
    },
  });

  fsm.addState({
    name: 'phase1',
    onEnter(c) {
      const b = c.world.get(c.id, Boss);
      if (b) {
        b.phase = 'phase1';
        b.phaseT = 0;
      }
      c.deps.onPhaseChange?.('phase1');
    },
    onUpdate(dt, c) {
      const b = c.world.get(c.id, Boss);
      const hp = c.world.get(c.id, Hp);
      if (!b || !hp) return;
      if (hp.current <= 0) {
        fsm.trigger('killed');
        return;
      }
      if (hp.current / hp.max <= PHASE2_HP_RATIO) {
        fsm.trigger('phase2');
        return;
      }
      sweepMove(c, 70);
      b.fireCooldown -= dt;
      if (b.fireCooldown <= 0) {
        firePhase1(c);
        b.fireCooldown = 0.55;
      }
    },
  });

  fsm.addState({
    name: 'phase2',
    onEnter(c) {
      const b = c.world.get(c.id, Boss);
      if (b) {
        b.phase = 'phase2';
        b.phaseT = 0;
      }
      c.deps.onPhaseChange?.('phase2');
    },
    onUpdate(dt, c) {
      const b = c.world.get(c.id, Boss);
      const hp = c.world.get(c.id, Hp);
      if (!b || !hp) return;
      if (hp.current <= 0) {
        fsm.trigger('killed');
        return;
      }
      sweepMove(c, 110);
      b.fireCooldown -= dt;
      if (b.fireCooldown <= 0) {
        firePhase2(c);
        b.fireCooldown = 0.9;
      }
    },
  });

  fsm.addState({
    name: 'dying',
    onEnter(c) {
      const b = c.world.get(c.id, Boss);
      if (b) {
        b.phase = 'dying';
        b.phaseT = 0;
        b.fireCooldown = 0;
      }
    },
    onUpdate(dt, c) {
      const b = c.world.get(c.id, Boss);
      const pos = c.world.get(c.id, Position);
      const vel = c.world.get(c.id, Velocity);
      if (!b || !pos || !vel) return;
      vel.x = 0;
      vel.y = 0;
      b.fireCooldown -= dt;
      if (b.fireCooldown <= 0 && b.dyingExplosions < DYING_TOTAL) {
        const ox = pos.x + (Math.random() - 0.5) * 72;
        const oy = pos.y + (Math.random() - 0.5) * 48;
        c.deps.onExplosion?.(ox, oy);
        b.dyingExplosions += 1;
        b.fireCooldown = DYING_INTERVAL;
      }
      if (b.dyingExplosions >= DYING_TOTAL) {
        fsm.trigger('exploded');
      }
    },
  });

  fsm.addState({
    name: 'defeated',
    onEnter(c) {
      const b = c.world.get(c.id, Boss);
      if (b) b.phase = 'defeated';
      c.deps.onDefeated?.();
      destroyEntity(c.world, c.deps.spawnCtx.coll, c.id);
    },
  });

  fsm.addTransition('entering', 'entered', 'phase1');
  fsm.addTransition('phase1', 'phase2', 'phase2');
  fsm.addTransition('phase1', 'killed', 'dying');
  fsm.addTransition('phase2', 'killed', 'dying');
  fsm.addTransition('dying', 'exploded', 'defeated');

  return fsm;
}

interface BossRuntime {
  fsm: FSM<BossCtx>;
  context: BossCtx;
}

/** Active boss runtimes keyed by entity id. Cleared on scene exit / boss death. */
const bossRuntimes = new Map<number, BossRuntime>();

export function clearBossFsms(): void {
  bossRuntimes.clear();
}

export function updateBoss(world: World, dt: number, deps: BossDeps): void {
  for (const id of deps.query) {
    const b = world.get(id, Boss);
    if (!b) continue;
    b.t += dt;
    b.phaseT += dt;

    let runtime = bossRuntimes.get(id);
    if (!runtime || runtime.context.world !== world) {
      const context: BossCtx = { world, id, deps };
      const fsm = buildBossFsm(context);
      runtime = { fsm, context };
      bossRuntimes.set(id, runtime);
      fsm.start(b.phase);
    } else {
      runtime.context.deps = deps;
      // If external code mutated b.phase, resync the FSM to that state.
      const currentName = runtime.fsm.current?.name;
      if (currentName !== b.phase) {
        runtime.fsm.start(b.phase);
      }
    }

    runtime.fsm.update(dt);

    if (b.phase === 'defeated') {
      bossRuntimes.delete(id);
    }

    // Clamp position to bounds after any state update
    const pos = world.get(id, Position);
    if (pos) {
      pos.x = clamp(pos.x, BOSS_HALF_W, deps.bounds.width - BOSS_HALF_W);
    }
  }
}
