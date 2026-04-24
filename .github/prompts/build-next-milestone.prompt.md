---
description: "Build the next milestone in a Flare game app. Auto-detects game from apps/<game>/, reads its build plan, plans with user approval, implements, gates, produces commit messages."
agent: game-builder
---

# Build Next Milestone

Execute one milestone end-to-end for a Flare game app (`apps/<game>/`). Stop before committing; hand commit messages to the user.

Follows [status-sync.instructions.md](../instructions/status-sync.instructions.md). Verify on entry, sync on exit.

## Step 0 — Detect the game

If the user didn't specify, list all `apps/*/` directories that contain a `docs/plans/<name>-build-plan.md`. Ask which one. If exactly one candidate, use it without asking.

Load the game's plan doc at `docs/plans/<game>-build-plan.md`.

## Step 1 — Identify next milestone + verify state (MANDATORY)

1. Open the plan's §17 Milestones table AND the Change log section at the bottom of the plan.
2. Verify the changelog is consistent with the repo: run `git log --oneline -n 20 -- apps/<game>` and confirm the last milestone entry matches recent commit history. If the changelog claims Mn done but no matching commits exist — or commits show Mn+1 work but changelog stops at Mn-1 — **stop and surface the drift**.
3. Cross-check the mirror row in `docs/references/builder-reference.md` (`apps/<game>` entry). If it contradicts the plan's changelog, the plan wins; note the mirror needs updating in Step 7.
4. Find the **lowest-numbered `M<n>`** whose engine-coverage checkboxes (in §16 or in-milestone) are not all ticked.
5. If every milestone is complete → report "game is feature-complete" and stop.

State the target milestone and what engine packages it exercises.

## Step 2 — Plan

List:

1. Every file you will create or modify (paths relative to repo root).
2. Tests you will add and what they assert.
3. Engine-coverage checkboxes you will tick at the end.
4. New npm dependencies, if any (must be flagged; justify each).
5. Any suspected engine gap you might hit. If a gap is likely, stop here and ask the user whether to delegate to `@builder` before proceeding.

**STOP. Present the plan. Wait for user approval. Do not touch files yet.**

## Step 3 — Implement

After approval:

1. Create/modify exactly the files from the approved plan. No drive-by changes.
2. Match existing patterns in the game (look at completed milestones for style).
3. Follow the [flare-game-dev skill](../skills/flare-game-dev/SKILL.md) — scene bootstrap, shape-atlas, zero-alloc bullet loops, localization-first strings.
4. Load per-package skills (`.github/skills/flare-*/SKILL.md`) on demand for packages you're actively wiring.

## Step 4 — Write tests

Cover deterministic concerns only (boss FSM, score math, plural resolution, dialogue branches, save-schema migrations). Skip visual/audio/timing-sensitive areas — those are device-verified.

Use `@flare-engine/testing` FakeClock + TestWorld.

## Step 5 — Gates (run in order; halt on first failure)

```bash
# Gate A — typecheck
bun --cwd apps/<game> run typecheck

# Gate B — lint
bun run lint

# Gate C — tests
bun --cwd apps/<game> test
# only if milestone touches engine testing utilities:
bun run test

# Gate D — build (only if game has a build script)
bun --cwd apps/<game> run build
```

On any failure: stop, print the trimmed failing output, suggest root cause. Do NOT loop on the same fix more than twice.

## Step 6 — Device smoke (USER STEP — do not auto-run)

Print the exact command for the user to run:

```bash
bun --cwd apps/<game> run android --device
```

Halt. Wait for user to paste outcome. If device smoke passes, continue; if it fails, diagnose from the paste and propose a fix plan (back to step 3 if needed).

## Step 7 — Sync docs (MANDATORY — do not skip)

In `docs/plans/<game>-build-plan.md`:

1. Tick the completed engine-coverage checkboxes for this milestone.
2. Append a dated entry to the "Change log" section: `**YYYY-MM-DD** — **Mn complete.** <one paragraph, same cadence as prior entries>`.

In `docs/references/builder-reference.md`:

3. Update the single `apps/<game>` mirror row to `🟡 Mn done, M(n+1) pending (YYYY-MM-DD) — <X> tests green`. This is the only row to touch.

In `docs/plans/release-readiness-checklist.md`:

4. Tick every checklist item this milestone satisfied. If the milestone surfaced a release gap not already on the checklist, ADD it as a new item — don't silently absorb it.

See [status-sync.instructions.md](../instructions/status-sync.instructions.md) + [release-readiness.instructions.md](../instructions/release-readiness.instructions.md) for the full contract.

## Step 8 — Commit commands (paste-ready)

Produce one or more Conventional Commits. Scope = game folder name. Split by concern:

- `feat(<game>): <gameplay summary>`
- `feat(<game>): <additional discrete feature>` (if any)
- `test(<game>): <test summary>` (if tests added)
- `docs(<game>): tick M<n> engine-coverage boxes`
- `chore(<game>): add dep <name>` (if any new deps)

For each commit, print **two paste-ready bash commands** inside a single fenced ```bash block:

1. `git add <exact file list>` — only the files for that commit, repo-root-relative, no wildcards
2. `git commit -m "<subject>"` — subject-only, single-line, ≤72 chars, **no body**

Example:

````
### Commit 1/4

```bash
git add apps/pan-tvardowski/src/scenes/zone-2.ts apps/pan-tvardowski/src/enemies/czart.ts apps/pan-tvardowski/src/enemies/bies.ts
git commit -m "feat(pan-tvardowski): zone 2 gameplay, Czart + Bies enemies"
```

### Commit 2/4

```bash
git add apps/pan-tvardowski/src/bosses/rokita.ts
git commit -m "feat(pan-tvardowski): Rokita miniboss with growing-roots pattern"
```

...
````

**STOP here.** Do not run `git add`, `git commit`, or `git push`. Wait for the user.
