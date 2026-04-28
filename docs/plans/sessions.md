# Sessions — unified 10–20 session slice

Short-horizon, executable session plan. Sits between the long-horizon roadmaps ([`build-plan.md`](build-plan.md) for the engine, [`pan-tvardowski-build-plan.md`](pan-tvardowski-build-plan.md) for the current game) and daily work.

**Rules of the artifact:**
- One row per session (≈ 2–6 h of implementation, one gate cycle, 1–4 commits).
- Scope tag is exactly one of `[engine]`, `[game]`, `[mixed]`.
- Rows are append-only — statuses move forward (`pending` → `in_progress` → `done` or `blocked`), rows are never deleted or renumbered.
- Row shape and field conventions: [sessions/_template.md](sessions/_template.md).
- Planner protocol: [sessions/_planner-protocol.md](sessions/_planner-protocol.md).

**Owned by:** `engine-planner` (engine rows), `game-planner` (game rows), both planners jointly (mixed rows). Status flips during execution are written by `engine-builder` / `game-builder` via `/session-start` and by `verifier` via `/session-close`.

**Read by:** `engine-builder`, `game-builder`, `verifier`, and the `session-start.sh` hook.

---

## Active slice

| # | status | scope | goal | touched paths | gates | target commits | depends on | opened | closed |
|---|--------|-------|------|---------------|-------|----------------|------------|--------|--------|
| 1 | done | [game] | M9.2 codex data model + PL/EN key scaffold for bestiary entries | apps/pan-tvardowski/src/codex/entries.ts, src/codex/index.ts, locales/en.json, locales/pl.json, tests/codex-entries.test.ts | lint, typecheck, test (+4) | 3 | — | 2026-04-25 | 2026-04-25 |
| 2 | done | [game] | M9.2 shards browser scene wired to save-slot shard count + codex unlocks | apps/pan-tvardowski/src/scenes/codex-shards.ts, src/hud/CodexOverlay.tsx, src/App.tsx, tests/codex-shards-scene.test.ts | lint, typecheck, test (+3), device-smoke | 3 | #1 | 2026-04-26 | 2026-04-27 |
| 3 | done | [game] | M9.2 boss codex view with per-phase stats; add PL+EN keys for boss codex labels | apps/pan-tvardowski/src/codex/boss-entries.ts, src/hud/CodexOverlay.tsx, locales/en.json, locales/pl.json, tests/boss-codex.test.ts | lint, typecheck, test (+3), device-smoke | 3 | #1 | 2026-04-27 | 2026-04-27 |
| 4 | done | [game] | M9.2 per-zone clear-stats tracker on SaveFile (deaths, best time, no-hit flag) | apps/pan-tvardowski/src/save/schema.ts, src/save/store.ts, src/scenes/play.ts, tests/zone-stats.test.ts | lint, typecheck, test (+4) | 3 | — | 2026-04-27 | 2026-04-27 |
| 5 | done | [game] | M9.2 achievement tracker screen + PL+EN keys for 12 achievement entries | apps/pan-tvardowski/src/scenes/achievements.ts, src/hud/AchievementsOverlay.tsx, locales/en.json, locales/pl.json, tests/achievements-screen.test.ts | lint, typecheck, test (+3), device-smoke | 3 | #4 | 2026-04-27 | 2026-04-27 |
| 6 | done | [game] | M9.2 close: tick §17 M9.2 checkbox + Change log entry; update mirror row | docs/plans/pan-tvardowski-build-plan.md, docs/references/builder-reference.md | lint, typecheck, test | 1 | #2, #3, #5 | 2026-04-27 | 2026-04-27 |
| 7 | done | [game] | M9.3 update PT_CATALOG SKUs to pan_tvardowski.full_game + supporter_pack (deprecate pt.shards_small); consumes @flare-engine/iap | apps/pan-tvardowski/src/iap/catalog.ts, tests/iap-catalog.test.ts, tests/shop-entitlements.test.ts | lint, typecheck, test (+5) | 2 | #25 | 2026-04-27 | 2026-04-27 |
| 8 | done | [game] | M9.3 wire createRevenueCatProvider in App.tsx (env-var keys); zone-gate guard on zones 4–8 via EntitlementStore.isEntitled('pt.full_game') | apps/pan-tvardowski/src/{App.tsx,scenes/play.ts,config/zones.ts,events.ts,iap/provider.ts,iap/zone-gate.ts,tier2/providers.ts,hud/MenuOverlay.tsx,localization/keys.ts}, locales/{en,pl}.json, tests/zone-gate.test.ts | lint, typecheck, test (+4) | 3 | #7, #23 | 2026-04-27 | 2026-04-27 |
| 9 | done | [game] | M9.3 swap hand-rolled ShopOverlay for @flare-engine/ui-shop ShopPanel; add PaywallModal on zone-3 boss defeat (soft-dismissible) + EN/PL paywall copy | apps/pan-tvardowski/src/{App.tsx,events.ts,hud/{PaywallOverlay.tsx,ShopOverlay.tsx,MenuOverlay.tsx},localization/keys.ts,scenes/play.ts,config/zones.ts,tier2/providers.ts}, package.json, locales/{en,pl}.json, tests/{paywall-flow,shop-entitlements}.test.ts | lint, typecheck, test (+4), device-smoke | 3 | #8, #24 | 2026-04-27 | 2026-04-27 |
| 10 | done | [game] | M9.3 add @flare-engine/ui-shop RestorePurchasesButton to settings; EN/PL restore-state keys | apps/pan-tvardowski/src/hud/MenuOverlay.tsx, src/localization/keys.ts, locales/en.json, locales/pl.json, tests/restore-purchases.test.ts | lint, typecheck, test (+3), device-smoke | 3 | #8, #24 | 2026-04-27 | 2026-04-27 |
| 11 | done | [game] | M9.3 close: tick §17 M9.3 + release-checklist §3 IAP items; changelog + mirror sync | docs/plans/pan-tvardowski-build-plan.md, docs/plans/release-readiness-checklist.md, docs/references/builder-reference.md | lint, typecheck, test | 1 | #9, #10 | 2026-04-27 | 2026-04-27 |
| 12 | done † | [game] | M9.4 dialogue graph speakerPortraitKey plumbing for opening + zone-7 + victory | apps/pan-tvardowski/src/dialogue/graphs.ts, src/dialogue/portrait-manifest.ts ‡, tests/dialogue-portrait.test.ts ‡ | lint, typecheck, test (+9 ‡) | 2 | — | 2026-04-26 | 2026-04-26 |
| 13 | done † | [game] | M9.4 DialoguePanel avatar slot wiring with shape-portrait placeholders | apps/pan-tvardowski/src/hud/DialogueOverlay.tsx, src/dialogue/portrait-manifest.ts ‡, tests/dialogue-portrait.test.ts ‡ | lint, typecheck, test (covered by #12), device-smoke | 3 | #12 | 2026-04-26 | 2026-04-26 |
| 14 | done † | [game] | M9.4 close: tick §17 M9.4 checkbox; Change log + mirror row sync | docs/plans/pan-tvardowski-build-plan.md, docs/references/builder-reference.md | lint, typecheck, test | 1 | #13 | 2026-04-26 | 2026-04-26 |
| 15 | done | [game] | M9.6 EAS build profile + keystore docs + version-bump policy | apps/pan-tvardowski/eas.json, apps/pan-tvardowski/docs/keystore.md, apps/pan-tvardowski/app.json | lint, typecheck, test, build | 2 | — | 2026-04-27 | 2026-04-27 |
| 16 | done | [game] | M9.6 privacy UI + data-safety declaration; add PL+EN keys for settings.privacy | apps/pan-tvardowski/src/scenes/settings.ts, src/hud/PrivacyOverlay.tsx, src/save/schema.ts, locales/en.json, locales/pl.json, tests/privacy-overlay.test.ts | lint, typecheck, test (+3), build, device-smoke | 3 | — | 2026-04-27 | 2026-04-27 |
| 17 | done | [game] | M9.6 Sentry crash-transport binding gated behind crashOptIn | apps/pan-tvardowski/src/errors/transport.ts, src/App.tsx, tests/crash-transport.test.ts | lint, typecheck, test (+8), build | 3 | #16 | 2026-04-27 | 2026-04-27 |
| 18 | done | [game] | M9.6 screenshot capture scene via @flare-engine/share createScreenshotScene | apps/pan-tvardowski/src/scenes/capture.ts, src/share/manager.ts, tests/capture-scene.test.ts, src/state.ts § | lint, typecheck, test (+7), build | 3 | — | 2026-04-27 | 2026-04-27 |
| 19 | done | [game] | M9.6 balance freeze with BALANCE_FROZEN_AT + grep pre-commit guard | apps/pan-tvardowski/src/config/zones.ts, src/config/gameplay.ts ¶, scripts/check-balance-freeze.sh, tests/balance-freeze.test.ts ¶ | lint, typecheck, test (+4), build | 2 | — | 2026-04-28 | 2026-04-28 |
| 20 | done | [game] | M9.6 locale parity audit script + fix any EN/PL drift | apps/pan-tvardowski/scripts/check-locale-parity.ts, package.json, tests/check-locale-parity.test.ts ° | lint, typecheck, test (+3), build | 2 | #16 | 2026-04-28 | 2026-04-28 |
| 21 | done | [game] | M9.6 save-migrator with synthetic fixture round-trip (full v→current chain) | apps/pan-tvardowski/src/save/migrate.ts, src/save/schema.ts, tests/save-migrator.test.ts | lint, typecheck, test (+5), build | 3 | #16 | 2026-04-28 | 2026-04-28 |
| 22 | done | [game] | M9.6 close: tick §17 M9.6 + release-checklist §2/§4/§5/§7/§8 + mirror sync | docs/plans/pan-tvardowski-build-plan.md, docs/plans/release-readiness-checklist.md, docs/references/builder-reference.md | lint, typecheck, test, build | 1 | #15, #17, #18, #19, #20, #21 | 2026-04-28 | 2026-04-28 |
| 23 | done | [engine] | new package @flare-engine/iap-revenuecat — concrete IAPProvider adapter wrapping react-native-purchases (peer dep); mock-SDK tests | packages/iap-revenuecat/package.json, tsup.config.ts, src/{index.ts,provider.ts,types.ts}, tests/provider.test.ts | lint, typecheck, test (+6), build | 4 | — | 2026-04-27 | 2026-04-27 |
| 24 | done | [engine] | new package @flare-engine/ui-shop — reusable ShopPanel + PaywallModal + RestorePurchasesButton primitives consuming IAPContext + EntitlementStore | packages/ui-shop/package.json, tsup.config.ts, src/{index.ts,ShopPanel.tsx,PaywallModal.tsx,RestorePurchasesButton.tsx,types.ts}, tests/{ShopPanel.test.ts,PaywallModal.test.ts,RestorePurchasesButton.test.ts} | lint, typecheck, test (+9), build | 4 | — | 2026-04-27 | 2026-04-27 |
| 25 | done | [engine] | cross-package integration tests (Noop → ShopPanel → purchase → grantProduct) + api-specs.md entries for iap-revenuecat + ui-shop | packages/iap-revenuecat/tests/integration.test.ts, packages/ui-shop/tests/integration.test.ts, docs/design/api-specs.md | lint, typecheck, test (+4), build | 2 | #23, #24 | 2026-04-27 | 2026-04-27 |
| 26 | done | [mixed] | M10.1 Sentry crash transport + composeTransports() in @flare-engine/errors | packages/errors/src/transports/sentry.ts, packages/errors/src/compose.ts, packages/errors/src/index.ts, packages/errors/tests/sentry-transport.test.ts, packages/errors/tests/compose-transports.test.ts, apps/pan-tvardowski/src/errors/transport.ts (delete), apps/pan-tvardowski/src/App.tsx | lint, typecheck, test (+6), build, 256+ PT tests green | 3 | -- | 2026-04-28 | 2026-04-28 |
| 27 | done | [mixed] | M10 engine promotion: 6 lifts (a11y/postfx/iap-gate/migrator/shapes-decision/lazy-sdk) | packages/iap/src/gate.ts, packages/iap/src/index.ts, packages/iap/tests/gate.test.ts, packages/storage/src/migration-chain.ts, packages/storage/src/index.ts, packages/storage/tests/migration-chain.test.ts, docs/recipes/save-migrations.md, apps/pan-tvardowski/src/{a11y/manager.ts (delete), fx/postfx.ts (delete), iap/zone-gate.ts (delete), App.tsx, scenes/play.ts, save/migrate.ts}, docs/plans/build-plan.md, docs/references/builder-reference.md, docs/design/api-specs.md, .github/skills/flare-tier2-stubs/SKILL.md, packages/iap-revenuecat/README.md, packages/achievements/README.md, packages/leaderboards/README.md, packages/analytics/README.md | lint, typecheck, test (+10), build, 256+ PT tests green | 12 | #26 | 2026-04-28 | 2026-04-28 |
| 28 | done | [game] | PT-Polish-1: theme module foundation — semantic visual tokens (colors/typography/spacing/shapes) | apps/pan-tvardowski/src/theme/colors.ts, src/theme/typography.ts, src/theme/spacing.ts, src/theme/shapes.ts, src/theme/index.ts, tests/theme.test.ts | lint, typecheck, test (+5), build | 1 | — | 2026-04-28 | 2026-04-28 |
| 29 | done | [game] | PT-Polish-2..9 bundled ★ — theme migration, overlay StyleSheet factory, entitlement fallback, release wiring, locale QA, perf + App.tsx split, code consolidation, RR final sync | apps/pan-tvardowski/src/{hud/{Hud.tsx,MenuOverlay.tsx,InventoryOverlay.tsx,CodexOverlay.tsx,AchievementsOverlay.tsx,DialogueOverlay.tsx,PrivacyOverlay.tsx,ShopOverlay.tsx,PaywallOverlay.tsx},theme/{index.ts,overlays.ts},iap/{catalog.ts,provider.ts},App.tsx,scenes/play.ts,providers.ts,scene-registry.ts,localization/keys.ts,config/analytics-events.ts,perf/cold-start.ts,draw/{shapes.ts,dedup.ts}}, app.json, locales/{en,pl}.json, tests/{theme-hud,theme-overlays,entitlement-fallback,analytics-freeze,deep-link,locale-qa,perf-baseline,app-split,shape-dedup,coverage-sweep}.test.ts, docs/{CREDITS.md,perf-baseline.md}, docs/plans/{pan-tvardowski-build-plan.md,release-readiness-checklist.md}, docs/references/builder-reference.md | lint, typecheck, test (+40), build, device-smoke (M1/M2/M5), cold-start profiling (M6) | 18 | #28 | 2026-04-28 | 2026-04-28 |

## Footnotes

† **M9.4 retroactive close (rows #12–14, 2026-04-27).** Rows were left at `pending` after the actual implementation shipped 2026-04-26 — sessions.md never got the status flip even though the build-plan §17 M9.4 box was ticked and the change-log entry written at the time. Reconciled in batch alongside M9.6 sessions #17–20. SESSION_LOG.md gained three retroactive blocks (sessions 12, 13, 14) referencing the 2026-04-26 work.

§ **Scope extension (row #18).** `src/state.ts` `SceneName` union extended with `'capture'` so the scene factory can register without a type-cast. Same pattern as session #2's `'codex-shards'` addition. Approved at implementation time.

° **Scope notes (row #20).** No EN/PL drift surfaced — script reports clean against the canonical 288-key set, so `locales/en.json` + `locales/pl.json` were not touched (planner had listed them as conditional). Drive-by `package.json` script entries: `check:locales` (this session) + `check:balance` (folded in from session #19, which had no `package.json` change). `tests/check-locale-parity.test.ts` (+3 tests) added so the comparator helper has unit coverage independent of the live locale files (live-files assertion + synthetic drift detection + report-formatter shape).

¶ **Path drift (row #19).** Planner declared `src/config/enemies.ts` + `src/config/upgrades.ts`; neither exists in the codebase. Real balance files are `src/config/gameplay.ts` (enemy specs, boss HPs, all phase / fire / lifetime constants) + `src/config/zones.ts` (per-zone configs). Both updated with `BALANCE_FROZEN_AT`. Drive-by `tests/balance-freeze.test.ts` added (+4 tests asserting both files agree on the date and that it parses as a valid calendar date) — guards against silent drift between the constants.

‡ **Path drift from the planner's declared `touched paths` (rows #12–13).** As-shipped: a single `src/dialogue/portrait-manifest.ts` (instead of separate `portraits.ts` + `shape-portraits.ts`) consolidates the 6-key portrait manifest + `resolvePortraitShape()` accessor; a single `tests/dialogue-portrait.test.ts` (singular, 16 tests) covers both rows' surface area (instead of the two declared test files). DialogueOverlay refactor in row #13 used `<ThemeProvider>` + `<DialoguePanel>` from `@flare-engine/ui` as planned; portrait slot is rendered as a 44×44 colour block driven by the manifest's first `fill` channel.

★ **8-milestone bundle (row #29).** This row bundles 8 sequential polish milestones into a single session entry. Each milestone has its own gate cycle and commits; the builder must complete and verify each milestone before advancing to the next. Per-milestone breakdown:

| M# | name | scope | gate | commits |
|----|------|-------|------|---------|
| M1 | Theme tokens: Hud + MenuOverlay | Hud.tsx, MenuOverlay.tsx consume theme.colors/typography/spacing | lint, typecheck, test, device-smoke | 2 |
| M2 | Theme tokens: remaining overlays + shared StyleSheet factory | InventoryOverlay, CodexOverlay, AchievementsOverlay, DialogueOverlay, PrivacyOverlay, ShopOverlay, PaywallOverlay + extract overlays.ts factory | lint, typecheck, test, device-smoke | 3 |
| M3 | Entitlement-lost fallback + PL/EN keys | graceful degradation when entitlement check fails mid-session; add PL+EN keys for fallback UI strings | lint, typecheck, test | 2 |
| M4 | Release wiring: analytics freeze + deep-link + CREDITS | freeze analytics event names, register deep-link schemes in app.json, create CREDITS.md | lint, typecheck, test, build | 3 |
| M5 | Localization: PL dialogue QA + store-page copy | PL dialogue string QA pass, draft EN/PL store listing copy | lint, typecheck, test, device-smoke | 2 |
| M6 | Perf + App.tsx split: cold-start + providers + scene-registry | cold-start instrumentation, perf-baseline doc, split App.tsx into providers.ts + scene-registry.ts | lint, typecheck, test, build, cold-start profiling | 3 |
| M7 | Code consolidation: shape-draw dedup + test-coverage sweep | deduplicate shape-drawing helpers, coverage sweep for untested branches | lint, typecheck, test | 2 |
| M8 | Release-readiness final sync | tick remaining release-checklist items, mirror-row sync, build-plan changelog | lint, typecheck, test, build | 1 |

Total target commits: 18. Builder executes M1 through M8 in order, running the milestone's gate set after each. A milestone is not considered complete until its gates pass. If a milestone surfaces a blocker, the builder halts and reports rather than skipping ahead.

## Archive

Closed rows accumulate above as `done`. Leave them in place — they form the executable changelog that mirrors `SESSION_LOG.md`.

## Definitions

| Status | Meaning |
|--------|---------|
| `pending` | Planned, not started. Builder may claim via `/session-start`. |
| `in_progress` | A builder claimed it. Has an `opened` date. |
| `done` | Gates green + docs synced + commit blocks emitted. Has a `closed` date. |
| `blocked` | Waiting on another session (`depends on`) or an external factor. Move back to `pending` once unblocked. |

| Scope | Owner | Touches |
|-------|-------|---------|
| `[engine]` | engine-builder | `packages/**`, engine-reference docs |
| `[game]` | game-builder | `apps/<game>/**`, the game's build plan + mirror row |
| `[mixed]` | both | engine package + game consumer in one session — engine half first, game half second |
