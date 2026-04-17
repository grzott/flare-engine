---
description: "Design and create a new instructions file — defines coding conventions scoped to file patterns or universal rules"
agent: architect
tools: [read, search, edit, web]
---

# Create an Instructions File

Design and implement a new `.instructions.md` file following best practices.

## Step 1 — Discover Existing Instructions

Scan `.github/instructions/` and `.github/copilot-instructions.md` for all existing rules. Identify gaps and avoid duplicates.

## Step 2 — Determine Scope

Ask (if unclear):
- **What rules?**: What coding conventions or guidelines should this enforce?
- **Which files?**: What `applyTo` glob pattern scopes these rules? (e.g., `**/*.ts`, `packages/math/**`, `**/*.test.ts`)
- **Why?**: What's the reasoning behind each rule? (include this — it helps the LLM handle edge cases)

**Critical**: Never use `applyTo: "**"` unless the rules truly apply to every file in the workspace. Overly broad patterns waste context on every request.

## Step 3 — Draft the Instructions

```markdown
---
description: "<what these rules cover>. Applied when working on <scope description>."
applyTo: "<specific glob pattern>"
---

# <Category> Rules

## <Section 1>
- <Rule with reasoning>
- <Rule with code example>

## <Section 2>
- <Rule>
```

**Writing rules**:
- One statement per rule — short and self-contained
- Include reasoning: "Use X because Y is deprecated and increases bundle size"
- Show concrete code examples for non-obvious patterns
- Don't duplicate what linters/formatters enforce
- Focus on non-obvious decisions that the AI wouldn't know from context alone

## Step 4 — Validate

- [ ] `applyTo` is scoped to specific files/folders (not `**`)
- [ ] Description accurately describes the scope
- [ ] Rules include reasoning behind non-obvious conventions
- [ ] No duplication with `copilot-instructions.md` or other `.instructions.md` files
- [ ] Code examples are concrete and correct
- [ ] YAML frontmatter is valid

## Step 5 — Save

Save to `.github/instructions/<name>.instructions.md` and confirm the `applyTo` pattern matches the intended files.
