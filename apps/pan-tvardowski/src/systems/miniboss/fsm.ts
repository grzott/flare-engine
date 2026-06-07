import { FSM, Position, Velocity } from '@flare-engine/ecs';
import type { Query, World } from '@flare-engine/engine';
import { clamp } from '@flare-engine/math';
import { Hp, Miniboss } from '../../components';
import { destroyEntity } from '../entity-ops';
import { clearEnemyBullets } from '../fire-helpers';
import { MINIBOSS_BEHAVIORS } from './behaviors';
import { DYING_INTERVAL, DYING_TOTAL, MINIBOSS_HALF_W } from './shared';
import type { MinibossCtx, MinibossDeps, MinibossStatus } from './types';

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
      form: m.form,
      hounds: m.hounds,
      spikeIndex: m.spikeIndex,
    };
  }
  return {
    alive: false,
    hp: 0,
    hpMax: 0,
    phase: 'defeated',
    pattern: null,
    rootProgress: 0,
    form: 'deer',
    hounds: 0,
    spikeIndex: 0,
  };
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
        m.formT = 0;
      }
      c.deps.onPhaseChange?.('active');
      const m2 = c.world.get(c.id, Miniboss);
      if (m2) MINIBOSS_BEHAVIORS[m2.pattern]?.onActiveEnter?.(c);
    },
    onUpdate(dt, c) {
      const m = c.world.get(c.id, Miniboss);
      const hp = c.world.get(c.id, Hp);
      if (!m || !hp) return;
      if (hp.current <= 0) {
        fsm.trigger('killed');
        return;
      }
      MINIBOSS_BEHAVIORS[m.pattern]?.onUpdate(dt, c);
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
