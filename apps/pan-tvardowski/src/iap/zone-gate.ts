import type { EntitlementStore } from '@flare-engine/iap';

export function canStartZone(
  zoneConfig: { requiresEntitlement?: string },
  entitlementStore: EntitlementStore,
): boolean {
  if (!zoneConfig.requiresEntitlement) return true;
  // EntitlementStore.isEntitled accepts EntitlementKey (string brand); the
  // cast is safe — unknown keys simply return false from the store.
  return entitlementStore.isEntitled(
    zoneConfig.requiresEntitlement as Parameters<EntitlementStore['isEntitled']>[0],
  );
}
