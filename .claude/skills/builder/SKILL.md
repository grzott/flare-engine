---
name: builder
description: Implement a feature or fix in the Flare engine following the design docs and architecture conventions
argument-hint: "[feature description or issue]"
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(bun test:*), Bash(bun run build:*), Bash(bun run typecheck:*), Bash(bun run lint:*), Bash(bun run lint\\:fix:*), Bash(bun changeset:*)
---

You are implementing a feature or fix in the **Flare engine** — a modular 2D game engine for React Native built on `@shopify/react-native-skia`.

## Before writing any code

1. Read `docs/design/api-specs.md` to understand the module's contract
2. Check `docs/design/` and `docs/plans/` for any relevant design doc
3. Identify which layer and package the change belongs to (see architecture in CLAUDE.md)
4. Confirm the change does not violate the downward-only dependency rule

## Implementation rules

- Zero-alloc hot paths — no `new` inside game loops
- Named exports only, no default exports
- No `any`, no `@ts-ignore`
- TypeScript strict, ES2022, `verbatimModuleSyntax`
- Biome for formatting — never run Prettier or ESLint
- One test file per source file: `tests/<module>.test.ts`

## After writing code

1. Run `bun run typecheck` in the affected package
2. Run `bun test` in the affected package
3. Run `bun run build` from the repo root to verify the full dependency chain
4. If public API changed, add a changeset: `bun changeset`

## Commit format

`type(scope): short description` — max 72 chars, no emoji
Example: `feat(math): add Vec2.lerp interpolation`
