import type { ZoneId } from '../palette';
import type { ZoneVisualSpec } from './types';
import { zone1 } from './zone-1';
import { zone2 } from './zone-2';
import { zone3 } from './zone-3';
import { zone4 } from './zone-4';
import { zone5 } from './zone-5';
import { zone6 } from './zone-6';
import { zone7 } from './zone-7';
import { zone8 } from './zone-8';

export type { ZoneVisualSpec } from './types';
export * from './types';
export { HULL_PRESETS } from './hull-presets';
export { SHIP_DEFS } from './ships';
export { BULLET_DEFS } from './bullets';
export { WEAPON_DEFS } from './weapons';
export { PICKUP_DEFS } from './pickups';

export const ZONE_VISUAL_SPECS: Readonly<Record<ZoneId, ZoneVisualSpec>> = Object.freeze({
  1: zone1,
  2: zone2,
  3: zone3,
  4: zone4,
  5: zone5,
  6: zone6,
  7: zone7,
  8: zone8,
});
