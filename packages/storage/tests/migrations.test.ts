import { describe, expect, test } from 'bun:test';
import { runMigrations } from '../src/migrations.js';
import type { Migration } from '../src/migrations.js';

describe('runMigrations', () => {
  test('no-op when from === to', () => {
    expect(runMigrations({ a: 1 }, 3, 3, [])).toEqual({ a: 1 });
  });

  test('applies only migrations with version in (from, to]', () => {
    const migrations: Migration[] = [
      { version: 1, migrate: (d) => ({ ...(d as object), v1: true }) },
      { version: 2, migrate: (d) => ({ ...(d as object), v2: true }) },
      { version: 3, migrate: (d) => ({ ...(d as object), v3: true }) },
    ];
    const out = runMigrations({}, 1, 3, migrations) as Record<string, boolean>;
    expect(out.v1).toBeUndefined();
    expect(out.v2).toBe(true);
    expect(out.v3).toBe(true);
  });

  test('applies in ascending version order regardless of input order', () => {
    const calls: number[] = [];
    const migrations: Migration[] = [
      {
        version: 3,
        migrate: (d) => {
          calls.push(3);
          return d;
        },
      },
      {
        version: 1,
        migrate: (d) => {
          calls.push(1);
          return d;
        },
      },
      {
        version: 2,
        migrate: (d) => {
          calls.push(2);
          return d;
        },
      },
    ];
    runMigrations({}, 0, 3, migrations);
    expect(calls).toEqual([1, 2, 3]);
  });

  test('throws on backward migration', () => {
    expect(() => runMigrations({}, 3, 1, [])).toThrow();
  });

  test('throws on non-positive / non-integer version', () => {
    expect(() => runMigrations({}, 0, 1, [{ version: 0, migrate: (d) => d }])).toThrow();
    expect(() => runMigrations({}, 0, 2, [{ version: 1.5, migrate: (d) => d }])).toThrow();
  });

  test('throws on duplicate version', () => {
    const migrations: Migration[] = [
      { version: 1, migrate: (d) => d },
      { version: 1, migrate: (d) => d },
    ];
    expect(() => runMigrations({}, 0, 1, migrations)).toThrow();
  });

  test('threads data through successive migrations', () => {
    const migrations: Migration[] = [
      { version: 1, migrate: (d) => ({ ...(d as object), step: 1 }) },
      { version: 2, migrate: (d) => ({ ...(d as object), step: 2 }) },
    ];
    const out = runMigrations({ hp: 10 }, 0, 2, migrations);
    expect(out).toEqual({ hp: 10, step: 2 });
  });
});
