import { EXPLOSION_TIER_DEFS } from '../visual-spec/explosions';
import type { ExplosionTier, ExplosionTierDef } from '../visual-spec/types';

export type { ExplosionTier };

export const DEFS_BY_TIER: Record<ExplosionTier, ExplosionTierDef> = (() => {
  const map = {} as Record<ExplosionTier, ExplosionTierDef>;
  for (const def of EXPLOSION_TIER_DEFS) {
    map[def.tier] = def;
  }
  return map;
})();

// Module-level caps state (M2).
export const _active = {
  burst: [] as { expiryMs: number }[],
  detonation: [] as { expiryMs: number }[],
  lastCataclysmZone: null as string | null,
};

export let _nowMs = (): number => Date.now();

/** @internal Override time source for deterministic tests. */
export function _setNowForTest(fn: () => number): void {
  _nowMs = fn;
}

/** @internal Restore real time source after tests. */
export function _resetNowForTest(): void {
  _nowMs = () => Date.now();
}

/** @internal Clear caps state between tests. */
export function _resetCapsForTest(): void {
  _active.burst.length = 0;
  _active.detonation.length = 0;
  _active.lastCataclysmZone = null;
}

export function _pruneExpired(): void {
  const now = _nowMs();
  _active.burst = _active.burst.filter((e) => e.expiryMs > now);
  _active.detonation = _active.detonation.filter((e) => e.expiryMs > now);
}

/**
 * Reset the cataclysm one-per-zone gate when a new zone starts.
 * Call from `startZone()` in play.ts.
 */
export function resetCataclysmGate(_zoneId: string): void {
  _active.lastCataclysmZone = null;
}
