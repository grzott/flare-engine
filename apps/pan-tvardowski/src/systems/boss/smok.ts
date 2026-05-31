import { Position } from '@flare-engine/ecs';
import { Vec2 as V, type Vec2 } from '@flare-engine/math';
import { Boss } from '../../components';
import { BULLET_SPAWN_OFFSET, BULLET_SPEED } from '../../config/gameplay';
import { Layer } from '../../layers';
import { spawnBullet } from '../../spawn';
import { hexToArgb } from '../../util/hex';

import { BOSS_TUNING_DEFS } from '../../visual-spec/boss-tuning';
import { THEME_SPEC } from '../../visual-spec/theme';
import type { PhaseScript } from './types';

const _t = BOSS_TUNING_DEFS['smok-krzemionkowski'];

const ARGB_P1 = hexToArgb(THEME_SPEC.colors.terracotta);
const ARGB_P2 = hexToArgb(THEME_SPEC.colors.rust);

const aim: Vec2 = { x: 0, y: 0 };

// Smok Krzemionkowski (Zone 1).
// Phase palette: P1=terracotta 0xffb05a3c, P2=rust 0xff8b3a1f (§10 visual-reference).
export const smokScript: PhaseScript = {
  sweepSpeed1: _t.sweepSpeed1,
  sweepSpeed2: _t.sweepSpeed2,
  fire1Cooldown: _t.fire1CooldownSec,
  fire2Cooldown: _t.fire2CooldownSec,
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
    V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
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
