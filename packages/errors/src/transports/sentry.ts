import type { Integration } from '@sentry/react-native';
import type { CrashPayload } from '../crash-payload.js';
import type { CrashTransport } from '../transport.js';
import { createNoopTransport } from '../transport.js';

export interface SentryTransportOptions {
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  enabled?: boolean;
}

// Sentry must send only what `report()` hands it (ADR-0008). The SDK's default
// integrations include its own global error/rejection handlers, which report
// outside the transport and so outside any consent check placed in front of
// it, plus collectors (breadcrumbs, device context) that attach data to every
// event. Only event processors that enrich an event already in flight are kept.
// Fail-safe: a name that does not match on some SDK major only loses that
// enrichment; an unknown name can never add a capture path.
const KEPT_INTEGRATIONS: ReadonlySet<string> = new Set([
  'RewriteFrames',
  'Release',
  'DebugMeta',
  'SdkInfo',
  'Dedupe',
  'InboundFilters',
  'NativeLinkedErrors',
  'EventOrigin',
]);

function keepEventProcessors(defaults: Integration[]): Integration[] {
  return defaults.filter((integration) => KEPT_INTEGRATIONS.has(integration.name));
}

export function createSentryTransport(opts: SentryTransportOptions): CrashTransport {
  if (!opts.dsn || opts.enabled === false) {
    return createNoopTransport();
  }

  const dsn = opts.dsn;
  type SentryMod = typeof import('@sentry/react-native');
  let mod: SentryMod | null = null;
  let loadFailed = false;

  return {
    async report(payload: CrashPayload): Promise<void> {
      if (loadFailed) return;

      if (mod === null) {
        try {
          mod = await import('@sentry/react-native');
          mod.init({
            dsn,
            environment: opts.environment,
            release: opts.release,
            sampleRate: opts.sampleRate,
            integrations: keepEventProcessors,
            enableAutoSessionTracking: false,
            enableNativeCrashHandling: false,
            enableAppHangTracking: false,
            enableWatchdogTerminationTracking: false,
            sendClientReports: false,
          });
        } catch {
          console.error(
            '[@flare-engine/errors] Failed to load @sentry/react-native — degrading to noop',
          );
          loadFailed = true;
          return;
        }
      }

      try {
        const err = Object.assign(new Error(payload.message), { name: payload.name });
        if (payload.stack !== null) err.stack = payload.stack;
        mod.captureException(err, {
          extra: { ...payload.context, capturedAt: payload.timestamp },
        });
      } catch {
        console.error('[@flare-engine/errors] Sentry captureException failed');
      }
    },
  };
}
