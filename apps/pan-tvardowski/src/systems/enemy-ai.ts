import type { Query, World } from '@flare-engine/engine';
import { Position, Velocity } from '@flare-engine/engine';
import { Enemy } from '../components';
import { BULLET_SPAWN_OFFSET, BULLET_SPEED, LICHO_BLINK_SEC } from '../config/gameplay';
import { Layer } from '../layers';
import { type SpawnCtx, spawnBullet } from '../spawn';
import { type Direction2D, normalizeDirection } from '../util/direction';

const aim: Direction2D = { x: 0, y: 0 };

export interface EnemyDeps {
  spawnCtx: SpawnCtx;
  query: Query;
  playerX: number;
  playerY: number;
  bounds?: { width: number; height: number };
}

/**
 * Enemy AI for Zones 1–2:
 *  - skrzat: zig-zag sine kamikaze (fires nothing).
 *  - latawiec: straight dive + aimed single shot every `fireInterval` s.
 *  - czart: sine wave + aimed 3-way spread.
 *  - bies: hover + strafe + aimed 3-burst (tight cluster).
 */
export function updateEnemyAI(world: World, dt: number, deps: EnemyDeps): void {
  for (const id of deps.query) {
    const e = world.get(id, Enemy);
    const pos = world.get(id, Position);
    const vel = world.get(id, Velocity);
    if (!e || !pos || !vel) continue;
    e.t += dt;

    if (e.pattern === 'skrzat') {
      vel.x = Math.cos(e.t * 3.2) * 90;
      vel.y = e.speed;
    } else if (e.pattern === 'czart') {
      vel.x = Math.cos(e.t * 2.1) * 110;
      vel.y = e.speed;
    } else if (e.pattern === 'bies') {
      // Hover-descend then strafe once past y=140.
      if (pos.y < 140) {
        vel.x = 0;
        vel.y = e.speed;
      } else {
        vel.x = Math.sin(e.t * 1.4) * 140;
        vel.y = 30;
      }
    } else if (e.pattern === 'topielec') {
      // Emerges from the bottom: negative vy (upward). Gentle side-to-side drift.
      vel.x = Math.sin(e.t * 1.6) * 40;
      vel.y = e.speed;
    } else if (e.pattern === 'strzyga') {
      // Swooping arc: cosine-driven horizontal with slight vertical wave.
      vel.x = Math.cos(e.t * 1.8) * 150;
      vel.y = e.speed * (0.7 + 0.3 * Math.sin(e.t * 1.3));
    } else if (e.pattern === 'mamuna') {
      // Horizontal sweep with a steady slow descent.
      vel.x = Math.sin(e.t * 1.1) * 140;
      vel.y = e.speed;
    } else if (e.pattern === 'licho') {
      // Slow drift; teleports sideways at LICHO_BLINK_SEC intervals.
      e.blinkT -= dt;
      if (e.blinkT <= 0) {
        const bw = deps.bounds?.width ?? 360;
        // Deterministic-ish jitter per enemy: hash t into [0,1).
        const h = Math.sin(e.t * 12.9898 + pos.x * 78.233) * 43758.5453;
        const r = h - Math.floor(h);
        pos.x = 40 + r * Math.max(1, bw - 80);
        e.blinkT = LICHO_BLINK_SEC;
      }
      vel.x = 0;
      vel.y = e.speed;
    } else if (e.pattern === 'nocnica') {
      // Fast straight descent; no horizontal drift.
      vel.x = 0;
      vel.y = e.speed;
    } else if (e.pattern === 'dziwozona') {
      // Slow hover — drifts sideways gently, non-firing summoner.
      vel.x = Math.sin(e.t * 0.9) * 30;
      vel.y = e.speed;
    } else if (e.pattern === 'wapierz') {
      // Slow heavy tank — gentle side-drift, steady descent.
      vel.x = Math.sin(e.t * 0.7) * 60;
      vel.y = e.speed;
    } else if (e.pattern === 'poludnica') {
      // Cross-screen rush — fast horizontal, slow descent; flip sides each ~4 s.
      const dir = Math.sin(e.t * 0.8) >= 0 ? 1 : -1;
      vel.x = dir * 180;
      vel.y = e.speed;
    } else if (e.pattern === 'hound') {
      // Homing hound — locks onto the player direction each tick.
      const dx = deps.playerX - pos.x;
      const dy = deps.playerY - pos.y;
      const len = Math.hypot(dx, dy) || 1;
      vel.x = (dx / len) * e.speed;
      vel.y = (dy / len) * e.speed;
    } else {
      vel.x = 0;
      vel.y = e.speed;
    }

    if (!Number.isFinite(e.fireInterval)) continue;
    e.fireCooldown -= dt;
    if (e.fireCooldown <= 0) {
      normalizeDirection(deps.playerX - pos.x, deps.playerY - pos.y, BULLET_SPEED.enemy, aim);
      if (e.pattern === 'czart') {
        // 3-way spread ±20°.
        for (let i = -1; i <= 1; i++) {
          const a = Math.atan2(aim.y, aim.x) + i * 0.35;
          const vx = Math.cos(a) * BULLET_SPEED.enemy;
          const vy = Math.sin(a) * BULLET_SPEED.enemy;
          spawnBullet(deps.spawnCtx, pos.x, pos.y + BULLET_SPAWN_OFFSET.enemy, vx, vy, Layer.enemy);
        }
      } else if (e.pattern === 'bies') {
        // Aimed 3-burst, tight ±7°.
        for (let i = -1; i <= 1; i++) {
          const a = Math.atan2(aim.y, aim.x) + i * 0.12;
          const vx = Math.cos(a) * BULLET_SPEED.enemy;
          const vy = Math.sin(a) * BULLET_SPEED.enemy;
          spawnBullet(deps.spawnCtx, pos.x, pos.y + BULLET_SPAWN_OFFSET.enemy, vx, vy, Layer.enemy);
        }
      } else if (e.pattern === 'topielec') {
        // 4-way upward burst (N, NE, NW, + aimed); bullets come from top of sprite.
        const off = -BULLET_SPAWN_OFFSET.enemy;
        const speeds: [number, number][] = [
          [0, -BULLET_SPEED.enemy],
          [BULLET_SPEED.enemy * 0.5, -BULLET_SPEED.enemy * 0.85],
          [-BULLET_SPEED.enemy * 0.5, -BULLET_SPEED.enemy * 0.85],
          [aim.x, aim.y],
        ];
        for (const [vx, vy] of speeds) {
          spawnBullet(deps.spawnCtx, pos.x, pos.y + off, vx, vy, Layer.enemy);
        }
      } else if (e.pattern === 'strzyga') {
        // Paired 2-way aimed shot ±12°.
        for (let i = -1; i <= 1; i += 2) {
          const a = Math.atan2(aim.y, aim.x) + i * 0.21;
          const vx = Math.cos(a) * BULLET_SPEED.enemy;
          const vy = Math.sin(a) * BULLET_SPEED.enemy;
          spawnBullet(deps.spawnCtx, pos.x, pos.y + BULLET_SPAWN_OFFSET.enemy, vx, vy, Layer.enemy);
        }
      } else if (e.pattern === 'mamuna') {
        // Drops a mine: short-range downward bullet.
        spawnBullet(
          deps.spawnCtx,
          pos.x,
          pos.y + BULLET_SPAWN_OFFSET.enemy,
          0,
          BULLET_SPEED.enemy * 0.6,
          Layer.enemy,
        );
      } else if (e.pattern === 'licho') {
        // Heavy single aimed shot, slightly slower but otherwise just one bullet.
        spawnBullet(
          deps.spawnCtx,
          pos.x,
          pos.y + BULLET_SPAWN_OFFSET.enemy,
          aim.x * 0.9,
          aim.y * 0.9,
          Layer.enemy,
        );
      } else if (e.pattern === 'nocnica') {
        // Radial 8-way burst.
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const vx = Math.cos(a) * BULLET_SPEED.enemy;
          const vy = Math.sin(a) * BULLET_SPEED.enemy;
          spawnBullet(deps.spawnCtx, pos.x, pos.y + BULLET_SPAWN_OFFSET.enemy, vx, vy, Layer.enemy);
        }
      } else if (e.pattern === 'wapierz') {
        // Heavy 5-way cross: cardinal-ish fan around the aim vector.
        const base = Math.atan2(aim.y, aim.x);
        for (let i = -2; i <= 2; i++) {
          const a = base + i * 0.22;
          const vx = Math.cos(a) * BULLET_SPEED.enemy;
          const vy = Math.sin(a) * BULLET_SPEED.enemy;
          spawnBullet(deps.spawnCtx, pos.x, pos.y + BULLET_SPAWN_OFFSET.enemy, vx, vy, Layer.enemy);
        }
      } else if (e.pattern === 'poludnica') {
        // Wide scythe sweep — 5 bullets fanned horizontally.
        const base = Math.atan2(aim.y, aim.x);
        for (let i = -2; i <= 2; i++) {
          const a = base + i * 0.32;
          const vx = Math.cos(a) * BULLET_SPEED.enemy * 1.05;
          const vy = Math.sin(a) * BULLET_SPEED.enemy * 1.05;
          spawnBullet(deps.spawnCtx, pos.x, pos.y + BULLET_SPAWN_OFFSET.enemy, vx, vy, Layer.enemy);
        }
      } else {
        // latawiec — single aimed shot, softened x.
        spawnBullet(
          deps.spawnCtx,
          pos.x,
          pos.y + BULLET_SPAWN_OFFSET.enemy,
          aim.x * 0.6,
          aim.y,
          Layer.enemy,
        );
      }
      e.fireCooldown = e.fireInterval;
    }
  }
}
