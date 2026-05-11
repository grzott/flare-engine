import { Position } from '@flare-engine/ecs';
import { Boss } from '../../components';
import { BORUTA_SUMMON_COUNT, BULLET_SPAWN_OFFSET, BULLET_SPEED } from '../../config/gameplay';
import { Layer } from '../../layers';
import { spawnBullet } from '../../spawn';
import { type Direction2D, normalizeDirection } from '../../util/direction';
import { hexToArgb } from '../../visual-spec/color-util';
import { THEME_SPEC } from '../../visual-spec/theme';
import type { BossCtx, PhaseScript } from './types';

const ARGB_P1 = hexToArgb(THEME_SPEC.colors.hazardOrange);
const ARGB_P2 = hexToArgb(THEME_SPEC.colors.crimson);

const aim: Direction2D = { x: 0, y: 0 };

/** Spawn Boruta's summons once on phase-2 entry. */
function spawnBorutaSummons(c: BossCtx): void {
  const b = c.world.get(c.id, Boss);
  const pos = c.world.get(c.id, Position);
  if (!b || !pos || !c.deps.onSpawnSummon) return;
  if (b.summonsSpawned >= BORUTA_SUMMON_COUNT) return;
  const toSpawn = BORUTA_SUMMON_COUNT - b.summonsSpawned;
  for (let i = 0; i < toSpawn; i++) {
    const offset = (i - (BORUTA_SUMMON_COUNT - 1) / 2) * 60;
    c.deps.onSpawnSummon(pos.x + offset, pos.y + 40);
  }
  b.summonsSpawned = BORUTA_SUMMON_COUNT;
}

// Boruta (Zone 4).
// Phase 1: whip-chains — 4 bullets rotating around the boss centre.
// Phase 2: mud geysers — aimed 3-way + single heavy central drop.
//          Summons (3× Bies) are spawned once on phase-2 entry.
// Phase palette: P1=hazard 0xffe84b2a, P2=crimson 0xffd4213d (§10 visual-reference).
export const borutaScript: PhaseScript = {
  sweepSpeed1: 55,
  sweepSpeed2: 90,
  fire1Cooldown: 0.22,
  fire2Cooldown: 0.7,
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
    normalizeDirection(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
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
