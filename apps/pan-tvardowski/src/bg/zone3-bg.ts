/**
 * Zone 3 background — two fullscreen-stretched sprite entities:
 *   z = -100  WaterEffect (Vistula river surface)
 *   z = -90   FogEffect   (hovering mist)
 *
 * Both entities are static in world space; the shaders animate autonomously
 * via `beginFrame(w, h, time)` injected by the Skia bridge each frame.
 * No per-frame position mutation needed — 283-entity tilemap eliminated.
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

// Vistula palette: deep verdigris water, pale bone foam, muted blue-grey fog.
const WATER_COLOR = hexToRgba01(THEME_SPEC.colors.vistulaBlue);
const FOAM_COLOR = hexToRgba01(THEME_SPEC.colors.foamBlue, 0.6);
const FOG_COLOR = hexToRgba01(THEME_SPEC.colors.mistBlue, 0.55);

export interface Zone3BgDeps {
  world: World;
  atlas: AtlasHandle;
  viewportWidth: number;
  viewportHeight: number;
}

export interface Zone3BgController {
  /** Remove both background entities from the world. */
  destroy(): void;
}

/**
 * Spawn 2 fullscreen background entities for Zone 3.
 * The atlas frame (`tile-water`) provides the texture source; the effect
 * shader overrides the pixel output so the 32×32 tile never tiles visibly.
 */
export function createZone3Bg(deps: Zone3BgDeps): Zone3BgController {
  const { world, atlas, viewportWidth, viewportHeight } = deps;

  const frame = getFrame(atlas.sheet, 'tile-water');
  if (!frame) throw new Error('zone3-bg: tile-water frame not found in atlas');

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
    effect: water(WATER_COLOR, FOAM_COLOR, 0.8, 0.04),
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
    effect: fog(FOG_COLOR, 0.45, 0.25, 2.5),
  });

  return {
    destroy() {
      world.destroy(waterId);
      world.destroy(fogId);
    },
  };
}
