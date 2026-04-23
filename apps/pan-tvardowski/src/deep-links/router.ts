import {
  DeepLinkManager,
  DeepLinkRouter,
  createMemorySource,
  createNativeSource,
} from '@flare-engine/deep-links';
import type { DeepLinkSource, LinkingLike } from '@flare-engine/deep-links';
import type { ZoneId } from '../events';

// The @flare-engine/deep-links parser treats `scheme://host/path` as
// host + path, so `pantvardowski://zone/1` yields segments `['1']` with
// host `zone`. The route therefore captures the single remaining segment.
const ZONE_ROUTE = '/:n';
const ZONE_SCENE = 'zone-deep-link';

export function createZoneRouter(): DeepLinkRouter {
  return new DeepLinkRouter().register(ZONE_ROUTE, ZONE_SCENE);
}

export interface ZoneDeepLinkHandlers {
  onZoneRequest: (zone: ZoneId) => void;
  onUnmatched?: (url: string) => void;
}

/**
 * Build a deep-link manager that routes `pantvardowski://zone/:n` (n in 1..3)
 * into a scene jump. Unknown zone numbers fall through to `onUnmatched`.
 */
export function createPanTvardowskiDeepLinks(
  source: DeepLinkSource,
  handlers: ZoneDeepLinkHandlers,
): DeepLinkManager {
  const router = createZoneRouter();
  const manager = new DeepLinkManager({ router, source });
  manager.onMatch.add((match) => {
    if (match.scene === ZONE_SCENE) {
      const zoneParam = String(match.params.n ?? '');
      if (zoneParam === '1') handlers.onZoneRequest('z1');
      else if (zoneParam === '2') handlers.onZoneRequest('z2');
      else if (zoneParam === '3') handlers.onZoneRequest('z3');
      else if (zoneParam === '4') handlers.onZoneRequest('z4');
      else if (zoneParam === '5') handlers.onZoneRequest('z5');
      else if (zoneParam === '6') handlers.onZoneRequest('z6');
      else if (zoneParam === '7') handlers.onZoneRequest('z7');
      else if (zoneParam === '8') handlers.onZoneRequest('z8');
      else handlers.onUnmatched?.(match.url);
    } else {
      handlers.onUnmatched?.(match.url);
    }
  });
  if (handlers.onUnmatched) manager.onUnmatched.add(handlers.onUnmatched);
  return manager;
}

export { createMemorySource, createNativeSource, type DeepLinkSource, type LinkingLike };
