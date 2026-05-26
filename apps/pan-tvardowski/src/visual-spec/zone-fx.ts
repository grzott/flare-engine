import type { ZoneFxDef } from './types';
import type { ZoneId } from './zones-palette';

export const ZONE_FX_DEFS = {
  1: {
    zoneId: 1,
    kind: 'rain',
    intensity: 0.55,
    direction: 15,
    speed: 180,
  },
  2: {
    zoneId: 2,
    kind: 'sun-shaft',
    intensity: 0.45,
    direction: 0,
    speed: 0,
  },
  3: {
    zoneId: 3,
    kind: 'rain',
    intensity: 0.7,
    direction: 5,
    speed: 220,
  },
  4: {
    zoneId: 4,
    kind: 'dark-vignette',
    intensity: 0.5,
    direction: 0,
    speed: 0,
  },
  5: {
    zoneId: 5,
    kind: 'dark-vignette',
    intensity: 0.75,
    direction: 0,
    speed: 0,
  },
  6: {
    zoneId: 6,
    kind: 'dark-vignette',
    intensity: 0.65,
    direction: 0,
    speed: 0,
  },
  7: {
    zoneId: 7,
    kind: 'clouds',
    intensity: 0.4,
    direction: 10,
    speed: 60,
  },
  8: {
    zoneId: 8,
    kind: 'clouds',
    intensity: 0.6,
    direction: 0,
    speed: 40,
  },
} as const satisfies Record<ZoneId, ZoneFxDef>;
