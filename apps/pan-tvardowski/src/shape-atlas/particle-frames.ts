import { argbTo } from '@flare-engine/shapes';
import { hexToArgb } from '../util/hex';
import { PARTICLE_DEFS } from '../visual-spec/particles';
import { ATLAS_COLOR, type FrameBuild } from './types';

export function buildParticleFrames(): FrameBuild[] {
  const frames: FrameBuild[] = [];

  for (const def of PARTICLE_DEFS) {
    const fillArgb = hexToArgb(def.fill);
    const side = Math.ceil(def.size * 2);
    const r = def.size;
    frames.push({
      name: String(def.id),
      w: side,
      h: side,
      draw: (Skia, canvas) => {
        const paint = Skia.Paint();
        argbTo(ATLAS_COLOR, fillArgb);
        paint.setColor(ATLAS_COLOR);
        canvas.drawCircle(r, r, r, paint);
      },
    });
  }

  return frames;
}
