---
description: "Design and create a new custom agent — walks through role definition, tool selection, constraints, and validation"
agent: architect
tools: [read, search, edit, web, todo]
---

# Create a Custom Agent

Design and implement a new `.agent.md` file following best practices.

## Step 1 — Discover Existing Agents

Scan `.github/agents/` for all existing agents. List their roles and tool sets to avoid overlap.

## Step 2 — Define the Role

Determine (ask user if unclear):
- **Job**: What single focused task does this agent perform?
- **When**: What trigger phrases should invoke this agent? (these go in `description`)
- **Tools**: What's the MINIMUM tool set needed? Start with `[read, search]` and add only what's justified.
- **Boundaries**: What should this agent explicitly NOT do?
- **Handoffs**: Should this agent hand off to another agent after completing its task?

## Step 3 — Draft the Agent

Create the `.agent.md` file with this structure:

```markdown
---
description: "<role summary> — <what it does>. Use when: <trigger phrase 1>, <trigger phrase 2>, <trigger phrase 3>"
tools: [<minimal set>]
model: "<if needed>"
agents: [<allowed subagents or omit>]
handoffs:
  - label: "<next step>"
    agent: <target>
    prompt: "<context to pass>"
    send: false
---

You are a **<role>**. Your job is to <clear purpose>.

---

## Approach
1. <Step one>
2. <Step two>
3. <Step three>

## Constraints
- DO NOT <thing this agent should never do>
- DO NOT <another restriction>
- ONLY <the one thing this agent does>

## Output Format
<What this agent returns>
```

## Step 4 — Validate

Check the draft against the anti-pattern checklist:
- [ ] Single responsibility? (not a Swiss-army agent)
- [ ] Description has specific trigger keywords?
- [ ] Minimal tool set? (no excess tools)
- [ ] Clear constraints section?
- [ ] No role confusion? (description matches body)
- [ ] No circular handoffs?
- [ ] YAML frontmatter is valid?

## Step 5 — Save and Test

Save the file to `.github/agents/<name>.agent.md` and suggest a test prompt the user can try to verify it works correctly.
