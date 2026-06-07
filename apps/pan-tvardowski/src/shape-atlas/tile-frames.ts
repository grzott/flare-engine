import { argbTo } from '@flare-engine/shapes';
import { hexToArgb } from '../util/hex';
import { TILE_DEFS } from '../visual-spec/tiles';
import { ATLAS_COLOR, type FrameBuild } from './types';

export function buildTileFrames(): FrameBuild[] {
  const frames: FrameBuild[] = [];

  // Tile frames for zone shader backgrounds — driven by TILE_DEFS.
  for (const def of TILE_DEFS) {
    const side = def.size;
    const baseArgb = hexToArgb(def.baseFill);
    const accentArgb = def.accent !== undefined ? hexToArgb(def.accent.fill) : 0;
    const hasAccent = def.accent !== undefined;
    frames.push({
      name: String(def.id),
      w: side,
      h: side,
      draw: (Skia, canvas) => {
        const base = Skia.Paint();
        argbTo(ATLAS_COLOR, baseArgb);
        base.setColor(ATLAS_COLOR);
        canvas.drawRect(Skia.XYWHRect(0, 0, side, side), base);
        if (hasAccent) {
          const ripple = Skia.Paint();
          argbTo(ATLAS_COLOR, accentArgb);
          ripple.setColor(ATLAS_COLOR);
          canvas.drawRect(Skia.XYWHRect(4, 8, 24, 2), ripple);
          canvas.drawRect(Skia.XYWHRect(8, 20, 20, 2), ripple);
        }
      },
    });
  }

  return frames;
}
