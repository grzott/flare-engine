/**
 * Version migrations for persisted save files. Each entry upgrades from one
 * version to the next; `runMigrations` applies them in order.
 *
 * v1 → v2 is a no-op reshape — it establishes the migration chain so future
 * schema changes drop in without special-casing legacy payloads.
 */
export interface SaveMigration {
  from: number;
  to: number;
  /** Receives the raw parsed object at `from` version; returns an object at `to` version. */
  migrate: (raw: Record<string, unknown>) => Record<string, unknown>;
}

function migrateV1ToV2(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, version: 2 };
}

export const migrations: readonly SaveMigration[] = [{ from: 1, to: 2, migrate: migrateV1ToV2 }];

/**
 * Run the migration chain over `raw` until it reaches `target`. Returns the
 * migrated object, or null if no path from the current version to `target`
 * exists.
 */
export function runMigrations(
  raw: Record<string, unknown>,
  target: number,
): Record<string, unknown> | null {
  let current = raw;
  let version = typeof current.version === 'number' ? current.version : target;
  let guard = migrations.length + 1;
  while (version < target && guard-- > 0) {
    const step = migrations.find((m) => m.from === version);
    if (!step) return null;
    current = step.migrate(current);
    version = step.to;
  }
  return version === target ? current : null;
}
