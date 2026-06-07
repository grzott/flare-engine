import { getFrame } from '@flare-engine/assets';
import { Position } from '@flare-engine/ecs';
import { Color } from '@flare-engine/math';
import { Sprite } from '@flare-engine/render';
import { THEME_SPEC } from '../visual-spec/theme';
import type { ZoneBgShaderDef } from '../visual-spec/types';
import { buildEffect } from './effect-builder';
import type { ZoneBgController, ZoneBgDeps } from './types';

const Z_LAYER_A = -100;
const Z_LAYER_B = -90;

export function createZoneSpriteBg(deps: ZoneBgDeps, def: ZoneBgShaderDef): ZoneBgController {
  const { world, atlas, camera } = deps;

  const frame = getFrame(atlas.sheet, 'tile-fire');
  if (!frame) throw new Error('createZoneSpriteBg: tile-fire frame not found in atlas');

  const primary = Color.fromHex(THEME_SPEC.colors[def.primaryToken]);
  const secondary = Color.fromHex(THEME_SPEC.colors[def.secondaryToken]);

  let scrollOffset = 0;

  const initW = camera.viewportWidth > 0 ? camera.viewportWidth : deps.viewportWidth;
  const initH = camera.viewportHeight > 0 ? camera.viewportHeight : deps.viewportHeight;
  const initCx = initW / 2;
  const initCy = initH / 2;
  const anchor = { x: 0.5, y: 0.5 };

  const idA = world.spawn();
  world.add(idA, Position, { x: initCx, y: initCy });
  world.add(idA, Sprite, {
    image: atlas.image,
    frame,
    z: Z_LAYER_A,
    width: initW,
    height: initH,
    anchor,
    effect: buildEffect(def.kind, primary, secondary, def.density, scrollOffset, initW, initH),
  });

  const idB = world.spawn();
  world.add(idB, Position, { x: initCx, y: initCy });
  world.add(idB, Sprite, {
    image: atlas.image,
    frame,
    z: Z_LAYER_B,
    width: initW,
    height: initH,
    anchor,
    effect: buildEffect(def.kind, primary, secondary, def.density, scrollOffset, initW, initH),
  });

  return {
    destroy() {
      world.destroy(idA);
      world.destroy(idB);
    },

    tick(dt: number) {
      scrollOffset += def.scrollSpeed * dt;

      const vw = camera.viewportWidth > 0 ? camera.viewportWidth : deps.viewportWidth;
      const vh = camera.viewportHeight > 0 ? camera.viewportHeight : deps.viewportHeight;
      const cx = vw / 2;
      const cy = vh / 2;

      // Within-tick dedup: both sprites receive identical arguments (same
      // scrollOffset/vw/vh), and the engine render path treats effect as
      // read-only. Build once and assign the same reference to both.
      const effect = buildEffect(def.kind, primary, secondary, def.density, scrollOffset, vw, vh);

      const sprA = world.get(idA, Sprite);
      if (sprA) {
        const posA = world.get(idA, Position);
        if (posA) {
          posA.x = cx;
          posA.y = cy;
        }
        sprA.width = vw;
        sprA.height = vh;
        sprA.effect = effect;
      }

      const sprB = world.get(idB, Sprite);
      if (sprB) {
        const posB = world.get(idB, Position);
        if (posB) {
          posB.x = cx;
          posB.y = cy;
        }
        sprB.width = vw;
        sprB.height = vh;
        sprB.effect = effect;
      }
    },
  };
}
