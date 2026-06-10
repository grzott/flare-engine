---
name: retro
description: Mine the last N SESSION_LOG blocks (engine + Pan-Tvardowski) and both project-memory indexes for repeated frictions, drift, and chores; emit a report with concrete harness recommendations. Read-only; report to chat, never committed. Run at each arc close or every ~15 sessions.
argument-hint: "[N=20] [engine|pt|all]"
---

# /retro

Answer "what do I keep repeating?" from the recorded evidence. Read-only.

## Inputs

- `N` — blocks to mine per repo (default 20).
- Scope filter: `engine`, `pt`, or `all` (default).

## Sources

| Source | Path |
|---|---|
| Engine session log | `SESSION_LOG.md` (this repo) |
| PT session log | `c:\_PROG\flare-engine-workspace\Pan-Tvardowski\SESSION_LOG.md` |
| Engine memory index | `C:\Users\user\.claude\projects\c---PROG-flare-engine-workspace-flare-engine\memory\MEMORY.md` |
| PT memory index | `C:\Users\user\.claude\projects\c---PROG-flare-engine-workspace-Pan-Tvardowski\memory\MEMORY.md` |
| Allowlists | each repo's `.claude/settings.json` |

PT paths are read via absolute path — works regardless of which repo the session roots in.

## Steps

1. Read the last N `## Session` blocks of each in-scope SESSION_LOG. Parse Goal /
   Touched files / Gates / **Frictions** (blocks before 2026-06-10 have no Frictions
   line — treat as unknown, not `none`).
2. Tally frictions by category (`corr` / `deny` / `gate` / `fixup` / `drift`) and group
   repeated cause-strings fuzzily (same file, same package, same kind of mistake).
3. Read both MEMORY.md indexes. Flag memory entries describing a problem that STILL
   recurred inside the window (memory said X, sessions still hit X) — those memories are
   not working; they need to become a hook, an allow rule, or a skill instruction.
4. Cross-check every `deny:` cause against the repo's current `settings.json` allow list —
   each is a candidate allow rule (or evidence a deny is doing its job; say which).
5. Report to chat ONLY (never commit it):
   - **Top repeated frictions** — count, session numbers, one-line cause each
   - **Candidate allow rules** — exact `settings.json` lines
   - **Candidate skill instructions** — which repeated manual step each would remove
   - **Doc gaps** — facts agents repeatedly re-derived → the doc that should hold them
   - **Stale memory candidates** — port-to-repo or delete

## Rules

- Every recommendation must cite **≥2 occurrences** in the window. One-offs are noise.
- No edits without user approval — this skill only reports.
