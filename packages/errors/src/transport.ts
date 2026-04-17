import type { CrashPayload } from './crash-payload.js';

/**
 * Pluggable transport for reporting crashes. Implementations send the payload
 * wherever they need — Sentry, Crashlytics, an HTTP endpoint, or nowhere.
 */
export interface CrashTransport {
  report(payload: CrashPayload): void | Promise<void>;
}

/** Transport that discards every payload. The default. */
export function createNoopTransport(): CrashTransport {
  return {
    report() {
      /* no-op */
    },
  };
}

/**
 * Transport that logs payloads via `console.error`. Useful in development and
 * as a wrapper around another transport when debugging.
 */
export function createConsoleTransport(): CrashTransport {
  return {
    report(payload) {
      console.error('[@flare-engine/errors]', payload);
    },
  };
}
