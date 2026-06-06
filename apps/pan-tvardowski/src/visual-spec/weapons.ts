import type { BulletSpecId, WeaponDef, WeaponSpecId } from './types';

const wid = (s: string) => s as WeaponSpecId;
const bid = (s: string) => s as BulletSpecId;

// fireRate/damage are L1 base-tier literals (build plan §10 / folio XIIID).
export const WEAPON_DEFS: readonly WeaponDef[] = [
  {
    id: wid('iskry'),
    bullet: bid('iskry-bullet'),
    fireRate: 8,
    spread: 0,
    volley: 1,
    damage: 10,
    sfxKey: 'spark',
  },
  {
    id: wid('piorun'),
    bullet: bid('piorun-bullet'),
    fireRate: 3,
    spread: 0,
    volley: 1,
    damage: 18,
    sfxKey: 'lightning',
  },
  {
    id: wid('sol-swiecona'),
    bullet: bid('sol-swiecona-bullet'),
    fireRate: 1,
    spread: 0,
    volley: 1,
    damage: 25,
    sfxKey: 'holy',
  },
  {
    id: wid('znak-pentagramu'),
    bullet: bid('znak-pentagramu-bullet'),
    fireRate: 2,
    spread: 0,
    volley: 1,
    damage: 22,
    sfxKey: 'sigil',
  },
] as const;
