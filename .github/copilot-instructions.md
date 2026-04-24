# Flare Engine — Workspace Instructions

Full conventions, architecture, and commands are in [AGENTS.md](../AGENTS.md).
Documentation index: [docs/README.md](../docs/README.md).
API contract source of truth: [docs/design/api-specs.md](../docs/design/api-specs.md) — read before implementing or modifying any public API.

## Session workflow

Execute work as short, gated sessions — plan 10–20, execute one at a time, close with gates + commits. Unified session plan: [docs/plans/sessions.md](../docs/plans/sessions.md). Append-only log of closed sessions: [SESSION_LOG.md](../SESSION_LOG.md). Canonical close format: [instructions/session-close.instructions.md](instructions/session-close.instructions.md).

Copilot users can follow this same workflow via the `@architect`, `@builder`, `@game-builder`, `@researcher` agents below. Claude Code users have the parallel wiring in [.claude/agents/](../.claude/agents/) and slash commands (`/plan-sessions`, `/session-start`, `/session-close`) — see [CLAUDE.md](../CLAUDE.md).

## Agents

- `@builder` — implements engine packages (`packages/**`), writes tests, builds the engine
- `@game-builder` — implements game apps (`apps/<game>/**`), wires engine packages into gameplay, produces commit messages (never commits). Reusable for any Flare game
- `@architect` — audits and designs the AI development environment
- `@researcher` — surveys libraries, techniques, assets, and competitor engines

## Prompts

- `/build-next` — engine builder: next phase from `docs/plans/build-plan.md`
- `/build-next-milestone` — game builder: next milestone from `docs/plans/<game>-build-plan.md`
- `/continue-game` — resume in-flight game work

## Scoped instructions

File-scoped rules live in [.github/instructions/](instructions/) and load automatically for matching files:

- `packages.instructions.md` — layout, exports, deps, perf, testing (`packages/**`)
- `code-style.instructions.md` — TypeScript + performance + formatting (`packages/**/*.{ts,tsx}`)
- `testing.instructions.md` — test conventions (`**/tests/**`, `**/*.test.ts`)
- `git.instructions.md` — commit and branch conventions (all files)
- `engine.instructions.md`, `physics.instructions.md`, `render.instructions.md` — per-package non-obvious rules
- `status-sync.instructions.md` — single-source-of-truth + pre/post-work doc sync (`docs/plans/**`, `docs/references/builder-reference.md`)
- `release-readiness.instructions.md` — asset-swap / localization / IAP / privacy discipline (`apps/pan-tvardowski/**`, `packages/iap/**`, `packages/share/**`, `docs/plans/release-readiness-checklist.md`)
- `session-close.instructions.md` — canonical format for the SESSION_LOG.md block written at `/session-close`
