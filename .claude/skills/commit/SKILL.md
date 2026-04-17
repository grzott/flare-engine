---
name: commit
description: Draft and create a conventional commit for staged/unstaged Flare changes, following .claude/rules/git.md
argument-hint: "[optional: scope hint or message override]"
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*)
---

Create a conventional commit for the current changes in the Flare engine.

## Pre-flight

1. Run `git status` and `git diff` to see what will be committed.
2. Run `git log -5 --oneline` to match the repo's existing style.
3. Do **NOT** stage or commit: `.env*`, `credentials.*`, `CLAUDE.local.md`, `.claude/settings.local.json`, or any file matching a secret-looking name. If the user has such a file modified, warn them explicitly before proceeding.

## Message format

Follow [.claude/rules/git.md](.claude/rules/git.md):

`type(scope): description`

- **type**: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`, `build`
- **scope**: the `@flare/*` package name without the `@flare/` prefix — e.g. `math`, `physics`, `engine`. For cross-cutting changes use `monorepo`.
- **description**: imperative mood, lowercase, no trailing period, total line ≤ 72 chars.
- No emoji. No narration of *what* the code does — the diff says that. Body (optional) is for the *why*.

## Process

1. Decide scope. If the diff spans multiple packages, pick the dominant one or use `monorepo`.
2. Stage only the files the user clearly intends to commit. Prefer `git add <path>` over `git add -A` to avoid sweeping up stray files.
3. Draft the message.
4. Create the commit using a HEREDOC so the body formats correctly:

```bash
git commit -m "$(cat <<'EOF'
type(scope): description

Optional body explaining the *why* when non-obvious.
EOF
)"
```

5. Run `git status` to confirm the commit landed cleanly and the working tree is in the expected state.

## Do not

- Do not amend existing commits unless explicitly asked.
- Do not force-push, push to remote, or create branches — this skill commits only.
- Do not pass `--no-verify` or bypass hooks.
- Do not create a commit if there is nothing staged after step 2 — report back instead.
