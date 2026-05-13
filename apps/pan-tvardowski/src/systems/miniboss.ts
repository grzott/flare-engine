import { FSM, Position, Velocity } from '@flare-engine/ecs';
import type { Query, World } from '@flare-engine/engine';
import { Vec2 as V, type Vec2, clamp } from '@flare-engine/math';
import {
  Bullet,
  Hp,
  type LeszyForm,
  Miniboss,
  type MinibossPattern,
  type MinibossPhase,
} from '../components';
import {
  BULLET_SPAWN_OFFSET,
  BULLET_SPEED,
  LESZY_FORM_SEC,
  MADEJ_FIRE_COOLDOWN,
  MADEJ_SPIKE_SEC,
  NOCNY_LOWCA_HOUND_COUNT,
} from '../config/gameplay';
import { Layer } from '../layers';
import { type SpawnCtx, spawnBullet } from '../spawn';
import { destroyEntity } from './entity-ops';

const DYING_INTERVAL = 0.16;
const DYING_TOTAL = 10;
const MINIBOSS_HALF_W = 40;
/** Time to reach full root extent (Rokita). */
const ROKITA_ROOT_GROW_SEC = 25;

const aim: Vec2 = { x: 0, y: 0 };

export interface MinibossDeps {
  spawnCtx: SpawnCtx;
  query: Query;
  playerX: number;
  playerY: number;
  bounds: { width: number; height: number };
  onPhaseChange?: (phase: MinibossPhase) => void;
  onDefeated?: () => void;
  onExplosion?: (x: number, y: number) => void;
  /** Leszy: fired the instant `form` changes. */
  onFormChange?: (form: LeszyForm) => void;
  /** Nocny Łowca: spawn one homing hound at (x, y). Re-summoned when pack dies. */
  onSpawnHound?: (x: number, y: number) => void;
  /** Nocny Łowca: count of live hounds in the world right now. */
  countHounds?: () => number;
  /** Madej: spawn a spike-lane ground hazard at column `laneX`. */
  onSpawnSpikeLane?: (laneX: number) => void;
}

export interface MinibossStatus {
  alive: boolean;
  hp: number;
  hpMax: number;
  phase: MinibossPhase;
  pattern: MinibossPattern | null;
  rootProgress: number;
  form: LeszyForm;
  hounds: number;
  spikeIndex: number;
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
    V.normalizeOut(c.deps.playerX - tipX, c.deps.playerY - yTip, BULLET_SPEED.enemy, aim);
    spawnBullet(c.deps.spawnCtx, tipX, yTip, aim.x, aim.y, Layer.enemy);
  }
  // Central aimed shot.
  V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
  spawnBullet(c.deps.spawnCtx, pos.x, pos.y + BULLET_SPAWN_OFFSET.boss, aim.x, aim.y, Layer.enemy);
}

/** Leszy fires per-form: deer=ram downward, bear=slow AOE single big bullet,
 *  owl=radial 8-way burst. Returns the next fire cooldown in seconds. */
function leszyFire(c: MinibossCtx): number {
  const pos = c.world.get(c.id, Position);
  const m = c.world.get(c.id, Miniboss);
  if (!pos || !m) return 1;
  const ox = pos.x;
  const oy = pos.y + BULLET_SPAWN_OFFSET.boss;
  if (m.form === 'deer') {
    // Ram: fast aimed single + two flanking shots ±8°.
    V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
    const baseAngle = Math.atan2(aim.y, aim.x);
    for (let i = -1; i <= 1; i++) {
      const a = baseAngle + i * 0.14;
      spawnBullet(
        c.deps.spawnCtx,
        ox,
        oy,
        Math.cos(a) * BULLET_SPEED.boss,
        Math.sin(a) * BULLET_SPEED.boss,
        Layer.enemy,
      );
    }
    return 0.8;
  }
  if (m.form === 'bear') {
    // Slow AOE: single heavy bullet aimed at player.
    V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss * 0.55, aim);
    spawnBullet(c.deps.spawnCtx, ox, oy, aim.x, aim.y, Layer.enemy);
    return 1.3;
  }
  // owl — radial 8-way burst.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    spawnBullet(
      c.deps.spawnCtx,
      ox,
      oy,
      Math.cos(a) * BULLET_SPEED.enemy,
      Math.sin(a) * BULLET_SPEED.enemy,
      Layer.enemy,
    );
  }
  return 1.6;
}

const FORM_ORDER: readonly LeszyForm[] = ['deer', 'bear', 'owl'];
function nextLeszyForm(current: LeszyForm): LeszyForm {
  const idx = FORM_ORDER.indexOf(current);
  return FORM_ORDER[(idx + 1) % FORM_ORDER.length] ?? 'deer';
}

/** Nocny Łowca fires an aimed pair whip-shot while the hounds do the chasing. */
function nocnyLowcaFire(c: MinibossCtx): number {
  const pos = c.world.get(c.id, Position);
  if (!pos) return 1;
  V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
  const base = Math.atan2(aim.y, aim.x);
  for (let i = -1; i <= 1; i += 2) {
    const a = base + i * 0.18;
    spawnBullet(
      c.deps.spawnCtx,
      pos.x,
      pos.y + BULLET_SPAWN_OFFSET.boss,
      Math.cos(a) * BULLET_SPEED.boss,
      Math.sin(a) * BULLET_SPEED.boss,
      Layer.enemy,
    );
  }
  return 0.9;
}

/** Madej: aimed heavy shot paired with a spike-lane drop on fixed cadence. */
function madejFire(c: MinibossCtx): number {
  const pos = c.world.get(c.id, Position);
  if (!pos) return MADEJ_FIRE_COOLDOWN;
  V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
  const base = Math.atan2(aim.y, aim.x);
  for (let i = -1; i <= 1; i++) {
    const a = base + i * 0.22;
    spawnBullet(
      c.deps.spawnCtx,
      pos.x,
      pos.y + BULLET_SPAWN_OFFSET.boss,
      Math.cos(a) * BULLET_SPEED.boss,
      Math.sin(a) * BULLET_SPEED.boss,
      Layer.enemy,
    );
  }
  return MADEJ_FIRE_COOLDOWN;
}

/** Madej: drop a persistent spike column in lane (spikeIndex % 3). */
function madejSpike(c: MinibossCtx): void {
  const m = c.world.get(c.id, Miniboss);
  if (!m || !c.deps.onSpawnSpikeLane) return;
  const laneIdx = m.spikeIndex % 3;
  const laneW = c.deps.bounds.width / 3;
  const laneX = laneW * (0.5 + laneIdx);
  c.deps.onSpawnSpikeLane(laneX);
  m.spikeIndex += 1;
}

/** Summon `NOCNY_LOWCA_HOUND_COUNT` hounds arcing around the miniboss. */
function summonHounds(c: MinibossCtx): void {
  const pos = c.world.get(c.id, Position);
  const m = c.world.get(c.id, Miniboss);
  if (!pos || !m || !c.deps.onSpawnHound) return;
  const half = (NOCNY_LOWCA_HOUND_COUNT - 1) / 2;
  for (let i = 0; i < NOCNY_LOWCA_HOUND_COUNT; i++) {
    const offset = (i - half) * 46;
    c.deps.onSpawnHound(pos.x + offset, pos.y + 30);
  }
  m.hounds = NOCNY_LOWCA_HOUND_COUNT;
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
        m.formT = 0;
      }
      c.deps.onPhaseChange?.('active');
      const m2 = c.world.get(c.id, Miniboss);
      if (m2 && m2.pattern === 'leszy') c.deps.onFormChange?.(m2.form);
      if (m2 && m2.pattern === 'nocny-lowca') summonHounds(c);
      if (m2 && m2.pattern === 'madej') {
        // First spike drops after MADEJ_SPIKE_SEC — `formT` doubles as the
        // spike-lane countdown (0 = due). Start at 0 so the first spike lands
        // quickly after the intro.
        m2.formT = MADEJ_SPIKE_SEC * 0.6;
        m2.spikeIndex = 0;
      }
    },
    onUpdate(dt, c) {
      const m = c.world.get(c.id, Miniboss);
      const hp = c.world.get(c.id, Hp);
      if (!m || !hp) return;
      if (hp.current <= 0) {
        fsm.trigger('killed');
        return;
      }
      if (m.pattern === 'rokita') {
        m.rootProgress = clamp(m.phaseT / ROKITA_ROOT_GROW_SEC, 0, 1);
        sweepMove(c, 55);
        m.fireCooldown -= dt;
        if (m.fireCooldown <= 0) {
          rokitaFire(c);
          m.fireCooldown = 1.1;
        }
      } else if (m.pattern === 'leszy') {
        // Shape-shift every LESZY_FORM_SEC.
        m.formT += dt;
        if (m.formT >= LESZY_FORM_SEC) {
          m.formT -= LESZY_FORM_SEC;
          m.form = nextLeszyForm(m.form);
          c.deps.onFormChange?.(m.form);
        }
        // Movement: deer rams faster, bear is slow, owl hovers fast side-to-side.
        const speed = m.form === 'deer' ? 95 : m.form === 'bear' ? 35 : 130;
        sweepMove(c, speed);
        m.fireCooldown -= dt;
        if (m.fireCooldown <= 0) {
          m.fireCooldown = leszyFire(c);
        }
      } else if (m.pattern === 'nocny-lowca') {
        // Spectral-horse sweep — faster than Rokita/Leszy-bear.
        sweepMove(c, 120);
        // Re-summon if the pack was wiped.
        const live = c.deps.countHounds?.() ?? m.hounds;
        m.hounds = live;
        if (live === 0) summonHounds(c);
        m.fireCooldown -= dt;
        if (m.fireCooldown <= 0) {
          m.fireCooldown = nocnyLowcaFire(c);
        }
      } else if (m.pattern === 'madej') {
        sweepMove(c, 50);
        m.formT += dt;
        if (m.formT >= MADEJ_SPIKE_SEC) {
          m.formT -= MADEJ_SPIKE_SEC;
          madejSpike(c);
        }
        m.fireCooldown -= dt;
        if (m.fireCooldown <= 0) {
          m.fireCooldown = madejFire(c);
        }
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
