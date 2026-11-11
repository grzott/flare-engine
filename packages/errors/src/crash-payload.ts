/**
 * Serializable crash payload. Everything here is JSON-safe so transports can
 * post it to Sentry / Crashlytics / a custom HTTP endpoint without extra work.
 */
export interface CrashPayload {
  /** Error message. */
  message: string;
  /** Error name (e.g., `TypeError`). */
  name: string;
  /** Captured stack trace, if available. */
  stack: string | null;
  /** Monotonic ms timestamp — `Date.now()` at capture. */
  timestamp: number;
  /** Optional free-form context supplied by the caller. */
  context: Record<string, unknown>;
}

/**
 * Capture an unknown thrown value as a serializable crash payload. Handles
 * `Error` instances, string throws, and arbitrary values.
 */
export function createCrashPayload(
  error: unknown,
  context: Record<string, unknown> = {},
): CrashPayload {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack ?? null,
      timestamp: Date.now(),
      context,
    };
  }
  if (typeof error === 'string') {
    return { message: error, name: 'Error', stack: null, timestamp: Date.now(), context };
  }
  let message: string;
  try {
    message = JSON.stringify(error);
  } catch {
    message = String(error);
  }
  return { message, name: 'NonError', stack: null, timestamp: Date.now(), context };
}

/**
 * Rebuild a payload into an `Error`, which is what error clients group by. The
 * captured stack replaces the new Error's own; a `null` stack leaves it as is.
 */
export function payloadToError(payload: CrashPayload): Error {
  const error = new Error(payload.message);
  error.name = payload.name;
  if (payload.stack !== null) error.stack = payload.stack;
  return error;
}
