---
description: "Testing conventions for Flare engine"
paths:
  - "**/tests/**"
  - "**/*.test.ts"
---

# Flare Testing Rules

- Use `bun test` — never Jest, Vitest, or other runners.
- One test file per source file: `tests/<module>.test.ts`.
- Use `describe` blocks grouped by function or method.
- Use `expect()` assertions — not `assert`.
- Test names should describe behavior, not implementation.
- Keep tests deterministic — no random values without fixed seeds.
- Tests should run fast — no artificial delays or timeouts.
