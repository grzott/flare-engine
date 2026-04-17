/**
 * Forward-only versioned migration step. Each migration lifts data from
 * `version - 1` to `version`. The runner applies every step whose version is
 * greater than the stored version and less than or equal to the target.
 */
export interface Migration {
  version: number;
  migrate: (old: unknown) => unknown;
}

/**
 * Run every migration whose `version` is strictly greater than `from` and
 * less than or equal to `to`, in ascending version order. Throws if the
 * migrations list has gaps, duplicates, or non-positive versions, or if `to`
 * is lower than the highest migration version while `from < to`.
 */
export function runMigrations(
  data: unknown,
  from: number,
  to: number,
  migrations: readonly Migration[],
): unknown {
  if (from === to) return data;
  if (from > to)
    throw new Error(`[@flare-engine/storage] cannot migrate backwards (${from} → ${to})`);

  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i]!;
    if (m.version <= 0 || !Number.isInteger(m.version))
      throw new Error('[@flare-engine/storage] migration version must be a positive integer');
    if (i > 0 && sorted[i - 1]!.version === m.version)
      throw new Error(`[@flare-engine/storage] duplicate migration version ${m.version}`);
  }

  let current = data;
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i]!;
    if (m.version > from && m.version <= to) {
      current = m.migrate(current);
    }
  }
  return current;
}
