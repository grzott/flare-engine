import type { CrashPayload, CrashTransport } from '@flare-engine/errors';

export interface SentryLike {
  captureException(
    err: unknown,
    hint?: { extra?: Record<string, unknown>; tags?: Record<string, string> },
  ): void;
}

export interface CreateSentryCrashTransportOptions {
  optIn: () => boolean;
  sentry?: SentryLike | null;
  dsn?: string | null;
}

export function createSentryCrashTransport(
  opts: CreateSentryCrashTransportOptions,
): CrashTransport {
  const sink: SentryLike | null = opts.sentry && opts.dsn ? opts.sentry : null;
  return {
    report(payload: CrashPayload) {
      if (!opts.optIn()) return;
      if (sink === null) return;
      const err = new Error(payload.message);
      err.name = payload.name;
      if (payload.stack !== null) err.stack = payload.stack;
      sink.captureException(err, {
        extra: { ...payload.context, capturedAt: payload.timestamp },
      });
    },
  };
}

export function composeTransports(...transports: CrashTransport[]): CrashTransport {
  return {
    report(payload: CrashPayload) {
      for (const t of transports) {
        try {
          t.report(payload);
        } catch {
          // Swallow per-transport failures — one bad transport must not block others.
        }
      }
    },
  };
}

export function tryLoadSentry(): SentryLike | null {
  try {
    const mod = require('@sentry/react-native') as { default?: SentryLike } & SentryLike;
    if (typeof mod.captureException === 'function') return mod;
    if (mod.default && typeof mod.default.captureException === 'function') return mod.default;
    return null;
  } catch {
    return null;
  }
}
