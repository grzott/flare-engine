# Git Conventions

## Commit format

Conventional Commits, subject-only, single-line, ≤72 chars, lowercase, no trailing period, no emoji, no body.

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`.
Scope: package name (e.g. `math`), game name (`pan-tvardowski`), or area (`docs`, `plans`).

Examples:
```
feat(math): add Vec2.normalizeOut zero-alloc helper
test(postfx): cover triggerTimed enable, expiry, retrigger
docs(api-specs): add createBootTrace under @flare-engine/debug
refactor(pan-tvardowski): wire budget + postfx to engine APIs
```

## Constraints

- Never include `Co-Authored-By: Claude` trailer. Repo convention is single-author commits.
- Subject describes WHY the change matters, not just WHAT changed. Imperative mood ("add", "fix", "refactor", not "added" or "fixes").
- Split by concern: separate `feat` / `test` / `docs` commits when changes span concerns.
- Never amend a published commit. Create a new commit instead.

## Workflow

Builders never run `git add` / `git commit` / `git push` — these are blocked in `.claude/settings.json` and the `pre-bash-guard.sh` hook.

`/close` emits paste-ready commit blocks via `.claude/hooks/verify.sh`. The user runs them.

If a commit hook fails, fix the underlying issue, re-stage, create a NEW commit. Never use `--no-verify`.

## Branches

- Main branch: `main`.
- Feature work happens directly on `main` for solo development (current state). Branching strategy revisits when contributors join.
