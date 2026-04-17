# Contributing to Flare

## Quick Start

```bash
bun install          # Install all dependencies
bun run build        # Build all 16 packages
bun run test         # Run all tests
```

## Development Workflow

1. Create a feature branch from `main`
2. Implement changes in the relevant `packages/<name>/src/` directory
3. Write tests in `packages/<name>/tests/`
4. Run verification: `bun test`, `bun run build`, `bun run lint`, `bun run typecheck`
5. Commit with a conventional commit message
6. Open a PR

## Package Structure

```
packages/<name>/
  package.json
  tsconfig.json
  tsup.config.ts
  src/
    index.ts          # Barrel — named exports only
    <module>.ts       # One file per concept
  tests/
    <module>.test.ts  # One test file per source file
```

## Commit Convention

Format: `<type>(<scope>): <description>`

- **Max 72 characters** in the header
- **No emoji** in the subject line
- Scope is the package name (optional): `feat(math): add Vec2.lerp`

Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`

Breaking changes: `feat(ecs)!: rename World.add to World.spawn` or `BREAKING CHANGE:` in body.

## Testing

- Run package tests: `cd packages/<name> && bun test`
- Run all tests: `bun run test`
- Cover edge cases: NaN, Infinity, zero, negative, very large, degenerate inputs

## Code Style

- **Biome** handles linting and formatting — run `bun run lint:fix` to auto-fix
- Named exports only, no default exports
- No `any` or `as any`
- Zero allocations in hot paths (game loop, render, physics tick)
- Plain objects + static methods over classes for data types

## PR Checklist

- [ ] Tests pass: `bun run test`
- [ ] Build passes: `bun run build`
- [ ] Lint clean: `bun run lint`
- [ ] Types clean: `bun run typecheck`
- [ ] Size within budget (check `dist/` output)
