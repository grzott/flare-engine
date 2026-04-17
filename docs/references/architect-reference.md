# Architect Reference

Detailed workflows for the `@architect` agent. See [architect.agent.md](../../.github/agents/architect.agent.md) for core instructions.

## Audit Workflow

### 1. Audit Phase

Scan the workspace for all customization primitives:

```
.github/copilot-instructions.md    → workspace instructions
.github/agents/*.agent.md          → custom agents
.github/instructions/*.instructions.md → file instructions
.github/prompts/*.prompt.md        → prompt files
.github/skills/*/SKILL.md          → agent skills
.github/hooks/*.json               → lifecycle hooks
AGENTS.md, CLAUDE.md               → cross-agent instructions
```

For each file found:

- Verify YAML frontmatter is valid (no unescaped colons, no tabs, proper quoting)
- Check descriptions are keyword-rich and specific (not vague like "a helpful agent")
- Verify `applyTo` patterns are scoped (not `**` unless truly universal)
- Check tool lists follow least-privilege (no excess tools)
- Identify role confusion (description doesn't match body)
- Check for circular handoffs or Swiss-army agents

Report findings as a structured audit table.

### 2. Research Phase

When the user asks to create or improve customizations, research current best practices:

- Fetch VS Code Copilot customization docs
- Check community examples from awesome-copilot
- Check skill spec compliance from agentskills.io

Synthesize findings into actionable recommendations.

### 3. Design Phase

**Always present a plan before creating or modifying files.** The plan must include:

- What primitive type (agent/instruction/prompt/skill/hook)
- File location and name
- Frontmatter configuration with rationale
- Body outline
- Which anti-patterns it avoids
- How it integrates with existing customizations

Wait for user approval before proceeding.

### 4. Implement Phase

Create or modify files following the conventions for each type:

- **Agents**: Single role, minimal tools, keyword-rich description, clear constraints
- **Instructions**: Scoped `applyTo`, short self-contained rules, concrete examples
- **Prompts**: Set correct `agent:`, use `tools:` to restrict, step-by-step body
- **Skills**: Name matches directory, progressive disclosure, body < 500 lines

### 5. Validate Phase

After creating any file:

- Verify YAML frontmatter parses correctly
- Check file is in the correct location for its type
- Confirm description contains discovery keywords
- Cross-reference with existing files for conflicts or overlaps
- Suggest a test prompt to verify the customization works

## Anti-Pattern Checklist

| Anti-Pattern      | Check                                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| Swiss-army agent  | Does the agent try to do too many different things?                      |
| Vague description | Would another agent know when to delegate to this one?                   |
| Role confusion    | Does the description match what the body actually instructs?             |
| Circular handoffs | Can A → B → A happen without progress criteria?                          |
| Context burn      | Does `applyTo: "**"` load instructions into every request unnecessarily? |
| Tool excess       | Does the agent have tools it doesn't need for its role?                  |
| Duplicate rules   | Are the same instructions repeated across multiple files?                |
| Silent failures   | Could unescaped YAML colons or tab characters break the frontmatter?     |

## Prompt Engineering Principles

1. **Be specific over general** — "Use `date-fns`" beats "use a good date library"
2. **Show, don't tell** — code examples > abstract descriptions
3. **State constraints explicitly** — "DO NOT" sections prevent drift
4. **Include reasoning** — "because moment.js is deprecated" helps LLMs handle edge cases
5. **Use structured formats** — tables, numbered steps, code blocks improve parsing
6. **Keyword-load descriptions** — the description is the discovery surface
7. **Progressive disclosure** — surface-level first, details on demand
8. **Test with adversarial prompts** — what happens when the user asks something ambiguous?
