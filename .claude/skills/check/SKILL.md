---
name: check
description: Run the full quality check suite — typecheck, lint, test, and build for the current package or entire repo
argument-hint: "[package name, or leave blank for all]"
allowed-tools: Bash(bun run typecheck:*), Bash(bun run lint:*), Bash(bun test:*), Bash(bun run build:*)
---

Run the full quality check suite for the Flare engine.

If a specific package was given as an argument, run checks only in that package directory (`packages/<name>/`).
Otherwise run from the repo root to check everything.

**Steps in order:**
1. `bun run typecheck` — TypeScript strict check
2. `bun run lint` — Biome lint
3. `bun test` — Bun test runner
4. `bun run build` — tsup dual CJS+ESM build

Report any failures clearly. Do not stop at the first failure — run all four and summarize results together.
If all pass, confirm clean.
