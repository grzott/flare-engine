import type { CrashPayload } from '../crash-payload.js';
import type { CrashTransport } from '../transport.js';
import { createNoopTransport } from '../transport.js';

/**
 * The shape of a Sentry integration this package relies on. Structural, so no
 * type from the optional `@sentry/react-native` peer leaks into the public API;
 * the SDK's own `Integration` objects satisfy it.
 */
export interface SentryIntegrationLike {
  name: string;
}

export interface SentryTransportOptions {
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  enabled?: boolean;
  /**
   * Chooses the integrations `init` receives. `kept` is the ADR-0008 allowlist
   * (event processors only) applied to `defaults`, the SDK's own default list;
   * without this hook `init` receives `kept`. Returning `defaults`, or any
   * capture integration such as `ReactNativeErrorHandlers`, re-enables Sentry's
   * own global handlers, which report outside the transport and so outside any
   * consent check placed in front of it. A hook that throws is logged and
   * `kept` is used.
   */
  integrations?: (
    kept: SentryIntegrationLike[],
    defaults: SentryIntegrationLike[],
  ) => SentryIntegrationLike[];
}

type SentryMod = typeof import('@sentry/react-native');
type IntegrationsFn = (defaults: SentryIntegrationLike[]) => SentryIntegrationLike[];

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

function keepEventProcessors(defaults: SentryIntegrationLike[]): SentryIntegrationLike[] {
  return defaults.filter((integration) => KEPT_INTEGRATIONS.has(integration.name));
}

// The SDK calls this inside `init`, so a throwing hook must be caught here or
// it would read as an import failure and degrade the transport to noop.
function withIntegrationsHook(
  hook: NonNullable<SentryTransportOptions['integrations']>,
): IntegrationsFn {
  return (defaults) => {
    const kept = keepEventProcessors(defaults);
    try {
      return hook(kept, defaults);
    } catch (err) {
      console.error(
        '[@flare-engine/errors] SentryTransportOptions.integrations threw — using the default allowlist',
        err,
      );
      return kept;
    }
  };
}

async function closeSdk(mod: SentryMod): Promise<void> {
  try {
    await mod.close();
  } catch (err) {
    console.error('[@flare-engine/errors] Sentry close failed', err);
  }
}

export function createSentryTransport(opts: SentryTransportOptions): CrashTransport {
  if (!opts.dsn || opts.enabled === false) {
    return createNoopTransport();
  }

  const dsn = opts.dsn;
  const integrations =
    opts.integrations === undefined ? keepEventProcessors : withIntegrationsHook(opts.integrations);
  let mod: SentryMod | null = null;
  let loadFailed = false;
  let closed = false;
  let closing: Promise<void> | null = null;

  return {
    async report(payload: CrashPayload): Promise<void> {
      if (loadFailed || closed) return;

      if (mod === null) {
        try {
          const loaded = await import('@sentry/react-native');
          // `close()` may have run while the import was pending; starting a
          // client now would leave one nothing can shut down.
          if (closed) return;
          loaded.init({
            dsn,
            environment: opts.environment,
            release: opts.release,
            sampleRate: opts.sampleRate,
            integrations,
            enableAutoSessionTracking: false,
            enableNativeCrashHandling: false,
            enableAppHangTracking: false,
            enableWatchdogTerminationTracking: false,
            sendClientReports: false,
          });
          mod = loaded;
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
    close(): Promise<void> {
      if (closing === null) {
        closed = true;
        closing = mod === null ? Promise.resolve() : closeSdk(mod);
      }
      return closing;
    },
  };
}
