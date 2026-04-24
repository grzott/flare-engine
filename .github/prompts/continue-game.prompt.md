---
description: "Resume work on a Flare game — detects in-flight milestone from git status + build plan, then continues or dispatches to build-next-milestone."
agent: game-builder
---

# Continue Game Work

Figure out where work was left off and resume.

## Step 1 — Read git state

```bash
git status --short
git log --oneline -n 10
```

Identify which `apps/<game>/` has recent modifications.

## Step 2 — Read the game plan + verify consistency

Open `docs/plans/<game>-build-plan.md`. Find the lowest milestone with **incomplete engine-coverage checkboxes**.

Verify doc ↔ code consistency (per [status-sync.instructions.md](../instructions/status-sync.instructions.md)):

1. The plan's Change log last entry should match recent commits from `git log --oneline -n 20 -- apps/<game>`.
2. The `apps/<game>` mirror row in `docs/references/builder-reference.md` should agree with the plan.

If any contradiction is found, **stop and surface it** — do not plan on stale docs.

## Step 3 — Decide mode

**Mode A — in-flight milestone (uncommitted changes exist in `apps/<game>/`)**

1. Summarize what's changed vs last commit.
2. Map those changes to the current milestone's checklist.
3. Ask the user: "continue M<n> implementation from here, run gates on current state, or revert?"
4. Based on answer, either keep implementing, jump to gates (step 5 in `build-next-milestone`), or stop.

**Mode B — clean tree, milestone incomplete**

Dispatch to the [build-next-milestone prompt](./build-next-milestone.prompt.md). Execute it end-to-end.

**Mode C — game feature-complete**

Report: every milestone done, coverage boxes all ticked. Suggest next steps (post-production polish pass, localization audit, store-page screenshots, device bench capture).

## Constraint

Never commit. Never push. Always hand commit messages to the user.
