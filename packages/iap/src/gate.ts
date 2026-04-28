import type { EntitlementStore } from './entitlements.js';

export interface ContentSpec {
  readonly requiresEntitlement?: string;
}

export function canAccessContent(spec: ContentSpec, entitlements: EntitlementStore): boolean {
  if (!spec.requiresEntitlement) return true;
  return entitlements.isEntitled(spec.requiresEntitlement);
}
