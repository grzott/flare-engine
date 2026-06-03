import type { ZoneBgDef } from './types';
import type { ZoneId } from './zones-palette';

export const ZONE_BG_DEFS = {
  1: {
    zoneId: 1,
    kind: 'image',
    scrollSpeed: 18,
  },
  2: {
    zoneId: 2,
    kind: 'forest-canopy',
    primaryToken: 'moss',
    secondaryToken: 'leafGreen',
    scrollSpeed: 12,
    density: 6,
  },
  3: {
    zoneId: 3,
    kind: 'river-wave',
    primaryToken: 'vistulaBlue',
    secondaryToken: 'foamBlue',
    scrollSpeed: 22,
    density: 2.5,
  },
  4: {
    zoneId: 4,
    kind: 'forest-canopy',
    primaryToken: 'bogGreen',
    secondaryToken: 'waterTeal',
    scrollSpeed: 10,
    density: 4,
  },
  5: {
    zoneId: 5,
    kind: 'mountain-hills',
    primaryToken: 'crimsonDeep',
    secondaryToken: 'inkBlack',
    scrollSpeed: 16,
    density: 1.8,
  },
  6: {
    zoneId: 6,
    kind: 'cave-interior',
    primaryToken: 'katakumbyDark',
    secondaryToken: 'goldDeep',
    scrollSpeed: 8,
    density: 10,
  },
  7: {
    zoneId: 7,
    kind: 'roofs-city',
    primaryToken: 'rust',
    secondaryToken: 'pitchBrown',
    scrollSpeed: 15,
    density: 5,
  },
  8: {
    zoneId: 8,
    kind: 'moon-crater',
    primaryToken: 'bone',
    secondaryToken: 'lunarInk',
    scrollSpeed: 6,
    density: 5,
  },
} as const satisfies Record<ZoneId, ZoneBgDef>;
