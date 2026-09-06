# Pre-flip full-repo audit — 2026-09

**Status:** APPROVED 2026-09-06, not yet executed. Runs in its own session, after the
2026-09-06 benchmark capture window closes.

Owner-approved scope, sequencing and cost strategy for the last broad audit before the
October 2026 public flip. This file is the source of truth for **how the audit runs**; the
audit's *findings* land in the deliverables listed in §6, and its *rows* land in `todo.md`.

Launch SoT remains [road-to-oss-2026-09.md](road-to-oss-2026-09.md). This audit feeds it; it
does not replace it.

---

## 0. Fixed decisions (owner, 2026-09-06 — do not relitigate in-row)

| # | Decision | Consequence |
|---|---|---|
| D1 | **Audit + plans only. Zero `packages/**` edits.** | Every code finding becomes a `todo.md` row, executed later behind the normal per-row gate. The audit never touches src. |
| D2 | **Arc HYG stays post-flip.** | SOLID/DRY/YAGNI/KISS findings are *specced now, executed after the flip*. **Exception:** anything that changes the published API surface is pulled pre-freeze, because npm does not take a publish back. |
| D3 | **Docs split public/internal + stable manifest.** | Consumer-facing docs separate from internal ones (plans, audits, session logs), plus a versioned manifest + frontmatter contract that `flare-engine-page` consumes mechanically rather than heuristically. |
| D4 | **Deep audit, adversarially verified.** | ~90–120 agents. High-severity findings get 3 perspective-diverse refuters; medium 1; low ships explicitly labelled unverified rather than silently dropped. |

## 1. Cost strategy — why no model switch is needed

All fan-out agents run `model: 'fable'` via the Workflow `agent()` per-call override. Fable
bills a **separate weekly bucket** from the Opus one, and that bucket was at **0% used** on
2026-09-06 while the Opus bucket was at 20%.

Switching the *session* model to Fable would be strictly worse: it would put orchestration
and synthesis on Fable too, spending more Fable tokens for weaker synthesis. Keep the session
on Opus; let the workflows spend the empty bucket.

## 2. Standing constraints

- **The orchestrator owns every file write.** Workflow agents are strictly read-only finders
  and verifiers returning structured JSON. Enforced because agents with `Write` have
  previously roamed into sibling repos, and `Pan-Tvardowski` + `flare-engine-page` sit
  adjacent on disk.
- **Never overlaps a benchmark capture window.** 100+ agents running `grep`/`find` across 41
  packages is not a quiet machine, and a loaded capture is untrustworthy on this box.
- **Synthesis happens in the main loop, never inside a schema-constrained agent.** Large
  combined JSON into a structured-output agent blows the retry cap.
- Findings are deduped **across shards** before verification — the same DRY violation spanning
  `render` and `render-web` must collapse to one finding.

## 3. Prior art this audit must reconcile with, not duplicate

| Source | Standing |
|---|---|
| [external-review-2026-08.md](external-review-2026-08.md) | 52 KB external pre-flip review; **Arc XR is actively remediating it**. Audit must not re-report what XR already owns. |
| [engine-deep-audit-2026-07.md](engine-deep-audit-2026-07.md) | 34-agent code audit, superseded-as-queue by road-to-oss. Cross-check before filing anything as new. |
| `todo.md` Arc HYG | Already exists, already scoped post-flip. The audit **populates** it precisely; per D2 it does not pull it forward wholesale. |

## 4. Scale (measured 2026-09-06)

- 41 scoped packages + `create-flare-app`; **279 src files, ~29.9k LOC**; 233 test files.
- Plan corpus **~1.1 MB across 25 files**; `todo.md` alone **487 KB / 1685 lines / 14 arcs**.

## 5. The four workflows

Run **W1 and W2 concurrently** (fully independent), **W3** after, **W4** last since it
consumes W1+W2 output. Read results between each — that is the point of splitting them.

### W1 — Code audit (areas 1·2·3) — ~15 finders + adaptive verify

5 package shards by tier × 3 lenses: correctness-bug, perf/zero-alloc-hot-path, and
SOLID/DRY/YAGNI/KISS. Cross-shard dedup in-script (a genuine barrier). Then adaptive
verification per D4. Every finding carries a `preFlip | postFlipHYG` tag decided by one rule:
**does it change the published API surface.**

### W2 — Plans + docs corpus audit (areas 4·5·6·7) — ~20 agents

Shard readers over all 25 plan files. The load-bearing agent **cross-checks claimed-DONE rows
against actual git history and code** — an arc marked done that is not is the most dangerous
thing in a pre-flip corpus. Plus one-source-per-fact violation hunting across the 1.1 MB, and
the public/internal split + manifest proposal (D3).

### W3 — Post-flip roadmap panel (area 8) — ~12 agents

4 independent proposers on distinct angles (extensibility-first, ecosystem/plugin-first,
perf-ceiling-first, content-pipeline-first); 3 judges scoring modularity, feasibility against
the 8-tier architecture, and YAGNI; grounding agents that read real code before costing
anything. Every output is a **standalone module track** — owner constraint: "it must be a
module, clearly in ROADMAP".

Seed topics (owner's list, 2026-09-06):

- Lift the **32-component ECS limit** to 128 or unlimited — see §7, already grounded.
- **Plugin API** for authoring pipelines: Blender, ComfyUI.
- **2D asset generation/modification plugins** — concretely, generating ship left/right
  movement-state frames from a single static sprite so movement reads smoother (the Pan
  Tvardowski ship is the motivating case).
- **PostFX authoring** surface.
- Anything else that helps someone build a game, provided it ships as a module.

### W4 — Pre-flip checklist reconciliation (area 9) — ~10 agents

Reconciles [flip-runbook.md](flip-runbook.md), road-to-oss §11/§12,
[manual-test-protocol.md](manual-test-protocol.md), Arc XR status, and W1/W2 output into one
ordered list, splitting **owner-only actions from agent work** and flagging contradictions
between those four existing sources. Ends with a completeness critic.

## 6. Deliverables

| Artefact | Content |
|---|---|
| `docs/plans/pre-flip-audit-2026-09-findings.md` | Verified findings SoT (W1+W2), each tagged `preFlip`/`postFlipHYG` and severity-rated. |
| `docs/plans/roadmap-post-flip.md` | Area 8 — the post-flip module tracks (W3). |
| `docs/history/` | Completed plans archived out of `docs/plans/`. |
| `docs/plans/todo.md` + `roadmap.md` | Rewritten arc sections; audit rows seeded in execution order. |
| docs public/internal split + manifest contract | D3 — the contract `flare-engine-page` builds its auto-pipeline against. |

## 7. Grounded fact — the 32-component limit (verified 2026-09-06)

Not a guess; read before the roadmap track was accepted.

- `packages/ecs/src/component.ts:30` throws at `id >= 32`.
- The archetype mask is a **plain JS number**: `world.ts:146` `mask |= c.bit`, archetypes held
  as `Map<number, number>` (entityId → bitmask), matched in `query.ts` via
  `archetype & requiredMask === requiredMask`.

So 128 components means replacing the scalar mask with a 4-word `Uint32Array` (or BigInt) and
updating **exactly three files** — `component.ts`, `world.ts`, `query.ts`. Bounded and real.
Zero-alloc rules apply: the match path is a hot loop, so a `Uint32Array` mask needs a
comparison that does not allocate per entity per frame.

## 8. Entry point for the executing session

1. Read this file and `road-to-oss-2026-09.md` §0 (fixed decisions).
2. Confirm the benchmark capture window is closed and the tree is clean.
3. Launch W1 + W2 concurrently, all agents `model: 'fable'`.
4. Read results, then W3, then W4.
5. Write the §6 deliverables. **Orchestrator writes; agents never do.**
