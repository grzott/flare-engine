import type { EntitlementStore } from '@flare-engine/iap';
import { ZONES } from '../config/zones';
import type { ZoneId } from '../events';

export interface ZoneSpec {
  readonly requiresEntitlement?: string;
}

/** Zone ids whose config declares `requiresEntitlement`. Derived at module-eval
 *  time from `ZONES` — single source of truth. Equivalent to the former
 *  hardcoded `new Set(['z4','z5','z6','z7','z8'])`. */
export const GATED_ZONES: ReadonlySet<ZoneId> = new Set(
  (Object.values(ZONES) as { id: ZoneId; requiresEntitlement?: string }[])
    .filter((z) => z.requiresEntitlement !== undefined)
    .map((z) => z.id),
);

export function isGatedZone(zone: ZoneId): boolean {
  return GATED_ZONES.has(zone);
}

/** Pure helper: returns true when the given zone config allows access given
 *  the current entitlement state. Mirrors `canAccessContent` from
 *  `@flare-engine/iap` but is local so callers avoid a direct engine import
 *  at the zone-selection layer. */
export function canStartZone(spec: ZoneSpec, store: EntitlementStore): boolean {
  if (!spec.requiresEntitlement) return true;
  return store.isEntitled(spec.requiresEntitlement);
}
