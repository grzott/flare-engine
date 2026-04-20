---
description: "Audit the AI development environment — scan all agents, instructions, prompts, skills, and hooks for gaps, anti-patterns, and optimization opportunities"
agent: architect
tools: [read, search, web, todo]
---

# Audit AI Development Environment

Perform a comprehensive audit of this workspace's AI customization setup.

## Step 1 — Inventory

Scan and list ALL customization files in the workspace:

- `.github/copilot-instructions.md`
- `.github/agents/*.agent.md`
- `.github/instructions/*.instructions.md`
- `.github/prompts/*.prompt.md`
- `.github/skills/*/SKILL.md`
- `.github/hooks/*.json`
- `AGENTS.md` (root)

For each file, extract: name, type, description, tools, applyTo patterns.

## Step 2 — Quality Check

For each file, evaluate:

| Check                                                               | Pass/Fail |
| ------------------------------------------------------------------- | --------- |
| YAML frontmatter is valid (no tabs, escaped colons, proper quoting) |           |
| Description is keyword-rich and specific                            |           |
| `applyTo` is scoped (not `**` unless justified)                     |           |
| Tool list follows least-privilege                                   |           |
| No role confusion (description matches body)                        |           |
| No duplicate rules across files                                     |           |
| No circular handoffs                                                |           |
| No Swiss-army agents (too many responsibilities)                    |           |

## Step 3 — Gap Analysis

Identify what's MISSING by comparing against best practices:

- Are there agents for common workflows? (planning, reviewing, testing, deploying)
- Are language/framework-specific instructions scoped with `applyTo`?
- Are common tasks captured as prompts or skills?
- Are lifecycle hooks being used for formatting/validation?
- Is there a handoff chain for multi-step workflows?

## Step 4 — Research Latest Practices

Fetch the latest recommendations from:

- VS Code Copilot customization docs
- awesome-copilot community repo
- agentskills.io specification

Compare current setup against community patterns.

## Step 5 — Report

Present findings as a structured report:

### Summary

- Total files audited
- Issues found (critical / warning / info)
- Coverage score (what percentage of recommended primitives exist)

### Findings Table

| File | Type | Status | Issues | Recommendation |
| ---- | ---- | ------ | ------ | -------------- |

### Recommended Actions (prioritized)

1. [Quick wins — fix existing issues]
2. [Medium effort — add missing coverage]
3. [Long term — advanced patterns like handoff chains, skills]

Ask the user which actions to proceed with.
