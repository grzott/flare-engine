# Save migrations

How to write forward-only versioned save-file migrations with `@flare-engine/storage`.

---

## Pattern

Use `defineMigrationChain` to declare a linear step chain, then pass the result to `runMigrations`.

```ts
import { defineMigrationChain, runMigrations } from '@flare-engine/storage';

const CURRENT_VERSION = 7;

const migrations = defineMigrationChain([
  { from: 1, to: 2, migrate: (d) => ({ ...(d as object), introSeen: false }) },
  { from: 2, to: 3, migrate: (d) => ({ ...(d as object), codexUnlocked: [] }) },
  { from: 3, to: 4, migrate: (d) => ({ ...(d as object) }) },
  { from: 4, to: 5, migrate: (d) => ({ ...(d as object), entitlements: [] }) },
  { from: 5, to: 6, migrate: (d) => ({ ...(d as object), unlockedAchievements: [] }) },
  {
    from: 6,
    to: 7,
    migrate: (d) => ({
      ...(d as object),
      privacy: { analyticsOptIn: false, crashOptIn: false },
    }),
  },
]);

export function migrateSave(raw: unknown, storedVersion: number): unknown {
  return runMigrations(raw, storedVersion, CURRENT_VERSION, migrations);
}
```

`defineMigrationChain` validates that steps are contiguous (each `to === next.from`) and that each step advances by exactly one version. It throws at definition time on any gap, overlap, or non-positive version — not at runtime when a user loads a save.

The resulting `Migration[]` is directly compatible with `runMigrations`: each step is mapped to `{ version: step.to, migrate: step.migrate }`.

Canonical real-world reference: [`src/save/migrate.ts` in the Pan Tvardowski repo](https://github.com/grzott/Pan-Tvardowski/blob/main/src/save/migrate.ts) — the PT game uses a hand-rolled version of this same v1→v7 chain.

---

## Avoid circular deps

Keep the migration chain in its own file, separate from the save-file schema.

**Bad:**
```ts
// schema.ts
export const defaultSaveFile = () => ({ ... });
export const migrations = defineMigrationChain([ ... ]); // imports types from schema.ts
// migrate.ts imports from schema.ts AND schema.ts re-exports migrations → circular
```

**Good:**
```ts
// schema.ts  — types + defaults only
// migrate.ts — imports types from schema.ts, defines chain, exports migrateSave()
// parseSaveFile.ts — imports from migrate.ts + schema.ts, no cycle
```

This is the pattern used in PT. The comment at [src/save/migrate.ts line 122](https://github.com/grzott/Pan-Tvardowski/blob/main/src/save/migrate.ts#L122) explains the rationale: the `makeDefaultSaveFile` helper is inlined in `migrate.ts` rather than re-exported from `schema.ts` to prevent a runtime circular dependency.

---

## Round-trip tests

Write one test file that seeds a fixture at every historic version and verifies the migrated output matches the current schema exactly.

Pattern from PT: [`tests/save-migrator.test.ts` in the Pan Tvardowski repo](https://github.com/grzott/Pan-Tvardowski/blob/main/tests/save-migrator.test.ts)

Key points:

- **Fix the fixture at the version it was written** — do not back-fill new fields into old fixtures.
- **Assert the migrated output shape**, not just that it doesn't throw.
- **Cover each version individually** (v1→current, v2→current, …) to catch regressions when a new step is added.
- Use `runMigrations(fixture, storedVersion, CURRENT_VERSION, migrations)` directly in tests so you cover the same code path as production.
- **`runMigrations` does not stamp `version`.** It applies each step's `migrate` and returns the
  result; writing the new version onto the save is the caller's job (or each step's). Assert on a
  field the migration actually produced, not on `version`, unless your chain sets it.

```ts
import { describe, expect, test } from 'bun:test';
import { migrations, CURRENT_VERSION } from '../src/save/migrate';
import { runMigrations } from '@flare-engine/storage';

const v1Fixture = { version: 1, slots: [null, null, null], settings: {} };

describe('save migrator', () => {
  test('v1 → current', () => {
    const result = runMigrations(v1Fixture, 1, CURRENT_VERSION, migrations);
    expect((result as { privacy: unknown }).privacy).toEqual({
      analyticsOptIn: false,
      crashOptIn: false,
    });
  });
});
```
