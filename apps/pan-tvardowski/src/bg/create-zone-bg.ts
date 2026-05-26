import { getFrame } from '@flare-engine/assets';
import { Position } from '@flare-engine/ecs';
import type { World } from '@flare-engine/ecs';
import { Color } from '@flare-engine/math';
import {
  Sprite,
  caveInterior,
  forestCanopy,
  moonCrater,
  mountainHills,
  riverWave,
  roofsCity,
} from '@flare-engine/render';
import type { AnySpriteEffect } from '@flare-engine/render';
import type { AtlasHandle } from '../spawn';
import { THEME_SPEC } from '../visual-spec/theme';
import { ZONE_BG_DEFS } from '../visual-spec/zone-bg';

const Z_LAYER_A = -100;
const Z_LAYER_B = -90;

type ZoneBgId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Minimal camera interface — only the viewport dimensions are needed. */
export interface ZoneBgCamera {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

export interface ZoneBgDeps {
  world: World;
  atlas: AtlasHandle;
  viewportWidth: number;
  viewportHeight: number;
  /** Live camera reference. tick() reads this each frame to detect the first
   * real layout and resize both BG entities to true full-canvas dimensions.
   * The initial viewportWidth/Height values from s.bounds are the play-area
   * size (safe-area-inset reduced and possibly the 360×640 pre-layout fallback);
   * camera.viewportWidth/Height is the actual canvas size. Without this sync
   * the BG only covers the 2/3-top band on real devices. */
  camera: ZoneBgCamera;
}

export interface ZoneBgController {
  destroy(): void;
  tick(dt: number): void;
}

function assertNever(x: never): never {
  throw new Error(`unreachable: ${x}`);
}

function buildEffect(
  kind: (typeof ZONE_BG_DEFS)[ZoneBgId]['kind'],
  primary: ReturnType<typeof Color.fromHex>,
  secondary: ReturnType<typeof Color.fromHex>,
  density: number,
  scrollOffsetY: number,
  resolutionW: number,
  resolutionH: number,
): AnySpriteEffect {
  switch (kind) {
    case 'roofs-city':
      return roofsCity({
        skyColor: primary,
        roofColor: secondary,
        scrollOffsetY,
        density,
        resolutionW,
        resolutionH,
      });
    case 'forest-canopy':
      return forestCanopy({
        skyColor: primary,
        leafColor: secondary,
        scrollOffsetY,
        density,
        resolutionW,
        resolutionH,
      });
    case 'river-wave':
      return riverWave({
        waterColor: primary,
        foamColor: secondary,
        scrollOffsetY,
        waveScale: density,
        resolutionW,
        resolutionH,
      });
    case 'moon-crater':
      return moonCrater({
        moonColor: primary,
        craterColor: secondary,
        scrollOffsetY,
        craterCount: density,
        resolutionW,
        resolutionH,
      });
    case 'cave-interior':
      return caveInterior({
        caveColor: primary,
        glowColor: secondary,
        scrollOffsetY,
        stalactiteCount: density,
        resolutionW,
        resolutionH,
      });
    case 'mountain-hills':
      return mountainHills({
        skyColor: primary,
        hillColor: secondary,
        scrollOffsetY,
        ridgeScale: density,
        resolutionW,
        resolutionH,
      });
    default:
      return assertNever(kind);
  }
}

export function createZoneBg(zoneId: string, deps: ZoneBgDeps): ZoneBgController {
  const { world, atlas, camera } = deps;

  const numId = Number(zoneId.slice(1)) as ZoneBgId;
  const def = ZONE_BG_DEFS[numId];
  if (!def) throw new Error(`createZoneBg: unknown zoneId ${zoneId}`);

  const frame = getFrame(atlas.sheet, 'tile-fire');
  if (!frame) throw new Error('createZoneBg: tile-fire frame not found in atlas');

  const primary = Color.fromHex(THEME_SPEC.colors[def.primaryToken]);
  const secondary = Color.fromHex(THEME_SPEC.colors[def.secondaryToken]);

  let scrollOffset = 0;

  // Use camera dimensions if already available; fall back to the passed play-area
  // bounds (deps.viewportWidth/Height) as the initial best-guess. tick() corrects
  // to the true canvas size on the first frame where the layout has fired.
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

      // Resolve true canvas dimensions. The camera's viewportWidth/Height
      // reflect the actual device canvas once React Native layout has fired;
      // the play-area bounds (passed at spawn) subtract the safe-area inset
      // and default to 360×640 before layout. Using camera dimensions here
      // ensures the BG entities grow to fill the full canvas rather than the
      // reduced play-area band.
      const vw = camera.viewportWidth > 0 ? camera.viewportWidth : deps.viewportWidth;
      const vh = camera.viewportHeight > 0 ? camera.viewportHeight : deps.viewportHeight;
      const cx = vw / 2;
      const cy = vh / 2;

      const sprA = world.get(idA, Sprite);
      if (sprA) {
        const posA = world.get(idA, Position);
        if (posA) {
          posA.x = cx;
          posA.y = cy;
        }
        sprA.width = vw;
        sprA.height = vh;
        sprA.effect = buildEffect(def.kind, primary, secondary, def.density, scrollOffset, vw, vh);
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
        sprB.effect = buildEffect(def.kind, primary, secondary, def.density, scrollOffset, vw, vh);
      }
    },
  };
}
