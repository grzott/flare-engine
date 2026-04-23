import { FSM, Position, Velocity } from '@flare-engine/ecs';
import type { Query, World } from '@flare-engine/engine';
import { clamp } from '@flare-engine/math';
import { Boss, Hp } from '../../components';
import { PHASE3_HP_RATIO, THREE_PHASE_P2_RATIO } from '../../config/gameplay';
import { destroyEntity } from '../entity-ops';
import { BOSS_SCRIPTS } from './registry';
import {
  BOSS_HALF_W,
  DYING_INTERVAL,
  DYING_TOTAL,
  PHASE2_HP_RATIO,
  clearEnemyBullets,
  sweepMove,
} from './shared';
import type { BossCtx, BossDeps, BossStatus } from './types';

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
      const script = b ? BOSS_SCRIPTS[b.pattern] : null;
      script?.onPhase1Enter?.(c);
    },
    onUpdate(dt, c) {
      const b = c.world.get(c.id, Boss);
      const hp = c.world.get(c.id, Hp);
      if (!b || !hp) return;
      if (hp.current <= 0) {
        fsm.trigger('killed');
        return;
      }
      const script = BOSS_SCRIPTS[b.pattern];
      const p2Ratio = script.threePhase ? THREE_PHASE_P2_RATIO : PHASE2_HP_RATIO;
      if (hp.current / hp.max <= p2Ratio) {
        fsm.trigger('phase2');
        return;
      }
      sweepMove(c, script.sweepSpeed1);
      b.fireCooldown -= dt;
      if (b.fireCooldown <= 0) {
        script.fire1(c);
        b.fireCooldown = script.fire1Cooldown;
      }
    },
    onExit(c) {
      clearEnemyBullets(c);
      const b = c.world.get(c.id, Boss);
      const script = b ? BOSS_SCRIPTS[b.pattern] : null;
      script?.onPhase1Exit?.(c);
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
      }
      c.deps.onPhaseChange?.('phase2');
      const script = b ? BOSS_SCRIPTS[b.pattern] : null;
      script?.onPhase2Enter?.(c);
    },
    onUpdate(dt, c) {
      const b = c.world.get(c.id, Boss);
      const hp = c.world.get(c.id, Hp);
      if (!b || !hp) return;
      if (hp.current <= 0) {
        fsm.trigger('killed');
        return;
      }
      const script = BOSS_SCRIPTS[b.pattern];
      if (script.threePhase && hp.current / hp.max <= PHASE3_HP_RATIO) {
        fsm.trigger('phase3');
        return;
      }
      script.onPhase2Update?.(dt, c);
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
      const script = b ? BOSS_SCRIPTS[b.pattern] : null;
      script?.onPhase2Exit?.(c);
    },
  });

  fsm.addState({
    name: 'phase3',
    onEnter(c) {
      const b = c.world.get(c.id, Boss);
      if (b) {
        b.phase = 'phase3';
        b.phaseT = 0;
        b.fireCooldown = 0.4;
        b.teleportT = 0;
      }
      c.deps.onPhaseChange?.('phase3');
      const script = b ? BOSS_SCRIPTS[b.pattern] : null;
      script?.onPhase3Enter?.(c);
    },
    onUpdate(dt, c) {
      const b = c.world.get(c.id, Boss);
      const hp = c.world.get(c.id, Hp);
      if (!b || !hp) return;
      if (hp.current <= 0) {
        fsm.trigger('killed');
        return;
      }
      const script = BOSS_SCRIPTS[b.pattern];
      if (script.phase3Movement) {
        script.phase3Movement(dt, c);
      } else {
        sweepMove(c, script.sweepSpeed3 ?? script.sweepSpeed2);
      }
      script.onPhase3Update?.(dt, c);
      b.fireCooldown -= dt;
      if (b.fireCooldown <= 0) {
        script.fire3?.(c);
        b.fireCooldown = script.fire3Cooldown ?? script.fire2Cooldown;
      }
    },
    onExit(c) {
      clearEnemyBullets(c);
      const b = c.world.get(c.id, Boss);
      const script = b ? BOSS_SCRIPTS[b.pattern] : null;
      script?.onPhase3Exit?.(c);
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
  fsm.addTransition('phase2', 'phase3', 'phase3');
  fsm.addTransition('phase2', 'killed', 'dying');
  fsm.addTransition('phase3', 'killed', 'dying');
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
