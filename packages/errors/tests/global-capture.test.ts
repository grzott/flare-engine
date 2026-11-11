import { describe, expect, spyOn, test } from 'bun:test';
import type { CrashPayload } from '../src/crash-payload.js';
import type { ErrorUtilsLike, GlobalErrorTarget } from '../src/global-capture.js';
import { installGlobalErrorCapture } from '../src/global-capture.js';
import type { CrashTransport } from '../src/transport.js';
import { createClientTransport } from '../src/transports/client.js';

/**
 * OSS-M7. Everything here runs against hand-built fake globals — no `window`,
 * no React Native runtime — which is the point of the structural target types.
 */

function recorder(): CrashTransport & { readonly seen: CrashPayload[] } {
  const seen: CrashPayload[] = [];
  return {
    seen,
    report(payload) {
      seen.push(payload);
    },
  };
}

/** A transport whose `report` rejects, as an `async report` awaiting `fetch` does offline. */
function rejecting(): CrashTransport & { readonly reports: number; readonly reason: Error } {
  const reason = new Error('offline');
  let reports = 0;
  return {
    reason,
    get reports() {
      return reports;
    },
    report() {
      reports += 1;
      return Promise.reject(reason);
    },
  };
}

/** Crosses a macrotask boundary so every microtask, and the unhandled-rejection check, has run. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** A fake global exposing the web half. */
function fakeWebTarget(): GlobalErrorTarget & {
  fire(type: string, event: unknown): void;
  readonly listenerCount: number;
} {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  return {
    addEventListener(type, listener) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    fire(type, event) {
      for (const l of listeners.get(type) ?? []) l(event);
    },
    get listenerCount() {
      let n = 0;
      for (const set of listeners.values()) n += set.size;
      return n;
    },
  };
}

/** A fake global exposing the React Native half. */
function fakeErrorUtils(initial?: (error: unknown, isFatal?: boolean) => void): ErrorUtilsLike & {
  readonly current: ((error: unknown, isFatal?: boolean) => void) | undefined;
  throwFatal(error: unknown): void;
} {
  let handler = initial;
  return {
    getGlobalHandler: () => handler,
    setGlobalHandler(next) {
      handler = next;
    },
    get current() {
      return handler;
    },
    throwFatal(error) {
      handler?.(error, true);
    },
  };
}

describe('installGlobalErrorCapture — web target', () => {
  test('captures a synchronous throw reported as an error event', () => {
    const target = fakeWebTarget();
    const transport = recorder();
    installGlobalErrorCapture(target, { transport });

    target.fire('error', { error: new TypeError('loop exploded') });

    expect(transport.seen.length).toBe(1);
    expect(transport.seen[0]!.name).toBe('TypeError');
    expect(transport.seen[0]!.message).toBe('loop exploded');
    expect(transport.seen[0]!.context.source).toBe('error');
  });

  test('captures an unhandled rejection via its reason', () => {
    const target = fakeWebTarget();
    const transport = recorder();
    installGlobalErrorCapture(target, { transport });

    target.fire('unhandledrejection', { reason: new Error('asset 404') });

    expect(transport.seen.length).toBe(1);
    expect(transport.seen[0]!.message).toBe('asset 404');
    expect(transport.seen[0]!.context.source).toBe('unhandledrejection');
  });

  test('falls back to the event message when no error object is attached', () => {
    // Cross-origin script errors arrive with `error: null`.
    const target = fakeWebTarget();
    const transport = recorder();
    installGlobalErrorCapture(target, { transport });

    target.fire('error', { error: null, message: 'Script error.' });

    expect(transport.seen.length).toBe(1);
    expect(transport.seen[0]!.message).toBe('Script error.');
  });

  test('uninstall removes every listener it added', () => {
    const target = fakeWebTarget();
    const transport = recorder();
    const capture = installGlobalErrorCapture(target, { transport });
    expect(target.listenerCount).toBe(2);

    capture.uninstall();

    expect(target.listenerCount).toBe(0);
    target.fire('error', { error: new Error('after uninstall') });
    expect(transport.seen.length).toBe(0);
  });

  test('uninstall is idempotent', () => {
    const target = fakeWebTarget();
    const capture = installGlobalErrorCapture(target, { transport: recorder() });
    capture.uninstall();
    expect(() => capture.uninstall()).not.toThrow();
  });
});

describe('installGlobalErrorCapture — React Native target', () => {
  test('captures through the ErrorUtils global handler', () => {
    const errorUtils = fakeErrorUtils();
    const transport = recorder();
    installGlobalErrorCapture({ ErrorUtils: errorUtils }, { transport });

    errorUtils.throwFatal(new Error('native boom'));

    expect(transport.seen.length).toBe(1);
    expect(transport.seen[0]!.message).toBe('native boom');
    expect(transport.seen[0]!.context.source).toBe('errorUtils');
    expect(transport.seen[0]!.context.isFatal).toBe(true);
  });

  test('chains to the previous handler rather than replacing it', () => {
    // On RN the prior handler is what shows the red box and ends the process.
    // Swallowing it would turn a visible crash into a silent one.
    const prior: unknown[] = [];
    const errorUtils = fakeErrorUtils((error) => prior.push(error));
    const transport = recorder();
    installGlobalErrorCapture({ ErrorUtils: errorUtils }, { transport });

    const err = new Error('still reaches the platform');
    errorUtils.throwFatal(err);

    expect(transport.seen.length).toBe(1);
    expect(prior).toEqual([err]);
  });

  test('uninstall restores the previous handler', () => {
    const prior = (): void => {};
    const errorUtils = fakeErrorUtils(prior);
    const capture = installGlobalErrorCapture(
      { ErrorUtils: errorUtils },
      { transport: recorder() },
    );
    expect(errorUtils.current).not.toBe(prior);

    capture.uninstall();

    expect(errorUtils.current).toBe(prior);
  });

  test('uninstall detaches the handler when no previous handler existed', () => {
    // With nothing to restore, the installed closure used to stay live and
    // keep reporting to a transport the consumer believed was detached.
    const errorUtils = fakeErrorUtils();
    const transport = recorder();
    const capture = installGlobalErrorCapture({ ErrorUtils: errorUtils }, { transport });

    capture.uninstall();
    errorUtils.throwFatal(new Error('after uninstall'));

    expect(transport.seen.length).toBe(0);
  });

  test('uninstall with no transport and no previous handler stops buffering', () => {
    const errorUtils = fakeErrorUtils();
    const capture = installGlobalErrorCapture({ ErrorUtils: errorUtils });

    capture.uninstall();
    errorUtils.throwFatal(new Error('after uninstall'));

    expect(capture.buffered).toBe(0);
  });
});

describe('installGlobalErrorCapture — early-error buffer', () => {
  test('errors raised before a transport attaches drain into it', () => {
    const target = fakeWebTarget();
    const capture = installGlobalErrorCapture(target); // no transport yet

    target.fire('error', { error: new Error('boot 1') });
    target.fire('error', { error: new Error('boot 2') });
    expect(capture.buffered).toBe(2);

    const transport = recorder();
    capture.setTransport(transport);

    expect(capture.buffered).toBe(0);
    expect(transport.seen.map((p) => p.message)).toEqual(['boot 1', 'boot 2']);
  });

  test('the buffer is bounded and drops oldest first', () => {
    const target = fakeWebTarget();
    const capture = installGlobalErrorCapture(target, { bufferSize: 2 });

    target.fire('error', { error: new Error('a') });
    target.fire('error', { error: new Error('b') });
    target.fire('error', { error: new Error('c') });
    expect(capture.buffered).toBe(2);

    const transport = recorder();
    capture.setTransport(transport);
    // 'a' evicted — a boot loop must not grow memory without bound.
    expect(transport.seen.map((p) => p.message)).toEqual(['b', 'c']);
  });

  test('bufferSize 0 disables buffering entirely', () => {
    const target = fakeWebTarget();
    const capture = installGlobalErrorCapture(target, { bufferSize: 0 });
    target.fire('error', { error: new Error('dropped') });
    expect(capture.buffered).toBe(0);

    const transport = recorder();
    capture.setTransport(transport);
    expect(transport.seen.length).toBe(0);
  });

  test('errors after attach go straight through', () => {
    const target = fakeWebTarget();
    const capture = installGlobalErrorCapture(target);
    const transport = recorder();
    capture.setTransport(transport);

    target.fire('error', { error: new Error('live') });

    expect(capture.buffered).toBe(0);
    expect(transport.seen.map((p) => p.message)).toEqual(['live']);
  });
});

describe('installGlobalErrorCapture — misc', () => {
  test('merges caller context into every payload', () => {
    const target = fakeWebTarget();
    const transport = recorder();
    installGlobalErrorCapture(target, { transport, context: { build: '1.2.3' } });

    target.fire('error', { error: new Error('x') });

    expect(transport.seen[0]!.context.build).toBe('1.2.3');
  });

  test('a target with neither capability installs and uninstalls harmlessly', () => {
    const capture = installGlobalErrorCapture({}, { transport: recorder() });
    expect(capture.buffered).toBe(0);
    expect(() => capture.uninstall()).not.toThrow();
  });

  test('a throwing transport does not escape into the error handler', () => {
    // The handler runs inside the platform's crash path; throwing there would
    // replace the real error with ours.
    const target = fakeWebTarget();
    const thrower: CrashTransport = {
      report() {
        throw new Error('transport is down');
      },
    };
    installGlobalErrorCapture(target, { transport: thrower });

    expect(() => target.fire('error', { error: new Error('original') })).not.toThrow();
  });
});

describe('installGlobalErrorCapture — rejecting transport', () => {
  // bun's runner claims any rejection nobody handles and fails the running test,
  // so these pass only when the capture handles it itself. In a browser an
  // unhandled one surfaces as `unhandledrejection` on the same global, re-enters
  // `emit`, and rejects again for as long as the transport stays down.
  test('one unhandledrejection yields one report and a logged, handled rejection', async () => {
    const target = fakeWebTarget();
    const transport = rejecting();
    const log = spyOn(console, 'error').mockImplementation(() => {});
    try {
      installGlobalErrorCapture(target, { transport });
      target.fire('unhandledrejection', { reason: new Error('asset 404') });
      await flush();

      expect(transport.reports).toBe(1);
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0]![0]).toContain('[@flare-engine/errors]');
      expect(log.mock.calls[0]![1]).toBe(transport.reason);
    } finally {
      log.mockRestore();
    }
  });

  test('draining the buffer into a rejecting transport reports once per entry', async () => {
    const target = fakeWebTarget();
    const capture = installGlobalErrorCapture(target);
    target.fire('unhandledrejection', { reason: new Error('boot') });
    const transport = rejecting();
    const log = spyOn(console, 'error').mockImplementation(() => {});
    try {
      capture.setTransport(transport);
      await flush();

      expect(capture.buffered).toBe(0);
      expect(transport.reports).toBe(1);
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0]![0]).toContain('[@flare-engine/errors]');
      expect(log.mock.calls[0]![1]).toBe(transport.reason);
    } finally {
      log.mockRestore();
    }
  });
});

describe('createClientTransport', () => {
  test('rebuilds an Error the client can group, preserving name and stack', () => {
    const calls: { error: unknown; hint: unknown }[] = [];
    const transport = createClientTransport({
      captureException(error, hint) {
        calls.push({ error, hint });
        return 'event-id';
      },
    });

    transport.report({
      message: 'render failed',
      name: 'RangeError',
      stack: 'RangeError: render failed\n    at frame (game.ts:12:3)',
      timestamp: 0,
      context: { scene: 'zone-3' },
    });

    expect(calls.length).toBe(1);
    const sent = calls[0]!.error as Error;
    expect(sent).toBeInstanceOf(Error);
    expect(sent.name).toBe('RangeError');
    expect(sent.message).toBe('render failed');
    expect(sent.stack).toContain('at frame (game.ts:12:3)');
    expect(calls[0]!.hint).toEqual({ extra: { scene: 'zone-3' } });
  });

  test('a throwing client does not propagate', () => {
    const transport = createClientTransport({
      captureException() {
        throw new Error('client is down');
      },
    });
    expect(() =>
      transport.report({ message: 'm', name: 'Error', stack: null, timestamp: 0, context: {} }),
    ).not.toThrow();
  });

  test('end to end: capture installed with a client transport reports once', () => {
    const target = fakeWebTarget();
    const seen: unknown[] = [];
    const transport = createClientTransport({
      captureException(error) {
        seen.push(error);
      },
    });
    installGlobalErrorCapture(target, { transport });

    target.fire('unhandledrejection', { reason: new Error('async died') });

    expect(seen.length).toBe(1);
    expect((seen[0] as Error).message).toBe('async died');
  });
});
