import { Position } from '@flare-engine/ecs';
import { Vec2 as V, type Vec2 } from '@flare-engine/math';
import { Boss } from '../../components';
import { BORUTA_SUMMON_COUNT, BULLET_SPAWN_OFFSET, BULLET_SPEED } from '../../config/gameplay';
import { Layer } from '../../layers';
import { spawnBullet } from '../../spawn';
import { hexToArgb } from '../../util/hex';
import { BOSS_LAYOUT_DEFS } from '../../visual-spec/boss-layouts';

import { BOSS_TUNING_DEFS } from '../../visual-spec/boss-tuning';
import { THEME_SPEC } from '../../visual-spec/theme';
import type { BossCtx, PhaseScript } from './types';

const _t = BOSS_TUNING_DEFS.boruta;

const ARGB_P1 = hexToArgb(THEME_SPEC.colors.hazardOrange);
const ARGB_P2 = hexToArgb(THEME_SPEC.colors.crimson);

const aim: Vec2 = { x: 0, y: 0 };

const BORUTA_LAYOUT = BOSS_LAYOUT_DEFS.find((d) => d.id === 'boruta');
const BORUTA_BIES_SUMMON = BORUTA_LAYOUT?.summons?.[0];

/** Spawn Boruta's summons once on phase-2 entry. */
function spawnBorutaSummons(c: BossCtx): void {
  const b = c.world.get(c.id, Boss);
  const pos = c.world.get(c.id, Position);
  if (!b || !pos || !c.deps.onSpawnSummon) return;
  if (b.summonsSpawned >= BORUTA_SUMMON_COUNT) return;
  const ox = BORUTA_BIES_SUMMON?.ox ?? 60;
  const oy = BORUTA_BIES_SUMMON?.oy ?? 40;
  const origin = BORUTA_BIES_SUMMON?.origin;
  const toSpawn = BORUTA_SUMMON_COUNT - b.summonsSpawned;
  for (let i = 0; i < toSpawn; i++) {
    const offset = (i - (BORUTA_SUMMON_COUNT - 1) / 2) * ox;
    let spawnX: number;
    let spawnY: number;
    if (origin === 'screen-bottom') {
      spawnX = pos.x + offset;
      spawnY = c.deps.bounds.height + oy;
    } else {
      spawnX = pos.x + offset;
      spawnY = pos.y + oy;
    }
    c.deps.onSpawnSummon(spawnX, spawnY);
  }
  b.summonsSpawned = BORUTA_SUMMON_COUNT;
}

// Boruta (Zone 4).
// Phase 1: whip-chains — 4 bullets rotating around the boss centre.
// Phase 2: mud geysers — aimed 3-way + single heavy central drop.
//          Summons (3× Bies) are spawned once on phase-2 entry.
// Phase palette: P1=hazard 0xffe84b2a, P2=crimson 0xffd4213d (§10 visual-reference).
export const borutaScript: PhaseScript = {
  sweepSpeed1: _t.sweepSpeed1,
  sweepSpeed2: _t.sweepSpeed2,
  fire1Cooldown: _t.fire1CooldownSec,
  fire2Cooldown: _t.fire2CooldownSec,
  onPhase1Enter(c) {
    c.deps.onPaletteShift?.('phase1', ARGB_P1);
  },
  fire1(c) {
    const pos = c.world.get(c.id, Position);
    const b = c.world.get(c.id, Boss);
    if (!pos || !b) return;
    for (let i = 0; i < 4; i++) {
      const a = b.t * 2.1 + (i / 4) * Math.PI * 2;
      spawnBullet(
        c.deps.spawnCtx,
        pos.x + Math.cos(a) * 28,
        pos.y + Math.sin(a) * 28,
        Math.cos(a) * BULLET_SPEED.boss * 0.95,
        Math.sin(a) * BULLET_SPEED.boss * 0.95,
        Layer.enemy,
      );
    }
  },
  fire2(c) {
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
    V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
    const baseAngle = Math.atan2(aim.y, aim.x);
    for (let i = -1; i <= 1; i++) {
      const a = baseAngle + i * 0.24;
      spawnBullet(
        c.deps.spawnCtx,
        pos.x,
        pos.y + BULLET_SPAWN_OFFSET.boss,
        Math.cos(a) * BULLET_SPEED.boss,
        Math.sin(a) * BULLET_SPEED.boss,
        Layer.enemy,
      );
    }
    spawnBullet(
      c.deps.spawnCtx,
      pos.x,
      pos.y + BULLET_SPAWN_OFFSET.boss,
      0,
      BULLET_SPEED.boss * 1.05,
      Layer.enemy,
    );
  },
  onPhase2Enter(c) {
    c.deps.onPaletteShift?.('phase2', ARGB_P2);
    const pos = c.world.get(c.id, Position);
    if (pos) {
      c.deps.onPhaseBreak?.(pos.x, pos.y);
      c.deps.onPhasePostFx?.('bloom+flash');
    }
    spawnBorutaSummons(c);
  },
};
