import { getFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position, Velocity } from '@flare-engine/ecs';
import { Sprite, tint } from '@flare-engine/render';
import type { AnySpriteEffect } from '@flare-engine/render';
import { getParallaxVelocity } from '../a11y/reduced-motion';
import { Lifetime } from '../components';
import type { AtlasHandle } from '../spawn';
import { hexToArgb } from '../util/hex';
import { THEME_SPEC } from '../visual-spec/theme';
import type { ZoneBackground } from '../visual-spec/types';
import type { ZonePalette } from '../visual-spec/zones-palette';

type AmbienceSpec = ZoneBackground['ambience'];

const PARTICLE_Z = 19;
const CENTER_ANCHOR = { x: 0.5, y: 0.5 };

/** Slow parallax layer Y-velocity (px/s). Folio XIIB: 0.5× ratio against VEL_FAST. */
export const VEL_SLOW = 10;
/** Fast parallax layer Y-velocity (px/s). */
export const VEL_FAST = 20;
/** Drift spread (px/s). Folio XIIB: ±8 px/s = ±1 tile. */
export const AMBIENCE_DRIFT_SPREAD = 16;
/** Default tint alpha applied to particle color. */
export const DEFAULT_TINT_ALPHA = 0.6;
/** Particle lifetime in seconds. */
const PARTICLE_LIFE = 4;

export interface AmbienceState {
  /** Pre-allocated ring buffer of entity IDs (-1 = slot empty). */
  readonly ring: Int32Array;
  /** Current write head in the ring. */
  ringHead: number;
  /** Accumulated dt since last emit (seconds). */
  accumulator: number;
  /** LCG state — single integer, never allocated in tick. */
  lcg: number;
  /** Cached primary color from last tick (detects zone change). */
  lastPrimary: number;
  /** Cached tint alpha from last tick (detects spec change). */
  lastTintAlpha: number;
  /** Pre-created tint effect, re-created only when primary or tintAlpha changes. */
  cachedTint: AnySpriteEffect;
  readonly world: World;
  readonly atlas: AtlasHandle;
}

/** Simple LCG: Park-Miller. Returns 0..1. */
function lcgNext(state: AmbienceState): number {
  state.lcg = (state.lcg * 16807) % 2147483647;
  return (state.lcg - 1) / 2147483646;
}

function argbToTint(argb: number, alpha: number): AnySpriteEffect {
  const r = ((argb >>> 16) & 0xff) / 255;
  const g = ((argb >>> 8) & 0xff) / 255;
  const b = (argb & 0xff) / 255;
  const a = ((argb >>> 24) & 0xff) / 255;
  return tint({ r, g, b, a }, alpha);
}

/**
 * Called once in startZone. Creates the AmbienceState with a pre-allocated
 * ring buffer sized to the zone's ambienceParticles count.
 */
export function createAmbienceState(world: World, atlas: AtlasHandle): AmbienceState {
  const initialPrimary = hexToArgb(THEME_SPEC.colors.terracotta);
  const ring = new Int32Array(256);
  ring.fill(-1);
  return {
    ring,
    ringHead: 0,
    accumulator: 0,
    lcg: 12345,
    lastPrimary: initialPrimary,
    lastTintAlpha: DEFAULT_TINT_ALPHA,
    cachedTint: argbToTint(initialPrimary, DEFAULT_TINT_ALPHA),
    world,
    atlas,
  };
}

/**
 * Tick ambience particles. Call once per frame from play.ts onUpdate.
 *
 * spawnRate = ambienceParticles / 8 (per plan §M2).
 * Under bossActive, spawn rate is 0.
 * Under reducedMotion, particles spawn at their normal rate but with zero
 * velocity (spawn-static) so the scene has ambient depth without motion.
 */
export function tickAmbience(
  state: AmbienceState,
  dt: number,
  zonePalette: ZonePalette,
  bounds: { width: number; height: number },
  reducedMotion: boolean,
  bossActive: boolean,
  ambienceSpec?: AmbienceSpec,
): void {
  if (bossActive) return;

  const spawnRate = zonePalette.ambienceParticles / 8;
  const interval = 1 / spawnRate;

  state.accumulator += dt;
  if (state.accumulator < interval) return;
  state.accumulator -= interval;

  const tintAlpha = ambienceSpec?.tintAlpha ?? DEFAULT_TINT_ALPHA;

  // Update tint cache when zone primary or tintAlpha changes (once per zone transition).
  if (state.lastPrimary !== zonePalette.primary || state.lastTintAlpha !== tintAlpha) {
    state.lastPrimary = zonePalette.primary;
    state.lastTintAlpha = tintAlpha;
    state.cachedTint = argbToTint(zonePalette.primary, tintAlpha);
  }

  const sparkFrame = getFrame(state.atlas.sheet, 'particle-smoke');
  if (!sparkFrame) return;

  // Advance ring head.
  const slot = state.ringHead;
  state.ringHead = (state.ringHead + 1) % state.ring.length;

  const existingId = state.ring[slot] ?? -1;
  if (existingId !== -1 && state.world.exists(existingId)) {
    // Slot still alive — skip this slot this cycle.
    return;
  }

  // Spawn new particle into the ring slot (entity allocation happens only
  // when a slot is empty or has been destroyed by the cleanup system).
  const id = state.world.spawn();
  state.ring[slot] = id;

  const velSlow = ambienceSpec?.velSlowPxPerSec ?? VEL_SLOW;
  const velFast = ambienceSpec?.velFastPxPerSec ?? VEL_FAST;
  const driftSpread = ambienceSpec?.driftSpreadPx ?? AMBIENCE_DRIFT_SPREAD;

  // Alternate between slow and fast parallax layers via LCG parity.
  // Under reducedMotion, getParallaxVelocity returns 0 — particle is
  // static (spawn-static behaviour).
  const r = lcgNext(state);
  const isFast = r < 0.5;
  const baseVy = isFast ? velFast : velSlow;
  const baseVx = (lcgNext(state) - 0.5) * driftSpread;
  const vy = getParallaxVelocity(baseVy, reducedMotion);
  const vx = getParallaxVelocity(baseVx, reducedMotion);

  const x = lcgNext(state) * bounds.width;
  const y = -10 - lcgNext(state) * 40;

  state.world.add(id, Position, { x, y });
  state.world.add(id, Velocity, { x: vx, y: vy });
  state.world.add(id, Sprite, {
    image: state.atlas.image,
    frame: sparkFrame,
    z: PARTICLE_Z,
    anchor: CENTER_ANCHOR,
    effect: state.cachedTint,
  });
  state.world.add(id, Lifetime, { remaining: PARTICLE_LIFE });
}
