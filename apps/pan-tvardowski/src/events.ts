import { EventEmitter } from '@flare-engine/events';
import type { BossPhase } from './components';

export type ZoneId = 'z1' | 'z2';

export type GameEventMap = {
  'zone-start': (zone: ZoneId) => void;
  'zone-complete': (zone: ZoneId, score: number) => void;
  'miniboss-defeated': (zone: ZoneId) => void;
  'boss-phase-change': (zone: ZoneId, phase: BossPhase) => void;
  'shard-collected': (zone: ZoneId) => void;
};

/**
 * Game-wide typed event bus. Scenes subscribe in `onEnter` and
 * unsubscribe in `onExit` (via the `Unsubscribe` return value).
 */
export const gameEvents = new EventEmitter<GameEventMap>();
