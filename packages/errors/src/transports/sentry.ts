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
