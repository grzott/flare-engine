import { Position } from '@flare-engine/ecs';
import { Boss } from '../../components';
import {
  BULLET_SPAWN_OFFSET,
  BULLET_SPEED,
  MEFISTOFELES_FIREPIT_SEC,
  MEFISTOFELES_P1_FIRE,
  MEFISTOFELES_P2_FIRE,
} from '../../config/gameplay';
import { Layer } from '../../layers';
import { spawnBullet } from '../../spawn';
import { type Direction2D, normalizeDirection } from '../../util/direction';
import { hexToArgb } from '../../visual-spec/color-util';
import { THEME_SPEC } from '../../visual-spec/theme';
import type { PhaseScript } from './types';

const ARGB_P1 = hexToArgb(THEME_SPEC.colors.gold);
const ARGB_P2 = hexToArgb(THEME_SPEC.colors.terracotta);
const ARGB_P3 = hexToArgb(THEME_SPEC.colors.crimson);

const aim: Direction2D = { x: 0, y: 0 };

/**
 * Mefistofeles — Karczma "Rzym" final boss (build plan §9, three phases).
 * Phase 1: contract-scroll projectiles — a 3-fan of aimed bullets every
 *   {@link MEFISTOFELES_P1_FIRE} s.
 * Phase 2: fire-pit persistent AOE + double horn-shots (±0.3 rad). Fire-pits
 *   drop every {@link MEFISTOFELES_FIREPIT_SEC} s below the boss.
 * Phase 3: spawns the mirror-twin clone at enter; boss keeps firing a 2-fan
 *   while the mirror-twin system tracks player + fires downward shots.
 */
export const mefistofelesScript: PhaseScript = {
  threePhase: true,
  sweepSpeed1: 55,
  sweepSpeed2: 80,
  sweepSpeed3: 40,
  fire1Cooldown: MEFISTOFELES_P1_FIRE,
  fire2Cooldown: MEFISTOFELES_P2_FIRE,
  fire3Cooldown: MEFISTOFELES_P2_FIRE,
  fire1(c) {
    // 3-fan of aimed contract scrolls.
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
    normalizeDirection(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
    const base = Math.atan2(aim.y, aim.x);
    for (let i = -1; i <= 1; i++) {
      const a = base + i * 0.2;
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
  fire2(c) {
    // Two horn-shots ±0.3 rad from aim line.
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
    normalizeDirection(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
    const base = Math.atan2(aim.y, aim.x);
    for (let i = -1; i <= 1; i += 2) {
      const a = base + i * 0.3;
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
    // 2-fan aimed shots from the boss while the mirror-twin fires on its own.
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
    normalizeDirection(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
    const base = Math.atan2(aim.y, aim.x);
    for (let i = -1; i <= 1; i += 2) {
      const a = base + i * 0.12;
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
    const b = c.world.get(c.id, Boss);
    if (b) b.firepitCooldown = MEFISTOFELES_FIREPIT_SEC * 0.3;
  },
  onPhase2Update(dt, c) {
    const b = c.world.get(c.id, Boss);
    const pos = c.world.get(c.id, Position);
    if (!b || !pos) return;
    b.firepitCooldown -= dt;
    if (b.firepitCooldown <= 0) {
      c.deps.onSpawnFirepit?.(pos.x, pos.y + 48);
      b.firepitCooldown = MEFISTOFELES_FIREPIT_SEC;
    }
  },
  onPhase3Enter(c) {
    c.deps.onPaletteShift?.('phase3', ARGB_P3);
    const b = c.world.get(c.id, Boss);
    const pos = c.world.get(c.id, Position);
    if (!b || !pos) return;
    c.deps.onPhaseBreak?.(pos.x, pos.y);
    if (!c.deps.onSpawnMirrorTwin) return;
    // Twin starts mirrored above the player position (its per-tick system
    // drives its actual placement, this is just a harmless initial spawn).
    b.twinId = c.deps.onSpawnMirrorTwin(c.deps.playerX, c.deps.playerY);
  },
  onPhase3Exit(c) {
    const b = c.world.get(c.id, Boss);
    if (!b) return;
    if (b.twinId >= 0 && c.deps.onDespawnMirrorTwin) {
      c.deps.onDespawnMirrorTwin(b.twinId);
    }
    b.twinId = -1;
  },
};
