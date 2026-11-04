import { describe, expect, spyOn, test } from 'bun:test';
import type { ErrorInfo } from 'react';
import type { CrashPayload } from '../src/crash-payload.js';
import { ErrorBoundary } from '../src/error-boundary.js';
import type { CrashTransport } from '../src/transport.js';

function makeBoundary(props?: {
  transport?: CrashTransport;
  context?: Record<string, unknown>;
  onError?: (err: unknown, p: CrashPayload) => void;
}) {
  const instance = new ErrorBoundary({
    children: null,
    fallback: () => null,
    ...props,
  });
  // setState is bound to React's updater in real usage; stub it for tests.
  const stateChanges: Partial<typeof instance.state>[] = [];
  instance.setState = ((update: Partial<typeof instance.state>) => {
    stateChanges.push(update);
    instance.state = { ...instance.state, ...update };
  }) as typeof instance.setState;
  return { instance, stateChanges };
}

describe('ErrorBoundary', () => {
  test('getDerivedStateFromError builds a payload from the thrown value', () => {
    const next = ErrorBoundary.getDerivedStateFromError(new Error('boom'));
    expect(next.payload?.message).toBe('boom');
  });

  test('initial state has no payload', () => {
    const { instance } = makeBoundary();
    expect(instance.state.payload).toBeNull();
  });

  test('componentDidCatch stores payload, reports to transport, and calls onError', () => {
    const reported: CrashPayload[] = [];
    const transport: CrashTransport = {
      report(p) {
        reported.push(p);
      },
    };
    const seen: unknown[] = [];
    const onError = (err: unknown) => seen.push(err);
    const { instance } = makeBoundary({ transport, onError, context: { scene: 'menu' } });

    const err = new Error('explode');
    const info: ErrorInfo = { componentStack: 'at App' };
    instance.componentDidCatch(err, info);

    expect(instance.state.payload?.message).toBe('explode');
    expect(instance.state.payload?.context.scene).toBe('menu');
    expect(instance.state.payload?.context.componentStack).toBe('at App');
    expect(reported.length).toBe(1);
    expect(seen[0]).toBe(err);
  });

  test('reset() clears the payload', () => {
    const { instance } = makeBoundary();
    instance.componentDidCatch(new Error('x'), { componentStack: null });
    expect(instance.state.payload).not.toBeNull();
    instance.reset();
    expect(instance.state.payload).toBeNull();
  });

  test('missing transport is not an error', () => {
    const { instance } = makeBoundary();
    expect(() =>
      instance.componentDidCatch(new Error('x'), { componentStack: null }),
    ).not.toThrow();
  });

  test('a rejecting transport reports once and its rejection is logged, not left unhandled', async () => {
    // bun's runner claims any rejection nobody handles and fails the running
    // test. In a browser one would reach `installGlobalErrorCapture`'s listener
    // and start the same report-reject loop from the boundary.
    const reason = new Error('offline');
    let reports = 0;
    const transport: CrashTransport = {
      report() {
        reports += 1;
        return Promise.reject(reason);
      },
    };
    const { instance } = makeBoundary({ transport });
    const log = spyOn(console, 'error').mockImplementation(() => {});
    try {
      instance.componentDidCatch(new Error('explode'), { componentStack: null });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(reports).toBe(1);
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0]![0]).toContain('[@flare-engine/errors]');
      expect(log.mock.calls[0]![1]).toBe(reason);
    } finally {
      log.mockRestore();
    }
  });
});
