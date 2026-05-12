/**
 * Zone 4 background — two fullscreen-stretched sprite entities:
 *   z = -100  WaterEffect (swamp gas ripple)
 *   z = -90   FogEffect   (bog vapour)
 *
 * Both entities are static in world space; the shaders animate autonomously
 * via `beginFrame(w, h, time)` injected by the Skia bridge each frame.
 * No per-frame position mutation needed.
 */

import { getFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position } from '@flare-engine/ecs';
import { Sprite, fog, water } from '@flare-engine/render';
import type { AtlasHandle } from '../spawn';
import { hexToRgba01 } from '../visual-spec/color-util';
import { THEME_SPEC } from '../visual-spec/theme';

const Z_WATER = -100;
const Z_FOG = -90;

// Zone 4 palette: marsh-olive swamp gas, river-depth undertone, teal bog vapour.
const SWAMP_COLOR = hexToRgba01(THEME_SPEC.colors.marshOlive);
const SWAMP_FOAM = hexToRgba01(THEME_SPEC.colors.riverDepth, 0.5);
const BOG_FOG_COLOR = hexToRgba01(THEME_SPEC.colors.waterTeal, 0.45);

export interface Zone4BgDeps {
  world: World;
  atlas: AtlasHandle;
  viewportWidth: number;
  viewportHeight: number;
}

export interface Zone4BgController {
  /** Remove both background entities from the world. */
  destroy(): void;
}

/**
 * Spawn 2 fullscreen background entities for Zone 4.
 * The atlas frame (`tile-water`) provides the texture source; the effect
 * shader overrides the pixel output so the 32×32 tile never tiles visibly.
 */
export function createZone4Bg(deps: Zone4BgDeps): Zone4BgController {
  const { world, atlas, viewportWidth, viewportHeight } = deps;

  const frame = getFrame(atlas.sheet, 'tile-water');
  if (!frame) throw new Error('zone4-bg: tile-water frame not found in atlas');

  const cx = viewportWidth / 2;
  const cy = viewportHeight / 2;
  const anchor = { x: 0.5, y: 0.5 };

  const waterId = world.spawn();
  world.add(waterId, Position, { x: cx, y: cy });
  world.add(waterId, Sprite, {
    image: atlas.image,
    frame,
    z: Z_WATER,
    width: viewportWidth,
    height: viewportHeight,
    anchor,
    effect: water(SWAMP_COLOR, SWAMP_FOAM, 0.6, 0.05),
  });

  const fogId = world.spawn();
  world.add(fogId, Position, { x: cx, y: cy });
  world.add(fogId, Sprite, {
    image: atlas.image,
    frame,
    z: Z_FOG,
    width: viewportWidth,
    height: viewportHeight,
    anchor,
    effect: fog(BOG_FOG_COLOR, 0.4, 0.28, 2.8),
  });

  return {
    destroy() {
      world.destroy(waterId);
      world.destroy(fogId);
    },
  };
}
