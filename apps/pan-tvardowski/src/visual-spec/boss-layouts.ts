import type { BossLayoutDef } from './types';

/**
 * Spawn-layout descriptors for bosses and minibosses that summon additional
 * entities. Geometry only — timing and count live in the FSM scripts.
 *
 * Values are extracted exactly from the existing FSM spawn sites (pure refactor,
 * zero behavior change):
 *
 *   Boruta   — `spawnBorutaSummons`: offset × 60, pos.y + 40
 *   Nocny Łowca — `summonHounds`: offset × 46, pos.y + 30
 *   Wodnik   — `raiseWodnikShield`: offset × 70, bounds.height + 40
 */
export const BOSS_LAYOUT_DEFS: readonly BossLayoutDef[] = [
  {
    id: 'boruta',
    summons: [
      {
        kind: 'bies',
        ox: 60,
        oy: 40,
      },
    ],
  },
  {
    id: 'nocny-lowca',
    summons: [
      {
        kind: 'hound',
        ox: 46,
        oy: 30,
      },
    ],
  },
  {
    id: 'wodnik-wislanny',
    summons: [
      {
        kind: 'topielec',
        ox: 70,
        oy: 40,
        origin: 'screen-bottom',
      },
    ],
  },
];
