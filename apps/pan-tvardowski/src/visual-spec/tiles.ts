import { THEME_SPEC } from './theme';
import type { TileDef, TileSpecId } from './types';

const c = THEME_SPEC.colors;

const id = (s: string) => s as TileSpecId;

export const TILE_DEFS: readonly TileDef[] = [
  {
    id: id('tile-fire'),
    size: 32,
    baseFill: c.terracotta,
  },
  {
    id: id('tile-water'),
    size: 32,
    baseFill: c.vistulaBlue,
    accent: {
      // foamBlue at 0x66 alpha
      fill: '#D9E4E766',
      pattern: 'ripple-2line',
    },
  },
  {
    id: id('tile-fog'),
    size: 32,
    // mistBlue at 0x44 alpha
    baseFill: '#E4F0FF44',
  },
] as const;
