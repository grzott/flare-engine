import { describe, expect, test } from 'bun:test';
import { defineMigrationChain } from '../src/migration-chain.js';
import { runMigrations } from '../src/migrations.js';

describe('defineMigrationChain', () => {
  test('empty chain returns empty Migration[]', () => {
    expect(defineMigrationChain([])).toEqual([]);
  });

  test('single step produces Migration consumed by runMigrations', () => {
    const migrate = (d: unknown) => ({ ...(d as object), added: true });
    const migrations = defineMigrationChain([{ from: 1, to: 2, migrate }]);

    expect(migrations).toHaveLength(1);
    expect(migrations[0]!.version).toBe(2);

    const result = runMigrations({ x: 1 }, 1, 2, migrations) as Record<string, unknown>;
    expect(result.x).toBe(1);
    expect(result.added).toBe(true);
  });

  test('multi-step v1→v2→v3 round-trip', () => {
    const migrations = defineMigrationChain([
      { from: 1, to: 2, migrate: (d) => ({ ...(d as object), step2: true }) },
      { from: 2, to: 3, migrate: (d) => ({ ...(d as object), step3: true }) },
    ]);

    expect(migrations).toHaveLength(2);
    expect(migrations.map((m) => m.version)).toEqual([2, 3]);

    const fromV1 = runMigrations({ v: 1 }, 1, 3, migrations) as Record<string, unknown>;
    expect(fromV1.step2).toBe(true);
    expect(fromV1.step3).toBe(true);

    const fromV2 = runMigrations({ v: 2 }, 2, 3, migrations) as Record<string, unknown>;
    expect(fromV2.step2).toBeUndefined();
    expect(fromV2.step3).toBe(true);
  });

  test('non-contiguous chain (gap) throws', () => {
    expect(() =>
      defineMigrationChain([
        { from: 1, to: 2, migrate: (d) => d },
        { from: 3, to: 4, migrate: (d) => d },
      ]),
    ).toThrow(/gap/);
  });

  test('step that does not advance by exactly 1 throws', () => {
    expect(() => defineMigrationChain([{ from: 1, to: 3, migrate: (d) => d }])).toThrow(
      /exactly one version/,
    );
  });

  test('non-positive version throws', () => {
    expect(() => defineMigrationChain([{ from: 0, to: 1, migrate: (d) => d }])).toThrow(
      /positive integers/,
    );
  });
});
