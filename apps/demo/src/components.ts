import { defineComponent } from '@flare/ecs';

export interface ShipData {
  fireRate: number;
  cooldown: number;
}

export const Ship = defineComponent<ShipData>('Ship', () => ({
  fireRate: 0.2,
  cooldown: 0,
}));

export type EnemyPattern = 'straight' | 'sine' | 'diagonal';

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
  pattern: 'straight',
  t: 0,
  baseX: 0,
  speed: 120,
  scoreValue: 100,
  fireInterval: 2,
  fireCooldown: 2,
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

export const Lifetime = defineComponent<LifetimeData>('Lifetime', () => ({ remaining: 1 }));

export type BossPhase = 'entering' | 'phase1' | 'phase2' | 'dying' | 'defeated';

export interface BossData {
  phase: BossPhase;
  t: number;
  phaseT: number;
  fireCooldown: number;
  dyingExplosions: number;
  targetY: number;
}

export const Boss = defineComponent<BossData>('Boss', () => ({
  phase: 'entering',
  t: 0,
  phaseT: 0,
  fireCooldown: 0,
  dyingExplosions: 0,
  targetY: 80,
}));
