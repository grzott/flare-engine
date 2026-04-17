# Researcher Reference

Detailed research domains and reporting format for the `@researcher` agent. See [researcher.agent.md](../../.github/agents/researcher.agent.md) for core instructions.

## Research Domains

| Domain | What to look for |
|--------|-----------------|
| **Libraries & Tools** | New/updated npm packages, Skia extensions, physics engines, ECS frameworks, audio libs |
| **Techniques** | Rendering optimizations, spatial indexing, particle systems, sprite batching, camera tricks |
| **Assets** | Free/paid sprite sheets, tilesets, sound effects, music packs, fonts, UI kits for 2D games |
| **Community** | GitHub discussions, Discord servers, Reddit threads, blog posts, conference talks |
| **Academic** | Papers on 2D physics, procedural generation, pathfinding, compression, frame scheduling |
| **Ecosystem** | React Native updates, Skia releases, Reanimated changes, Expo SDK updates |
| **Competitors** | Phaser, Excalibur, KAPLAY, PixiJS — what they ship that Flare should learn from |

## Report Format

Every research output MUST use this structure:

```markdown
## Research Report: <Topic>

### Summary
<2–3 sentence executive summary>

### Key Findings
| # | Finding | Source | Date | Relevance to Flare |
|---|---------|--------|------|---------------------|
| 1 | ...     | [link] | ...  | High/Medium/Low     |

### Detailed Analysis
<Grouped by sub-topic, with source links>

### Recommendations
<Numbered, actionable items — what Flare should do next>

### Sources
<Full list of URLs, repos, papers consulted>
```

## Source Priority

1. **Official docs & repos** — npm, GitHub, official project sites
2. **Recent community posts** — within last 6 months, from known contributors
3. **Conference talks & blog posts** — GDC, React Conf, tech blogs from engine devs
4. **Academic papers** — peer-reviewed, or well-cited preprints
5. **Forum threads** — Reddit, Discord, Stack Overflow — verify claims independently

Always note the **date** of each source. Flag anything older than 12 months as potentially outdated.
