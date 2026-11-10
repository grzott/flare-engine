import { payloadToError } from '../crash-payload.js';
import type { CrashTransport } from '../transport.js';

/**
 * A Sentry-browser-shaped client, described structurally so this package takes
 * no dependency on `@sentry/browser` (or on any particular client).
 */
export interface ErrorClientLike {
  captureException(error: unknown, hint?: unknown): unknown;
}

/**
 * Transport over an injected browser error client.
 *
 * `createSentryTransport` is native-only — it dynamically imports
 * `@sentry/react-native`, which does not resolve on web. This is the web half:
 * the caller supplies an already-initialised client, so this package neither
 * imports nor initialises one.
 *
 * ```ts
 * import * as Sentry from '@sentry/browser';
 * Sentry.init({ dsn });
 * const transport = createClientTransport(Sentry);
 * ```
 *
 * The payload is rebuilt into an `Error` because that is what such clients
 * group by; the original stack is preserved rather than replaced with this
 * function's own.
 */
export function createClientTransport(client: ErrorClientLike): CrashTransport {
  return {
    report(payload): void {
      const error = payloadToError(payload);
      try {
        client.captureException(error, { extra: payload.context });
      } catch (err) {
        console.error('[@flare-engine/errors] client.captureException threw', err);
      }
    },
  };
}
