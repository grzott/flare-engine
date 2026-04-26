import { type EntitlementStore, createEntitlementStore } from '@flare-engine/iap';
import { PT_CATALOG } from './catalog';

/**
 * Creates the game-level entitlement store seeded with any keys already
 * persisted in the save file.
 *
 * Pass `initial` from `saveStore.entitlements()` to hydrate on boot.
 */
export function createPTEntitlementStore(initial: readonly string[] = []): EntitlementStore {
  return createEntitlementStore(PT_CATALOG, { initial });
}
