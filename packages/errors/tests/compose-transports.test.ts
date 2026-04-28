import { describe, expect, test } from 'bun:test';
import { composeTransports } from '../src/compose.js';
import { createCrashPayload } from '../src/crash-payload.js';
import type { CrashTransport } from '../src/transport.js';

describe('composeTransports', () => {
  test('calls all children in order', async () => {
    const order: number[] = [];
    const a: CrashTransport = {
      report() {
        order.push(1);
      },
    };
    const b: CrashTransport = {
      report() {
        order.push(2);
      },
    };
    const c: CrashTransport = {
      report() {
        order.push(3);
      },
    };

    const t = composeTransports(a, b, c);
    await t.report(createCrashPayload(new Error('x')));

    expect(order).toEqual([1, 2, 3]);
  });

  test('throwing child does not block subsequent children and error is logged', async () => {
    const visited: string[] = [];
    const consoleCalls: unknown[][] = [];
    const originalError = console.error;
    console.error = ((...args: unknown[]) => consoleCalls.push(args)) as typeof console.error;

    try {
      const good1: CrashTransport = {
        report() {
          visited.push('before');
        },
      };
      const bad: CrashTransport = {
        report() {
          visited.push('bad');
          throw new Error('transport exploded');
        },
      };
      const good2: CrashTransport = {
        report() {
          visited.push('after');
        },
      };

      const t = composeTransports(good1, bad, good2);
      await t.report(createCrashPayload(new Error('crash')));

      expect(visited).toEqual(['before', 'bad', 'after']);
      expect(consoleCalls.length).toBeGreaterThanOrEqual(1);
    } finally {
      console.error = originalError;
    }
  });

  test('empty array produces a valid noop transport', async () => {
    const t = composeTransports();
    await expect(t.report(createCrashPayload(new Error('x')))).resolves.toBeUndefined();
  });
});
