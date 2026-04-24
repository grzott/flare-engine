# Flare Engine — Claude Code Guide

Conventions, architecture, and commands: [AGENTS.md](AGENTS.md) (source of truth).
Documentation index: [docs/README.md](docs/README.md).
API contract: [docs/design/api-specs.md](docs/design/api-specs.md).

## Agent map (auto-delegation)

Claude Code sub-agents live in [.claude/agents/](.claude/agents/). Seven single-responsibility agents:

- `engine-planner` — cuts 10–20 session slices from `docs/plans/build-plan.md` → `docs/plans/sessions.md`
- `game-planner` — same, for `apps/<game>/` work, writes to the same unified sessions file
- `engine-researcher` — library / technique / benchmark surveys for engine packages
- `game-researcher` — assets, folklore, marketplaces, name validation for game apps
- `engine-builder` — implements `packages/**` (never touches `apps/**`)
- `game-builder` — implements `apps/<game>/**` (never touches `packages/**`)
- `verifier` — runs gates, reads diffs, blocks `/session-close` on drift
- `architect` — audits + designs the AI environment itself (this file, `.claude/`, `.github/`)

## Session workflow

Execute work as short, gated sessions. The unified session plan lives in [docs/plans/sessions.md](docs/plans/sessions.md).

1. `/plan-sessions` — planner proposes the next 10–20 session slice. You approve before it writes.
2. `/session-start` — builder verifies state, picks next pending session, presents implementation plan, waits for approval.
3. Implement (builder).
4. `/session-close` — verifier runs lint → typecheck → test → build, syncs docs, appends to [SESSION_LOG.md](SESSION_LOG.md), emits paste-ready commit bash blocks. You run the commits.

Each commit ≤72 chars, Conventional Commits, subject only. See [.github/instructions/git.instructions.md](.github/instructions/git.instructions.md).

## Skills

Skill content lives once in [.github/skills/](.github/skills/). [.claude/skills/](.claude/skills/) holds pass-through stubs so Claude's skill discovery works without duplicating content. Always edit `.github/skills/<name>/SKILL.md` — never the stub.

## Copilot coexistence

This repo serves both Claude Code and GitHub Copilot. `.github/` is the Copilot wiring; `.claude/` is additive. Do not remove `.github/` files.

Single-source-of-truth map: instructions in [.github/instructions/](.github/instructions/) are the one copy — both tools reference them. Agents in `.claude/agents/` and `.github/agents/` have minor frontmatter differences (model IDs, tool names) but carry identical body rules by reference.

## Boundary rules (reinforced from agents)

- `engine-builder` — never edits `apps/**`, `docs/design/**`, `docs/plans/build-plan.md` (read-only reference)
- `game-builder` — never edits `packages/**`, `.github/**`, engine-level design docs
- All builders — never run `git add`, `git commit`, `git push` (blocked in [.claude/settings.json](.claude/settings.json))
- `verifier` — never edits anything; runs gates, reads diff, reports
- `architect` — only touches customization files (`.github/**`, `.claude/**`, reference docs)

See [AGENTS.md](AGENTS.md) for code-style, perf, and package rules.
