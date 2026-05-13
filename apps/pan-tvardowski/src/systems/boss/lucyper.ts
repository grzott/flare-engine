import { Position } from '@flare-engine/ecs';
import { Color, Vec2 as V, type Vec2 } from '@flare-engine/math';
function hexToArgb(hex: string): number {
  return Color.toSkColor(Color.fromHex(hex));
}
import { Boss, type BossPattern } from '../../components';
import {
  BULLET_SPAWN_OFFSET,
  BULLET_SPEED,
  LUCYPER_P1_FIRE,
  LUCYPER_P2_FIRE,
  LUCYPER_P3_FIRE,
  LUCYPER_SHATTER_CYCLE,
} from '../../config/gameplay';
import { Layer } from '../../layers';
import { spawnBullet } from '../../spawn';

import { THEME_SPEC } from '../../visual-spec/theme';
import type { BossCtx, PhaseScript } from './types';

const ARGB_P1 = hexToArgb(THEME_SPEC.colors.silver);
const ARGB_P2 = hexToArgb(THEME_SPEC.colors.lunarInk);
const ARGB_P3 = hexToArgb(THEME_SPEC.colors.crimson);

const aim: Vec2 = { x: 0, y: 0 };

/** Phase-3 shattered-mirror rotation: picks a pattern from this list by idx. */
const SHATTER_CYCLE: BossPattern[] = [
  'smok-krzemionkowski',
  'borowy-krol',
  'wodnik-wislanny',
  'boruta',
  'baba-jaga',
  'bazyliszek-warszawski',
  'mefistofeles',
];

function fireRadial(c: BossCtx, rays: number, speedMul = 1): void {
  const pos = c.world.get(c.id, Position);
  const b = c.world.get(c.id, Boss);
  if (!pos || !b) return;
  const spin = b.t * 1.1;
  for (let i = 0; i < rays; i++) {
    const a = spin + (i / rays) * Math.PI * 2;
    spawnBullet(
      c.deps.spawnCtx,
      pos.x,
      pos.y,
      Math.cos(a) * BULLET_SPEED.boss * speedMul,
      Math.sin(a) * BULLET_SPEED.boss * speedMul,
      Layer.enemy,
    );
  }
}

function fireAimedFan(c: BossCtx, count: number, spread: number, speedMul = 1): void {
  const pos = c.world.get(c.id, Position);
  if (!pos) return;
  V.normalizeOut(c.deps.playerX - pos.x, c.deps.playerY - pos.y, BULLET_SPEED.boss, aim);
  const base = Math.atan2(aim.y, aim.x);
  const half = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    const a = base + (i - half) * spread;
    spawnBullet(
      c.deps.spawnCtx,
      pos.x,
      pos.y + BULLET_SPAWN_OFFSET.boss,
      Math.cos(a) * BULLET_SPEED.boss * speedMul,
      Math.sin(a) * BULLET_SPEED.boss * speedMul,
      Layer.enemy,
    );
  }
}

/**
 * Lucyper Księżycowy — Zone 8 final boss (build plan §9, three phases).
 * Phase 1 cosmic rain — heavy 10-way radial + aimed anchor shot every
 *   {@link LUCYPER_P1_FIRE} s.
 * Phase 2 eclipse + spotlight — tight aimed 3-fan every
 *   {@link LUCYPER_P2_FIRE} s; `onPhase2Enter` drops the arena to eclipse mode.
 * Phase 3 shattered-mirror bullet hell — cycles through `SHATTER_CYCLE` every
 *   {@link LUCYPER_SHATTER_CYCLE} s, running a simplified emission for each
 *   prior boss: radial (smok), aimed spread (borowy), aimed vertical
 *   (wodnik), orbital rays (boruta), broom pinwheel (baba jaga), gaze pinwheel
 *   (bazyliszek), aimed 3-fan (mefistofeles).
 */
export const lucyperScript: PhaseScript = {
  threePhase: true,
  sweepSpeed1: 60,
  sweepSpeed2: 90,
  sweepSpeed3: 110,
  fire1Cooldown: LUCYPER_P1_FIRE,
  fire2Cooldown: LUCYPER_P2_FIRE,
  fire3Cooldown: LUCYPER_P3_FIRE,
  fire1(c) {
    // Cosmic rain: 10-way radial + center anchor.
    fireRadial(c, 10);
    const pos = c.world.get(c.id, Position);
    if (!pos) return;
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
  fire2(c) {
    // Eclipse spotlight: tight aimed 3-fan.
    fireAimedFan(c, 3, 0.1);
  },
  fire3(c) {
    const b = c.world.get(c.id, Boss);
    if (!b) return;
    const len = SHATTER_CYCLE.length;
    const idx = ((b.shatterIdx % len) + len) % len;
    const pattern = SHATTER_CYCLE[idx] ?? 'smok-krzemionkowski';
    switch (pattern) {
      case 'smok-krzemionkowski':
        fireRadial(c, 6);
        break;
      case 'borowy-krol':
        fireAimedFan(c, 5, 0.18);
        break;
      case 'wodnik-wislanny': {
        // Vertical 3-column spouts.
        const pos = c.world.get(c.id, Position);
        if (!pos) return;
        for (let i = -1; i <= 1; i++) {
          spawnBullet(
            c.deps.spawnCtx,
            pos.x + i * 48,
            pos.y + BULLET_SPAWN_OFFSET.boss,
            0,
            BULLET_SPEED.boss,
            Layer.enemy,
          );
        }
        break;
      }
      case 'boruta':
        fireRadial(c, 4, 0.85);
        break;
      case 'baba-jaga':
        fireRadial(c, 12, 0.9);
        break;
      case 'bazyliszek-warszawski':
        fireRadial(c, 10, 0.9);
        break;
      case 'mefistofeles':
        fireAimedFan(c, 3, 0.2);
        break;
      case 'lucyper-ksiezycowy':
        fireAimedFan(c, 3, 0.1);
        break;
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
    }
    c.deps.onEclipseChange?.(true);
  },
  onPhase2Exit(c) {
    c.deps.onEclipseChange?.(false);
  },
  onPhase3Enter(c) {
    // Crimson-mirror finale (M3): crimson palette + phase break + bloom+flash+CRT.
    c.deps.onPaletteShift?.('phase3', ARGB_P3);
    const pos = c.world.get(c.id, Position);
    if (pos) {
      c.deps.onPhaseBreak?.(pos.x, pos.y);
      c.deps.onPhasePostFx?.('bloom+flash+CRT');
    }
    const b = c.world.get(c.id, Boss);
    if (!b) return;
    b.shatterIdx = 0;
    b.shatterT = 0;
  },
  onPhase3Update(dt, c) {
    const b = c.world.get(c.id, Boss);
    if (!b) return;
    b.shatterT += dt;
    if (b.shatterT >= LUCYPER_SHATTER_CYCLE) {
      b.shatterT = 0;
      b.shatterIdx = (b.shatterIdx + 1) % SHATTER_CYCLE.length;
    }
  },
};
