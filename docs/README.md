# Flare Documentation

Entry point for everything under `docs/`. Each subdirectory has a distinct purpose — reach for the right one first.

## Layout

| Folder                     | Purpose                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [design/](design/)         | Canonical design — architecture, API contracts, dependency rationale, ecosystem landscape, native strategy. **Source of truth for the public API surface.** |
| [plans/](plans/)           | Forward-looking execution plans. The active roadmap lives here; completed phase details move to archival over time.                                         |
| [references/](references/) | Living reference material: benchmarks, CanvasKit parity audit, CLI tooling background.                                                                       |
| [conventions/](conventions/) | Code style and git conventions the builders and the gate enforce.                                                                                          |
| [recipes/](recipes/)       | Task-shaped how-tos for consumers (save migrations, and more as they are written).                                                                           |
| [history/](history/)       | Archived plans kept for provenance, not for execution.                                                                                                       |

## Files

### design/

- [api-specs.md](design/api-specs.md) — **Canonical.** Per-package public API tables. Divergence from code is treated as a spec bug.
- [architecture.md](design/architecture.md) — Layer diagram, dependency flow, game-loop order, rendering pipeline, tooling rationale.
- [dependencies.md](design/dependencies.md) — External + peer dep rationale, ECS / physics / audio library comparisons.
- [ecosystem.md](design/ecosystem.md) — Competitive landscape: RN gaming, web TS engines, shipped RN games.
- [native-acceleration.md](design/native-acceleration.md) — Phase-10 strategy for Nitro C++ modules (data-gated, post-Phase-8 benchmarks).
- [lighting-2-5d.md](design/lighting-2-5d.md) — 2.5D lighting strategy: SkSL RuntimeEffect on the existing Skia stack, not WebGPU.

### plans/

- [roadmap.md](plans/roadmap.md) — Phase-by-phase roadmap through the October 2026 OSS launch.
- [todo.md](plans/todo.md) — the next-work queue. `/start` picks from the top of `## Active`.
- [road-to-oss-2026-09.md](plans/road-to-oss-2026-09.md) — **the launch SoT**: row specs, freeze protocol, flip sequencing.
- [Pan Tvardowski](https://github.com/grzott/Pan-Tvardowski) — the canonical showcase game (Polish-folklore shmup), in its own repo since 2026-06-10.

### references/

- [benchmarks.md](references/benchmarks.md) — Microbench + device FPS results (regenerated from `benchmarks/results/`).
- [canvaskit-parity.md](references/canvaskit-parity.md) — Audit of CanvasKit web parity for every Skia API Flare uses.
- [cli-image-tooling.md](references/cli-image-tooling.md) — Tooling background for `@flare-engine/cli` (sharp + maxrects-packer decisions).
- [pan-tvardowski/](references/pan-tvardowski/) — showcase-game reference material kept for engine context.

### conventions/ · recipes/ · history/

- [conventions/code.md](conventions/code.md) · [conventions/git.md](conventions/git.md) — the rules the gate enforces.
- [recipes/save-migrations.md](recipes/save-migrations.md) — versioned save files with `@flare-engine/storage`.
- [history/build-plan-archive.md](history/build-plan-archive.md) — archived build plan; provenance only.

## See also

- [AGENTS.md](../AGENTS.md) — conventions, commands, architecture summary (root of the repo).
- [CONTRIBUTING.md](../CONTRIBUTING.md) — how to contribute.
- [.claude/agents/](../.claude/agents/) — builder subagents (`engine-builder`, `game-builder`).
- [.claude/skills/](../.claude/skills/) — workflow + domain skills (start/close, game-dev, scaffolder, tier-2 stubs).
