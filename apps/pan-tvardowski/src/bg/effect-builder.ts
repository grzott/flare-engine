import type { Color } from '@flare-engine/math';
import {
  caveInterior,
  forestCanopy,
  moonCrater,
  mountainHills,
  riverWave,
  roofsCity,
} from '@flare-engine/render';
import type { AnySpriteEffect } from '@flare-engine/render';
import type { ZoneBgShaderDef } from '../visual-spec/types';

function assertNever(x: never): never {
  throw new Error(`unreachable: ${x}`);
}

export function buildEffect(
  kind: ZoneBgShaderDef['kind'],
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
