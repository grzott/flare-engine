import { createCrashPayload } from './crash-payload.js';
import type { CrashTransport } from './transport.js';

/**
 * React Native's `global.ErrorUtils`, described structurally so this package
 * needs no React Native dependency or types.
 */
export interface ErrorUtilsLike {
  getGlobalHandler?(): ((error: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
}

/**
 * What `installGlobalErrorCapture` needs from a global object.
 *
 * Both members are optional and independent, so one call handles either
 * platform: on web `globalThis` supplies `addEventListener`, on React Native it
 * supplies `ErrorUtils`, and in a test you pass a hand-built fake. Nothing here
 * references `window`, `document` or any RN type.
 */
export interface GlobalErrorTarget {
  addEventListener?(type: string, listener: (event: unknown) => void): void;
  removeEventListener?(type: string, listener: (event: unknown) => void): void;
  ErrorUtils?: ErrorUtilsLike;
}

/** Options for `installGlobalErrorCapture`. */
export interface GlobalCaptureOptions {
  /**
   * Where captured errors go. May be omitted at install and attached later with
   * `setTransport` — errors raised in between are held in the buffer below
   * rather than dropped.
   */
  transport?: CrashTransport;
  /**
   * How many pre-transport errors to retain. Default 20. The oldest is dropped
   * once full: a boot loop should not grow memory without bound, and the first
   * errors are the ones worth keeping.
   */
  bufferSize?: number;
  /** Context merged into every payload this capture produces. */
  context?: Record<string, unknown>;
}

/** Handle returned by `installGlobalErrorCapture`. */
export interface GlobalCaptureHandle {
  /**
   * Detach every handler this call installed and restore whatever was there
   * before. Safe to call more than once.
   */
  uninstall(): void;
  /** Attach or replace the transport, draining any buffered errors into it. */
  setTransport(transport: CrashTransport): void;
  /** How many errors are currently held awaiting a transport. */
  readonly buffered: number;
}

/** Pull the underlying error out of a structurally-typed DOM-ish event. */
function unwrapEvent(event: unknown, key: 'error' | 'reason'): unknown {
  if (typeof event === 'object' && event !== null && key in event) {
    const value = (event as Record<string, unknown>)[key];
    if (value !== undefined && value !== null) return value;
  }
  // An ErrorEvent with no `.error` still carries a message worth reporting.
  if (typeof event === 'object' && event !== null && 'message' in event) {
    return (event as Record<string, unknown>).message;
  }
  return event;
}

/**
 * Route uncaught errors and unhandled rejections into a `CrashTransport`.
 *
 * `ErrorBoundary` only sees errors thrown during React's render phase. The
 * majority of a game's crashes are not there — they are in the update loop, in
 * an asset load, in a promise nobody awaited — and before this nothing carried
 * them to a transport.
 *
 * Both platforms are handled through the same call:
 *
 * ```ts
 * const capture = installGlobalErrorCapture(globalThis, { transport });
 * // ...
 * capture.uninstall();
 * ```
 *
 * The React Native handler is **chained, not replaced**: whatever handler was
 * installed before still runs, because on RN that handler is what shows the
 * red box in dev and terminates the app on a fatal. Swallowing it would convert
 * a visible crash into a silent one.
 */
export function installGlobalErrorCapture(
  target: GlobalErrorTarget,
  options?: GlobalCaptureOptions,
): GlobalCaptureHandle {
  const bufferSize = Math.max(0, options?.bufferSize ?? 20);
  const context = options?.context ?? {};
  let transport: CrashTransport | null = options?.transport ?? null;
  const pending: ReturnType<typeof createCrashPayload>[] = [];
  let installed = true;

  const emit = (error: unknown, extra?: Record<string, unknown>): void => {
    const payload = createCrashPayload(error, extra ? { ...context, ...extra } : { ...context });
    if (transport === null) {
      if (bufferSize === 0) return;
      if (pending.length === bufferSize) pending.shift();
      pending.push(payload);
      return;
    }
    try {
      void transport.report(payload);
    } catch (err) {
      console.error('[@flare-engine/errors] transport threw while reporting', err);
    }
  };

  const onError = (event: unknown): void => {
    emit(unwrapEvent(event, 'error'), { source: 'error' });
  };
  const onRejection = (event: unknown): void => {
    emit(unwrapEvent(event, 'reason'), { source: 'unhandledrejection' });
  };

  const canListen =
    typeof target.addEventListener === 'function' &&
    typeof target.removeEventListener === 'function';
  if (canListen) {
    target.addEventListener?.('error', onError);
    target.addEventListener?.('unhandledrejection', onRejection);
  }

  const errorUtils = target.ErrorUtils;
  const previousHandler = errorUtils?.getGlobalHandler?.();
  if (errorUtils !== undefined) {
    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      emit(error, { source: 'errorUtils', isFatal: isFatal ?? false });
      // Chain, so the platform's own reporting still happens.
      previousHandler?.(error, isFatal);
    });
  }

  return {
    uninstall(): void {
      if (!installed) return;
      installed = false;
      if (canListen) {
        target.removeEventListener?.('error', onError);
        target.removeEventListener?.('unhandledrejection', onRejection);
      }
      if (errorUtils !== undefined && previousHandler !== undefined) {
        errorUtils.setGlobalHandler(previousHandler);
      }
    },
    setTransport(next: CrashTransport): void {
      transport = next;
      while (pending.length > 0) {
        const payload = pending.shift()!;
        try {
          void next.report(payload);
        } catch (err) {
          console.error('[@flare-engine/errors] transport threw while draining', err);
        }
      }
    },
    get buffered(): number {
      return pending.length;
    },
  };
}

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
      const error = new Error(payload.message);
      error.name = payload.name;
      if (payload.stack !== null) error.stack = payload.stack;
      try {
        client.captureException(error, { extra: payload.context });
      } catch (err) {
        console.error('[@flare-engine/errors] client.captureException threw', err);
      }
    },
  };
}
