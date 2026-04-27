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
| 12 | pending | [game] | M9.4 dialogue graph speakerPortraitKey plumbing for opening + zone-7 + victory | apps/pan-tvardowski/src/dialogue/graphs.ts, src/dialogue/portraits.ts, tests/dialogue-portraits.test.ts | lint, typecheck, test (+3) | 2 | — | — | — |
| 13 | pending | [game] | M9.4 DialoguePanel avatar slot wiring with shape-portrait placeholders | apps/pan-tvardowski/src/hud/DialogueOverlay.tsx, src/dialogue/shape-portraits.ts, tests/dialogue-overlay-avatar.test.ts | lint, typecheck, test (+3), device-smoke | 3 | #12 | — | — |
| 14 | pending | [game] | M9.4 close: tick §17 M9.4 checkbox; Change log + mirror row sync | docs/plans/pan-tvardowski-build-plan.md, docs/references/builder-reference.md | lint, typecheck, test | 1 | #13 | — | — |
| 15 | pending | [game] | M9.6 EAS build profile + keystore docs + version-bump policy | apps/pan-tvardowski/eas.json, apps/pan-tvardowski/docs/keystore.md, apps/pan-tvardowski/app.json | lint, typecheck, test, build | 2 | — | — | — |
| 16 | pending | [game] | M9.6 privacy UI + data-safety declaration; add PL+EN keys for settings.privacy | apps/pan-tvardowski/src/scenes/settings.ts, src/hud/PrivacyOverlay.tsx, src/save/schema.ts, locales/en.json, locales/pl.json, tests/privacy-overlay.test.ts | lint, typecheck, test (+3), build, device-smoke | 3 | — | — | — |
| 17 | pending | [game] | M9.6 Sentry crash-transport binding gated behind crashOptIn | apps/pan-tvardowski/src/errors/transport.ts, src/App.tsx, tests/crash-transport.test.ts | lint, typecheck, test (+3), build | 3 | #16 | — | — |
| 18 | pending | [game] | M9.6 screenshot capture scene via @flare-engine/share createScreenshotScene | apps/pan-tvardowski/src/scenes/capture.ts, src/share/manager.ts, tests/capture-scene.test.ts | lint, typecheck, test (+2), build, device-smoke | 3 | — | — | — |
| 19 | pending | [game] | M9.6 balance freeze with BALANCE_FROZEN_AT + grep pre-commit guard | apps/pan-tvardowski/src/config/zones.ts, src/config/enemies.ts, src/config/upgrades.ts, scripts/check-balance-freeze.sh | lint, typecheck, test, build | 2 | — | — | — |
| 20 | pending | [game] | M9.6 locale parity audit script + fix any EN/PL drift | apps/pan-tvardowski/scripts/check-locale-parity.ts, package.json, locales/en.json, locales/pl.json | lint, typecheck, test (+1), build | 2 | #16 | — | — |
| 21 | pending | [game] | M9.6 save-migrator with synthetic fixture round-trip (full v→current chain) | apps/pan-tvardowski/src/save/migrate.ts, src/save/schema.ts, tests/save-migrator.test.ts | lint, typecheck, test (+4), build | 3 | #16 | — | — |
| 22 | pending | [game] | M9.6 close: tick §17 M9.6 + release-checklist §2/§4/§5/§7/§8 + mirror sync | docs/plans/pan-tvardowski-build-plan.md, docs/plans/release-readiness-checklist.md, docs/references/builder-reference.md | lint, typecheck, test, build | 1 | #15, #17, #18, #19, #20, #21 | — | — |
| 23 | done | [engine] | new package @flare-engine/iap-revenuecat — concrete IAPProvider adapter wrapping react-native-purchases (peer dep); mock-SDK tests | packages/iap-revenuecat/package.json, tsup.config.ts, src/{index.ts,provider.ts,types.ts}, tests/provider.test.ts | lint, typecheck, test (+6), build | 4 | — | 2026-04-27 | 2026-04-27 |
| 24 | done | [engine] | new package @flare-engine/ui-shop — reusable ShopPanel + PaywallModal + RestorePurchasesButton primitives consuming IAPContext + EntitlementStore | packages/ui-shop/package.json, tsup.config.ts, src/{index.ts,ShopPanel.tsx,PaywallModal.tsx,RestorePurchasesButton.tsx,types.ts}, tests/{ShopPanel.test.ts,PaywallModal.test.ts,RestorePurchasesButton.test.ts} | lint, typecheck, test (+9), build | 4 | — | 2026-04-27 | 2026-04-27 |
| 25 | done | [engine] | cross-package integration tests (Noop → ShopPanel → purchase → grantProduct) + api-specs.md entries for iap-revenuecat + ui-shop | packages/iap-revenuecat/tests/integration.test.ts, packages/ui-shop/tests/integration.test.ts, docs/design/api-specs.md | lint, typecheck, test (+4), build | 2 | #23, #24 | 2026-04-27 | 2026-04-27 |

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
