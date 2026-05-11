import { THEME_SPEC } from './theme';
import type { BulletDef, BulletSpecId } from './types';

const c = THEME_SPEC.colors;

const id = (s: string) => s as BulletSpecId;

export const BULLET_DEFS: readonly BulletDef[] = [
  {
    id: id('iskry-bullet'),
    kind: 'dots',
    scheme: 'circle',
    count: 3,
    r: 3,
    spread: 6,
    intensity: 1.2,
    fill: c.orange,
    glow: 'friendly',
  },
  {
    id: id('piorun-bullet'),
    kind: 'line',
    width: 2,
    length: 14,
    intensity: 1.4,
    // one-off piorun-bullet fill — kept as literal since it appears nowhere else
    fill: '#FFF7A6',
    glow: 'friendly',
  },
  {
    id: id('sol-swiecona-bullet'),
    kind: 'laser',
    width: 4,
    intensity: 1.8,
    fill: c.silver,
    glow: 'friendly',
  },
  {
    id: id('znak-pentagramu-bullet'),
    kind: 'dot',
    r: 6,
    intensity: 1.5,
    fill: c.purpleBright,
    glow: 'friendly',
  },
  {
    id: id('enemy-bullet'),
    kind: 'line',
    width: 2,
    length: 12,
    intensity: 1.0,
    fill: c.hazard,
    glow: 'hazard',
  },
] as const;
