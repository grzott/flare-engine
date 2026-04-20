---
description: "Git commit and branch conventions for Flare engine. Applied to every commit / PR description."
applyTo: "**"
---

# Git Conventions

## Commit Messages

- Format: `type(scope): description` — max 72 chars, no emoji in subject
- Scope = package name without `@flare-engine/`: `feat(math): add Vec2.lerp`. Cross-cutting = `monorepo`.
- Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`
- Imperative mood, lowercase, no trailing period
- Body is optional — use it for the _why_, not the _what_ (the diff shows _what_)
- Breaking changes: `feat(ecs)!: rename World.add to World.spawn` or `BREAKING CHANGE:` in body

## Branch Names

- Feature: `feat/<short-description>`
- Fix: `fix/<short-description>`
- Use kebab-case, no spaces

## Versioning

- SemVer via Changesets — independent versioning per package
- Add a changeset (`bun changeset`) for any user-facing change
- Patch: bug fix · Minor: new feature · Major: breaking change

## What NOT to commit

- `.env*` files, anything matching a secret-looking name
- Build artifacts (`dist/`, `*.tsbuildinfo`, `.turbo/`, `coverage/`)
- Local editor / tool overrides
