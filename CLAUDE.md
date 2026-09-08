# Flare Engine — Claude Code Guide

@AGENTS.md

Roadmap: [docs/plans/roadmap.md](docs/plans/roadmap.md). Next-up: [docs/plans/todo.md](docs/plans/todo.md). API contract: [docs/design/api-specs.md](docs/design/api-specs.md).

## Agents

Two builders, no planners. You pick the next row from `todo.md`.

- `engine-builder` — implements `packages/**`. Never touches `apps/**`.
- `game-builder` — implements `apps/<game>/**`. Never touches `packages/**`. Engine gaps must split into engine-first work in `packages/**` before the game-side wire. **Dormant since 2026-06-10:** Pan Tvardowski moved to [its own repo](https://github.com/grzott/Pan-Tvardowski) (own `.claude/` harness there); no game app lives in this repo. `apps/bench-dashboard` is owner-maintained tooling.

## Workflow

1. `/start [N | keyword]` — pick the top row (or top N, max 5) from `todo.md`, route to builder by scope, present all plans, halt ONCE for batch approval.
2. Implement row by row — per-row gate, per-row commit block (batch state in `.claude/.batch-baseline`).
3. `/close` — runs the full gate sequence in `.claude/hooks/verify.sh` (lint, typecheck, test, build, and more — that script is the authoritative list), appends a block (incl. a frictions self-report) to `SESSION_LOG.md`, emits commit blocks. You run the commits.
4. `/retro` every ~15 sessions — mines SESSION_LOG frictions into harness recommendations.

## Boundaries

- Builders never run `git add`/`commit`/`push` (blocked in `.claude/settings.json` + `pre-bash-guard.sh`).
- Commit format and the one-source-per-fact rule come from the imported `AGENTS.md`. If a plan changes, edit `roadmap.md` or `todo.md` directly.
