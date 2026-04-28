import type { Migration } from './migrations.js';

export interface MigrationStep {
  from: number;
  to: number;
  migrate: (data: unknown) => unknown;
}

/**
 * Converts an ordered array of step-wise migrations into a `Migration[]`
 * compatible with `runMigrations`. Each step must be contiguous
 * (`steps[i].to === steps[i+1].from`); throws on any gap or overlap.
 *
 * @example
 * const migrations = defineMigrationChain([
 *   { from: 1, to: 2, migrate: (d) => ({ ...(d as object), v: 2 }) },
 *   { from: 2, to: 3, migrate: (d) => ({ ...(d as object), v: 3 }) },
 * ]);
 * // Pass to runMigrations(data, storedVersion, CURRENT_VERSION, migrations)
 */
export function defineMigrationChain(steps: readonly MigrationStep[]): Migration[] {
  if (steps.length === 0) return [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (
      !Number.isInteger(step.from) ||
      !Number.isInteger(step.to) ||
      step.from <= 0 ||
      step.to <= 0
    ) {
      throw new Error(
        `[@flare-engine/storage] defineMigrationChain: step[${i}] from/to must be positive integers`,
      );
    }
    if (step.to !== step.from + 1) {
      throw new Error(
        `[@flare-engine/storage] defineMigrationChain: step[${i}] must advance exactly one version (got ${step.from}→${step.to})`,
      );
    }
    if (i > 0 && steps[i - 1]!.to !== step.from) {
      throw new Error(
        `[@flare-engine/storage] defineMigrationChain: gap between step[${i - 1}] (to=${steps[i - 1]!.to}) and step[${i}] (from=${step.from})`,
      );
    }
  }

  return steps.map((step) => ({
    version: step.to,
    migrate: step.migrate,
  }));
}
