import { describe, expect, mock, test } from 'bun:test';
import { createCrashPayload } from '../src/crash-payload.js';
import { createSentryTransport } from '../src/transports/sentry.js';

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

  test('with mocked Sentry module: payload reaches captureException with mapped fields', async () => {
    const captured: Array<{ err: unknown; hint: unknown }> = [];
    const initCalls: unknown[] = [];

    const fakeSentry = {
      captureException(err: unknown, hint: unknown) {
        captured.push({ err, hint });
      },
      init(opts: unknown) {
        initCalls.push(opts);
      },
    };

    mock.module('@sentry/react-native', () => fakeSentry);

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
    type FakeIntegration = { name: string };
    const { integrations } = initCalls[0] as {
      integrations: (defaults: FakeIntegration[]) => FakeIntegration[];
    };
    const defaults: FakeIntegration[] = [
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
    const kept = integrations(defaults);
    expect(kept.map((i) => i.name)).toStrictEqual([
      'InboundFilters',
      'Release',
      'RewriteFrames',
      'DebugMeta',
      'SdkInfo',
      'Dedupe',
      'NativeLinkedErrors',
      'EventOrigin',
    ]);
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
});
