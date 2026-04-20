# Flare Engine — Workspace Instructions

Full conventions, architecture, and commands are in [AGENTS.md](../AGENTS.md).
Documentation index: [docs/README.md](../docs/README.md).
API contract source of truth: [docs/design/api-specs.md](../docs/design/api-specs.md) — read before implementing or modifying any public API.

## Agents

- `@builder` — implements packages, writes tests, builds the engine
- `@architect` — audits and designs the AI development environment
- `@researcher` — surveys libraries, techniques, assets, and competitor engines

## Scoped instructions

File-scoped rules live in [.github/instructions/](instructions/) and load automatically for matching files:

- `packages.instructions.md` — layout, exports, deps, perf, testing (`packages/**`)
- `code-style.instructions.md` — TypeScript + performance + formatting (`packages/**/*.{ts,tsx}`)
- `testing.instructions.md` — test conventions (`**/tests/**`, `**/*.test.ts`)
- `git.instructions.md` — commit and branch conventions (all files)
- `engine.instructions.md`, `physics.instructions.md`, `render.instructions.md` — per-package non-obvious rules
