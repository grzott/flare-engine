---
description: "Single-source-of-truth rules for engine + game status docs. Every agent must verify state on entry and sync docs on exit of any phase / milestone / session."
applyTo: "docs/plans/**,docs/references/builder-reference.md,docs/references/architect-reference.md"
---

# Status Sync Protocol

Stale status docs cause wrong planning. This file defines the single-source-of-truth contract.

## Source of truth

| Subject                    | Primary doc                                                                            | Mirror (must stay in sync)                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Engine phase status (0–12) | [docs/plans/build-plan.md](../../docs/plans/build-plan.md) **Phase Summary table**     | [docs/references/builder-reference.md](../../docs/references/builder-reference.md) **Current State table** |
| Engine package status      | [docs/references/builder-reference.md](../../docs/references/builder-reference.md)     | —                                                                                                          |
| Game app status (per game) | [docs/plans/\<game\>-build-plan.md](../../docs/plans/) **§17 Milestones** ticks + [SESSION_LOG.md](../../SESSION_LOG.md) per-session blocks (verifier-written) | `builder-reference.md` mirrors ONLY the last-milestone marker (one row per game)                           |
| Stub Tier-2 packages       | `builder-reference.md`                                                                 | —                                                                                                          |

Rules:

- **One primary doc per subject.** Never record the same fact in two primary docs.
- **Mirrors are copy-only.** If a mirror disagrees with its primary, the primary wins. Fix the mirror immediately.
- **Never duplicate detailed changelogs.** Mirrors carry a one-line marker; prose lives in the primary.

## Pre-work verification (every agent, every session)

Before planning any phase / milestone / implementation:

1. Read the primary doc for the subject you will modify.
2. Read the mirror. If it contradicts the primary, **stop and reconcile first**.
3. Spot-check code vs docs:
   - Engine phase: does `packages/<name>/src/` exist with real code + `tests/` green?
   - Game milestone: does the changelog line match actual commits (`git log --oneline -n 20 -- apps/<game>`)?
4. If docs claim "not started" but code exists, or claim "done" but tests fail, **halt and surface the mismatch**. Do not plan on top of unverified status.

## Post-work sync (every agent, every session)

When a phase / milestone / session ends — successful OR abandoned:

### Engine phase or package (builder)

1. Update the package row in `builder-reference.md` "Current State" table (module count, test count, size).
2. Update the phase row in `build-plan.md` Phase Summary if the phase state changed.
3. Add a short dated entry to the phase section in `build-plan.md` if the phase added/shipped something notable.
4. Run `bun run test && bun run build` **before** marking DONE. Never mark DONE on untested work.

### Game milestone (game-builder)

1. Tick engine-coverage checkboxes in `<game>-build-plan.md` §16/§17.
2. Update the single mirror row in `builder-reference.md` for `apps/<game>` → `Mn done, M(n+1) pending` with today's date.
3. The verifier writes the closure record to [`SESSION_LOG.md`](../../SESSION_LOG.md) at `/session-close`. Do **not** append a free-form `**Mn complete.**` paragraph to `<game>-build-plan.md` — the Change log section was retired 2026-05-10 (session #103 doc-refactor); historical entries up to session #156 live in `SESSION_LOG.md` Pan Tvardowski appendix.

### Architect / instruction changes

1. Update `docs/references/architect-reference.md` if the agent/prompt/instruction/skill inventory changed.

## Format rules

- **Date format:** `YYYY-MM-DD`. Always include the date on a new changelog / status line.
- **No mark-DONE without evidence.** Evidence = tests green + build green + (for device work) user-confirmed smoke test. Quote counts exactly (`119 tests`, not `~120`).
- **No silent edits.** Every status change has a changelog line or commit message that describes it.
- **Never rely on a subagent's recall of status.** Subagents read the same docs you do; if the docs are stale, so is the subagent.

## Common failure modes (from real incidents)

- "Research agent said M1 pending" → research agent read a stale cached summary. Always verify against the primary doc + changelog directly.
- "Builder-reference says pre-production" but game is at M8 → mirror was never synced as milestones shipped. Game-builder step 7 enforces this going forward.
- "Phase 11.2 not started" but packages exist → phase row was never updated when packages landed. Builder step 6 enforces this going forward.

## Escalation

If you discover a large batch of stale rows (more than 3 rows, or more than 1 phase drift), do **not** silently fix them. Surface the drift to the user with a diff summary and ask for confirmation before batch-correcting. A large drift indicates a process break that may need structural repair, not just content patching.
