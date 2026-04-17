import { type SkImageLike, createSpriteSheet } from '@flare-engine/assets';
import type { AtlasHandle } from './spawn';

const FRAME_NAMES = [
  'player',
  'enemy-a',
  'enemy-b',
  'enemy-c',
  'boss',
  'bullet-player',
  'bullet-enemy',
  'particle-spark',
  'particle-smoke',
];

export function createStubAtlas(): AtlasHandle {
  const image: SkImageLike = {
    width: () => 256,
    height: () => 256,
  };
  const sheet = createSpriteSheet();
  for (const name of FRAME_NAMES) {
    sheet.frames.push({ name, x: 0, y: 0, w: 16, h: 16 });
    sheet.frameMap.set(name, sheet.frames.length - 1);
  }
  return { image, sheet };
}
