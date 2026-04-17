---
description: "TypeScript, performance, and formatting rules for Flare engine source files"
paths:
  - "packages/**/*.ts"
  - "packages/**/*.tsx"
---

# Code Style

## TypeScript
- Strict mode — no `any`, no `as any`, no `@ts-ignore`
- ES2022 target, `verbatimModuleSyntax`
- Named exports only — no default exports
- No barrel re-exports of entire modules (`export * from ...` is banned)
- Prefer `type` imports: `import type { Foo } from './foo'`

## Performance (hot paths)
- Zero-alloc in game loops — no `new` inside `update()`/`render()` calls
- Use plain objects + static methods instead of classes where possible
- Pre-allocate and reuse buffers; avoid creating temporary arrays

## Functions & Objects
- Prefer pure functions over methods with side effects
- Keep functions small and single-purpose
- No classes where a plain object + module-level functions suffice

## Comments
- Only comment logic that is non-obvious
- No JSDoc on internal functions unless a public API
- No `// TODO` or `// FIXME` unless tracked in an issue

## Formatting
- Biome handles all formatting — do not run Prettier or ESLint
- Run `bun run lint:fix` to auto-fix
