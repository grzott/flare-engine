import type { World } from '@flare-engine/ecs';
import { SpiralCollapse } from '../components';
import {
  SPIRAL_DURATION_SEC,
  SPIRAL_INITIAL_RADIUS,
  SPIRAL_TURNS,
} from '../visual-spec/explosions';

export const SPIRAL_POOL_SIZE = 8;

export interface SpiralSlot {
  entityId: number;
  active: boolean;
}

export const _spiralPool: SpiralSlot[] = [];
for (let _i = 0; _i < SPIRAL_POOL_SIZE; _i++) {
  _spiralPool.push({ entityId: -1, active: false });
}

/** @internal Clear spiral pool between tests. */
export function _resetSpiralPoolForTest(): void {
  for (const slot of _spiralPool) {
    slot.entityId = -1;
    slot.active = false;
  }
}

/**
 * Trigger the spiral-collapse death animation for an elite enemy.
 *
 * reducedMotion=true: destroys the entity immediately + fires a 1-frame
 * chromatic-ab flash (§15 pattern). No SpiralCollapse component attached.
 *
 * reducedMotion=false: attaches a SpiralCollapse component; the entity is
 * destroyed by the play-scene tick when elapsed >= duration.
 *
 * Returns true if the effect was attached, false if the entity was destroyed
 * immediately (reducedMotion) or a second-death guard fired.
 */
export function triggerSpiralCollapse(
  world: World,
  entityId: number,
  x: number,
  y: number,
  reducedMotion: boolean,
  postfx: { triggerChromaticAb(decayMs: number): void } | null,
): boolean {
  if (!world.exists(entityId)) return false;

  if (reducedMotion) {
    world.destroy(entityId);
    postfx?.triggerChromaticAb(100);
    return false;
  }

  if (world.has(entityId, SpiralCollapse)) return false;

  world.add(entityId, SpiralCollapse, {
    originX: x,
    originY: y,
    elapsed: 0,
    duration: SPIRAL_DURATION_SEC,
    turns: SPIRAL_TURNS,
    initialRadius: SPIRAL_INITIAL_RADIUS,
    scaleFrom: 1.0,
    scaleTo: 0.0,
    alphaFrom: 1.0,
    alphaTo: 0.0,
  });

  for (let _i = 0; _i < SPIRAL_POOL_SIZE; _i++) {
    const slot = _spiralPool[_i];
    if (slot && !slot.active) {
      slot.entityId = entityId;
      slot.active = true;
      break;
    }
  }

  return true;
}
