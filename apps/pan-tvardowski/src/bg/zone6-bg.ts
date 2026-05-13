/**
 * Zone 6 background — two fullscreen-stretched sprite entities:
 *   z = -100  FireEffect (torch flicker)
 *   z = -90   FogEffect  (dust haze)
 *
 * Both entities are static in world space; the shaders animate autonomously
 * via `beginFrame(w, h, time)` injected by the Skia bridge each frame.
 * No per-frame position mutation needed.
 */

import { getFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import { Position } from '@flare-engine/ecs';
import { Color } from '@flare-engine/math';
import { Sprite, fire, fog } from '@flare-engine/render';
import type { AtlasHandle } from '../spawn';
import { THEME_SPEC } from '../visual-spec/theme';

const Z_FIRE = -100;
const Z_FOG = -90;

// Zone 6 palette: terracotta torch body, gold-deep tip, parchment dust haze.
const TORCH_COLOR = Color.fromHex(THEME_SPEC.colors.terracotta);
const TORCH_TIP_COLOR = Color.fromHex(THEME_SPEC.colors.goldDeep);
const DUST_FOG_COLOR = { ...Color.fromHex(THEME_SPEC.colors.parchment), a: 0.3 };

export interface Zone6BgDeps {
  world: World;
  atlas: AtlasHandle;
  viewportWidth: number;
  viewportHeight: number;
}

export interface Zone6BgController {
  /** Remove both background entities from the world. */
  destroy(): void;
}

/**
 * Spawn 2 fullscreen background entities for Zone 6.
 * The atlas frame (`tile-fire`) provides the texture source; the effect
 * shader overrides the pixel output so the 32×32 tile never tiles visibly.
 */
export function createZone6Bg(deps: Zone6BgDeps): Zone6BgController {
  const { world, atlas, viewportWidth, viewportHeight } = deps;

  const frame = getFrame(atlas.sheet, 'tile-fire');
  if (!frame) throw new Error('zone6-bg: tile-fire frame not found in atlas');

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
    effect: fire({ color: TORCH_COLOR, tipColor: TORCH_TIP_COLOR, speed: 1.1, intensity: 0.65 }),
  });

  const dustId = world.spawn();
  world.add(dustId, Position, { x: cx, y: cy });
  world.add(dustId, Sprite, {
    image: atlas.image,
    frame,
    z: Z_FOG,
    width: viewportWidth,
    height: viewportHeight,
    anchor,
    effect: fog(DUST_FOG_COLOR, 0.35, 0.15, 4.0),
  });

  return {
    destroy() {
      world.destroy(fireId);
      world.destroy(dustId);
    },
  };
}
