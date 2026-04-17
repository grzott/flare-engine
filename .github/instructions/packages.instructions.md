---
description: "Rules for Flare engine packages. Applied when working with any package under packages/."
applyTo: "packages/**"
---

# Flare Package Rules

## File Structure

Each package follows this layout:
```
packages/<name>/
  package.json
  tsconfig.json
  tsup.config.ts
  src/
    index.ts          # Barrel file — named exports only
    <module>.ts       # One file per concept
  tests/
    <module>.test.ts  # One test file per source file
```

## Exports

- Named exports only. No `export default`.
- Barrel `src/index.ts` re-exports public API.
- Internal helpers: prefix with `_` or put in `src/internal/`.

## Dependencies

- Only import from lower layers.
- Use `workspace:*` for internal deps.
- External peer deps must be declared in `peerDependencies`.

## Performance

- No `new` in hot paths (game loop, render, physics tick).
- Prefer plain objects `{ x, y }` over class instances for data.
- Use `Float32Array` for bulk numeric data.
- Pre-allocate and pool — zero GC pressure in steady state.

## Testing

- `bun test` in each package directory.
- Test edge cases: NaN, Infinity, zero, negative, very large values.
- Benchmark hot paths with `performance.now()` in dedicated bench files.
