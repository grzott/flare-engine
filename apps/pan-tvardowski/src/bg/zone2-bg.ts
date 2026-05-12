/**
 * Zone 2 background — two fullscreen-stretched sprite entities:
 *   z = -100  FogEffect (pine mist)
 *   z = -90   FogEffect (pollen haze)
 *
 * Both entities are static in world space; the shaders animate autonomously
 * via `beginFrame(w, h, time)` injected by the Skia bridge each frame.
 * No per-frame position mutation needed.
 */

import { getFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position } from '@flare-engine/ecs';
import { Sprite, fog } from '@flare-engine/render';
import type { AtlasHandle } from '../spawn';
import { hexToRgba01 } from '../visual-spec/color-util';
import { THEME_SPEC } from '../visual-spec/theme';

const Z_FOG_PINE = -100;
const Z_FOG_POLLEN = -90;

// Zone 2 palette: deep moss pine mist, pale bone/gold pollen haze.
const PINE_MIST_COLOR = hexToRgba01(THEME_SPEC.colors.moss, 0.6);
const POLLEN_HAZE_COLOR = hexToRgba01(THEME_SPEC.colors.bone, 0.35);

export interface Zone2BgDeps {
  world: World;
  atlas: AtlasHandle;
  viewportWidth: number;
  viewportHeight: number;
}

export interface Zone2BgController {
  /** Remove both background entities from the world. */
  destroy(): void;
}

/**
 * Spawn 2 fullscreen background entities for Zone 2.
 * The atlas frame (`tile-water`) provides the texture source; the effect
 * shader overrides the pixel output so the 32×32 tile never tiles visibly.
 */
export function createZone2Bg(deps: Zone2BgDeps): Zone2BgController {
  const { world, atlas, viewportWidth, viewportHeight } = deps;

  const frame = getFrame(atlas.sheet, 'tile-water');
  if (!frame) throw new Error('zone2-bg: tile-water frame not found in atlas');

  const cx = viewportWidth / 2;
  const cy = viewportHeight / 2;
  const anchor = { x: 0.5, y: 0.5 };

  const pineMistId = world.spawn();
  world.add(pineMistId, Position, { x: cx, y: cy });
  world.add(pineMistId, Sprite, {
    image: atlas.image,
    frame,
    z: Z_FOG_PINE,
    width: viewportWidth,
    height: viewportHeight,
    anchor,
    effect: fog(PINE_MIST_COLOR, 0.5, 0.35, 2.5),
  });

  const pollenId = world.spawn();
  world.add(pollenId, Position, { x: cx, y: cy });
  world.add(pollenId, Sprite, {
    image: atlas.image,
    frame,
    z: Z_FOG_POLLEN,
    width: viewportWidth,
    height: viewportHeight,
    anchor,
    effect: fog(POLLEN_HAZE_COLOR, 0.3, 0.2, 3.5),
  });

  return {
    destroy() {
      world.destroy(pineMistId);
      world.destroy(pollenId);
    },
  };
}
