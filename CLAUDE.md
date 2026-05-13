# Flare Engine — Claude Code Guide

Conventions: [AGENTS.md](AGENTS.md). Roadmap: [docs/plans/roadmap.md](docs/plans/roadmap.md). Next-up: [docs/plans/todo.md](docs/plans/todo.md). API contract: [docs/design/api-specs.md](docs/design/api-specs.md).

## Agents

Two builders, no planners. You pick the next row from `todo.md`.

- `engine-builder` — implements `packages/**`. Never touches `apps/**`.
- `game-builder` — implements `apps/<game>/**`. Never touches `packages/**`. Engine gaps must split into engine-first work in `packages/**` before the game-side wire.

## Workflow

1. `/start` — pick top row from `todo.md`, route to builder by scope, present plan, halt for approval.
2. Implement.
3. `/close` — `.claude/hooks/verify.sh` runs lint → typecheck → test → build, appends a block to `SESSION_LOG.md`, emits commit blocks. You run the commits.

## Boundaries

- Builders never run `git add`/`commit`/`push` (blocked in `.claude/settings.json` + `pre-bash-guard.sh`).
- Conventional Commits, ≤72-char subject, no body, no Co-Authored-By trailer.
- One source per fact. No mirror rows. No supersession footnotes. If a plan changes, edit `roadmap.md` or `todo.md` directly.
