import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createCrashPayload } from '../src/crash-payload.js';
import { createConsoleTransport, createNoopTransport } from '../src/transport.js';
import { createSentryTransport } from '../src/transports/sentry.js';

type FakeIntegration = { name: string };
type IntegrationsFn = (defaults: FakeIntegration[]) => FakeIntegration[];

// The order the SDK hands its defaults over in; mixes capture-side
// integrations, collectors, event processors and a name the allowlist has
// never seen.
const SDK_DEFAULTS: FakeIntegration[] = [
  { name: 'ReactNativeErrorHandlers' },
  { name: 'InboundFilters' },
  { name: 'Breadcrumbs' },
  { name: 'Release' },
  { name: 'DeviceContext' },
  { name: 'RewriteFrames' },
  { name: 'HttpContext' },
  { name: 'DebugMeta' },
  { name: 'ModulesLoader' },
  { name: 'SdkInfo' },
  { name: 'ReactNativeInfo' },
  { name: 'Dedupe' },
  { name: 'FutureCaptureThing' },
  { name: 'NativeLinkedErrors' },
  { name: 'EventOrigin' },
];
const ALLOWLIST = [
  'InboundFilters',
  'Release',
  'RewriteFrames',
  'DebugMeta',
  'SdkInfo',
  'Dedupe',
  'NativeLinkedErrors',
  'EventOrigin',
];

function captureConsoleError(): { calls: unknown[][]; restore(): void } {
  const calls: unknown[][] = [];
  const original = console.error;
  console.error = ((...args: unknown[]) => calls.push(args)) as typeof console.error;
  return {
    calls,
    restore() {
      console.error = original;
    },
  };
}

describe('createSentryTransport', () => {
  test('no DSN returns noop — report does not throw and never imports Sentry', async () => {
    const t = createSentryTransport({});
    const result = t.report(createCrashPayload(new Error('x')));
    if (result instanceof Promise) await result;
  });

  test('enabled: false returns noop even when DSN is supplied', async () => {
    const t = createSentryTransport({ dsn: 'https://key@sentry.io/123', enabled: false });
    const result = t.report(createCrashPayload(new Error('x')));
    if (result instanceof Promise) await result;
  });

  test('noop paths leave close undefined', () => {
    expect(createSentryTransport({}).close).toBeUndefined();
    expect(createSentryTransport({ dsn: 'https://key@sentry.io/1', enabled: false }).close).toBe(
      undefined,
    );
    expect(createNoopTransport().close).toBeUndefined();
    expect(createConsoleTransport().close).toBeUndefined();
  });

  test('import failure degrades to noop and second call does not retry', async () => {
    const consoleCalls: unknown[][] = [];
    const originalError = console.error;
    console.error = ((...args: unknown[]) => consoleCalls.push(args)) as typeof console.error;

    try {
      const t = createSentryTransport({ dsn: 'https://key@sentry.io/42' });
      const payload = createCrashPayload(new Error('boom'));

      const r1 = t.report(payload);
      if (r1 instanceof Promise) await r1;
      const countAfterFirst = consoleCalls.length;
      expect(countAfterFirst).toBeGreaterThanOrEqual(1);

      const r2 = t.report(payload);
      if (r2 instanceof Promise) await r2;
      expect(consoleCalls.length).toBe(countAfterFirst);
    } finally {
      console.error = originalError;
    }
  });

  // bun's `mock.module` is process-global and evaluates its factory once, on
  // the first import, so every test below shares one fake whose recorders are
  // reset per test. The import-failure test above must run before the mock is
  // installed, hence `beforeAll` here rather than a top-level call.
  describe('with mocked Sentry module', () => {
    const captured: Array<{ err: unknown; hint: unknown }> = [];
    const initCalls: Array<{ integrations: IntegrationsFn } & Record<string, unknown>> = [];
    const initResolved: FakeIntegration[][] = [];
    let closeCalls = 0;
    let closeImpl: () => Promise<void> = () => Promise.resolve();
    let importGate: Promise<void> | null = null;

    const fakeSentry = {
      captureException(err: unknown, hint: unknown) {
        captured.push({ err, hint });
      },
      init(opts: { integrations: IntegrationsFn } & Record<string, unknown>) {
        initCalls.push(opts);
        // The SDK applies the `integrations` function to its default list
        // inside `init`, so a hook that throws surfaces here, not later.
        initResolved.push(opts.integrations(SDK_DEFAULTS));
      },
      close() {
        closeCalls++;
        return closeImpl();
      },
    };

    beforeAll(() => {
      mock.module('@sentry/react-native', async () => {
        if (importGate !== null) await importGate;
        return fakeSentry;
      });
    });

    beforeEach(() => {
      captured.length = 0;
      initCalls.length = 0;
      initResolved.length = 0;
      closeCalls = 0;
      closeImpl = () => Promise.resolve();
      importGate = null;
    });

    // First in this block on purpose: the module factory runs once per
    // process, so only the first import can be held behind the gate. In any
    // other position `await import()` still resumes in a microtask, so the
    // synchronous `close()` below lands before `init` either way.
    test('close during a pending import: init never runs and no client is left behind', async () => {
      let release: () => void = () => {};
      importGate = new Promise<void>((r) => {
        release = r;
      });

      const t = createSentryTransport({ dsn: 'https://key@sentry.io/7' });
      const pending = t.report(createCrashPayload(new Error('in flight')));
      try {
        const closing = t.close?.();
        expect(closing).toBeInstanceOf(Promise);
        await closing;
        expect(initCalls.length).toBe(0);
      } finally {
        // An import left waiting on the gate would hang the process.
        release();
      }
      await pending;

      expect(initCalls.length).toBe(0);
      expect(captured.length).toBe(0);
      expect(closeCalls).toBe(0);

      await t.report(createCrashPayload(new Error('after')));
      expect(initCalls.length).toBe(0);
      expect(captured.length).toBe(0);
    });

    test('payload reaches captureException with mapped fields', async () => {
      const { createSentryTransport: fresh } = (await import('../src/transports/sentry.js')) as {
        createSentryTransport: typeof import('../src/transports/sentry.js').createSentryTransport;
      };

      const t = fresh({
        dsn: 'https://key@sentry.io/99',
        environment: 'test',
        release: '1.0.0',
        sampleRate: 1,
      });

      const payload = createCrashPayload(new Error('test error'), { scene: 'play' });
      const result = t.report(payload);
      if (result instanceof Promise) await result;

      expect(initCalls.length).toBe(1);
      expect(initCalls[0]).toStrictEqual({
        dsn: 'https://key@sentry.io/99',
        environment: 'test',
        release: '1.0.0',
        sampleRate: 1,
        integrations: expect.any(Function),
        enableAutoSessionTracking: false,
        enableNativeCrashHandling: false,
        enableAppHangTracking: false,
        enableWatchdogTerminationTracking: false,
        sendClientReports: false,
      });

      // The allowlist keeps only event processors, in the SDK's original order,
      // and drops every capture-side integration including names it has never
      // seen — the fail-safe direction (ADR-0008).
      const { integrations } = initCalls[0] as { integrations: IntegrationsFn };
      const defaults = SDK_DEFAULTS;
      const kept = integrations(defaults);
      expect(kept.map((i) => i.name)).toStrictEqual(ALLOWLIST);
      expect(kept[0]).toBe(defaults[1]);
      expect(kept[7]).toBe(defaults[14]);
      expect(integrations([])).toStrictEqual([]);

      expect(captured.length).toBe(1);
      const hint = captured[0]?.hint as { extra: Record<string, unknown> };
      expect(hint.extra.scene).toBe('play');
      expect(typeof hint.extra.capturedAt).toBe('number');

      const capturedErr = captured[0]?.err as Error;
      expect(capturedErr.message).toBe('test error');
    });

    test('integrations hook receives kept + defaults and its return reaches init', async () => {
      const hookCalls: Array<{ kept: FakeIntegration[]; defaults: FakeIntegration[] }> = [];
      const t = createSentryTransport({
        dsn: 'https://key@sentry.io/5',
        integrations: (kept, defaults) => {
          hookCalls.push({ kept, defaults });
          return defaults;
        },
      });

      await t.report(createCrashPayload(new Error('x')));

      expect(initCalls.length).toBe(1);
      expect(initResolved[0]).toBe(SDK_DEFAULTS);
      expect(hookCalls.length).toBe(1);
      expect(hookCalls[0]?.defaults).toBe(SDK_DEFAULTS);
      expect(hookCalls[0]?.kept.map((i) => i.name)).toStrictEqual(ALLOWLIST);

      const own: FakeIntegration[] = [{ name: 'ReactNativeErrorHandlers' }, { name: 'Release' }];
      const { integrations } = initCalls[0] as { integrations: IntegrationsFn };
      expect(integrations(own)).toBe(own);
      expect(hookCalls[1]?.kept.map((i) => i.name)).toStrictEqual(['Release']);
      expect(captured.length).toBe(1);
    });

    test('throwing integrations hook is logged, falls back to the allowlist, and reporting continues', async () => {
      const con = captureConsoleError();
      try {
        const boom = new Error('hook exploded');
        const t = createSentryTransport({
          dsn: 'https://key@sentry.io/6',
          integrations: () => {
            throw boom;
          },
        });

        await t.report(createCrashPayload(new Error('first')));

        expect(initCalls.length).toBe(1);
        expect(initResolved[0]?.map((i) => i.name)).toStrictEqual(ALLOWLIST);
        expect(con.calls.length).toBe(1);
        expect(con.calls[0]?.[0]).toBe(
          '[@flare-engine/errors] SentryTransportOptions.integrations threw — using the default allowlist',
        );
        expect(con.calls[0]?.[1]).toBe(boom);
        expect(captured.length).toBe(1);

        await t.report(createCrashPayload(new Error('second')));
        expect(captured.length).toBe(2);
        expect(initCalls.length).toBe(1);
      } finally {
        con.restore();
      }
    });

    test('close() calls the SDK close once; a second close() returns the same promise', async () => {
      const t = createSentryTransport({ dsn: 'https://key@sentry.io/8' });
      await t.report(createCrashPayload(new Error('x')));
      expect(captured.length).toBe(1);

      const first = t.close?.();
      expect(first).toBeInstanceOf(Promise);
      await first;
      expect(closeCalls).toBe(1);

      const second = t.close?.();
      expect(second).toBe(first);
      await second;
      expect(closeCalls).toBe(1);
    });

    test('report() after close() calls neither captureException nor init', async () => {
      const t = createSentryTransport({ dsn: 'https://key@sentry.io/9' });
      await t.report(createCrashPayload(new Error('before')));
      expect(initCalls.length).toBe(1);
      expect(captured.length).toBe(1);

      await t.close?.();
      await t.report(createCrashPayload(new Error('after')));

      expect(initCalls.length).toBe(1);
      expect(captured.length).toBe(1);
    });

    test('close() before any report never calls init; a later report sends nothing', async () => {
      const t = createSentryTransport({ dsn: 'https://key@sentry.io/10' });
      await t.close?.();

      expect(initCalls.length).toBe(0);
      expect(closeCalls).toBe(0);

      await t.report(createCrashPayload(new Error('after')));
      expect(initCalls.length).toBe(0);
      expect(captured.length).toBe(0);
    });

    test('a rejecting SDK close is logged; the transport stays closed and close() resolves', async () => {
      const con = captureConsoleError();
      try {
        const rejection = new Error('native refused');
        closeImpl = () => Promise.reject(rejection);

        const t = createSentryTransport({ dsn: 'https://key@sentry.io/11' });
        await t.report(createCrashPayload(new Error('x')));

        await expect(t.close?.()).resolves.toBeUndefined();
        expect(closeCalls).toBe(1);
        expect(con.calls.length).toBe(1);
        expect(con.calls[0]?.[0]).toBe('[@flare-engine/errors] Sentry close failed');
        expect(con.calls[0]?.[1]).toBe(rejection);

        await t.report(createCrashPayload(new Error('after')));
        expect(captured.length).toBe(1);

        await expect(t.close?.()).resolves.toBeUndefined();
        expect(closeCalls).toBe(1);
      } finally {
        con.restore();
      }
    });
  });
});
