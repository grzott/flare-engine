import type { Query, World } from '@flare-engine/ecs';
import { Position, Velocity } from '@flare-engine/ecs';
import { Boss, type BossPhase, Hp } from '../components';
import { Layer } from '../layers';
import type { SpawnCtx } from '../spawn';
import { spawnBullet } from '../spawn';
import { destroyEntity } from './entity-ops';

const BOSS_BULLET_SPEED = 260;
const PHASE2_HP_RATIO = 0.5;
const DYING_INTERVAL = 0.18;
const DYING_TOTAL = 12;

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
    return { alive: true, hp: hp.current, hpMax: hp.max, phase: b.phase, invulnerable };
  }
  return { alive: false, hp: 0, hpMax: 0, phase: 'defeated', invulnerable: true };
}

function setPhase(b: { phase: BossPhase; phaseT: number }, next: BossPhase): void {
  if (b.phase === next) return;
  b.phase = next;
  b.phaseT = 0;
}

function firePhase1(ctx: SpawnCtx, x: number, y: number, t: number): void {
  const sweep = Math.sin(t * 1.8) * 160;
  spawnBullet(ctx, x, y + 32, sweep, BOSS_BULLET_SPEED, Layer.enemy);
}

function firePhase2(ctx: SpawnCtx, x: number, y: number, playerX: number, playerY: number): void {
  const dx = playerX - x;
  const dy = playerY - y;
  const mag = Math.hypot(dx, dy) || 1;
  const baseVx = (dx / mag) * BOSS_BULLET_SPEED;
  const baseVy = (dy / mag) * BOSS_BULLET_SPEED;
  for (const angle of [-0.25, 0, 0.25]) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const vx = baseVx * c - baseVy * s;
    const vy = baseVx * s + baseVy * c;
    spawnBullet(ctx, x, y + 32, vx, vy, Layer.enemy);
  }
}

export function updateBoss(world: World, dt: number, deps: BossDeps): void {
  for (const id of deps.query) {
    const b = world.get(id, Boss);
    const pos = world.get(id, Position);
    const vel = world.get(id, Velocity);
    const hp = world.get(id, Hp);
    if (!b || !pos || !vel || !hp) continue;

    b.t += dt;
    b.phaseT += dt;

    if (b.phase === 'entering') {
      vel.x = 0;
      vel.y = 60;
      if (pos.y >= b.targetY) {
        pos.y = b.targetY;
        vel.y = 0;
        setPhase(b, 'phase1');
        deps.onPhaseChange?.('phase1');
      }
      continue;
    }

    if (b.phase === 'defeated') continue;

    if (b.phase === 'dying') {
      vel.x = 0;
      vel.y = 0;
      b.fireCooldown -= dt;
      if (b.fireCooldown <= 0 && b.dyingExplosions < DYING_TOTAL) {
        const ox = pos.x + (Math.random() - 0.5) * 72;
        const oy = pos.y + (Math.random() - 0.5) * 48;
        deps.onExplosion?.(ox, oy);
        b.dyingExplosions += 1;
        b.fireCooldown = DYING_INTERVAL;
      }
      if (b.dyingExplosions >= DYING_TOTAL) {
        setPhase(b, 'defeated');
        deps.onDefeated?.();
        destroyEntity(world, deps.spawnCtx.coll, id);
      }
      continue;
    }

    if (hp.current <= 0) {
      setPhase(b, 'dying');
      b.fireCooldown = 0;
      continue;
    }

    if (b.phase === 'phase1' && hp.current / hp.max <= PHASE2_HP_RATIO) {
      setPhase(b, 'phase2');
      deps.onPhaseChange?.('phase2');
    }

    const sweepSpeed = b.phase === 'phase2' ? 110 : 70;
    vel.x = Math.cos(b.t * 1.1) * sweepSpeed;
    vel.y = 0;

    const halfW = 48;
    if (pos.x < halfW) {
      pos.x = halfW;
      vel.x = Math.abs(vel.x);
    } else if (pos.x > deps.bounds.width - halfW) {
      pos.x = deps.bounds.width - halfW;
      vel.x = -Math.abs(vel.x);
    }

    b.fireCooldown -= dt;
    if (b.fireCooldown <= 0) {
      if (b.phase === 'phase2') {
        firePhase2(deps.spawnCtx, pos.x, pos.y, deps.playerX, deps.playerY);
        b.fireCooldown = 0.9;
      } else {
        firePhase1(deps.spawnCtx, pos.x, pos.y, b.t);
        b.fireCooldown = 0.55;
      }
    }
  }
}
