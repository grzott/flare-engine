---
description: "Git commit and branch conventions for Flare engine"
---

# Git Conventions

## Commit Messages
- Format: `type(scope): description` — max 72 chars, no emoji
- Scope = package name: `feat(math): add Vec2.lerp`
- Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`, `build`
- Body is optional; use for non-obvious motivation
- Co-author line when Claude writes the commit

## Branch Names
- Feature: `feat/<short-description>`
- Fix: `fix/<short-description>`
- Use kebab-case, no spaces

## Versioning
- SemVer via Changesets — independent versioning per package
- Add a changeset (`bun changeset`) for any user-facing change
- Patch: bug fix, Minor: new feature, Major: breaking change

## What NOT to commit
- `.claude/settings.local.json`
- `CLAUDE.local.md`
- `.env` files
- Build artifacts (`dist/`, `*.tsbuildinfo`)
