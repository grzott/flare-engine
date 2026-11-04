# Flare Roadmap

Flare is a 2D engine that runs the same code on Web and React Native: animation, gamification,
interactive UI, and games. This page says where the engine stands and how its work is tracked. The
work itself lives in [GitHub issues](https://github.com/grzott/flare-engine/issues).

## Where things stand

- **Public since 2026-10-26.** The repo and all 42 scoped `@flare-engine/*` packages are public;
  every release since `0.4.5` is published from CI with npm provenance, and since `0.4.6` through npm
  Trusted Publishing. Read [CHANGELOG.md](../../CHANGELOG.md) for the current version.
- **One version line.** The 42 packages move in lockstep (Changesets `fixed`). The `0.4.x` line takes
  patches; breaking changes wait for `0.5.0`, each behind an accepted ADR
  ([versioning-and-announcements.md](versioning-and-announcements.md)).
- **Architecture.** Layered packages with downward-only dependencies. The tier map lives once, in
  [architecture.md](../design/architecture.md#layer-diagram); the rule is stated in
  [AGENTS.md](../../AGENTS.md) and enforced by `bun run check:deps`. The API contract is
  [api-specs.md](../design/api-specs.md).
- **Consumers.** [flareengine.dev](https://flareengine.dev) runs three playable demos and five
  animations on the published packages in the browser. Pan Tvardowski, a private game in alpha,
  consumes the engine from npm on Android. What consumers asked for is recorded in the
  `docs/plans/*-needs-*.md` documents.

## How work is tracked

- **One issue, one PR.** Every piece of engine work is an issue with a type, a scope, a size and a
  priority label, in a milestone.
- **The owner approves a phase** by labelling its issues `status:ready`. `/start next` takes the next
  approved issue in milestone due-date order and opens one PR on a `claude/*` branch.
- **PRs merge through the gate:** `ci` and `risk-gate` must pass; held changes
  ([risk-policy.json](../../.github/risk-policy.json)) wait for the owner.
- **History:** merged PR descriptions. `todo.md` was the queue until 2026-11-04; its last full
  version is `f5464ae`, and `SESSION_LOG.md` is frozen as of 2026-10-30.

## Milestones

| Milestone | Due | What it holds |
| --- | --- | --- |
| [Release health](https://github.com/grzott/flare-engine/milestone/2) | 2026-11-19 | The token teardown and the bench baselines before the 30-day refusal |
| [Deferred defects](https://github.com/grzott/flare-engine/milestone/3) | 2026-12-18 | Consumer-visible defects held past the October freeze, and the CI gaps |
| [Post-release verification](https://github.com/grzott/flare-engine/milestone/4) | 2027-01-15 | The npm install path, fresh machines, Expo SDK 58 templates |
| [Hygiene](https://github.com/grzott/flare-engine/milestone/5) | 2027-01-29 | Audit findings, one issue per finding |
| [Consumer asks](https://github.com/grzott/flare-engine/milestone/6) | 2027-02-12 | Additive features a named consumer asked for |
| [Perf](https://github.com/grzott/flare-engine/milestone/7) | 2027-02-12 | Benchmark suites, device lanes, perf-protocol automation |
| [Adoption basics](https://github.com/grzott/flare-engine/milestone/8) | 2027-02-26 | Quickstart, recipes, first issues, Discussions |
| [0.5.0](https://github.com/grzott/flare-engine/milestone/9) | 2027-03-31 | The breaking changes held back during `0.4.x`, each behind an ADR |

Due dates are targets, not promises; the owner moves them.

## Epics

Larger work with no milestone yet. Each item becomes its own issues once it has a design and, for a
new module, a named consumer.

- [#180](https://github.com/grzott/flare-engine/issues/180) Desktop builds and Steam (ADR-0005,
  [desktop-steam-2026-09.md](desktop-steam-2026-09.md)).
- [#181](https://github.com/grzott/flare-engine/issues/181) Devtools inspector, typed manifests, docs
  playground.
- [#182](https://github.com/grzott/flare-engine/issues/182) Engine modules waiting for a named
  consumer ([roadmap-post-flip.md](roadmap-post-flip.md)).

## Records

- The launch: [road-to-oss-2026-09.md](road-to-oss-2026-09.md), [flip-runbook.md](flip-runbook.md),
  [manual-test-protocol.md](manual-test-protocol.md).
- Engine phases 0–9: [docs/history/build-plan-archive.md](../history/build-plan-archive.md).
- Conventions: [AGENTS.md](../../AGENTS.md). Design decisions: the ADRs in [docs/design](../design).
