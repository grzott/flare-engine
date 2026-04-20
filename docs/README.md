# Flare Documentation

Entry point for everything under `docs/`. Each subdirectory has a distinct purpose — reach for the right one first.

## Layout

| Folder                     | Purpose                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [design/](design/)         | Canonical design — architecture, API contracts, dependency rationale, ecosystem landscape, native strategy. **Source of truth for the public API surface.** |
| [plans/](plans/)           | Forward-looking execution plans. The active roadmap lives here; completed phase details move to archival over time.                                         |
| [references/](references/) | Living reference material: benchmarks, agent playbooks, CanvasKit parity audit, CLI tooling background.                                                     |

## Files

### design/

- [api-specs.md](design/api-specs.md) — **Canonical.** Per-package public API tables. Divergence from code is treated as a spec bug.
- [architecture.md](design/architecture.md) — Layer diagram, dependency flow, game-loop order, rendering pipeline, tooling rationale.
- [dependencies.md](design/dependencies.md) — External + peer dep rationale, ECS / physics / audio library comparisons.
- [ecosystem.md](design/ecosystem.md) — Competitive landscape: RN gaming, web TS engines, shipped RN games.
- [native-acceleration.md](design/native-acceleration.md) — Phase-10 strategy for Nitro C++ modules (data-gated, post-Phase-8 benchmarks).

### plans/

- [build-plan.md](plans/build-plan.md) — Phase-by-phase roadmap through the October 2026 OSS launch.

### references/

- [architect-reference.md](references/architect-reference.md) — Audit workflow + anti-pattern checklist for the `@architect` agent.
- [builder-reference.md](references/builder-reference.md) — Current package status + verification protocol for the `@builder` agent.
- [researcher-reference.md](references/researcher-reference.md) — Research domains + report format for the `@researcher` agent.
- [benchmarks.md](references/benchmarks.md) — Microbench + device FPS results (regenerated from `benchmarks/results/`).
- [canvaskit-parity.md](references/canvaskit-parity.md) — Audit of CanvasKit web parity for every Skia API Flare uses.
- [cli-image-tooling.md](references/cli-image-tooling.md) — Tooling background for `@flare-engine/cli` (sharp + maxrects-packer decisions).

## See also

- [AGENTS.md](../AGENTS.md) — conventions, commands, architecture summary (root of the repo).
- [CONTRIBUTING.md](../CONTRIBUTING.md) — how to contribute.
- [.github/agents/](../.github/agents/) — custom Copilot agents (`@builder`, `@architect`, `@researcher`).
- [.github/instructions/](../.github/instructions/) — file-scoped coding rules.
- [.github/skills/](../.github/skills/) — per-package discovery skills.
