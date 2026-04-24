# `.claude/skills/` — pass-through stubs

This directory holds **stubs only**. The real skill content lives once under [`.github/skills/`](../../.github/skills/).

## Why stubs

- Claude Code discovers skills by scanning `.claude/skills/<name>/SKILL.md` and reading each one's frontmatter (name + description) at session start — that's level-1 progressive disclosure.
- When Claude decides a skill is relevant, it follows the pointer in the stub body to load the full `.github/skills/<name>/SKILL.md` content — level-2 progressive disclosure.
- This keeps both Copilot and Claude Code reading the same one file, with zero duplication.

## Invariants

- **Edit `.github/skills/<name>/SKILL.md`, never the stub.** The stub only mirrors the frontmatter.
- When a skill's `description` changes, update the stub frontmatter too (single `description` line — Claude discovers the skill from that text).
- When a new skill is added under `.github/skills/<name>/`, add a matching stub at `.claude/skills/<name>/SKILL.md`. Remove the stub if the skill is removed.
- Stub content is a single pointer line — do not paste rules, examples, or code into the stub.

## Format

```markdown
---
name: flare-<name>
description: <mirror of .github/skills/flare-<name>/SKILL.md description>
---

Full skill content: [.github/skills/flare-<name>/SKILL.md](../../../.github/skills/flare-<name>/SKILL.md).
```

## Architect checklist

The `architect` agent should run `.claude/skills/` parity checks as part of any environment audit:
- every `.github/skills/<name>/` has a stub
- every stub description matches the source
- no stub contains rules content
