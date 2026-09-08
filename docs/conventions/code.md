# Code Conventions

Applied to all source under `packages/**` and `apps/**`. The entry point is [AGENTS.md](../../AGENTS.md); this file expands the rules with examples.

## TypeScript

- Strict mode — no `any`, `as any`, `@ts-ignore`.
- ES2022 target, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`.
- Named exports only — no `export default`.
- No barrel re-exports (`export * from …`) outside `@flare-engine/engine`.
- Prefer `import type { Foo } from './foo'` for type-only imports.

## Functions & objects

- Pure functions over methods with side effects.
- Plain objects + module-level functions over classes when classes add nothing.
- Functions stay small and single-purpose.

## Performance (hot paths)

Hot paths: `update()`, `render()`, physics tick, particle update, bullet loops, collision step.

- Zero-alloc — no `new` inside the loop.
- Plain objects `{ x, y }` over class instances for data.
- `Float32Array` for bulk numeric data.
- Pre-allocate and reuse buffers; never create temporary arrays per-frame.
- Pre-create queries outside the loop — never `world.query(...)` inside a system.
- Provide an `out`-parameter (`…Into`) zero-alloc form alongside the allocating form when the value is consumed per frame.

## Comments

- Only comment logic that is non-obvious.
- No JSDoc on internal functions; reserve it for public API.
- No `// TODO` / `// FIXME` — track in issues or roadmap.md.

## Formatting

- Biome handles all formatting — never run Prettier or ESLint.
- Run `bun run lint:fix` to auto-fix.

## Packages (`packages/**`)

Layout:
```
packages/<name>/
  package.json
  tsconfig.json
  tsup.config.ts
  src/
    index.ts          # Barrel, named exports only
    <module>.ts       # One file per concept
  tests/
    <module>.test.ts  # One test file per source file
```

Rules:
- Named exports only. Internal helpers prefixed with `_` or in `src/internal/`.
- Import only from an equal-or-lower layer, never higher (enforced by `scripts/check-deps-tiers.mjs`; tier map: `docs/design/architecture.md`).
- Internal deps use `workspace:*`.
- External peer deps declared in `peerDependencies`.

## Testing

- `bun test` in each package directory.
- Edge cases: NaN, Infinity, zero, negative, very large values.
- Deterministic concerns only (math, FSMs, save migrations, ICU plurals). Skip visual/audio/timing — those are device-verified.
- No `toBeDefined`-style tautological assertions, no import-only tests, no shallow snapshots. Tests verify behavior, not coverage percentage.
- Benchmark hot paths with `performance.now()` in dedicated bench files.
