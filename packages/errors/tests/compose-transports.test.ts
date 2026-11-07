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

  test('close() closes every closable child once, in order', async () => {
    const closed: string[] = [];
    const closable = (id: string): CrashTransport => ({
      report() {},
      async close() {
        closed.push(id);
      },
    });

    const t = composeTransports(closable('a'), closable('b'), closable('c'));
    await expect(t.close?.()).resolves.toBeUndefined();

    expect(closed).toEqual(['a', 'b', 'c']);
  });

  test('close() skips children without close', async () => {
    const closed: string[] = [];
    const plain: CrashTransport = {
      report() {},
    };
    const closable: CrashTransport = {
      report() {},
      async close() {
        closed.push('closable');
      },
    };

    const t = composeTransports(plain, closable, plain);
    await t.close?.();

    expect(closed).toEqual(['closable']);
  });

  test('a child whose close throws or rejects is logged and later children still close', async () => {
    const closed: string[] = [];
    const consoleCalls: unknown[][] = [];
    const originalError = console.error;
    console.error = ((...args: unknown[]) => consoleCalls.push(args)) as typeof console.error;

    try {
      const thrown = new Error('sync close exploded');
      const rejected = new Error('async close exploded');
      const good1: CrashTransport = {
        report() {},
        async close() {
          closed.push('before');
        },
      };
      const throws: CrashTransport = {
        report() {},
        close() {
          throw thrown;
        },
      };
      const rejects: CrashTransport = {
        report() {},
        close() {
          return Promise.reject(rejected);
        },
      };
      const good2: CrashTransport = {
        report() {},
        async close() {
          closed.push('after');
        },
      };

      const t = composeTransports(good1, throws, rejects, good2);
      await expect(t.close?.()).resolves.toBeUndefined();

      expect(closed).toEqual(['before', 'after']);
      expect(consoleCalls.length).toBe(2);
      expect(consoleCalls[0]?.[0]).toBe(
        '[@flare-engine/errors] composeTransports: child transport close threw',
      );
      expect(consoleCalls[0]?.[1]).toBe(thrown);
      expect(consoleCalls[1]?.[1]).toBe(rejected);
    } finally {
      console.error = originalError;
    }
  });
});
