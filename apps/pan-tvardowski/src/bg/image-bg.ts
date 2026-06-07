import { Position } from '@flare-engine/ecs';
import { Sprite } from '@flare-engine/render';
import type { ZoneBgController, ZoneBgDeps } from './types';

const Z_LAYER_A = -100;

export function createZoneImageBg(deps: ZoneBgDeps, scrollSpeed: number): ZoneBgController {
  const { world, atlas, camera } = deps;

  const initW = camera.viewportWidth > 0 ? camera.viewportWidth : deps.viewportWidth;
  const initH = camera.viewportHeight > 0 ? camera.viewportHeight : deps.viewportHeight;
  const initCx = initW / 2;
  const initCy = initH / 2;
  const anchor = { x: 0.5, y: 0.5 };

  // Sentinel frame — zero-size, used while the real image is still null.
  const sentinelFrame = { name: 'bg-sentinel', x: 0, y: 0, w: 0, h: 0 };

  const idTop = world.spawn();
  world.add(idTop, Position, { x: initCx, y: initCy - initH });
  world.add(idTop, Sprite, {
    image: atlas.image,
    frame: sentinelFrame,
    z: Z_LAYER_A,
    width: initW,
    height: initH,
    anchor,
    alpha: 0,
  });

  const idBot = world.spawn();
  world.add(idBot, Position, { x: initCx, y: initCy });
  world.add(idBot, Sprite, {
    image: atlas.image,
    frame: sentinelFrame,
    z: Z_LAYER_A,
    width: initW,
    height: initH,
    anchor,
    alpha: 0,
  });

  let imageResolved = false;

  return {
    destroy() {
      world.destroy(idTop);
      world.destroy(idBot);
    },

    tick(dt: number) {
      const vw = camera.viewportWidth > 0 ? camera.viewportWidth : deps.viewportWidth;
      const vh = camera.viewportHeight > 0 ? camera.viewportHeight : deps.viewportHeight;
      const cx = vw / 2;

      const posTop = world.get(idTop, Position);
      const posBot = world.get(idBot, Position);
      const sprTop = world.get(idTop, Sprite);
      const sprBot = world.get(idBot, Sprite);
      if (!posTop || !posBot || !sprTop || !sprBot) return;

      // Live-image transition: once bg.image is non-null, switch both sprites.
      if (!imageResolved && deps.bg?.image != null) {
        const img = deps.bg.image;
        const fullFrame = { name: 'darkPurple', x: 0, y: 0, w: img.width(), h: img.height() };
        sprTop.image = img;
        sprTop.frame = fullFrame;
        sprTop.alpha = 1;
        sprTop.stretch = true;
        sprBot.image = img;
        sprBot.frame = fullFrame;
        sprBot.alpha = 1;
        sprBot.stretch = true;
        imageResolved = true;
      }

      // Camera-sync: keep sprites sized to full viewport.
      sprTop.width = vw;
      sprTop.height = vh;
      sprBot.width = vw;
      sprBot.height = vh;
      posTop.x = cx;
      posBot.x = cx;

      // Scroll downward.
      posTop.y += scrollSpeed * dt;
      posBot.y += scrollSpeed * dt;

      // Wrap: absolute, drift-free. Both sprites stay exactly vh apart.
      const cy = vh / 2;
      if (posTop.y > cy + vh) posTop.y -= 2 * vh;
      if (posBot.y > cy + vh) posBot.y -= 2 * vh;
    },
  };
}
