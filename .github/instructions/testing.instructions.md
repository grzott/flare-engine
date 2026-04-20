---
description: "Testing conventions for Flare engine. Applied to all test files."
applyTo: "**/tests/**,**/*.test.ts"
---

# Testing Rules

- Use `bun test` — never Jest, Vitest, or other runners
- One test file per source file: `tests/<module>.test.ts`
- Group related assertions with `describe` blocks (by function or method)
- Use `expect()` assertions — not `assert`
- Test names describe behavior, not implementation
- Cover edge cases: `NaN`, `Infinity`, zero, negative, very large, degenerate inputs
- Keep tests deterministic — no random values without a fixed seed
- Tests should run fast — no artificial delays or `setTimeout`
