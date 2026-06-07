import { argbTo } from '@flare-engine/shapes';
import { hexToArgb } from '../util/hex';
import { BULLET_DEFS } from '../visual-spec/bullets';
import { ATLAS_COLOR, type FrameBuild } from './types';

export function buildBulletFrames(): FrameBuild[] {
  const frames: FrameBuild[] = [];

  // Bullet frames — data-driven from BULLET_DEFS. Frame name = BulletSpecId.
  // The 'enemy-bullet' entry also emits 'enemy-bullet-b': a stroke variant for
  // the 8 Hz flicker used in play.ts (hazardOrange at alpha 0.6 = 0x99E84B2A).
  for (const def of BULLET_DEFS) {
    const fillArgb = hexToArgb(def.fill);
    const name = String(def.id);

    if (def.kind === 'line') {
      const { width: w, length: h } = def;
      frames.push({
        name,
        w,
        h,
        draw: (Skia, canvas) => {
          const paint = Skia.Paint();
          argbTo(ATLAS_COLOR, fillArgb);
          paint.setColor(ATLAS_COLOR);
          canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
        },
      });
      if (name === 'enemy-bullet') {
        const strokeArgb = 0x99e84b2a;
        frames.push({
          name: 'enemy-bullet-b',
          w,
          h,
          draw: (Skia, canvas) => {
            const paint = Skia.Paint();
            argbTo(ATLAS_COLOR, fillArgb);
            paint.setColor(ATLAS_COLOR);
            canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
            const stroke = Skia.Paint();
            argbTo(ATLAS_COLOR, strokeArgb);
            stroke.setColor(ATLAS_COLOR);
            stroke.setStyle(1); // PaintStyle.Stroke
            stroke.setStrokeWidth(0.5);
            canvas.drawRect(Skia.XYWHRect(0.25, 0.25, w - 0.5, h - 0.5), stroke);
          },
        });
      }
    } else if (def.kind === 'dot') {
      const { r } = def;
      const side = Math.ceil(r * 2);
      frames.push({
        name,
        w: side,
        h: side,
        draw: (Skia, canvas) => {
          const paint = Skia.Paint();
          argbTo(ATLAS_COLOR, fillArgb);
          paint.setColor(ATLAS_COLOR);
          canvas.drawCircle(r, r, r, paint);
        },
      });
    } else if (def.kind === 'laser') {
      // Laser: a tall thin rect; length is capped to 64 px for atlas budget.
      const w = def.width;
      const h = 64;
      frames.push({
        name,
        w,
        h,
        draw: (Skia, canvas) => {
          const paint = Skia.Paint();
          argbTo(ATLAS_COLOR, fillArgb);
          paint.setColor(ATLAS_COLOR);
          canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
        },
      });
    } else if (def.kind === 'dots') {
      // dots cluster: bounding square = (spread + r) * 2.
      const side = Math.ceil((def.spread + def.r) * 2);
      const cx = side / 2;
      const cy = side / 2;
      const { r, spread, count } = def;
      frames.push({
        name,
        w: side,
        h: side,
        draw: (Skia, canvas) => {
          const paint = Skia.Paint();
          argbTo(ATLAS_COLOR, fillArgb);
          paint.setColor(ATLAS_COLOR);
          // Arrange dots evenly on a circle (scheme='circle').
          for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            canvas.drawCircle(
              cx + Math.cos(angle) * spread,
              cy + Math.sin(angle) * spread,
              r,
              paint,
            );
          }
        },
      });
    } else {
      // rocket: treat same as line using width/length.
      const { width: w, length: h } = def as { kind: 'rocket'; width: number; length: number };
      frames.push({
        name,
        w,
        h,
        draw: (Skia, canvas) => {
          const paint = Skia.Paint();
          argbTo(ATLAS_COLOR, fillArgb);
          paint.setColor(ATLAS_COLOR);
          canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
        },
      });
    }
  }

  return frames;
}
