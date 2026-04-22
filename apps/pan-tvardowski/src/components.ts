import { defineComponent } from '@flare-engine/ecs';

export interface ShipData {
  fireRate: number;
  cooldown: number;
}
export const Ship = defineComponent<ShipData>('Ship', () => ({
  fireRate: 0.22,
  cooldown: 0,
}));

/** Enemy kinds across Zones 1–3. */
export type EnemyPattern = 'skrzat' | 'latawiec' | 'czart' | 'bies' | 'topielec' | 'strzyga';

export interface EnemyData {
  pattern: EnemyPattern;
  t: number;
  baseX: number;
  speed: number;
  scoreValue: number;
  fireInterval: number;
  fireCooldown: number;
}
export const Enemy = defineComponent<EnemyData>('Enemy', () => ({
  pattern: 'skrzat',
  t: 0,
  baseX: 0,
  speed: 130,
  scoreValue: 100,
  fireInterval: 2.4,
  fireCooldown: 1.5,
}));

export interface BulletData {
  damage: number;
  ownerLayer: number;
}
export const Bullet = defineComponent<BulletData>('Bullet', () => ({
  damage: 1,
  ownerLayer: 0,
}));

export interface HpData {
  current: number;
  max: number;
}
export const Hp = defineComponent<HpData>('Hp', () => ({ current: 1, max: 1 }));

export interface LifetimeData {
  remaining: number;
}
export const Lifetime = defineComponent<LifetimeData>('Lifetime', () => ({
  remaining: 1,
}));

export type BossPhase = 'entering' | 'phase1' | 'phase2' | 'dying' | 'defeated';

export type BossPattern = 'smok-krzemionkowski' | 'borowy-krol' | 'wodnik-wislanny';

export interface BossData {
  pattern: BossPattern;
  phase: BossPhase;
  t: number;
  phaseT: number;
  fireCooldown: number;
  dyingExplosions: number;
  targetY: number;
  /** Wodnik Wiślany: true while bubble-shield minions are alive. */
  shieldActive: boolean;
  /** Count of currently-alive shield minions (Wodnik phase 2). */
  minionsAlive: number;
  /** Seconds since shield last dropped; used to gate re-raising the shield. */
  shieldDownFor: number;
}
export const Boss = defineComponent<BossData>('Boss', () => ({
  pattern: 'smok-krzemionkowski',
  phase: 'entering',
  t: 0,
  phaseT: 0,
  fireCooldown: 0,
  dyingExplosions: 0,
  targetY: 90,
  shieldActive: false,
  minionsAlive: 0,
  shieldDownFor: 0,
}));

export type MinibossPattern = 'rokita';
export type MinibossPhase = 'entering' | 'active' | 'dying' | 'defeated';

export interface MinibossData {
  pattern: MinibossPattern;
  phase: MinibossPhase;
  t: number;
  phaseT: number;
  fireCooldown: number;
  dyingExplosions: number;
  targetY: number;
  /** Horizontal root-line growth progress 0..1 (Rokita). */
  rootProgress: number;
}
export const Miniboss = defineComponent<MinibossData>('Miniboss', () => ({
  pattern: 'rokita',
  phase: 'entering',
  t: 0,
  phaseT: 0,
  fireCooldown: 0,
  dyingExplosions: 0,
  targetY: 110,
  rootProgress: 0,
}));
