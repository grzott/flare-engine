# Flare Roadmap

Source of truth for what's done, what's left, and what's deferred. Replaces the prior 4-doc split (build-plan / pan-tvardowski-build-plan / release-readiness-checklist / sessions).

For next-row tracking: [todo.md](todo.md). For history: [SESSION_LOG.md](../../SESSION_LOG.md).

---

## State (2026-06-10)

**Engine:** Feature-complete at 0.1.x. **Published 2026-06-09: 36 scoped `@flare-engine/*@0.1.0` live on npm, private/restricted** (public flip at OSS launch). 37 package dirs in-repo (36 scoped + `create-flare-app`).
**Pan Tvardowski:** **Extracted to its own repo 2026-06-10** — [github.com/grzott/Pan-Tvardowski](https://github.com/grzott/Pan-Tvardowski) (history-preserving split, 405 commits, `monorepo-archive` boundary tag). Consumes the engine from npm at `^0.1.0`. Feature-complete since 2026-04-28; launch tier owner-managed in that repo.
**Active focus:** Arc PT-EXTRACT close-out (S8/S9) + engine-repo docs/harness polish — see `todo.md`.

---

## Engine architecture

37 packages, layered, downward-only deps. Diagram: `docs/design/architecture.md`.

| Layer | Packages |
|---|---|
| 0 Foundation | math · events |
| 1 Runtime | core · ecs |
| 2 Systems | render · shapes · input · physics · audio · assets |
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
| 11.11 | Landing-page MP4 + store links | Deferred (PT-gated) |
| 11.12 | Docs site (`apps/site` Docusaurus) | Deferred to pre-launch polish |
| 11.13 | API lock + RC + governance + trademark | Deferred to pre-launch polish |
| 11.14 | Engine extraction from PT | Done (2026-04-24) |
| 12 | Launch + content | Planned |

OSS launch target: October 2026.

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

## When ready to ship (manual launch tier)

Owner-managed, outside the session loop. Nothing here is urgent.

### 1. Store accounts (~$124 first year)
- Google Play developer account ($25 one-time)
- Apple Developer Program ($99/year)
- Google Play Console: PT app + internal testing track (procedure in the PT repo's `docs/keystore.md`)
- App Store Connect: PT app + TestFlight (procedure in the PT repo's `docs/keystore.md`)
- Android signing: upload keystore in EAS credentials
- iOS signing: dist cert + provisioning profile via EAS

### 2. IAP products
- Google Play: `pan_tvardowski.full_game` + `pan_tvardowski.supporter_pack` (both non-consumable) — pricing, localized name/description
- App Store: matching product IDs + metadata

### 3. Legal
- Domains: `pantvardowski.com` + `.pl` + `.eu` (~€30)
- Social handles: `@pantvardowski` on X, YouTube, TikTok
- EUIPO word mark (Classes 9 + 41, ~€900 DIY)
- Privacy policy URL on engine site
- Terms of Service
- Age rating (IARC + App Store)

### 4. Build + smoke
- Fresh release APK via EAS cloud build (Windows `eas build --local` is broken — use cloud or WSL)
- TestingBot Pixel 10 (Android) smoke — Maestro flows in the PT repo's `.maestro/`
- iPhone 16 Pro (iOS) smoke — gated on Apple Developer account

### 5. Store assets
- App icon (1024×1024 master, platform variants generated)
- Google Play: 8 screenshots (1080×1920) per language + feature graphic (1024×500) + 30s trailer
- App Store: 10 screenshots per device class per language + 30s preview per device class
- Store-page copy EN + PL (short, long, promo)

### 6. Submit
- Google Play closed testing → production (14-day-with-12-testers gate)
- App Store TestFlight → production (budget 2 review rounds)
- Steam (Tauri wrap) — 0.2.0+

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

1. **Ship PT** — walk the launch-tier checklist above. ~$124 + weekend of submission work.
2. **Second game** — top-down or deck-builder, separate private repo. Tests engine reusability. Use `bun add github:grzott/flare-engine` for cross-repo dep, no npm $ needed.
3. **Engine feature** — e.g. 2.5D lighting via SkSL RuntimeEffect (notes in `docs/design/lighting-2-5d.md`), or snapshot-source postfx for scene-texture effects.
4. **Pre-launch polish** — Phase 11.11 / 11.12 / 11.13 (landing MP4, docs site, RC publish, EUIPO trademark).

---

## Conventions pointers

- Engine + game conventions: `AGENTS.md`
- Code style + testing: `docs/conventions/code.md` (after M3)
- Commit format: `docs/conventions/git.md` (after M3)
- API contract: `docs/design/api-specs.md`
- Architecture: `docs/design/architecture.md`
