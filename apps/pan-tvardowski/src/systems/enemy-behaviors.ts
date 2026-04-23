/**
 * Per-enemy movement + firing behaviors, indexed by `EnemyPattern`.
 *
 * Adding a new enemy is a single entry in `ENEMY_BEHAVIORS` — no edits to the
 * dispatch loop in `enemy-ai.ts`. Each behavior provides:
 *   - `move(e, pos, vel, dt, deps)` — writes to `vel` (and rarely `pos`).
 *   - `fire?(e, pos, aim, deps)` — aim vector is pre-normalized to
 *     `BULLET_SPEED.enemy`, pointing from enemy → player.
 *
 * Zero-alloc: behaviors receive the ECS component objects by reference and
 * mutate them in place. No closures per entity, no per-frame allocation.
 */

import type { Query } from '@flare-engine/engine';
import type { Vec2 } from '@flare-engine/math';
import type { EnemyData, EnemyPattern } from '../components';
import { BULLET_SPAWN_OFFSET, BULLET_SPEED, LICHO_BLINK_SEC } from '../config/gameplay';
import { Layer } from '../layers';
import { type SpawnCtx, spawnBullet } from '../spawn';
import type { Direction2D } from '../util/direction';

export interface EnemyDeps {
  spawnCtx: SpawnCtx;
  query: Query;
  playerX: number;
  playerY: number;
  bounds?: { width: number; height: number };
}

export interface EnemyBehavior {
  move(e: EnemyData, pos: Vec2, vel: Vec2, dt: number, deps: EnemyDeps): void;
  fire?(e: EnemyData, pos: Vec2, aim: Direction2D, deps: EnemyDeps): void;
}

// -- shared fire helpers ----------------------------------------------------

function fireFan(
  pos: Vec2,
  aim: Direction2D,
  spawnCtx: SpawnCtx,
  count: number,
  spreadRad: number,
  speedMul = 1,
): void {
  const base = Math.atan2(aim.y, aim.x);
  const half = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    const a = base + (i - half) * spreadRad;
    spawnBullet(
      spawnCtx,
      pos.x,
      pos.y + BULLET_SPAWN_OFFSET.enemy,
      Math.cos(a) * BULLET_SPEED.enemy * speedMul,
      Math.sin(a) * BULLET_SPEED.enemy * speedMul,
      Layer.enemy,
    );
  }
}

// -- registry ---------------------------------------------------------------

export const ENEMY_BEHAVIORS: Record<EnemyPattern, EnemyBehavior> = {
  skrzat: {
    move(e, _pos, vel) {
      vel.x = Math.cos(e.t * 3.2) * 90;
      vel.y = e.speed;
    },
  },

  latawiec: {
    move(e, _pos, vel) {
      vel.x = 0;
      vel.y = e.speed;
    },
    // Single aimed shot, softened x.
    fire(_e, pos, aim, deps) {
      spawnBullet(
        deps.spawnCtx,
        pos.x,
        pos.y + BULLET_SPAWN_OFFSET.enemy,
        aim.x * 0.6,
        aim.y,
        Layer.enemy,
      );
    },
  },

  czart: {
    move(e, _pos, vel) {
      vel.x = Math.cos(e.t * 2.1) * 110;
      vel.y = e.speed;
    },
    // 3-way spread ±20°.
    fire(_e, pos, aim, deps) {
      fireFan(pos, aim, deps.spawnCtx, 3, 0.35);
    },
  },

  bies: {
    // Hover-descend then strafe once past y=140.
    move(e, pos, vel) {
      if (pos.y < 140) {
        vel.x = 0;
        vel.y = e.speed;
      } else {
        vel.x = Math.sin(e.t * 1.4) * 140;
        vel.y = 30;
      }
    },
    // Aimed 3-burst, tight ±7°.
    fire(_e, pos, aim, deps) {
      fireFan(pos, aim, deps.spawnCtx, 3, 0.12);
    },
  },

  topielec: {
    // Emerges from the bottom: negative vy (upward). Gentle side-to-side drift.
    move(e, _pos, vel) {
      vel.x = Math.sin(e.t * 1.6) * 40;
      vel.y = e.speed;
    },
    // 4-way upward burst (N, NE, NW, + aimed); bullets come from top of sprite.
    fire(_e, pos, aim, deps) {
      const off = -BULLET_SPAWN_OFFSET.enemy;
      const s = BULLET_SPEED.enemy;
      spawnBullet(deps.spawnCtx, pos.x, pos.y + off, 0, -s, Layer.enemy);
      spawnBullet(deps.spawnCtx, pos.x, pos.y + off, s * 0.5, -s * 0.85, Layer.enemy);
      spawnBullet(deps.spawnCtx, pos.x, pos.y + off, -s * 0.5, -s * 0.85, Layer.enemy);
      spawnBullet(deps.spawnCtx, pos.x, pos.y + off, aim.x, aim.y, Layer.enemy);
    },
  },

  strzyga: {
    // Swooping arc: cosine-driven horizontal with slight vertical wave.
    move(e, _pos, vel) {
      vel.x = Math.cos(e.t * 1.8) * 150;
      vel.y = e.speed * (0.7 + 0.3 * Math.sin(e.t * 1.3));
    },
    // Paired 2-way aimed shot ±12°.
    fire(_e, pos, aim, deps) {
      const base = Math.atan2(aim.y, aim.x);
      for (let i = -1; i <= 1; i += 2) {
        const a = base + i * 0.21;
        spawnBullet(
          deps.spawnCtx,
          pos.x,
          pos.y + BULLET_SPAWN_OFFSET.enemy,
          Math.cos(a) * BULLET_SPEED.enemy,
          Math.sin(a) * BULLET_SPEED.enemy,
          Layer.enemy,
        );
      }
    },
  },

  mamuna: {
    // Horizontal sweep with a steady slow descent.
    move(e, _pos, vel) {
      vel.x = Math.sin(e.t * 1.1) * 140;
      vel.y = e.speed;
    },
    // Drops a mine: short-range downward bullet.
    fire(_e, pos, _aim, deps) {
      spawnBullet(
        deps.spawnCtx,
        pos.x,
        pos.y + BULLET_SPAWN_OFFSET.enemy,
        0,
        BULLET_SPEED.enemy * 0.6,
        Layer.enemy,
      );
    },
  },

  licho: {
    // Slow drift; teleports sideways at LICHO_BLINK_SEC intervals.
    move(e, pos, vel, dt, deps) {
      e.blinkT -= dt;
      if (e.blinkT <= 0) {
        const bw = deps.bounds?.width ?? 360;
        const h = Math.sin(e.t * 12.9898 + pos.x * 78.233) * 43758.5453;
        const r = h - Math.floor(h);
        pos.x = 40 + r * Math.max(1, bw - 80);
        e.blinkT = LICHO_BLINK_SEC;
      }
      vel.x = 0;
      vel.y = e.speed;
    },
    // Heavy single aimed shot, slightly slower.
    fire(_e, pos, aim, deps) {
      spawnBullet(
        deps.spawnCtx,
        pos.x,
        pos.y + BULLET_SPAWN_OFFSET.enemy,
        aim.x * 0.9,
        aim.y * 0.9,
        Layer.enemy,
      );
    },
  },

  nocnica: {
    // Fast straight descent; no horizontal drift.
    move(e, _pos, vel) {
      vel.x = 0;
      vel.y = e.speed;
    },
    // Radial 8-way burst.
    fire(_e, pos, _aim, deps) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        spawnBullet(
          deps.spawnCtx,
          pos.x,
          pos.y + BULLET_SPAWN_OFFSET.enemy,
          Math.cos(a) * BULLET_SPEED.enemy,
          Math.sin(a) * BULLET_SPEED.enemy,
          Layer.enemy,
        );
      }
    },
  },

  dziwozona: {
    // Slow hover — drifts sideways gently, non-firing summoner.
    move(e, _pos, vel) {
      vel.x = Math.sin(e.t * 0.9) * 30;
      vel.y = e.speed;
    },
  },

  wapierz: {
    // Slow heavy tank — gentle side-drift, steady descent.
    move(e, _pos, vel) {
      vel.x = Math.sin(e.t * 0.7) * 60;
      vel.y = e.speed;
    },
    // Heavy 5-way cross: cardinal-ish fan around the aim vector.
    fire(_e, pos, aim, deps) {
      fireFan(pos, aim, deps.spawnCtx, 5, 0.22);
    },
  },

  poludnica: {
    // Cross-screen rush — fast horizontal, slow descent; flip sides each ~4s.
    move(e, _pos, vel) {
      const dir = Math.sin(e.t * 0.8) >= 0 ? 1 : -1;
      vel.x = dir * 180;
      vel.y = e.speed;
    },
    // Wide scythe sweep — 5 bullets fanned horizontally.
    fire(_e, pos, aim, deps) {
      fireFan(pos, aim, deps.spawnCtx, 5, 0.32, 1.05);
    },
  },

  hound: {
    // Homing hound — locks onto the player direction each tick.
    move(e, pos, vel, _dt, deps) {
      const dx = deps.playerX - pos.x;
      const dy = deps.playerY - pos.y;
      const len = Math.hypot(dx, dy) || 1;
      vel.x = (dx / len) * e.speed;
      vel.y = (dy / len) * e.speed;
    },
  },
};
