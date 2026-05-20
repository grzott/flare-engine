import {
  DeepLinkManager,
  DeepLinkRouter,
  createMemorySource,
  createNativeSource,
} from '@flare-engine/deep-links';
import type { DeepLinkSource, LinkingLike } from '@flare-engine/deep-links';
import type { ZoneId } from '../events';
import type { BenchScenarioId } from '../perf/bench-mode';

// The @flare-engine/deep-links parser treats `scheme://host/path` as
// host + path, so `pantvardowski://zone/1` yields segments `['1']` with
// host `zone`. The route therefore captures the single remaining segment.
const ZONE_ROUTE = '/:n';
const ZONE_SCENE = 'zone-deep-link';

// pantvardowski://bench/<id>  — activates bench mode for the named scenario.
// Host = 'bench', single path segment = scenario id.
// Uses a wildcard route so that multi-segment ids (e.g. future nested paths)
// are captured as-is in the `rest` param.
const BENCH_ROUTE = '/*';
const BENCH_SCENE = 'bench-deep-link';

export function createZoneRouter(): DeepLinkRouter {
  return new DeepLinkRouter().register(ZONE_ROUTE, ZONE_SCENE);
}

export interface ZoneDeepLinkHandlers {
  onZoneRequest: (zone: ZoneId) => void;
  onBenchRequest?: (scenarioId: BenchScenarioId) => void;
  onUnmatched?: (url: string) => void;
}

/**
 * Dispatches incoming URLs to the correct handler by inspecting the URL host:
 *   - host `zone`  → `pantvardowski://zone/:n` → onZoneRequest
 *   - host `bench` → `pantvardowski://bench/<id>` → onBenchRequest
 *   - anything else → onUnmatched
 *
 * Implementation: a single DeepLinkManager using the zone router handles URL
 * delivery.  The onMatch / onUnmatched callbacks re-dispatch based on host so
 * bench URLs are never misidentified as zone requests.
 */
export function createPanTvardowskiDeepLinks(
  source: DeepLinkSource,
  handlers: ZoneDeepLinkHandlers,
): DeepLinkManager {
  const zoneRouter = new DeepLinkRouter().register(ZONE_ROUTE, ZONE_SCENE);
  const benchRouter = new DeepLinkRouter().register(BENCH_ROUTE, BENCH_SCENE);

  const manager = new DeepLinkManager({ router: zoneRouter, source });

  function dispatchUrl(url: string): void {
    // Determine the URL host so we can separate zone and bench links.
    // @flare-engine/deep-links parseUrl is internal; replicate the extraction.
    const schemeIdx = url.indexOf('://');
    let host = '';
    if (schemeIdx !== -1) {
      const afterScheme = url.slice(schemeIdx + 3);
      const slashIdx = afterScheme.indexOf('/');
      host = slashIdx === -1 ? afterScheme : afterScheme.slice(0, slashIdx);
    }

    if (host === 'bench') {
      const benchMatch = benchRouter.match(url);
      if (benchMatch?.scene === BENCH_SCENE) {
        const scenarioId = String(benchMatch.params.rest ?? '');
        if (scenarioId.length > 0) {
          handlers.onBenchRequest?.(scenarioId);
          return;
        }
      }
      handlers.onUnmatched?.(url);
      return;
    }

    if (host === 'zone') {
      const zoneMatch = zoneRouter.match(url);
      if (zoneMatch?.scene === ZONE_SCENE) {
        const n = String(zoneMatch.params.n ?? '');
        if (n === '1') {
          handlers.onZoneRequest('z1');
          return;
        }
        if (n === '2') {
          handlers.onZoneRequest('z2');
          return;
        }
        if (n === '3') {
          handlers.onZoneRequest('z3');
          return;
        }
        if (n === '4') {
          handlers.onZoneRequest('z4');
          return;
        }
        if (n === '5') {
          handlers.onZoneRequest('z5');
          return;
        }
        if (n === '6') {
          handlers.onZoneRequest('z6');
          return;
        }
        if (n === '7') {
          handlers.onZoneRequest('z7');
          return;
        }
        if (n === '8') {
          handlers.onZoneRequest('z8');
          return;
        }
      }
    }

    handlers.onUnmatched?.(url);
  }

  // Intercept every match / unmatched and re-route through dispatchUrl so we
  // own the host-based dispatch without depending on manager internals.
  manager.onMatch.add((match) => dispatchUrl(match.url));
  manager.onUnmatched.add((url) => dispatchUrl(url));

  return manager;
}

export { createMemorySource, createNativeSource, type DeepLinkSource, type LinkingLike };
