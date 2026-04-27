import type { EntitlementKey } from '@flare-engine/iap';
import type { MusicKey } from '../audio/synth';
import type { BossPattern, MinibossPattern } from '../components';
import type { ZoneId } from '../events';
import { ENTITLEMENT_FULL_GAME } from '../iap/catalog';
import {
  buildZone1Schedule,
  buildZone2Schedule,
  buildZone3Schedule,
  buildZone4Schedule,
  buildZone5Schedule,
  buildZone6Schedule,
  buildZone7Schedule,
  buildZone8Schedule,
} from '../systems/spawner';
import type { WaveEntry } from '../systems/spawner';
import {
  BABA_JAGA_HP_MAX,
  BAZYLISZEK_HP_MAX,
  BOROWY_HP_MAX,
  BORUTA_HP_MAX,
  BOSS_SPAWN_T,
  LESZY_HP,
  LUCYPER_HP_MAX,
  MADEJ_HP,
  MEFISTOFELES_HP_MAX,
  NOCNY_LOWCA_HP,
  ROKITA_HP,
  SMOK_HP_MAX,
  WODNIK_HP_MAX,
  ZONE2_BOSS_T,
  ZONE2_MINIBOSS_T,
  ZONE3_BOSS_T,
  ZONE4_BOSS_T,
  ZONE4_MINIBOSS_T,
  ZONE5_BOSS_T,
  ZONE6_BOSS_T,
  ZONE6_MINIBOSS_T,
  ZONE7_BOSS_T,
  ZONE7_MINIBOSS_T,
  ZONE8_BOSS_T,
} from './gameplay';

/**
 * Balance freeze date — `YYYY-MM-DD`. After this date, edits to this file are
 * blocked by `scripts/check-balance-freeze.sh` unless `ALLOW_BALANCE_CHANGE=1`
 * is set in the environment. Bump only with intent (post-launch balance pass).
 */
export const BALANCE_FROZEN_AT = '2026-04-28';

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
  readonly music: MusicKey;
  readonly nextZone: ZoneId | null;
  /** Zones 4–8 require this entitlement; undefined = free zone. */
  readonly requiresEntitlement?: EntitlementKey;
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
    music: 'zone1',
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
    music: 'zone2',
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
    music: 'zone3',
    nextZone: 'z4',
  },
  z4: {
    id: 'z4',
    nameKey: 'zones.4.name',
    bossNameKey: 'bosses.boruta.name',
    bossPattern: 'boruta',
    bossHp: BORUTA_HP_MAX,
    bossT: ZONE4_BOSS_T,
    minibossPattern: 'leszy',
    minibossHp: LESZY_HP,
    minibossT: ZONE4_MINIBOSS_T,
    buildSchedule: buildZone4Schedule,
    music: 'zone4',
    nextZone: 'z5',
    requiresEntitlement: ENTITLEMENT_FULL_GAME,
  },
  z5: {
    id: 'z5',
    nameKey: 'zones.5.name',
    bossNameKey: 'bosses.baba-jaga.name',
    bossPattern: 'baba-jaga',
    bossHp: BABA_JAGA_HP_MAX,
    bossT: ZONE5_BOSS_T,
    minibossPattern: null,
    minibossHp: 0,
    minibossT: Number.POSITIVE_INFINITY,
    buildSchedule: buildZone5Schedule,
    music: 'zone5',
    nextZone: 'z6',
    requiresEntitlement: ENTITLEMENT_FULL_GAME,
  },
  z6: {
    id: 'z6',
    nameKey: 'zones.6.name',
    bossNameKey: 'bosses.bazyliszek-warszawski.name',
    bossPattern: 'bazyliszek-warszawski',
    bossHp: BAZYLISZEK_HP_MAX,
    bossT: ZONE6_BOSS_T,
    minibossPattern: 'nocny-lowca',
    minibossHp: NOCNY_LOWCA_HP,
    minibossT: ZONE6_MINIBOSS_T,
    buildSchedule: buildZone6Schedule,
    music: 'zone6',
    nextZone: 'z7',
    requiresEntitlement: ENTITLEMENT_FULL_GAME,
  },
  z7: {
    id: 'z7',
    nameKey: 'zones.7.name',
    bossNameKey: 'bosses.mefistofeles.name',
    bossPattern: 'mefistofeles',
    bossHp: MEFISTOFELES_HP_MAX,
    bossT: ZONE7_BOSS_T,
    minibossPattern: 'madej',
    minibossHp: MADEJ_HP,
    minibossT: ZONE7_MINIBOSS_T,
    buildSchedule: buildZone7Schedule,
    music: 'zone7',
    nextZone: 'z8',
    requiresEntitlement: ENTITLEMENT_FULL_GAME,
  },
  z8: {
    id: 'z8',
    nameKey: 'zones.8.name',
    bossNameKey: 'bosses.lucyper-ksiezycowy.name',
    bossPattern: 'lucyper-ksiezycowy',
    bossHp: LUCYPER_HP_MAX,
    bossT: ZONE8_BOSS_T,
    minibossPattern: null,
    minibossHp: 0,
    minibossT: Number.POSITIVE_INFINITY,
    buildSchedule: buildZone8Schedule,
    music: 'zone8',
    nextZone: null,
    requiresEntitlement: ENTITLEMENT_FULL_GAME,
  },
};
