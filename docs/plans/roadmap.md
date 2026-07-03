# Flare Roadmap

Source of truth for what's done, what's left, and what's deferred. Replaces the prior 4-doc split (build-plan / pan-tvardowski-build-plan / release-readiness-checklist / sessions).

For next-row tracking: [todo.md](todo.md). For history: [SESSION_LOG.md](../../SESSION_LOG.md).

---

## State (2026-07-03)

**Positioning (2026-07-03):** public framing = "a 2D engine that runs the same code on Web + React Native — animation, gamification, interactive UI, and games"; not "the first RN game engine", not a Unity/Godot/Unreal competitor. Games (Pan Tvardowski, Berek, a planned platformer) are showcases/dogfooding.
**License (2026-07-03 owner decision):** engine relicenses MIT → Apache-2.0 before the flip (patent grant + §6 name reservation); games licensed separately (PT = PolyForm Noncommercial). Supersedes the "MIT everywhere" line in road-to-oss §0.2.

**Engine:** Feature-complete. **0.2.0 lockstep cut: all 40 scoped `@flare-engine/*@0.2.0` on npm, private/restricted** (publish owner-gated; public flip at OSS launch). 41 package dirs in-repo (40 scoped + `create-flare-app`); the new-in-repo packages `@flare-engine/simulation` (XP6) + `@flare-engine/progression` (XP8), plus `haptics` / `render-web`, all ship at 0.2.0.
**Pan Tvardowski:** **Extracted to its own repo 2026-06-10** — [github.com/grzott/Pan-Tvardowski](https://github.com/grzott/Pan-Tvardowski) (history-preserving split, 405 commits, `monorepo-archive` boundary tag). Consumes the engine from npm at `^0.1.0`. Feature-complete since 2026-04-28; launch tier owner-managed in that repo.
**Active focus:** **Road to OSS — the October 2026 public flip.** Single roadmap + full row specs: [road-to-oss-2026-09.md](road-to-oss-2026-09.md). Queue: `todo.md` Arc OSS. Freeze Oct 5 → two-week owner manual-test window Oct 5–18 → flip week Oct 19–23.

---

## Engine architecture

41 packages, layered, downward-only deps. Diagram: `docs/design/architecture.md`.

| Layer | Packages |
|---|---|
| 0 Foundation | math · events |
| 1 Runtime | core · ecs |
| 2 Systems | render · shapes · input · physics · audio · assets · simulation · progression |
| 2.5 Persistence | storage · errors · testing · localization · deep-links · share · a11y |
| 3 Features | scene · animation · particles · tilemap · debug · pathfinding · dialogue |
| 3.5 UI | ui · postfx · ui-shop |
| 4 Integration | react · engine |
| Tooling | cli · devtools · create-flare-app |
| Tier-2 stubs | leaderboards · achievements · iap · analytics |
| Adapters | iap-revenuecat |

### Engine phases — status

| Phase | Goal | Status |
|---|---|---|
| 0–9 | Engine core, integration, hardening, benchmarks, demo | Done (archived in `docs/history/build-plan-archive.md`) |
| 10 | C++ acceleration | Deferred — data-gated, physics first if ever needed |
| 11.1–11.5, 11.7, 11.10 | Tier-1 + Tier-2 packages | Done |
| 11.8 | CLI + scaffolder | Done |
| 11.11 | Landing-page MP4 + store links | Superseded — showcase assets are post-flip rows in [road-to-oss-2026-09.md §13](road-to-oss-2026-09.md) |
| 11.12 | Docs site (now the sibling `flare-engine-page` repo, Astro Starlight) | In flight — G-lane of [road-to-oss-2026-09.md §10](road-to-oss-2026-09.md) |
| 11.13 | API lock + governance | Absorbed into road-to-oss Arcs C/D/E (trademark: dormant per §0.3) |
| 11.14 | Engine extraction from PT | Done (2026-04-24) |
| 12 | **OSS launch** | **ACTIVE — [road-to-oss-2026-09.md](road-to-oss-2026-09.md)** |

OSS launch: **October 2026 public flip** (freeze Oct 5, manual window Oct 5–18, flip week Oct 19–23).

---

## Pan Tvardowski (the game — own repo since 2026-06-10)

Canonical end-to-end reference + integration smoke test, now at [github.com/grzott/Pan-Tvardowski](https://github.com/grzott/Pan-Tvardowski) consuming `@flare-engine/*@^0.1.0` from npm. Folklore-themed vertical shmup. Free zones 1–3, paid zones 4–8. License: PolyForm Noncommercial 1.0.0. Day-to-day PT work happens in that repo (own `.claude/` harness); this section keeps only the engine-facing summary.

| Element | Count | Notes |
|---|---|---|
| Zones | 8 | ~38 min campaign |
| Mini-bosses | 4 | Zones 2, 4, 6, 7 |
| Bosses | 8 | One per zone; Z1–4 = 2 phases, Z5–8 = 3 phases |
| Enemy types | 12 | Polish folklore |
| Weapons | 4 | 3 upgrade levels each |
| Player ships | 3 | Unlocked via progression |

**Visual source of truth:** the typed `src/visual-spec/` schema in the PT repo (canonical since 2026-06-08). The 21 PNG folios at `docs/references/pan-tvardowski/folios/` are **retired/historical** — they predate the Kenney sprite swap and stay here only as the design archive.

**Engine-first rule.** Presentation features requiring engine support ship in `packages/**` first; PT-side wire follows. Builders never patch engine gaps with PT-local workarounds.

### Detailed design

Full zone/enemy/boss/weapon/ship/upgrade/dialogue specs live in the PT repo's `src/visual-spec/` + `docs/visual-reference.md`. The prior `pan-tvardowski-build-plan.md` (576 lines) is retired — its session history is in `SESSION_LOG.md`; the retired folios remain the design archive.

---

## When ready to ship

PT launch checklist (store accounts, IAP products, legal, build + smoke, store assets,
submission) moved to the PT repo:
[docs/release-checklist.md](https://github.com/grzott/Pan-Tvardowski/blob/main/docs/release-checklist.md).

---

## Engine extraction history

What PT produced that was promoted back to engine packages. Genre-agnostic only.

| Lift | From PT | To engine | Session |
|---|---|---|---|
| PostFx controller bridge | `src/fx/` | `@flare-engine/postfx createPostFxController` | M10 |
| A11y bridge | `src/a11y/manager.ts` | `@flare-engine/a11y createA11yBridge` | M10 |
| Tier-2 wiring | `src/tier2/wiring.ts` | `@flare-engine/engine createTier2Wiring` | M10 |
| ShopPanel + EntitlementStore + ProductCatalog | (M9.3) | `@flare-engine/ui-shop` + `@flare-engine/iap` | #24, #25 |
| Sentry crash + composeTransports | (M10.1) | `@flare-engine/errors` | #26 |
| canAccessContent + ContentSpec | (M10.3) | `@flare-engine/iap` | #27 |
| defineMigrationChain | (M10.4) | `@flare-engine/storage` | #27 |
| RevenueCat adapter | (M9.3) | `@flare-engine/iap-revenuecat` | #23 |
| Screenshot capture scene | (M9.6) | `@flare-engine/share` | #18 |
| Frame budget + watchdog | `src/fx/budget.ts` | `@flare-engine/debug createFrameBudget` | #192 |
| Boot trace timing | `src/perf/cold-start.ts` | `@flare-engine/debug createBootTrace` | #193 |
| Vec2 normalize zero-alloc | `src/util/direction.ts` | `@flare-engine/math Vec2.normalizeOut` | #194 |
| Postfx timed trigger | `src/fx/postfx.ts` | `@flare-engine/postfx triggerTimed` | #195 |

### Rejected (genre-specific, stays in PT)

- Boss FSM + PhaseScript dispatch (shmup-specific)
- Miniboss form-cycle (shmup-specific)
- Deterministic wave spawner (shmup-specific)
- Shape catalogue (Kogut, Smok, …) — PT-specific IP

---

## Future tracks (when meta-refactor closes)

Pick any — or none. None is the default.

1. **Ship PT** — walk the PT repo's `docs/release-checklist.md`. ~$124 + weekend of submission work.
2. **Second game** — top-down or deck-builder, separate private repo. Tests engine reusability. Consumes `@flare-engine/*@^0.1.0` from the restricted npm registry (Berek is already scaffolded this way).
3. **Engine feature** — e.g. 2.5D lighting via SkSL RuntimeEffect (notes in `docs/design/lighting-2-5d.md`), or snapshot-source postfx for scene-texture effects.
4. **Pre-launch polish** — superseded by [road-to-oss-2026-09.md](road-to-oss-2026-09.md) (the active track).

---

## Conventions pointers

- Engine + game conventions: `AGENTS.md`
- Code style + testing: `docs/conventions/code.md` (after M3)
- Commit format: `docs/conventions/git.md` (after M3)
- API contract: `docs/design/api-specs.md`
- Architecture: `docs/design/architecture.md`
