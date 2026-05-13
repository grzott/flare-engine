import { Position } from '@flare-engine/ecs';
import { Color, Vec2 as V, type Vec2 } from '@flare-engine/math';
function hexToArgb(hex: string): number {
  return Color.toSkColor(Color.fromHex(hex));
}
import { BULLET_SPAWN_OFFSET, BULLET_SPEED } from '../../config/gameplay';
import { Layer } from '../../layers';
import { spawnBullet } from '../../spawn';

import { THEME_SPEC } from '../../visual-spec/theme';
import type { PhaseScript } from './types';

const ARGB_P1 = hexToArgb(THEME_SPEC.colors.moss);
const ARGB_P2 = hexToArgb(THEME_SPEC.colors.verdigris);

const aim: Vec2 = { x: 0, y: 0 };

// Borowy Król (Zone 2).
// Phase palette: P1=moss 0xff243a29, P2=verdigris 0xff4a7a6a (§10 visual-reference).
export const borowyScript: PhaseScript = {
  sweepSpeed1: 60,
  sweepSpeed2: 110,
  fire1Cooldown: 0.7,
  fire2Cooldown: 0.55,
  onPhase1Enter(c) {
    c.deps.onPaletteShift?.('phase1', ARGB_P1);
  },
  onPhase2Enter(c) {
    c.deps.onPaletteShift?.('phase2', ARGB_P2);
    const pos = c.world.get(c.id, Position);
    if (pos) {
      c.deps.onPhaseBreak?.(pos.x, pos.y);
      c.deps.onPhasePostFx?.('bloom+vignette');
    }
  },
  // Phase 1: rolling boulders — 2 arcing shots that fall heavy.
  fire1(c) {
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
    for (let i = -1; i <= 1; i += 2) {
      spawnBullet(
        c.deps.spawnCtx,
        pos.x + i * 18,
        pos.y + BULLET_SPAWN_OFFSET.boss,
        i * 60,
        BULLET_SPEED.boss * 0.9,
        Layer.enemy,
      );
    }
  },
  // Phase 2: aimed seed-shots from "root walls" — tight 5-way aim at player.
  fire2(c) {
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
    V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
    const baseAngle = Math.atan2(aim.y, aim.x);
    for (let i = -2; i <= 2; i++) {
      const a = baseAngle + i * 0.18;
      const vx = Math.cos(a) * BULLET_SPEED.boss;
      const vy = Math.sin(a) * BULLET_SPEED.boss;
      spawnBullet(c.deps.spawnCtx, pos.x, pos.y + BULLET_SPAWN_OFFSET.boss, vx, vy, Layer.enemy);
    }
  },
};
