import { Position, Velocity } from '@flare-engine/ecs';
import { Boss } from '../../components';
import { BAZYLISZEK_TELEPORT_SEC, BULLET_SPAWN_OFFSET, BULLET_SPEED } from '../../config/gameplay';
import { Layer } from '../../layers';
import { spawnBullet } from '../../spawn';
import { type Direction2D, normalizeDirection } from '../../util/direction';
import { hexToArgb } from '../../visual-spec/color-util';
import { THEME_SPEC } from '../../visual-spec/theme';
import { BOSS_HALF_W } from './shared';
import type { BossCtx, PhaseScript } from './types';

const ARGB_P1 = hexToArgb(THEME_SPEC.colors.bone);
const ARGB_P2 = hexToArgb(THEME_SPEC.colors.katakumbyDark);
const ARGB_P3 = hexToArgb(THEME_SPEC.colors.crimson);

const aim: Direction2D = { x: 0, y: 0 };

/** Phase-3 teleport instead of sweep movement. Deterministic hash → testable. */
function bazyliszekTeleport(dt: number, c: BossCtx): void {
  const b = c.world.get(c.id, Boss);
  const pos = c.world.get(c.id, Position);
  if (!b || !pos) return;
  b.teleportT += dt;
  if (b.teleportT < BAZYLISZEK_TELEPORT_SEC) return;
  b.teleportT = 0;
  const h = Math.abs(Math.sin(b.t * 12.9898) * 43758.5453);
  const u = h - Math.floor(h);
  const left = BOSS_HALF_W;
  const right = c.deps.bounds.width - BOSS_HALF_W;
  pos.x = left + u * (right - left);
  const vel = c.world.get(c.id, Velocity);
  if (vel) {
    vel.x = 0;
    vel.y = 0;
  }
}

// Bazyliszek Warszawski (Zone 6).
// Phase 1: stone-gaze cone — narrow 3-way cone; scene slows player via onGazeChange.
// Phase 2: venom spit — single heavy aimed shot + persistent puddle.
// Phase 3: gaze-beam maze — 10 radial spokes + periodic teleport.
export const bazyliszekScript: PhaseScript = {
  threePhase: true,
  sweepSpeed1: 45,
  sweepSpeed2: 80,
  sweepSpeed3: 25,
  fire1Cooldown: 0.7,
  fire2Cooldown: 0.55,
  fire3Cooldown: 0.22,
  fire1(c) {
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
    normalizeDirection(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
    const baseAngle = Math.atan2(aim.y, aim.x);
    for (let i = -1; i <= 1; i++) {
      const a = baseAngle + i * 0.12;
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
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
    normalizeDirection(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
    spawnBullet(
      c.deps.spawnCtx,
      pos.x,
      pos.y + BULLET_SPAWN_OFFSET.boss,
      aim.x,
      aim.y,
      Layer.enemy,
    );
    c.deps.onSpawnPuddle?.(pos.x, pos.y + BULLET_SPAWN_OFFSET.boss + 20);
  },
  fire3(c) {
    const pos = c.world.get(c.id, Position);
    const b = c.world.get(c.id, Boss);
    if (!pos || !b) return;
    const rays = 10;
    const spin = b.t * 1.35;
    for (let i = 0; i < rays; i++) {
      const a = spin + (i / rays) * Math.PI * 2;
      spawnBullet(
        c.deps.spawnCtx,
        pos.x,
        pos.y,
        Math.cos(a) * BULLET_SPEED.boss * 0.9,
        Math.sin(a) * BULLET_SPEED.boss * 0.9,
        Layer.enemy,
      );
    }
  },
  onPhase1Enter(c) {
    c.deps.onPaletteShift?.('phase1', ARGB_P1);
    c.deps.onGazeChange?.(true);
  },
  onPhase1Exit(c) {
    c.deps.onGazeChange?.(false);
  },
  onPhase2Enter(c) {
    c.deps.onPaletteShift?.('phase2', ARGB_P2);
    const pos = c.world.get(c.id, Position);
    if (pos) {
      c.deps.onPhaseBreak?.(pos.x, pos.y);
      c.deps.onPhasePostFx?.('bloom+vignette');
    }
  },
  onPhase3Enter(c) {
    c.deps.onPaletteShift?.('phase3', ARGB_P3);
    const pos = c.world.get(c.id, Position);
    if (pos) {
      c.deps.onPhaseBreak?.(pos.x, pos.y);
    }
  },
  phase3Movement: bazyliszekTeleport,
};
