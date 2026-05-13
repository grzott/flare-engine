/**
 * Zone 8 background — two fullscreen-stretched sprite entities:
 *   z = -100  WaterEffect (lunar surface shimmer)
 *   z = -90   FogEffect   (lunar fog)
 *
 * Both entities are static in world space; the shaders animate autonomously
 * via `beginFrame(w, h, time)` injected by the Skia bridge each frame.
 * No per-frame position mutation needed.
 */

import { getFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position } from '@flare-engine/ecs';
import { Color } from '@flare-engine/math';
import { Sprite, fog, water } from '@flare-engine/render';
import type { AtlasHandle } from '../spawn';
import { THEME_SPEC } from '../visual-spec/theme';

const Z_WATER = -100;
const Z_FOG = -90;

// Zone 8 palette: bone water, parchment foam, lunar-ink fog.
const WATER_COLOR = Color.fromHex(THEME_SPEC.colors.bone);
const FOAM_COLOR = { ...Color.fromHex(THEME_SPEC.colors.parchment), a: 0.7 };
const LUNAR_FOG_COLOR = { ...Color.fromHex(THEME_SPEC.colors.lunarInk), a: 0.35 };

export interface Zone8BgDeps {
  world: World;
  atlas: AtlasHandle;
  viewportWidth: number;
  viewportHeight: number;
}

export interface Zone8BgController {
  /** Remove both background entities from the world. */
  destroy(): void;
}

/**
 * Spawn 2 fullscreen background entities for Zone 8.
 * The atlas frame (`tile-water`) provides the texture source; the effect
 * shader overrides the pixel output so the 32×32 tile never tiles visibly.
 */
export function createZone8Bg(deps: Zone8BgDeps): Zone8BgController {
  const { world, atlas, viewportWidth, viewportHeight } = deps;

  const frame = getFrame(atlas.sheet, 'tile-water');
  if (!frame) throw new Error('zone8-bg: tile-water frame not found in atlas');

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
    effect: water(WATER_COLOR, FOAM_COLOR, 0.5, 0.03),
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
    effect: fog(LUNAR_FOG_COLOR, 0.35, 0.2, 3.0),
  });

  return {
    destroy() {
      world.destroy(waterId);
      world.destroy(fogId);
    },
  };
}
