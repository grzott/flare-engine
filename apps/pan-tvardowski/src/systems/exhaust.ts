import type { Query, World } from '@flare-engine/ecs';
import { Position } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import type { KenneyAtlasHandle } from '../assets/sprites-loader';
import { Exhaust } from '../components';
import {
  EXHAUST_HZ,
  EXHAUST_MAX_OPACITY,
  EXHAUST_MIN_OPACITY,
  exhaustFrameIndex,
  exhaustPulseAlpha,
} from '../fx/exhaust-frame';
import { KENNEY_SPRITE_SCALE } from '../visual-spec/kenney-frames';
/**
 * Kenney fire00..19 native orientation: plume points UPWARD (sprite is portrait
 * 16×40, tip at top, base at bottom in image-space, Y-down).
 *
 * Player (travels toward screen-top) → flame trails BELOW hull → plume must
 * point downward → rotation = Math.PI (180° flip).
 *
 * Enemy (travels toward screen-bottom) → flame trails ABOVE hull → plume points
 * upward natively → rotation = 0.
 */
export const EXHAUST_ROTATION_PLAYER = Math.PI;
export const EXHAUST_ROTATION_ENEMY = 0;

/** Half-height (logical pixels) of the exhaust flame sprite at KENNEY_SPRITE_SCALE. */
export const EXHAUST_FLAME_HALF_HEIGHT = 10;
/** Gap (logical pixels) between hull edge and flame edge. */
export const EXHAUST_MARGIN = 2;
/** Fallback half-height when the owner Sprite has no height value. */
export const DEFAULT_OWNER_HALF_HEIGHT = 19;

/** Pre-built frame-name array — no per-frame string allocation. */
const FIRE_FRAME_NAMES: readonly string[] = [
  'fire00',
  'fire01',
  'fire02',
  'fire03',
  'fire04',
  'fire05',
  'fire06',
  'fire07',
  'fire08',
  'fire09',
  'fire10',
  'fire11',
  'fire12',
  'fire13',
  'fire14',
  'fire15',
  'fire16',
  'fire17',
  'fire18',
  'fire19',
] as const;

const FIRE_FRAME_COUNT = FIRE_FRAME_NAMES.length;

export interface ExhaustDeps {
  exhaustQuery: Query;
  kenney: KenneyAtlasHandle | null | undefined;
  accum: number;
  playerVisible: boolean;
  reducedMotion: boolean;
}

export function updateExhaust(world: World, deps: ExhaustDeps): void {
  const { exhaustQuery, kenney, accum, playerVisible, reducedMotion } = deps;
  const kenneyLive = kenney !== null && kenney !== undefined && kenney.image !== null;

  const frameIdx = exhaustFrameIndex(accum, FIRE_FRAME_COUNT, EXHAUST_HZ);
  const frameName = FIRE_FRAME_NAMES[frameIdx] as string;

  for (const id of exhaustQuery) {
    const exhaust = world.get(id, Exhaust);
    if (!exhaust) continue;

    const parentPos = world.get(exhaust.ownerId, Position);
    if (parentPos === undefined) continue;

    const pos = world.get(id, Position);
    if (pos) {
      pos.x = parentPos.x;
      pos.y = exhaust.isPlayer ? parentPos.y + exhaust.offsetY : parentPos.y - exhaust.offsetY;
    }

    const sprite = world.get(id, Sprite);
    if (!sprite) continue;

    if (!kenneyLive) {
      sprite.alpha = 0;
      continue;
    }

    const visible = exhaust.isPlayer ? playerVisible : true;
    sprite.alpha = exhaustPulseAlpha(
      accum,
      EXHAUST_HZ,
      EXHAUST_MIN_OPACITY,
      EXHAUST_MAX_OPACITY,
      visible,
      reducedMotion,
    );
    sprite.rotation = exhaust.isPlayer ? EXHAUST_ROTATION_PLAYER : EXHAUST_ROTATION_ENEMY;

    const kenneyFrame = kenney!.sheet.frameMap.get(frameName);
    if (kenneyFrame !== undefined) {
      const f = kenney!.sheet.frames[kenneyFrame];
      if (f !== undefined) {
        sprite.image = kenney!.image!;
        sprite.frame = f;
        sprite.width = f.w * KENNEY_SPRITE_SCALE;
        sprite.height = f.h * KENNEY_SPRITE_SCALE;
      }
    }
  }
}
