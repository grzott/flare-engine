/**
 * Zone 7 background — two fullscreen-stretched sprite entities:
 *   z = -100  FireEffect (hearth glow)
 *   z = -90   FogEffect  (smoke haze)
 *
 * Both entities are static in world space; the shaders animate autonomously
 * via `beginFrame(w, h, time)` injected by the Skia bridge each frame.
 * No per-frame position mutation needed.
 */

import { getFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position } from '@flare-engine/ecs';
import { Sprite, fire, fog } from '@flare-engine/render';
import type { AtlasHandle } from '../spawn';
import { hexToRgba01 } from '../visual-spec/color-util';
import { THEME_SPEC } from '../visual-spec/theme';

const Z_FIRE = -100;
const Z_FOG = -90;

// Zone 7 palette: rust hearth body, gold tip, shadow-black smoke haze.
const HEARTH_COLOR = hexToRgba01(THEME_SPEC.colors.rust);
const HEARTH_TIP_COLOR = hexToRgba01(THEME_SPEC.colors.gold);
const SMOKE_COLOR = hexToRgba01(THEME_SPEC.colors.shadowBlack, 0.5);

export interface Zone7BgDeps {
  world: World;
  atlas: AtlasHandle;
  viewportWidth: number;
  viewportHeight: number;
}

export interface Zone7BgController {
  /** Remove both background entities from the world. */
  destroy(): void;
}

/**
 * Spawn 2 fullscreen background entities for Zone 7.
 * The atlas frame (`tile-fire`) provides the texture source; the effect
 * shader overrides the pixel output so the 32×32 tile never tiles visibly.
 */
export function createZone7Bg(deps: Zone7BgDeps): Zone7BgController {
  const { world, atlas, viewportWidth, viewportHeight } = deps;

  const frame = getFrame(atlas.sheet, 'tile-fire');
  if (!frame) throw new Error('zone7-bg: tile-fire frame not found in atlas');

  const cx = viewportWidth / 2;
  const cy = viewportHeight / 2;
  const anchor = { x: 0.5, y: 0.5 };

  const fireId = world.spawn();
  world.add(fireId, Position, { x: cx, y: cy });
  world.add(fireId, Sprite, {
    image: atlas.image,
    frame,
    z: Z_FIRE,
    width: viewportWidth,
    height: viewportHeight,
    anchor,
    effect: fire({ color: HEARTH_COLOR, tipColor: HEARTH_TIP_COLOR, speed: 0.8, intensity: 0.7 }),
  });

  const smokeId = world.spawn();
  world.add(smokeId, Position, { x: cx, y: cy });
  world.add(smokeId, Sprite, {
    image: atlas.image,
    frame,
    z: Z_FOG,
    width: viewportWidth,
    height: viewportHeight,
    anchor,
    effect: fog(SMOKE_COLOR, 0.45, 0.3, 2.0),
  });

  return {
    destroy() {
      world.destroy(fireId);
      world.destroy(smokeId);
    },
  };
}
