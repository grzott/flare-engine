import type { CrashPayload } from './crash-payload.js';

/**
 * Pluggable transport for reporting crashes. Implementations send the payload
 * wherever they need — Sentry, Crashlytics, an HTTP endpoint, or nowhere.
 */
export interface CrashTransport {
  report(payload: CrashPayload): void | Promise<void>;
}

/**
 * Call `transport.report` so that neither a synchronous throw nor a rejected
 * promise escapes. Left unhandled, a rejection surfaces on the global as an
 * `unhandledrejection` that `installGlobalErrorCapture` listens for, so each
 * failed report would trigger the next for as long as the transport is down.
 */
export function reportSafely(
  transport: CrashTransport,
  payload: CrashPayload,
  stage: 'reporting' | 'draining',
): void {
  const onFailure = (err: unknown): void => {
    console.error(`[@flare-engine/errors] transport threw while ${stage}`, err);
  };
  try {
    void Promise.resolve(transport.report(payload)).catch(onFailure);
  } catch (err) {
    onFailure(err);
  }
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
