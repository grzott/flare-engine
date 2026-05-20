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

const _t = BOSS_TUNING_DEFS['baba-jaga'];

const ARGB_P1 = hexToArgb(THEME_SPEC.colors.crimsonDeep);
const ARGB_P2 = hexToArgb(THEME_SPEC.colors.crimson);
const ARGB_P3 = hexToArgb(THEME_SPEC.colors.white);

const aim: Vec2 = { x: 0, y: 0 };

// Baba Jaga (Zone 5).
// Phase 1: cauldron bombs — 3 arcing heavy shots with slight aim spread.
// Phase 2: mortar flight — aimed rush, single heavy + flank pair ±10°.
// Phase 3: broom-laser 360° sweep — 12-ray radial pinwheel spun by b.t.
// Phase palette: P1=crimson-deep 0xff7a1322, P2=crimson 0xffd4213d,
//   P3=white-out 0xffffffff (§10 visual-reference, M3).
export const babaJagaScript: PhaseScript = {
  threePhase: true,
  sweepSpeed1: _t.sweepSpeed1,
  sweepSpeed2: _t.sweepSpeed2,
  sweepSpeed3: _t.sweepSpeed3,
  fire1Cooldown: _t.fire1CooldownSec,
  fire2Cooldown: _t.fire2CooldownSec,
  fire3Cooldown: _t.fire3CooldownSec,
  fire1(c) {
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
    V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss * 0.85, aim);
    const baseAngle = Math.atan2(aim.y, aim.x);
    for (let i = -1; i <= 1; i++) {
      const a = baseAngle + i * 0.22;
      spawnBullet(
        c.deps.spawnCtx,
        pos.x,
        pos.y + BULLET_SPAWN_OFFSET.boss,
        Math.cos(a) * BULLET_SPEED.boss * 0.85,
        Math.sin(a) * BULLET_SPEED.boss * 0.85,
        Layer.enemy,
      );
    }
  },
  fire2(c) {
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
    V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
    const baseAngle = Math.atan2(aim.y, aim.x);
    spawnBullet(
      c.deps.spawnCtx,
      pos.x,
      pos.y + BULLET_SPAWN_OFFSET.boss,
      aim.x,
      aim.y,
      Layer.enemy,
    );
    for (let i = -1; i <= 1; i += 2) {
      const a = baseAngle + i * 0.175;
      spawnBullet(
        c.deps.spawnCtx,
        pos.x,
        pos.y + BULLET_SPAWN_OFFSET.boss,
        Math.cos(a) * BULLET_SPEED.boss,
        Math.sin(a) * BULLET_SPEED.boss,
        Layer.enemy,
      );
    }
  },
  fire3(c) {
    const pos = c.world.get(c.id, Position);
    const b = c.world.get(c.id, Boss);
    if (!pos || !b) return;
    const rays = 12;
    const spin = b.t * 1.6;
    for (let i = 0; i < rays; i++) {
      const a = spin + (i / rays) * Math.PI * 2;
      spawnBullet(
        c.deps.spawnCtx,
        pos.x,
        pos.y,
        Math.cos(a) * BULLET_SPEED.boss * 0.95,
        Math.sin(a) * BULLET_SPEED.boss * 0.95,
        Layer.enemy,
      );
    }
  },
  onPhase1Enter(c) {
    c.deps.onPaletteShift?.('phase1', ARGB_P1);
  },
  onPhase2Enter(c) {
    c.deps.onPaletteShift?.('phase2', ARGB_P2);
    const pos = c.world.get(c.id, Position);
    if (pos) {
      c.deps.onPhaseBreak?.(pos.x, pos.y);
      c.deps.onPhasePostFx?.('bloom+chrom+flash');
    }
  },
  onPhase3Enter(c) {
    // White-out finale (M3): full-screen white palette + detonation burst.
    c.deps.onPaletteShift?.('phase3', ARGB_P3);
    const pos = c.world.get(c.id, Position);
    if (pos) {
      c.deps.onPhaseBreak?.(pos.x, pos.y);
    }
  },
};
