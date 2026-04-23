import { Position } from '@flare-engine/ecs';
import { clamp } from '@flare-engine/math';
import { Boss } from '../../components';
import {
  BULLET_SPAWN_OFFSET,
  BULLET_SPEED,
  WODNIK_SHIELD_MINIONS,
  WODNIK_SHIELD_REBUILD_SEC,
} from '../../config/gameplay';
import { Layer } from '../../layers';
import { spawnBullet } from '../../spawn';
import { type Direction2D, normalizeDirection } from '../../util/direction';
import type { BossCtx, PhaseScript } from './types';

const aim: Direction2D = { x: 0, y: 0 };

/** Raise the bubble shield and spawn WODNIK_SHIELD_MINIONS Topielec minions. */
function raiseWodnikShield(c: BossCtx): void {
  const b = c.world.get(c.id, Boss);
  const pos = c.world.get(c.id, Position);
  if (!b || !pos) return;
  b.shieldActive = true;
  b.shieldDownFor = 0;
  b.minionsAlive = WODNIK_SHIELD_MINIONS;
  const spawn = c.deps.onSpawnShieldMinion;
  if (!spawn) return;
  const bottomY = c.deps.bounds.height + 40;
  const halfCount = (WODNIK_SHIELD_MINIONS - 1) / 2;
  for (let i = 0; i < WODNIK_SHIELD_MINIONS; i++) {
    const offset = (i - halfCount) * 70;
    spawn(clamp(pos.x + offset, 40, c.deps.bounds.width - 40), bottomY);
  }
}

/** Per-frame shield-state update — drops shield when minions die, re-raises after rebuild. */
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

// Wodnik Wiślany (Zone 3).
// Phase 1: three staggered vertical water-spout columns.
// Phase 2: lighter aimed spout + bubble-shield.
export const wodnikScript: PhaseScript = {
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
  onPhase2Enter: raiseWodnikShield,
  onPhase2Update: tickWodnikShield,
  onPhase2Exit(c) {
    const b = c.world.get(c.id, Boss);
    if (b) {
      b.shieldActive = false;
      b.minionsAlive = 0;
    }
  },
};
