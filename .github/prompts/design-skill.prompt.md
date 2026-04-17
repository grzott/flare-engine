---
description: "Design and create a new agent skill — packages instructions, scripts, and resources into a portable, discoverable capability"
agent: architect
tools: [read, search, edit, web]
---

# Create an Agent Skill

Design and implement a new `SKILL.md` following the agentskills.io specification and VS Code conventions.

## Step 1 — Discover Existing Skills

Scan `.github/skills/` for all existing skills. List their names and descriptions to avoid overlap.

## Step 2 — Design the Skill

Determine (ask user if unclear):
- **What capability?**: What specialized task does this skill teach?
- **When invoked?**: What user prompts or context should trigger this skill?
- **What resources?**: Does it need scripts, templates, examples, or reference docs?
- **Slash command?**: Should it appear in the `/` menu? (`user-invocable: true/false`)

## Step 3 — Create Directory Structure

```
.github/skills/<skill-name>/
├── SKILL.md           # Required: metadata + instructions
├── scripts/           # Optional: executable code
├── references/        # Optional: detailed docs (loaded on demand)
└── assets/            # Optional: templates, schemas
```

**Naming**: `<skill-name>` must be lowercase, hyphens only, no consecutive hyphens, 1-64 chars. Directory name MUST match `name:` field.

## Step 4 — Write SKILL.md

```markdown
---
name: "<skill-name>"
description: "<What it does AND when to use it>. Use when <trigger phrase 1>, <trigger phrase 2>."
---

# <Skill Name>

## Overview
<Brief description of the capability>

## Steps
1. <Step one>
2. <Step two>
3. <Step three>

## Examples
<Input/output examples>

## Edge Cases
<Common issues and how to handle them>

## Resources
- [Reference guide](references/REFERENCE.md) for detailed specs
- [Template](assets/template.ts) for scaffolding
```

**Progressive disclosure**:
- Frontmatter `name` + `description` ≈ 100 tokens (loaded at startup for ALL skills)
- `SKILL.md` body < 500 lines / < 5000 tokens (loaded when skill is activated)
- Referenced files in `scripts/`, `references/`, `assets/` loaded only on demand

## Step 5 — Validate

- [ ] `name` matches directory name exactly
- [ ] `name` is lowercase, hyphens only, no consecutive hyphens
- [ ] `description` includes both capabilities AND trigger keywords
- [ ] Body is under 500 lines
- [ ] All referenced files exist and use relative paths
- [ ] File references are one level deep (no deeply nested chains)
- [ ] Compliant with agentskills.io specification

## Step 6 — Save and Test

Save to `.github/skills/<skill-name>/SKILL.md`, suggest a `/skill-name` test prompt, and verify it appears in the skills list.
