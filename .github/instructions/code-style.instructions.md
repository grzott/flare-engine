---
description: "TypeScript, performance, and formatting rules for Flare engine source files. Applied to all packages/**/*.ts(x)."
applyTo: "packages/**/*.{ts,tsx}"
---

# Code Style

## TypeScript

- Strict mode — no `any`, no `as any`, no `@ts-ignore`
- ES2022 target, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`
- Named exports only — no default exports
- No barrel re-exports of entire modules (`export * from …` is banned outside `@flare-engine/engine`)
- Prefer `type` imports: `import type { Foo } from './foo'`

## Performance (hot paths)

- Zero-alloc in game loops — no `new` inside `update()` / `render()` calls
- Use plain objects + static methods instead of classes where possible
- Pre-allocate and reuse buffers; avoid creating temporary arrays
- Provide an `out`-parameter (`…Into`) zero-alloc form alongside the allocating form when the value is consumed per-frame

## Functions & Objects

- Prefer pure functions over methods with side effects
- Keep functions small and single-purpose
- No classes where a plain object + module-level functions suffice

## Comments

- Only comment logic that is non-obvious
- No JSDoc on internal functions unless a public API
- No `// TODO` / `// FIXME` unless tracked in an issue

## Formatting

- Biome handles all formatting — never run Prettier or ESLint
- Run `bun run lint:fix` to auto-fix
