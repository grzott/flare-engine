import type { ZoneId } from '../events';
import { gameEvents } from '../events';
import type { SaveStore } from '../save/store';
import { gameState, notifyStateChanged } from '../state';

export type EntitlementHealth = 'ok' | 'stale';

export interface EntitlementFallbackHandler {
  shouldAllowStaleAccess(zoneId: ZoneId, save: SaveStore): boolean;
  reset(): void;
}

function zoneIndex(id: ZoneId): number {
  return Number(id.slice(1));
}

export function createEntitlementFallback(): EntitlementFallbackHandler {
  return {
    shouldAllowStaleAccess(zoneId: ZoneId, save: SaveStore): boolean {
      const slot = save.getSlot(gameState.activeSlot);
      if (slot === null) return false;
      if (zoneIndex(slot.zoneReached) >= zoneIndex(zoneId)) {
        gameState.entitlementHealth = 'stale';
        gameEvents.emit('entitlement-check-failed', zoneId, 'stale');
        notifyStateChanged();
        return true;
      }
      return false;
    },
    reset(): void {
      gameState.entitlementHealth = 'ok';
      notifyStateChanged();
    },
  };
}
