import { describe, expect, test } from 'bun:test';
import { createConsoleTransport, createCrashPayload } from '@flare-engine/errors';
import {
  type SentryLike,
  composeTransports,
  createSentryCrashTransport,
} from '../src/errors/transport';

function makeFakeSentry(): SentryLike & {
  calls: Array<{ err: unknown; extra: Record<string, unknown> | undefined }>;
} {
  const calls: Array<{ err: unknown; extra: Record<string, unknown> | undefined }> = [];
  return {
    calls,
    captureException(err, hint) {
      calls.push({ err, extra: hint?.extra });
    },
  };
}

describe('createSentryCrashTransport — M9.6 session #17', () => {
  test('drops payload when optIn returns false (even with sentry + dsn present)', () => {
    const sentry = makeFakeSentry();
    const transport = createSentryCrashTransport({
      optIn: () => false,
      sentry,
      dsn: 'https://fake@sentry.io/1',
    });
    transport.report(createCrashPayload(new Error('boom'), { scene: 'play' }));
    expect(sentry.calls).toHaveLength(0);
  });

  test('forwards to sentry when optIn returns true and DSN + sink are present', () => {
    const sentry = makeFakeSentry();
    const transport = createSentryCrashTransport({
      optIn: () => true,
      sentry,
      dsn: 'https://fake@sentry.io/1',
    });
    const payload = createCrashPayload(new TypeError('null deref'), { zone: 'z3' });
    transport.report(payload);
    expect(sentry.calls).toHaveLength(1);
    const call = sentry.calls[0];
    if (!call) throw new Error('expected one captured call');
    expect(call.err).toBeInstanceOf(Error);
    expect((call.err as Error).name).toBe('TypeError');
    expect((call.err as Error).message).toBe('null deref');
    expect(call.extra).toMatchObject({ zone: 'z3', capturedAt: payload.timestamp });
  });

  test('drops silently when optIn=true but DSN is null (Sentry not configured)', () => {
    const sentry = makeFakeSentry();
    const transport = createSentryCrashTransport({
      optIn: () => true,
      sentry,
      dsn: null,
    });
    expect(() => transport.report(createCrashPayload(new Error('no dsn')))).not.toThrow();
    expect(sentry.calls).toHaveLength(0);
  });

  test('drops silently when optIn=true but sentry sink is null (module not installed)', () => {
    const transport = createSentryCrashTransport({
      optIn: () => true,
      sentry: null,
      dsn: 'https://fake@sentry.io/1',
    });
    expect(() => transport.report(createCrashPayload(new Error('no sentry')))).not.toThrow();
  });

  test('preserves stack when payload carries one', () => {
    const sentry = makeFakeSentry();
    const transport = createSentryCrashTransport({
      optIn: () => true,
      sentry,
      dsn: 'https://fake@sentry.io/1',
    });
    const payload = createCrashPayload(new Error('with stack'));
    transport.report(payload);
    const call = sentry.calls[0];
    if (!call) throw new Error('expected one captured call');
    expect(payload.stack).not.toBeNull();
    expect((call.err as Error).stack).toBe(payload.stack as string);
  });
});

describe('composeTransports — M9.6 session #17', () => {
  test('fans out to every transport in order', () => {
    const calls: string[] = [];
    const a = {
      report: () => {
        calls.push('a');
      },
    };
    const b = {
      report: () => {
        calls.push('b');
      },
    };
    const c = {
      report: () => {
        calls.push('c');
      },
    };
    composeTransports(a, b, c).report(createCrashPayload(new Error('x')));
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  test('one throwing transport does not block the rest', () => {
    const calls: string[] = [];
    const ok = {
      report: () => {
        calls.push('ok');
      },
    };
    const bad = {
      report: () => {
        throw new Error('transport boom');
      },
    };
    const after = {
      report: () => {
        calls.push('after');
      },
    };
    expect(() =>
      composeTransports(ok, bad, after).report(createCrashPayload(new Error('x'))),
    ).not.toThrow();
    expect(calls).toEqual(['ok', 'after']);
  });

  test('composes the gated Sentry transport with the console transport', () => {
    const sentry = makeFakeSentry();
    const transport = composeTransports(
      createConsoleTransport(),
      createSentryCrashTransport({
        optIn: () => true,
        sentry,
        dsn: 'https://fake@sentry.io/1',
      }),
    );
    transport.report(createCrashPayload(new Error('composed')));
    expect(sentry.calls).toHaveLength(1);
  });
});
