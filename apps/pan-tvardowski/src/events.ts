import { EventEmitter } from '@flare-engine/events';
import type { ProductId } from '@flare-engine/iap';
import type { BossPhase, EnemyPattern, LeszyForm } from './components';

export type ZoneId = 'z1' | 'z2' | 'z3' | 'z4' | 'z5' | 'z6' | 'z7' | 'z8';

export type PaywallReason = 'zone-3-defeat' | 'zone-locked-click';

export type GameEventMap = {
  'zone-start': (zone: ZoneId) => void;
  'zone-complete': (zone: ZoneId, score: number) => void;
  'zone-gated': (zone: ZoneId, requiredEntitlement: string) => void;
  'miniboss-defeated': (zone: ZoneId) => void;
  'miniboss-form-change': (zone: ZoneId, form: LeszyForm) => void;
  'boss-phase-change': (zone: ZoneId, phase: BossPhase) => void;
  'boss-shield-broken': (zone: ZoneId) => void;
  'boss-summon': (zone: ZoneId, pattern: EnemyPattern) => void;
  'boss-gaze-changed': (zone: ZoneId, active: boolean) => void;
  'shard-collected': (zone: ZoneId) => void;
  'dialogue-start': (graphId: string) => void;
  'dialogue-end': (graphId: string) => void;
  'paywall-trigger': (reason: PaywallReason) => void;
  'purchase-completed': (productId: ProductId) => void;
  'entitlement-check-failed': (zone: ZoneId, reason: 'stale') => void;
};

/**
 * Game-wide typed event bus. Scenes subscribe in `onEnter` and
 * unsubscribe in `onExit` (via the `Unsubscribe` return value).
 */
export const gameEvents = new EventEmitter<GameEventMap>();
