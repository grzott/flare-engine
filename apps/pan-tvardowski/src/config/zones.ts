import type { BossPattern, MinibossPattern } from '../components';
import type { ZoneId } from '../events';
import { buildZone1Schedule, buildZone2Schedule, buildZone3Schedule } from '../systems/spawner';
import type { WaveEntry } from '../systems/spawner';
import {
  BOROWY_HP_MAX,
  BOSS_SPAWN_T,
  ROKITA_HP,
  SMOK_HP_MAX,
  WODNIK_HP_MAX,
  ZONE2_BOSS_T,
  ZONE2_MINIBOSS_T,
  ZONE3_BOSS_T,
} from './gameplay';

export interface ZoneConfig {
  readonly id: ZoneId;
  readonly nameKey: string;
  readonly bossNameKey: string;
  readonly bossPattern: BossPattern;
  readonly bossHp: number;
  readonly bossT: number;
  readonly minibossPattern: MinibossPattern | null;
  readonly minibossHp: number;
  readonly minibossT: number;
  readonly buildSchedule: (seed: number, viewportWidth?: number) => WaveEntry[];
  readonly nextZone: ZoneId | null;
}

export const ZONES: Record<ZoneId, ZoneConfig> = {
  z1: {
    id: 'z1',
    nameKey: 'zones.1.name',
    bossNameKey: 'bosses.smok-krzemionkowski.name',
    bossPattern: 'smok-krzemionkowski',
    bossHp: SMOK_HP_MAX,
    bossT: BOSS_SPAWN_T,
    minibossPattern: null,
    minibossHp: 0,
    minibossT: Number.POSITIVE_INFINITY,
    buildSchedule: buildZone1Schedule,
    nextZone: 'z2',
  },
  z2: {
    id: 'z2',
    nameKey: 'zones.2.name',
    bossNameKey: 'bosses.borowy-krol.name',
    bossPattern: 'borowy-krol',
    bossHp: BOROWY_HP_MAX,
    bossT: ZONE2_BOSS_T,
    minibossPattern: 'rokita',
    minibossHp: ROKITA_HP,
    minibossT: ZONE2_MINIBOSS_T,
    buildSchedule: buildZone2Schedule,
    nextZone: 'z3',
  },
  z3: {
    id: 'z3',
    nameKey: 'zones.3.name',
    bossNameKey: 'bosses.wodnik-wislanny.name',
    bossPattern: 'wodnik-wislanny',
    bossHp: WODNIK_HP_MAX,
    bossT: ZONE3_BOSS_T,
    minibossPattern: null,
    minibossHp: 0,
    minibossT: Number.POSITIVE_INFINITY,
    buildSchedule: buildZone3Schedule,
    nextZone: null,
  },
};
