---
description: "Build the next milestone in a Flare game app. Auto-detects game from apps/<game>/, reads its build plan, plans with user approval, implements, gates, produces commit messages."
agent: game-builder
---

# Build Next Milestone

Execute one milestone end-to-end for a Flare game app (`apps/<game>/`). Stop before committing; hand commit messages to the user.

## Step 0 — Detect the game

If the user didn't specify, list all `apps/*/` directories that contain a `docs/plans/<name>-build-plan.md`. Ask which one. If exactly one candidate, use it without asking.

Load the game's plan doc at `docs/plans/<game>-build-plan.md`.

## Step 1 — Identify next milestone

1. Open the plan's §17 Milestones table.
2. Find the **lowest-numbered `M<n>`** whose engine-coverage checkboxes (in §16 or in-milestone) are not all ticked.
3. If every milestone is complete → report "game is feature-complete" and stop.

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

## Step 7 — Update plan doc

In `docs/plans/<game>-build-plan.md`:

1. Tick the completed engine-coverage checkboxes for this milestone.
2. Append a line to the "Change log" section (date + one-line summary).

## Step 8 — Commit messages

Produce one or more Conventional Commits. Scope = game folder name. Split by concern:

- `feat(<game>): <gameplay summary>`
- `feat(<game>): <additional discrete feature>` (if any)
- `test(<game>): <test summary>` (if tests added)
- `docs(<game>): tick M<n> engine-coverage boxes`
- `chore(<game>): add dep <name>` (if any new deps)

Print each in a fenced code block clearly labelled, ready for `git commit -m ...`:

````
### Commit 1/4

```
feat(pan-tvardowski): zone 2 gameplay, Czart + Bies enemies

Adds scrolling Mazovian forest scene with sine + hover enemy
patterns and a wave spawner coroutine. Camera shake on enemy
explosion gated through @flare-engine/a11y.
```

### Commit 2/4
...
````

**STOP here.** Do not run `git commit`. Do not run `git push`. Wait for the user.
