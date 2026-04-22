import { FSM, Position, Velocity } from '@flare-engine/ecs';
import type { Query, World } from '@flare-engine/engine';
import { clamp } from '@flare-engine/math';
import { Boss, type BossPattern, type BossPhase, Bullet, Hp } from '../components';
import {
  BULLET_SPAWN_OFFSET,
  BULLET_SPEED,
  WODNIK_SHIELD_MINIONS,
  WODNIK_SHIELD_REBUILD_SEC,
} from '../config/gameplay';
import { Layer } from '../layers';
import { type SpawnCtx, spawnBullet } from '../spawn';
import { type Direction2D, normalizeDirection } from '../util/direction';
import { destroyEntity } from './entity-ops';

const PHASE2_HP_RATIO = 0.5;
const DYING_INTERVAL = 0.18;
const DYING_TOTAL = 14;
const BOSS_HALF_W = 52;

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
  /** Wodnik: spawn a Topielec shield minion at (x, y). */
  onSpawnShieldMinion?: (x: number, y: number) => void;
  /** Wodnik: count how many live Topielec minions exist. */
  countShieldMinions?: () => number;
  /** Wodnik: fired the instant all minions die and the shield drops. */
  onShieldBroken?: () => void;
}

export interface BossStatus {
  alive: boolean;
  hp: number;
  hpMax: number;
  phase: BossPhase;
  invulnerable: boolean;
  pattern: BossPattern | null;
}

export function computeBossStatus(world: World, query: Query): BossStatus {
  for (const id of query) {
    const b = world.get(id, Boss);
    const hp = world.get(id, Hp);
    if (!b || !hp) continue;
    const invulnerable =
      b.phase === 'entering' || b.phase === 'dying' || b.phase === 'defeated' || b.shieldActive;
    return {
      alive: true,
      hp: hp.current,
      hpMax: hp.max,
      phase: b.phase,
      invulnerable,
      pattern: b.pattern,
    };
  }
  return {
    alive: false,
    hp: 0,
    hpMax: 0,
    phase: 'defeated',
    invulnerable: true,
    pattern: null,
  };
}

interface BossCtx {
  world: World;
  id: number;
  deps: BossDeps;
}

interface PhaseScript {
  /** Movement speed in phase 1 vs phase 2 (sweep). */
  sweepSpeed1: number;
  sweepSpeed2: number;
  /** Phase-1 fire cadence (seconds). */
  fire1Cooldown: number;
  /** Phase-2 fire cadence. */
  fire2Cooldown: number;
  fire1: (c: BossCtx) => void;
  fire2: (c: BossCtx) => void;
}

// ---- Smok Krzemionkowski (Zone 1) ------------------------------------------

const smokScript: PhaseScript = {
  sweepSpeed1: 80,
  sweepSpeed2: 140,
  fire1Cooldown: 0.5,
  fire2Cooldown: 1.1,
  fire1(c) {
    const pos = c.world.get(c.id, Position);
    const b = c.world.get(c.id, Boss);
    if (!pos || !b) return;
    // Triangle-wave sweep left↔right; period ~4s.
    const sweep = Math.sin(b.t * 1.6) * 180;
    spawnBullet(
      c.deps.spawnCtx,
      pos.x,
      pos.y + BULLET_SPAWN_OFFSET.boss,
      sweep,
      BULLET_SPEED.boss,
      Layer.enemy,
    );
  },
  fire2(c) {
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      aim.x = Math.cos(a) * BULLET_SPEED.boss;
      aim.y = Math.sin(a) * BULLET_SPEED.boss;
      spawnBullet(
        c.deps.spawnCtx,
        pos.x,
        pos.y + BULLET_SPAWN_OFFSET.boss,
        aim.x,
        aim.y,
        Layer.enemy,
      );
    }
    normalizeDirection(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
    spawnBullet(
      c.deps.spawnCtx,
      pos.x,
      pos.y + BULLET_SPAWN_OFFSET.boss,
      aim.x,
      aim.y,
      Layer.enemy,
    );
  },
};

// ---- Borowy Król (Zone 2) --------------------------------------------------

const borowyScript: PhaseScript = {
  sweepSpeed1: 60,
  sweepSpeed2: 110,
  fire1Cooldown: 0.7,
  fire2Cooldown: 0.55,
  // Phase 1: rolling boulders — 2 arcing shots that fall heavy (large vy, small vx drift).
  fire1(c) {
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
    for (let i = -1; i <= 1; i += 2) {
      spawnBullet(
        c.deps.spawnCtx,
        pos.x + i * 18,
        pos.y + BULLET_SPAWN_OFFSET.boss,
        i * 60,
        BULLET_SPEED.boss * 0.9,
        Layer.enemy,
      );
    }
  },
  // Phase 2: aimed seed-shots from "root walls" — tight 5-way aim at player.
  fire2(c) {
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
    normalizeDirection(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
    const baseAngle = Math.atan2(aim.y, aim.x);
    for (let i = -2; i <= 2; i++) {
      const a = baseAngle + i * 0.18;
      const vx = Math.cos(a) * BULLET_SPEED.boss;
      const vy = Math.sin(a) * BULLET_SPEED.boss;
      spawnBullet(c.deps.spawnCtx, pos.x, pos.y + BULLET_SPAWN_OFFSET.boss, vx, vy, Layer.enemy);
    }
  },
};

// ---- Wodnik Wiślany (Zone 3) -----------------------------------------------

// Phase 1: three staggered vertical water-spout columns (downward, slight drift).
// Phase 2: lighter aimed spout; bubble-shield logic runs in FSM phase2 state.
const wodnikScript: PhaseScript = {
  sweepSpeed1: 70,
  sweepSpeed2: 95,
  fire1Cooldown: 0.45,
  fire2Cooldown: 0.9,
  fire1(c) {
    const pos = c.world.get(c.id, Position);
    const b = c.world.get(c.id, Boss);
    if (!pos || !b) return;
    const bases: [number, number][] = [
      [-70, 0],
      [0, 10],
      [70, 20],
    ];
    for (const [dx, dyOff] of bases) {
      spawnBullet(
        c.deps.spawnCtx,
        pos.x + dx,
        pos.y + BULLET_SPAWN_OFFSET.boss + dyOff,
        Math.sin(b.t * 1.2 + dx * 0.02) * 40,
        BULLET_SPEED.boss * 0.95,
        Layer.enemy,
      );
    }
  },
  fire2(c) {
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
    normalizeDirection(
      c.deps.playerX - pos.x,
      c.deps.playerY - pos.y,
      BULLET_SPEED.boss * 0.9,
      aim,
    );
    spawnBullet(
      c.deps.spawnCtx,
      pos.x,
      pos.y + BULLET_SPAWN_OFFSET.boss,
      aim.x,
      aim.y,
      Layer.enemy,
    );
  },
};

const SCRIPTS: Record<BossPattern, PhaseScript> = {
  'smok-krzemionkowski': smokScript,
  'borowy-krol': borowyScript,
  'wodnik-wislanny': wodnikScript,
};

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

/** Clear every live enemy-bullet (used between phase transitions to avoid bullet soup). */
function clearEnemyBullets(c: BossCtx): void {
  const toDrop: number[] = [];
  const q = c.world.query(Bullet);
  for (const bid of q) {
    const b = c.world.get(bid, Bullet);
    if (b && b.ownerLayer === Layer.enemy) toDrop.push(bid);
  }
  for (const id of toDrop) destroyEntity(c.world, c.deps.spawnCtx.coll, id);
}

/** Wodnik: raise the bubble shield and spawn WODNIK_SHIELD_MINIONS Topielec minions. */
function raiseWodnikShield(c: BossCtx): void {
  const b = c.world.get(c.id, Boss);
  const pos = c.world.get(c.id, Position);
  if (!b || !pos) return;
  b.shieldActive = true;
  b.shieldDownFor = 0;
  b.minionsAlive = WODNIK_SHIELD_MINIONS;
  const spawn = c.deps.onSpawnShieldMinion;
  if (!spawn) return;
  // Spawn minions in an arc around the boss at the bottom of the arena.
  const bottomY = c.deps.bounds.height + 40;
  const halfCount = (WODNIK_SHIELD_MINIONS - 1) / 2;
  for (let i = 0; i < WODNIK_SHIELD_MINIONS; i++) {
    const offset = (i - halfCount) * 70;
    spawn(clamp(pos.x + offset, 40, c.deps.bounds.width - 40), bottomY);
  }
}

/** Wodnik: per-frame shield-state update. Drops shield when minions all die,
 *  then re-raises after WODNIK_SHIELD_REBUILD_SEC. */
function tickWodnikShield(dt: number, c: BossCtx): void {
  const b = c.world.get(c.id, Boss);
  if (!b) return;
  const live = c.deps.countShieldMinions?.() ?? 0;
  b.minionsAlive = live;
  if (b.shieldActive) {
    if (live === 0) {
      b.shieldActive = false;
      b.shieldDownFor = 0;
      c.deps.onShieldBroken?.();
    }
  } else {
    b.shieldDownFor += dt;
    if (b.shieldDownFor >= WODNIK_SHIELD_REBUILD_SEC) {
      raiseWodnikShield(c);
    }
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
        b.fireCooldown = 0.4;
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
      const script = SCRIPTS[b.pattern];
      sweepMove(c, script.sweepSpeed1);
      b.fireCooldown -= dt;
      if (b.fireCooldown <= 0) {
        script.fire1(c);
        b.fireCooldown = script.fire1Cooldown;
      }
    },
    onExit(c) {
      clearEnemyBullets(c);
    },
  });

  fsm.addState({
    name: 'phase2',
    onEnter(c) {
      const b = c.world.get(c.id, Boss);
      if (b) {
        b.phase = 'phase2';
        b.phaseT = 0;
        b.fireCooldown = 0.6;
        if (b.pattern === 'wodnik-wislanny') {
          raiseWodnikShield(c);
        }
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
      if (b.pattern === 'wodnik-wislanny') {
        tickWodnikShield(dt, c);
      }
      const script = SCRIPTS[b.pattern];
      sweepMove(c, script.sweepSpeed2);
      b.fireCooldown -= dt;
      if (b.fireCooldown <= 0) {
        script.fire2(c);
        b.fireCooldown = script.fire2Cooldown;
      }
    },
    onExit(c) {
      clearEnemyBullets(c);
      const b = c.world.get(c.id, Boss);
      if (b) {
        b.shieldActive = false;
        b.minionsAlive = 0;
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
        b.dyingExplosions = 0;
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
        const ox = pos.x + (Math.random() - 0.5) * 96;
        const oy = pos.y + (Math.random() - 0.5) * 64;
        c.deps.onExplosion?.(ox, oy);
        b.dyingExplosions += 1;
        b.fireCooldown = DYING_INTERVAL;
      }
      if (b.dyingExplosions >= DYING_TOTAL) fsm.trigger('exploded');
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
      const currentName = runtime.fsm.current?.name;
      if (currentName !== b.phase) runtime.fsm.start(b.phase);
    }

    runtime.fsm.update(dt);
    if (b.phase === 'defeated') bossRuntimes.delete(id);

    const pos = world.get(id, Position);
    if (pos) pos.x = clamp(pos.x, BOSS_HALF_W, deps.bounds.width - BOSS_HALF_W);
  }
}
