# Flare Engine — Claude Code Guide

@AGENTS.md

Roadmap: [docs/plans/roadmap.md](docs/plans/roadmap.md). Next-up: [docs/plans/todo.md](docs/plans/todo.md). API contract: [docs/design/api-specs.md](docs/design/api-specs.md).

## Agents

Two builders, no planners. You pick the next row from `todo.md`.

- `engine-builder` — implements `packages/**`. Never touches `apps/**`.
- `game-builder` — implements `apps/<game>/**`. Never touches `packages/**`. Engine gaps must split into engine-first work in `packages/**` before the game-side wire. **Dormant since 2026-06-10:** Pan Tvardowski moved to [its own repo](https://github.com/grzott/Pan-Tvardowski) (own `.claude/` harness there); no game app lives in this repo. `apps/bench-dashboard` and `apps/bench-web` are owner-maintained tooling, not game apps.

## Workflow

Work comes from GitHub issues; each issue becomes one PR. Mechanics, policy and the gate workflows: [docs/plans/a2-agent-workflow-2026-11-tasks.md](docs/plans/a2-agent-workflow-2026-11-tasks.md).

1. `/start next` — take the next `status:ready` issue (or `/start <n>` interactively, halting for plan approval), route to builder by scope, gate with `.claude/hooks/verify.sh` (that script is the authoritative list), open one PR on a `claude/*` branch as the agent bot.
2. `/close` — turn hand-started work into a PR the same way. The PR description (incl. the frictions self-report) is the session record; `SESSION_LOG.md` is frozen.
3. `/retro` every ~15 PRs — mines merged PR descriptions' frictions into harness recommendations.

## Boundaries

- Builders never commit. The `/start` or `/close` session commits and pushes only `claude/*` branches (enforced by `.claude/hooks/pre-bash-guard.sh`).
- `main` takes changes only through PRs whose `ci` and `risk-gate` checks pass (the `main` ruleset). Held classes (`.github/risk-policy.json`) wait for the owner.
- Commit format and the one-source-per-fact rule come from the imported `AGENTS.md`. If a plan changes, edit `roadmap.md` or `todo.md` directly.
