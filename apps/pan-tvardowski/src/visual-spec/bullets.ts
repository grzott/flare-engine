import type { BulletDef, BulletSpecId } from './types';

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
    fill: '#ff9944',
    glow: 'friendly',
  },
  {
    id: id('piorun-bullet'),
    kind: 'line',
    width: 2,
    length: 14,
    intensity: 1.4,
    fill: '#fff7a6',
    glow: 'friendly',
  },
  {
    id: id('sol-swiecona-bullet'),
    kind: 'laser',
    width: 4,
    intensity: 1.8,
    fill: '#c8cdd4',
    glow: 'friendly',
  },
  {
    id: id('znak-pentagramu-bullet'),
    kind: 'dot',
    r: 6,
    intensity: 1.5,
    fill: '#8844ff',
    glow: 'friendly',
  },
  {
    id: id('enemy-bullet'),
    kind: 'line',
    width: 2,
    length: 12,
    intensity: 1.0,
    fill: '#e84b2a',
    glow: 'hazard',
  },
] as const;
