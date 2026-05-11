/**
 * Zone 1 background — two fullscreen-stretched sprite entities:
 *   z = -100  FireEffect (Krakow rooftop ember glow)
 *   z = -90   FogEffect  (chimney smoke)
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

const Z_FIRE = -100;
const Z_FOG = -90;

// Zone 1 palette: terracotta ember glow, gold tip, rust chimney smoke.
const EMBER_COLOR = { r: 0xb0 / 255, g: 0x5a / 255, b: 0x3c / 255, a: 1 } as const;
const GLOW_TIP_COLOR = { r: 0xc9 / 255, g: 0xa2 / 255, b: 0x4a / 255, a: 1 } as const;
const CHIMNEY_FOG_COLOR = { r: 0x8b / 255, g: 0x3a / 255, b: 0x1f / 255, a: 0.4 } as const;

export interface Zone1BgDeps {
  world: World;
  atlas: AtlasHandle;
  viewportWidth: number;
  viewportHeight: number;
}

export interface Zone1BgController {
  /** Remove both background entities from the world. */
  destroy(): void;
}

/**
 * Spawn 2 fullscreen background entities for Zone 1.
 * The atlas frame (`tile-fire`) provides the texture source; the effect
 * shader overrides the pixel output so the 32×32 tile never tiles visibly.
 */
export function createZone1Bg(deps: Zone1BgDeps): Zone1BgController {
  const { world, atlas, viewportWidth, viewportHeight } = deps;

  const frame = getFrame(atlas.sheet, 'tile-fire');
  if (!frame) throw new Error('zone1-bg: tile-fire frame not found in atlas');

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
    effect: fire({ color: EMBER_COLOR, tipColor: GLOW_TIP_COLOR, speed: 0.9, intensity: 0.75 }),
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
    effect: fog(CHIMNEY_FOG_COLOR, 0.5, 0.4, 2.0),
  });

  return {
    destroy() {
      world.destroy(fireId);
      world.destroy(smokeId);
    },
  };
}
