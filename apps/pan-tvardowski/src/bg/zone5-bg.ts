/**
 * Zone 5 background — two fullscreen-stretched sprite entities:
 *   z = -100  FireEffect (Łysa Góra volcanic ember glow)
 *   z = -90   FogEffect  (ash fog)
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

// Zone 5 palette: crimson-deep ember body, gold tip, ink-black ash fog.
const EMBER_COLOR = Color.fromHex(THEME_SPEC.colors.crimsonDeep);
const GLOW_TIP_COLOR = Color.fromHex(THEME_SPEC.colors.gold);
const ASH_FOG_COLOR = { ...Color.fromHex(THEME_SPEC.colors.inkBlack), a: 0.45 };

export interface Zone5BgDeps {
  world: World;
  atlas: AtlasHandle;
  viewportWidth: number;
  viewportHeight: number;
}

export interface Zone5BgController {
  /** Remove both background entities from the world. */
  destroy(): void;
}

/**
 * Spawn 2 fullscreen background entities for Zone 5.
 * The atlas frame (`tile-fire`) provides the texture source; the effect
 * shader overrides the pixel output so the 32×32 tile never tiles visibly.
 */
export function createZone5Bg(deps: Zone5BgDeps): Zone5BgController {
  const { world, atlas, viewportWidth, viewportHeight } = deps;

  const frame = getFrame(atlas.sheet, 'tile-fire');
  if (!frame) throw new Error('zone5-bg: tile-fire frame not found in atlas');

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
    effect: fire({ color: EMBER_COLOR, tipColor: GLOW_TIP_COLOR, speed: 0.7, intensity: 0.85 }),
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
    effect: fog(ASH_FOG_COLOR, 0.55, 0.3, 2.2),
  });

  return {
    destroy() {
      world.destroy(fireId);
      world.destroy(fogId);
    },
  };
}
