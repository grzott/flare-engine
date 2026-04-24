---
description: Resume in-flight Flare game work — detects the active game + unfinished milestone from git status and the build plan, then continues implementation or dispatches to /build-next-milestone. Routes to game-builder.
---

# /continue-game

Resume work on a Flare game app via the `game-builder` agent.

Full protocol lives in [.github/prompts/continue-game.prompt.md](../../.github/prompts/continue-game.prompt.md) — this command loads it and dispatches.

## Protocol

1. Read git state (`git status --short`, `git log --oneline -n 10`) to identify the active `apps/<game>/`.
2. Open `docs/plans/<game>-build-plan.md` — find the lowest milestone with unticked engine-coverage checkboxes.
3. Verify doc ↔ code consistency per [.github/instructions/status-sync.instructions.md](../../.github/instructions/status-sync.instructions.md). On contradiction, halt and surface.
4. Decide mode:
   - If code for the target milestone is partially written → resume (match existing patterns, finish the milestone).
   - If the last milestone is clean and the next has no work in progress → dispatch `/build-next-milestone`.
5. Emit commit blocks when done. Never commit.
