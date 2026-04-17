import {
  type ProceduralAtlas,
  type ProceduralFrameSpec,
  createProceduralAtlas,
} from '@flare-engine/engine';
import type { SkiaAtlasModuleLike } from '@flare-engine/engine';

const frames: ProceduralFrameSpec[] = [
  { name: 'player', w: 32, h: 32, color: 0xff66ccff },
  { name: 'enemy-a', w: 28, h: 28, color: 0xffff5566 },
  { name: 'enemy-b', w: 24, h: 24, color: 0xffff9944 },
  { name: 'enemy-c', w: 32, h: 24, color: 0xffcc44ff },
  { name: 'bullet-player', w: 6, h: 14, color: 0xffffffff },
  { name: 'bullet-enemy', w: 6, h: 10, color: 0xffff8855 },
  { name: 'particle-spark', w: 4, h: 4, color: 0xffffee88 },
  { name: 'particle-smoke', w: 6, h: 6, color: 0xff888888 },
  { name: 'boss', w: 96, h: 64, color: 0xffcc3355 },
];

export function buildPlaceholderAtlas(skia: SkiaAtlasModuleLike): ProceduralAtlas {
  return createProceduralAtlas(skia, frames, { maxWidth: 512, padding: 1 });
}
