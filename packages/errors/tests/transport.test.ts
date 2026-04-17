import { describe, expect, test } from 'bun:test';
import { createCrashPayload } from '../src/crash-payload.js';
import { createConsoleTransport, createNoopTransport } from '../src/transport.js';

describe('transport', () => {
  test('noop transport discards payloads', () => {
    const t = createNoopTransport();
    expect(() => t.report(createCrashPayload(new Error('x')))).not.toThrow();
  });

  test('console transport logs via console.error', () => {
    const calls: unknown[][] = [];
    const original = console.error;
    console.error = ((...args: unknown[]) => {
      calls.push(args);
    }) as typeof console.error;
    try {
      const t = createConsoleTransport();
      t.report(createCrashPayload(new Error('boom')));
      expect(calls.length).toBe(1);
      expect(calls[0]?.[0]).toBe('[@flare-engine/errors]');
    } finally {
      console.error = original;
    }
  });
});
