import { Position } from '@flare-engine/ecs';
import { Boss } from '../../components';
import { BULLET_SPAWN_OFFSET, BULLET_SPEED } from '../../config/gameplay';
import { Layer } from '../../layers';
import { spawnBullet } from '../../spawn';
import { type Direction2D, normalizeDirection } from '../../util/direction';
import { hexToArgb } from '../../visual-spec/color-util';
import { THEME_SPEC } from '../../visual-spec/theme';
import type { PhaseScript } from './types';

const ARGB_P1 = hexToArgb(THEME_SPEC.colors.terracotta);
const ARGB_P2 = hexToArgb(THEME_SPEC.colors.rust);

const aim: Direction2D = { x: 0, y: 0 };

// Smok Krzemionkowski (Zone 1).
// Phase palette: P1=terracotta 0xffb05a3c, P2=rust 0xff8b3a1f (§10 visual-reference).
export const smokScript: PhaseScript = {
  sweepSpeed1: 80,
  sweepSpeed2: 140,
  fire1Cooldown: 0.5,
  fire2Cooldown: 1.1,
  onPhase1Enter(c) {
    c.deps.onPaletteShift?.('phase1', ARGB_P1);
  },
  onPhase2Enter(c) {
    c.deps.onPaletteShift?.('phase2', ARGB_P2);
    const pos = c.world.get(c.id, Position);
    if (pos) {
      c.deps.onPhaseBreak?.(pos.x, pos.y);
      c.deps.onPhasePostFx?.('bloom+chrom');
    }
  },
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
