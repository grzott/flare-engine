# Todo

Next work, in order. Pick top → `/start`. When done → `/close`. History appends to `SESSION_LOG.md`.

## Active

_(none — meta-refactor complete; pick a future track when ready)_

## Future tracks

See [roadmap.md "Future tracks"](roadmap.md#future-tracks-when-meta-refactor-closes). None is the default. Options:

1. **Ship PT** — store accounts + IAP + legal + screenshots + submits (~$124 + weekend of work).
2. **Second game** — top-down or deck-builder in a separate private repo.
3. **Engine feature** — e.g. 2.5D lighting via SkSL RuntimeEffect.
4. **Pre-launch polish** — Phase 11.11 / 11.12 / 11.13 (landing MP4, docs site, RC publish, EUIPO trademark).

## Done

- **M3 — meta-refactor close** (2026-05-13). Killed Copilot mirrors (`.github/agents`, `.github/prompts`, `.github/copilot*`). Collapsed 11 instructions → 2 in `docs/conventions/`. Moved 3 surviving skills to `.claude/skills/`. Lifted PT rules into `apps/pan-tvardowski/AGENTS.md`.
- **M2 — meta-refactor** (2026-05-13). Cut 6 agents + 6 commands + 35 flare-* skills + 39 .claude/skills stubs. Built `verify.sh` + `/start` + `/close`. Simplified `session-start.sh` hook.
- **M1 — plan consolidation** (2026-05-13). Created `roadmap.md` + `todo.md`. Deleted 4 plan docs + 3 reference docs. Trimmed CLAUDE.md + AGENTS.md.
