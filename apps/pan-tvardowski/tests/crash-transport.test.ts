import { describe, expect, test } from 'bun:test';
import {
  composeTransports,
  createConsoleTransport,
  createCrashPayload,
} from '@flare-engine/errors';
import type { CrashPayload, CrashTransport } from '@flare-engine/errors';

function makeRecorder(): CrashTransport & { calls: CrashPayload[] } {
  const calls: CrashPayload[] = [];
  return {
    calls,
    report(payload) {
      calls.push(payload);
    },
  };
}

function makeOptInGate(optIn: () => boolean, inner: CrashTransport): CrashTransport {
  return {
    report(payload) {
      if (!optIn()) return;
      return inner.report(payload);
    },
  };
}

describe('opt-in gate wrapper — M10.1', () => {
  test('blocks report when optIn returns false', () => {
    const recorder = makeRecorder();
    const gated = makeOptInGate(() => false, recorder);
    gated.report(createCrashPayload(new Error('boom')));
    expect(recorder.calls).toHaveLength(0);
  });

  test('forwards report when optIn returns true', () => {
    const recorder = makeRecorder();
    const gated = makeOptInGate(() => true, recorder);
    const payload = createCrashPayload(new TypeError('null deref'), { zone: 'z3' });
    gated.report(payload);
    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0]).toBe(payload);
  });

  test('re-evaluates optIn on each call (dynamic toggle)', () => {
    const recorder = makeRecorder();
    let allowed = false;
    const gated = makeOptInGate(() => allowed, recorder);
    gated.report(createCrashPayload(new Error('first — blocked')));
    expect(recorder.calls).toHaveLength(0);
    allowed = true;
    gated.report(createCrashPayload(new Error('second — allowed')));
    expect(recorder.calls).toHaveLength(1);
  });
});

describe('composeTransports (engine) — M10.1', () => {
  test('fans out to every transport in order', async () => {
    const calls: string[] = [];
    const a: CrashTransport = {
      report: () => {
        calls.push('a');
      },
    };
    const b: CrashTransport = {
      report: () => {
        calls.push('b');
      },
    };
    const c: CrashTransport = {
      report: () => {
        calls.push('c');
      },
    };
    await composeTransports(a, b, c).report(createCrashPayload(new Error('x')));
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  test('one throwing transport does not block the rest', async () => {
    const calls: string[] = [];
    const ok: CrashTransport = {
      report: () => {
        calls.push('ok');
      },
    };
    const bad: CrashTransport = {
      report: () => {
        throw new Error('transport boom');
      },
    };
    const after: CrashTransport = {
      report: () => {
        calls.push('after');
      },
    };
    await expect(
      composeTransports(ok, bad, after).report(createCrashPayload(new Error('x'))),
    ).resolves.toBeUndefined();
    expect(calls).toEqual(['ok', 'after']);
  });

  test('composes console transport with gated recorder', async () => {
    const recorder = makeRecorder();
    const gated = makeOptInGate(() => true, recorder);
    const composed = composeTransports(createConsoleTransport(), gated);
    await composed.report(createCrashPayload(new Error('composed')));
    expect(recorder.calls).toHaveLength(1);
  });
});
