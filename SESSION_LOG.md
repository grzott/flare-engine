# Session Log

Append-only record of closed sessions. Written by `/session-close` via the `verifier` agent after all gates pass. Format defined in [.github/instructions/session-close.instructions.md](.github/instructions/session-close.instructions.md).

Source-of-truth for session status remains [docs/plans/sessions.md](docs/plans/sessions.md); this file is a chronological changelog mirror.

---

<!-- New session blocks appended below. Format per session-close.instructions.md. -->

## Session 1 — 2026-04-25 (scope: [game])

**Goal (from sessions.md row #1):** M9.2 codex data model + PL/EN key scaffold for bestiary entries

**Touched files**
- `apps/pan-tvardowski/src/codex/entries.ts`
- `apps/pan-tvardowski/src/codex/index.ts`
- `apps/pan-tvardowski/src/localization/keys.ts` †
- `apps/pan-tvardowski/locales/en.json`
- `apps/pan-tvardowski/locales/pl.json`
- `apps/pan-tvardowski/tests/codex-entries.test.ts`

† Drift from declared `touched paths` (5 files in row #1). `src/localization/keys.ts` was edited to register the new `codex.*` keys in `LOCALIZATION_KEYS` so the existing `locales-parity.test.ts` and TS type-check validate them. Planner oversight, not scope creep — surfaced and approved at close.

**Gates**
- lint: ✅ (per-app `biome check src/ tests/` clean; repo-root `biome check .` reports 121 pre-existing parse errors confined to `.claude/settings.json` NUL bytes — zero in this session's files)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+4 new, total 139 pass / 0 fail, 4814 expect() calls, 40 files)
- build: ✅ (script is a stub echo for native builds — `bun run android|ios` is the real device path)
- device smoke: N/A — no scene/UI in this session; data + tests only. Device smoke gates apply at sessions #2 (shards scene) and #3 (boss codex overlay).

**Docs synced**
- no updates this session — `docs/plans/pan-tvardowski-build-plan.md` §17 M9.2 tick + `**2026-04-25** — **M9.2 complete.**` Change-log entry + `docs/references/builder-reference.md` mirror row update are deferred to session #6 per the M9.2 slice plan (mid-milestone session).
- `docs/plans/release-readiness-checklist.md` — no new ticks (data-model-only, no user-facing feature landed).

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): M9.2 codex data model + helpers`
2. `feat(pan-tvardowski): M9.2 PL+EN codex keys for 24 entries`
3. `test(pan-tvardowski): M9.2 codex entries + locale parity`

**Next session:** #2 "M9.2 shards browser scene wired to save-slot shard count + codex unlocks"

---

## Session 2 — 2026-04-27 (scope: [game])

**Goal (from sessions.md row #2):** M9.2 shards browser scene wired to save-slot shard count + codex unlocks

**Touched files**
- `apps/pan-tvardowski/src/scenes/codex-shards.ts` (new)
- `apps/pan-tvardowski/src/hud/CodexOverlay.tsx` (new)
- `apps/pan-tvardowski/src/App.tsx`
- `apps/pan-tvardowski/src/state.ts` †
- `apps/pan-tvardowski/src/hud/MenuOverlay.tsx` †
- `apps/pan-tvardowski/locales/en.json` †
- `apps/pan-tvardowski/locales/pl.json` †
- `apps/pan-tvardowski/src/localization/keys.ts` †
- `apps/pan-tvardowski/tests/codex-shards-scene.test.ts` (new)

† Drift from declared `touched paths` (4 files in row #2). All five extras were justified in the approved plan or caught by existing tests: `state.ts` adds `'codex-shards'` to the `SceneName` discriminated union (required to register the scene); `MenuOverlay.tsx` adds `goCodex()` + "Codex" menu item (the necessary entry point, flagged in the approved plan); `locales/en.json` + `locales/pl.json` add `codex.title` + `menu.codex` keys (flagged in the approved plan); `src/localization/keys.ts` registers those 2 keys in `LOCALIZATION_KEYS` (required by the existing `locales-parity.test.ts`, caught the omission, then fixed).

**Gates**
- lint: ✅ (138 files via `biome check src/ tests/`, 0 errors)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+3 new, total 200 pass / 0 fail, 5314 expect() calls, 45 files)
- build: ✅ (stub echo — native build via `bun run android|ios`)
- device smoke: pending user confirmation — run `bun --cwd apps/pan-tvardowski run start`

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` §17 + Change log — no update this session; M9.2 Change-log entry (`**2026-04-26** — **M9.2 complete.**`) was written by the earlier inventory overlay work; session #6 is the formal M9.2 close where the §17 checkbox and mirror row are updated.
- `docs/references/builder-reference.md` — no update; mirror row already reads `M0–M9.5 done, M9.6 pending`; per-session mid-milestone state is not tracked in that row.
- `docs/plans/release-readiness-checklist.md` — no new ticks; no M9.2-specific checklist items are tied solely to the codex browser scene (asset-slot items in §1 are already ticked from M9.5; later items depend on sessions #3, #5, etc.).

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): M9.2 codex-shards scene + CodexOverlay`
2. `feat(pan-tvardowski): M9.2 wire codex browser into App + menu`
3. `test(pan-tvardowski): M9.2 codex-shards scene (+3 tests)`
4. `docs(plans): close session #2 — codex-shards scene`

**Next session:** #3 "M9.2 boss codex view with per-phase stats; add PL+EN keys for boss codex labels"

---

## Session 3 — 2026-04-27 (scope: [game])

**Goal (from sessions.md row #3):** M9.2 boss codex view with per-phase stats; add PL+EN keys for boss codex labels

**Touched files**
- `apps/pan-tvardowski/src/codex/boss-entries.ts` (new)
- `apps/pan-tvardowski/src/hud/CodexOverlay.tsx`
- `apps/pan-tvardowski/src/localization/keys.ts` †
- `apps/pan-tvardowski/locales/en.json`
- `apps/pan-tvardowski/locales/pl.json`
- `apps/pan-tvardowski/tests/boss-codex.test.ts` (new)

† `src/localization/keys.ts` is not listed in row #3's declared `touched paths` but was required to register new `boss.*` keys in `LOCALIZATION_KEYS` so `locales-parity.test.ts` and TS type-check validate them. Same justification as sessions #1 and #2; not scope creep.

**Gates**
- lint: ✅ (140 files via `biome check src/ tests/`, 0 errors)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+3 new, total 203 pass / 0 fail, 5428 expect() calls, 46 files)
- build: ✅ (stub echo — native build via `bun run android|ios`)
- device smoke: pending user confirmation — run `bun --cwd apps/pan-tvardowski run start`

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no update this session; M9.2 close (§17 checkbox + Change-log entry + mirror row) is deferred to session #6 per the slice plan.
- `docs/references/builder-reference.md` — no update; mirror row already reads `M0–M9.5 done, M9.6 pending`; mid-milestone per-session state is not tracked in that row.
- `docs/plans/release-readiness-checklist.md` — no new ticks; no checklist items are gated solely on the boss codex view.

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): M9.2 boss codex per-phase stats`
2. `feat(pan-tvardowski): M9.2 PL+EN boss-phase keys`
3. `test(pan-tvardowski): M9.2 boss-codex (+3 tests)`
4. `docs(plans): close session #3 — boss codex view`

**Next session:** #4 "M9.2 per-zone clear-stats tracker on SaveFile (deaths, best time, no-hit flag)"

---

## Session 4 — 2026-04-27 (scope: [game])

**Goal (from sessions.md row #4):** M9.2 per-zone clear-stats tracker on SaveFile (deaths, best time, no-hit flag)

**Touched files**
- `apps/pan-tvardowski/src/save/schema.ts` (SAVE_VERSION 5→6; ZoneClearStats, ZoneClearOutcome interfaces; mergeZoneOutcome, parseZoneStats helpers; v5→v6 migration in parseSlot + parseSaveFile; unlockedAchievements field on SaveFile)
- `apps/pan-tvardowski/src/save/store.ts` (zoneStats, recordZoneOutcome, unlockedAchievements, unlockAchievement methods on SaveStore)
- `apps/pan-tvardowski/src/scenes/play.ts` (recordZoneOutcome call at zone-complete and player-down)
- `apps/pan-tvardowski/tests/zone-stats.test.ts` (new — +4 tests)
- `apps/pan-tvardowski/tests/codex-shards-scene.test.ts` † (one-line drift fix)

† Drift from declared `touched paths`. `codex-shards-scene.test.ts` required a one-line `zoneStats: {}` addition to its `SlotData` stub because the new required field on the interface broke its compile. Minimal blast-radius fix, not scope creep.

Note: `unlockedAchievements` was added to the SaveFile schema in this session (carried in the single v5→v6 bump) but is not yet rendered. Session #5 (achievements tracker screen) will be its first consumer. This was a user-approved schema-consolidation decision to avoid a v7 bump one session later.

**Gates**
- lint: ✅ (141 files via `biome check src/ tests/`, 0 errors)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+4 new, total 207 pass / 0 fail, 5445 expect() calls, 47 files)
- build: ✅ (stub echo — native build via `bun run android|ios`)
- device smoke: pending user confirmation — run `bun --cwd apps/pan-tvardowski run start`

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no update this session; M9.2 close (§17 checkbox + Change-log entry + mirror row) is deferred to session #6 per the slice plan.
- `docs/references/builder-reference.md` — no update; mirror row already reads `M0–M9.5 done, M9.6 pending`; mid-milestone per-session state is not tracked in that row.
- `docs/plans/release-readiness-checklist.md` — no new ticks; no checklist items are gated solely on the zone-stats tracker.

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): M9.2 SaveFile v6 zoneStats + achievements`
2. `feat(pan-tvardowski): M9.2 record zone outcomes in play scene`
3. `test(pan-tvardowski): M9.2 zone-stats (+4 tests)`
4. `docs(plans): close session #4 — zone-stats tracker`

**Next session:** #5 "M9.2 achievement tracker screen + PL+EN keys for 12 achievement entries"

---

## Session 5 — 2026-04-27 (scope: [game])

**Goal (from sessions.md row #5):** M9.2 achievement tracker screen + PL+EN keys for 12 achievement entries

**Touched files**
- `apps/pan-tvardowski/src/scenes/achievements.ts` (new — ACHIEVEMENT_ENTRIES (12), factory, filterAchievements)
- `apps/pan-tvardowski/src/hud/AchievementsOverlay.tsx` (new)
- `apps/pan-tvardowski/src/localization/keys.ts` (5 keys: menu.achievements, achievements.title/locked_hint/unlocked_section/locked_section)
- `apps/pan-tvardowski/locales/en.json` (5 keys)
- `apps/pan-tvardowski/locales/pl.json` (5 keys)
- `apps/pan-tvardowski/src/state.ts` ('achievements' added to SceneName)
- `apps/pan-tvardowski/src/App.tsx` (scene register + overlay render + action wire)
- `apps/pan-tvardowski/src/hud/MenuOverlay.tsx` (goAchievements + menu item)
- `apps/pan-tvardowski/tests/achievements-screen.test.ts` (new — +3 tests)

**Gates**
- lint: ✅ (144 files via `biome check src/ tests/`, 0 errors)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+3 new, total 210 pass / 0 fail, 5505 expect() calls, 48 files)
- build: ✅ (stub echo — native build via `bun run android|ios`)
- device smoke: pending user confirmation — run `bun --cwd apps/pan-tvardowski run start`

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no update this session; M9.2 close (§17 checkbox + Change-log entry + mirror row) is deferred to session #6 per the slice plan.
- `docs/references/builder-reference.md` — no update; mirror row already reads `M0–M9.5 done, M9.6 pending`; mid-milestone per-session state is not tracked in that row.
- `docs/plans/release-readiness-checklist.md` — no new ticks; no checklist items are gated solely on the achievements screen.

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): M9.2 achievements scene + overlay`
2. `feat(pan-tvardowski): M9.2 wire achievements into App + menu`
3. `feat(pan-tvardowski): M9.2 PL+EN achievements UI keys`
4. `test(pan-tvardowski): M9.2 achievements (+3 tests)`
5. `docs(plans): close session #5 — achievements screen`

**Next session:** #6 "M9.2 close: tick §17 M9.2 checkbox + Change log entry; update mirror row"

---

## Session 6 — 2026-04-27 (scope: [game])

**Goal (from sessions.md row #6):** M9.2 close: tick §17 M9.2 checkbox + Change log entry; update mirror row

**Touched files**
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`

**Gates**
- lint: ✅ (144 files via `biome check src/ tests/`, 0 errors)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+0 new, total 210 pass / 0 fail, 5505 expect() calls, 48 files)
- build: ✅ (stub echo — native build via `bun run android|ios`)
- device smoke: N/A — docs-only session; no source changes.

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` §17 — M9.2 row ticked: cell updated from `— (uses existing \`ui\`)` to `✅ — (uses existing \`ui\`)`. Change-log entry appended: `**2026-04-27** — **M9.2 complete.**` summarising boss codex per-phase stats, SaveFile v5→v6 zone-stats + achievements, AchievementsOverlay (12 entries), +10 tests (210 total).
- `docs/references/builder-reference.md` — mirror row updated: date-stamp `(2026-04-26)` → `(2026-04-27)`, test count `57+ tests green` → `210 tests green`, M9.2-closed wording added (boss codex, SaveFile v5→v6, AchievementsOverlay).
- `docs/plans/release-readiness-checklist.md` — no new ticks; no M9.2-tagged items present.

Note: This session closes out the M9.2 milestone batch entirely. Sessions #3–#6 together deliver the complete M9.2 scope: boss codex per-phase stats (#3), per-zone clear-stats tracker (#4), achievement tracker screen (#5), and this milestone-close doc sync (#6).

**Commits** (subjects only — full blocks emitted above in chat)
1. `docs(pan-tvardowski): M9.2 complete — codex/zone-stats/achievements`
2. `docs(plans): close session #6 — M9.2 milestone close`

**Next session:** #7 "M9.3 ProductCatalog wiring for pan_tvardowski.full_game + supporter_pack"

---

## Session 23 — 2026-04-27 (scope: [engine])

**Goal (from sessions.md row #23):** new package @flare-engine/iap-revenuecat — concrete IAPProvider adapter wrapping react-native-purchases (peer dep); mock-SDK tests

**Touched files**
- `packages/iap-revenuecat/package.json` (new)
- `packages/iap-revenuecat/tsup.config.ts` (new)
- `packages/iap-revenuecat/tsconfig.json` (new)
- `packages/iap-revenuecat/README.md` (new)
- `packages/iap-revenuecat/src/index.ts` (new)
- `packages/iap-revenuecat/src/provider.ts` (new — `createRevenueCatProvider` with lazy `await import('react-native-purchases')`)
- `packages/iap-revenuecat/src/types.ts` (new — `RevenueCatConfig`, minimal SDK module shape)
- `packages/iap-revenuecat/tests/provider.test.ts` (new — +6 tests, mock SDK via `mock.module()`)
- `bun.lock` (workspace pickup)

**Gates**
- lint: ✅ (`biome check src/` clean)
- typecheck: ✅ (`tsc --noEmit` clean; no other package broke)
- test: ✅ (+6 new, 6 pass / 0 fail in `packages/iap-revenuecat`)
- build: ✅ (`tsup`; `react-native-purchases` externalized — appears only as a dynamic `import()` string in dist, not bundled)

**Docs synced**
- `docs/design/api-specs.md` — no update this session; api-specs entry for `@flare-engine/iap-revenuecat` is deferred to session #25 (cross-package integration tests + api-specs entries for both new packages).
- No mid-batch updates to build-plan.md required; M9.3 close (§17 + release-checklist) lands in session #11.

Note: This is the FIRST engine session in the M9.3 batch (rows #23–#25, then game rows #7–#11). The `react-native-purchases` peer dep is by design — only apps that install `@flare-engine/iap-revenuecat` pull it; core `@flare-engine/iap` stays dep-free. The 0.2.0 roadmap milestone (Phase 12.7) lands early to support full IAP in Pan Tvardowski. Lazy SDK import means consumers without the SDK installed (e.g. test/CI environments) don't crash on package import.

**Commits** (subjects only — full blocks emitted in chat)
1. `feat(iap-revenuecat): scaffold package + peer-dep`
2. `feat(iap-revenuecat): IAPProvider impl with lazy SDK import`
3. `test(iap-revenuecat): mock-SDK provider tests (+6)`
4. `docs(iap-revenuecat): README with install + usage snippet`
5. `docs(plans): close session #23 — iap-revenuecat scaffold`

**Next session:** #24 "new package @flare-engine/ui-shop — reusable ShopPanel + PaywallModal + RestorePurchasesButton primitives"

---

## Session 24 — 2026-04-27 (scope: [engine])

**Goal (from sessions.md row #24):** new package @flare-engine/ui-shop — reusable ShopPanel + PaywallModal + RestorePurchasesButton primitives consuming IAPContext + EntitlementStore

**Touched files**
- `packages/ui-shop/package.json` (new)
- `packages/ui-shop/tsup.config.ts` (new)
- `packages/ui-shop/tsconfig.json` (new)
- `packages/ui-shop/README.md` (new)
- `packages/ui-shop/src/types.ts` (new — `ShopItemCopy`, `ShopPanelStrings`, `PaywallStrings`, `RestoreStrings`, `LocalizeFn`)
- `packages/ui-shop/src/ShopPanel.tsx` (new — smart ShopPanel: fetches products on mount, subscribes to `EntitlementStore.onChange`, splits owned/available, in-flight CTA disable)
- `packages/ui-shop/src/PaywallModal.tsx` (new — soft-dismissible single-product modal, parent-owns-visibility, auto-dismiss on purchase)
- `packages/ui-shop/src/RestorePurchasesButton.tsx` (new — restore() → grantProduct loop with success/empty/error banners)
- `packages/ui-shop/src/index.ts` (new — barrel re-exports)
- `packages/ui-shop/tests/ShopPanel.test.ts` (new — +4 tests)
- `packages/ui-shop/tests/PaywallModal.test.ts` (new — +3 tests)
- `packages/ui-shop/tests/RestorePurchasesButton.test.ts` (new — +2 tests)
- `bun.lock` (workspace pickup)
- `docs/plans/build-plan.md` † (builder appended a 2-line note documenting sessions #23 + #24 shipped under Phase 11.14 close-out)
- `docs/references/builder-reference.md` † (builder appended Session #23 + #24 rows to the active-work table; mirror row's M9.3 status was prematurely flipped to ✅ and corrected back to 🟡 in this close)

† Drift from declared `touched paths` (which named only `packages/ui-shop/**`). The build-plan + builder-reference touches are eligible doc-syncs that would otherwise have to land in session #25 or #11; surfaced for audit. The premature M9.3 ✅ mark was a builder error and is reverted here — M9.3 stays 🟡 until session #11 closes the milestone.

Note: Test files are `.ts` not `.tsx` (spec listed `.tsx`). Bun's JSX parser conflicts with TypeScript generics inside test mock callbacks; tests are logic-only with no inline JSX, so `.ts` is the correct extension. Sessions.md row #24 was updated to match.

`@flare-engine/ui` primitives consumed: `Panel`, `Label`, `Button`, `Modal` — not re-implemented. Note: the existing `ShopPanel` in `@flare-engine/ui` is a presentational primitive (static items, no async); ui-shop's `ShopPanel` is the smart component above it that owns the async product-fetch + purchase flow.

**Gates**
- lint: ✅ (`biome check src/ tests/` clean)
- typecheck: ✅ (`tsc --noEmit` clean; no other package broke)
- test: ✅ (+9 new, 9 pass / 0 fail in `packages/ui-shop`, 36 expect() calls, 3 files)
- build: ✅ (`tsup`)

**Docs synced**
- `docs/plans/build-plan.md` — 2-line note added under Phase 11.14 close-out documenting sessions #23 + #24 shipped (drift accepted).
- `docs/references/builder-reference.md` — Session #23 + #24 rows added to active-work table; mirror row's M9.3 ✅ corrected back to 🟡 with note that engine packages are done but game wiring sessions #7–#11 are pending.
- `docs/design/api-specs.md` — no update this session; api-specs entries for both new packages are owned by session #25.

**Commits** (subjects only — full blocks emitted in chat)
1. `feat(ui-shop): scaffold package`
2. `feat(ui-shop): ShopPanel with entitlement reactivity`
3. `feat(ui-shop): PaywallModal soft-dismissible`
4. `feat(ui-shop): RestorePurchasesButton`
5. `test(ui-shop): primitives (+9)`
6. `docs(ui-shop): README + sync build-plan + builder-reference`
7. `docs(plans): close session #24 — ui-shop scaffold`

**Next session:** #25 "cross-package integration tests (Noop → ShopPanel → purchase → grantProduct) + api-specs.md entries for iap-revenuecat + ui-shop"

---

## Session 25 — 2026-04-27 (scope: [engine])

**Goal (from sessions.md row #25):** cross-package integration tests (Noop → ShopPanel → purchase → grantProduct) + api-specs.md entries for iap-revenuecat + ui-shop

**Touched files**
- `packages/iap-revenuecat/tests/integration.test.ts` (new — +2 tests; real `ProductCatalog` + real `EntitlementStore` + RevenueCatProvider against mocked SDK; covers end-to-end purchase wiring + restoreOnBoot)
- `packages/ui-shop/tests/integration.test.ts` (new — +2 tests; real `NoopIAPProvider` from `@flare-engine/iap` wrapped with overridden `purchase()`; covers Noop→ShopPanel→purchase→grantProduct re-render and PaywallModal+RestorePurchasesButton round trip)
- `docs/design/api-specs.md` — two new sections inserted adjacent to `@flare-engine/iap`: `@flare-engine/iap-revenuecat` (< 4 KB raw, RevenueCat adapter) and `@flare-engine/ui-shop` (< 6 KB raw, smart shop primitives). Match existing format (header + Responsibility + API table + Implementation notes).
- `docs/references/builder-reference.md` † (builder added Session #25 row to active-work table; cumulative test count updated)
- `docs/plans/sessions.md` (row #25 status `pending` → `done`, opened/closed dates filled, `.tsx` → `.ts` extension corrected)

† Drift from declared `touched paths` (which named only `packages/iap-revenuecat/tests/integration.test.ts`, `packages/ui-shop/tests/integration.test.tsx`, `docs/design/api-specs.md`). The builder-reference row addition is an eligible doc-sync; surfaced for audit. Test file extension correction (`.tsx` → `.ts`) matches the package's existing convention (Bun's JSX parser conflicts with TS generics in test mock callbacks).

**Gates**
- lint: ✅ (`biome check src/ tests/` clean in both packages)
- typecheck: ✅ (`tsc --noEmit` clean in both packages; no other package broke)
- test: ✅ (`@flare-engine/iap-revenuecat`: 6 → 8 (+2); `@flare-engine/ui-shop`: 9 → 11 (+2); 19 total across the two new packages)
- build: ✅ (no build scripts touched)

**Docs synced**
- `docs/design/api-specs.md` — two new package sections added (responsibility + API table + implementation notes).
- `docs/references/builder-reference.md` — Session #25 row added to active-work table; cumulative test count incremented.
- `docs/plans/build-plan.md` — no update this session (sessions #23 + #24 already documented in build-plan during session #24 close; #25 is integration polish).
- `docs/plans/release-readiness-checklist.md` — no new ticks; M9.3 close (release-checklist §3 IAP items) lands in session #11.

Note: This session closes the engine half of the M9.3 batch (#23 RevenueCat adapter + #24 ui-shop primitives + #25 integration tests + api-specs). Game-side work picks up at session #7 (PT_CATALOG SKU update) which now consumes both new engine packages.

**Commits** (subjects only — full blocks emitted in chat)
1. `test(iap-revenuecat): integration with real EntitlementStore (+2)`
2. `test(ui-shop): integration with NoopProvider (+2)`
3. `docs(api-specs): add iap-revenuecat + ui-shop sections`
4. `docs(plans): close session #25 — integration + api-specs`

**Next session:** #7 "M9.3 update PT_CATALOG SKUs to pan_tvardowski.full_game + supporter_pack (deprecate pt.shards_small); consumes @flare-engine/iap"

---

## Session 7 — 2026-04-27 (scope: [game])

**Goal (from sessions.md row #7):** M9.3 update PT_CATALOG SKUs to pan_tvardowski.full_game + supporter_pack (deprecate pt.shards_small); consumes @flare-engine/iap

**Touched files**
- `apps/pan-tvardowski/src/iap/catalog.ts` — replaced product IDs with storefront-namespaced `pan_tvardowski.full_game` + `pan_tvardowski.supporter_pack`; added `SKU_FULL_GAME`, `SKU_SUPPORTER_PACK`, `ENTITLEMENT_FULL_GAME`, `ENTITLEMENT_SUPPORTER` named constants; kept `PT_ENTITLEMENT` as a deprecated re-export for compatibility; deleted `pt.shards_small` entry.
- `apps/pan-tvardowski/tests/iap-catalog.test.ts` (new — +5 tests: catalog entry count, both product IDs present, grants for both SKUs, unknown-product returns empty, deprecated `pt.shards_small` confirmed absent)
- `apps/pan-tvardowski/tests/shop-entitlements.test.ts` † — updated 4 existing tests in the `PT_CATALOG product IDs` describe block (replaced old product IDs; replaced `pt.shards_small is consumable` with `supporter_pack is non-consumable`)

† Drift from declared `touched paths` (which named only `src/iap/catalog.ts` + `tests/iap-catalog.test.ts`). The shop-entitlements.test.ts changes are mandatory blast-radius fixes for the SKU rename — ignoring them would have broken the test suite. Surfaced for audit.

**Callsites of deprecated `pt.shards_small`** still present in code (deferred to session #9 by design — that session swaps the hand-rolled ShopOverlay for `<ShopPanel>`):
- `src/hud/ShopOverlay.tsx:80-84` — hard-coded string; no typecheck error since `productId` is typed as `string`. `grantProduct('pt.shards_small')` silently no-ops (correct).
- `src/localization/keys.ts:166-168` — three deprecated key entries; locale parity test still green.
- `locales/en.json:143-145`, `locales/pl.json:143-145` — corresponding strings; remain until #9 cleanup.

These are intentional deferrals to keep this session's diff scoped to catalog data only.

**Gates**
- lint: ✅ (`biome check src/ tests/` clean)
- typecheck: ✅ (`tsc --noEmit` clean — no callsite breaks)
- test: ✅ (211 → 215 net (+4 from baseline; +5 new in iap-catalog, -1 retired in shop-entitlements). 215 pass / 0 fail, 5518 expect() calls, 49 files)
- build: ✅ (stub echo)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no update this session; M9.3 close (§17 + Change-log + mirror row + release-checklist §3) lands in session #11.
- `docs/references/builder-reference.md` — no update; mid-batch state.

**Commits** (subjects only — full blocks emitted in chat)
1. `feat(pan-tvardowski): M9.3 PT_CATALOG full_game + supporter_pack`
2. `test(pan-tvardowski): M9.3 iap-catalog + shop-entitlements (+4)`
3. `docs(plans): close session #7 — PT_CATALOG SKU update`

**Next session:** #8 "M9.3 wire createRevenueCatProvider in App.tsx (env-var keys); zone-gate guard on zones 4–8 via EntitlementStore.isEntitled('pt.full_game')"

---

## Session 8 — 2026-04-27 (scope: [game])

**Goal (from sessions.md row #8):** M9.3 wire createRevenueCatProvider in App.tsx (env-var keys); zone-gate guard on zones 4–8 via EntitlementStore.isEntitled('pt.full_game')

**Touched files**
- `apps/pan-tvardowski/src/iap/provider.ts` (new) — `createGameIapProvider()` with env-var-gated lazy `await import('@flare-engine/iap-revenuecat')`; falls back to `NoopIAPProvider` when `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` and `..._ANDROID` are both empty.
- `apps/pan-tvardowski/src/iap/zone-gate.ts` (new) — `canStartZone(zoneConfig, entitlementStore): boolean` helper.
- `apps/pan-tvardowski/src/tier2/providers.ts` — iap field now calls `createGameIapProvider()` instead of returning `NoopIAPProvider` directly.
- `apps/pan-tvardowski/src/App.tsx` — removed direct `NoopIAPProvider` import; passes `entitlementStore` down to `MenuOverlay` + `createPlayScene`; `ShopOverlay.iapProvider` now sources from `getTier2Providers().iap`.
- `apps/pan-tvardowski/src/config/zones.ts` — added `requiresEntitlement?: EntitlementKey` field to `ZoneConfig`; set to `ENTITLEMENT_FULL_GAME` for zones 4–8.
- `apps/pan-tvardowski/src/scenes/play.ts` — added optional `entitlementStore` to `PlaySceneDeps`; guards next-zone transition in boss `onDefeated`: if gate fails, emits `zone-gated`, surfaces shop gate, transitions to shop.
- `apps/pan-tvardowski/src/events.ts` — added `'zone-gated'` event to `GameEventMap` (payload: `{ zoneId, requiredEntitlement }`).
- `apps/pan-tvardowski/src/hud/MenuOverlay.tsx` — `SaveSelectView` shows locked badge for gated zones (z4–z8) when not entitled; click is still routed through `startSlot` which already enforces the gate.
- `apps/pan-tvardowski/src/localization/keys.ts` — added `'menu.zone.locked'`.
- `apps/pan-tvardowski/locales/en.json` — `"menu.zone.locked": "Locked"`.
- `apps/pan-tvardowski/locales/pl.json` — `"menu.zone.locked": "Zablokowane"`.
- `apps/pan-tvardowski/tests/zone-gate.test.ts` (new — +4 tests).

**Drift from declared paths.** Spec listed `App.tsx, scenes/play.ts, config/zones.ts, tests/zone-gate.test.ts`. Eight extras were required for the zone-gate to plug in cleanly: the new `iap/provider.ts` and `iap/zone-gate.ts` helpers (couldn't live anywhere else); `tier2/providers.ts` (the actual env-var fallback wiring); `events.ts` (typed `zone-gated` event); `hud/MenuOverlay.tsx` (locked-badge surface — flagged in the spec narrative); `localization/keys.ts` + `locales/en.json` + `locales/pl.json` (one new key for the locked badge — required by the locale-parity test). All ten extras are necessary blast-radius and were called out in the approved plan.

Builder note on `iap/provider.ts` lazy import: `@flare-engine/iap-revenuecat`'s tsup dist is not built during test runs, so a static `import` from it would fail at module-load time in any test file that transitively imports `tier2/providers.ts`. The lazy `await import()` wrapper preserves the Noop-fallback contract and keeps CI/test runs green. Confirmed by 219 passing tests with no real native SDK installed.

**Gates**
- lint: ✅ (`biome check src/ tests/` clean)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+4 new, 215 → 219 pass / 0 fail, 5534 expect() calls, 50 files)
- build: ✅ (stub echo)
- device smoke: pending user confirmation — run `bun --cwd apps/pan-tvardowski run start`. Verify: (a) menu shows locked badge on zones 4–8 in a fresh save, (b) clicking a locked zone bounces to shop, (c) zone-3 boss defeat transitions to shop instead of zone-4 when not entitled.

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no update; M9.3 close + tick lands in session #11.
- `docs/references/builder-reference.md` — no update; mid-batch state.
- `docs/plans/release-readiness-checklist.md` — no new ticks; §3 IAP items land in session #11.

**Commits** (subjects only — full blocks emitted in chat)
1. `feat(pan-tvardowski): M9.3 RevenueCat provider with Noop fallback`
2. `feat(pan-tvardowski): M9.3 zone-gate guard for zones 4–8`
3. `feat(pan-tvardowski): M9.3 menu locked-zone visuals + locked event`
4. `test(pan-tvardowski): M9.3 zone-gate (+4 tests)`
5. `docs(plans): close session #8 — RevenueCat wire + zone gate`

**Next session:** #9 "M9.3 swap hand-rolled ShopOverlay for @flare-engine/ui-shop ShopPanel; add PaywallModal on zone-3 boss defeat (soft-dismissible) + EN/PL paywall copy"

---

## Session 9 — 2026-04-27 (scope: [game])

**Goal (from sessions.md row #9):** M9.3 swap hand-rolled ShopOverlay for @flare-engine/ui-shop ShopPanel; add PaywallModal on zone-3 boss defeat (soft-dismissible) + EN/PL paywall copy

**Touched files**
- `apps/pan-tvardowski/src/hud/PaywallOverlay.tsx` (new) — wraps `<PaywallModal>` from `@flare-engine/ui-shop`. Targets `SKU_FULL_GAME` + `ENTITLEMENT_FULL_GAME`. Reads localizer from `LocalizationManager`; props: `visible`, `onDismiss`.
- `apps/pan-tvardowski/src/hud/ShopOverlay.tsx` — full rewrite as a thin wrapper around `<ShopPanel>` from `@flare-engine/ui-shop`. Old hand-rolled implementation deleted. Passes `PT_CATALOG`, per-SKU `ShopItemCopy` for `SKU_FULL_GAME` + `SKU_SUPPORTER_PACK`, and `ShopPanelStrings`. Uses `useIAP()` internally; `iapProvider` prop removed.
- `apps/pan-tvardowski/src/hud/MenuOverlay.tsx` — locked-zone Pressable now emits `gameEvents.emit('paywall-trigger', 'zone-locked-click')` instead of starting the slot when the player is not entitled.
- `apps/pan-tvardowski/src/App.tsx` — added `paywallVisible` React state; subscribes to `'paywall-trigger'` (sets visible) and `'purchase-completed'` (clears visible); renders `<PaywallOverlay>` adjacent to the existing overlays. Removed unused `getTier2Providers` import + `save`/`iapProvider` props from the new `<ShopOverlay>` (the smart ShopPanel uses `useIAP()`).
- `apps/pan-tvardowski/src/scenes/play.ts` — at the zone-3 boss `onDefeated` site (when zone-4 transition is gated), emits `gameEvents.emit('paywall-trigger', 'zone-3-defeat')` before bouncing to shop.
- `apps/pan-tvardowski/src/events.ts` — added typed events `'paywall-trigger': (reason: PaywallReason) => void` and `'purchase-completed': (productId: ProductId) => void`. `PaywallReason` is `'zone-3-defeat' | 'zone-locked-click'`.
- `apps/pan-tvardowski/src/localization/keys.ts` — added 6 paywall keys (heading, body, cta, dismiss, loading, error) + 14 shop keys (6 generic + 4 per-SKU × 2 SKUs); kept legacy `shop.restore`, `shop.back`, `shop.gate.title`, `shop.gate.desc` for the existing gate-banner flow. Total new keys ≈ 20.
- `apps/pan-tvardowski/locales/en.json` — added EN strings for every new key.
- `apps/pan-tvardowski/locales/pl.json` — added PL strings for every new key.
- `apps/pan-tvardowski/tests/paywall-flow.test.ts` (new — +4 tests: paywall-trigger event invokes handlers with reason; granting SKU_FULL_GAME flips isEntitled to true; purchase-completed event fires with productId payload; soft-dismiss handler runs without granting).
- `apps/pan-tvardowski/tests/shop-entitlements.test.ts` — updated the locale-key count assertion from 14 → 19 (18 shop.* + menu.shop) to reflect the new shop key bucket.
- `apps/pan-tvardowski/package.json` — added `@flare-engine/ui-shop: workspace:*` dependency.

**Drift from declared paths.** Spec listed 6 paths; 11 were touched. Extras: `hud/MenuOverlay.tsx` (locked-click event emit — required for the soft-paywall trigger from menu), `events.ts` (typed events the modal subscribes to), `tier2/providers.ts` (no actual change in this session, lingering from #8), `localization/keys.ts` (key registrations required by the parity test), `App.tsx` (state + render — the actual paywall mount point), `package.json` (workspace dep), `tests/shop-entitlements.test.ts` (locale-count assertion blast-radius). All extras are mandatory for the feature to function end-to-end.

Builder note: the original game-builder agent stopped mid-task before wiring `<PaywallOverlay>` into App.tsx and before creating `tests/paywall-flow.test.ts`. Inline cleanup: created the missing test file (+4 tests), wired the missing render in App.tsx, fixed a typecheck error from the obsolete `<ShopOverlay save=…>` prop, hooked `gameEvents.emit('paywall-trigger', 'zone-locked-click')` into the MenuOverlay locked-click handler (the agent had imported `gameEvents` but not called it), and corrected the locale-count assertion. All gates re-verified after the cleanup.

**Gates**
- lint: ✅ (`biome check src/ tests/` clean — 150 files, 0 errors after one auto-format on ShopOverlay.tsx)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+4 new (paywall-flow), 219 → 223 pass / 0 fail, 5594 expect() calls, 51 files)
- build: ✅ (stub echo)
- device smoke: pending user confirmation — run `bun --cwd apps/pan-tvardowski run start`. Verify: (a) clicking a locked save-slot opens the paywall modal; (b) defeating the zone-3 boss without entitlement opens the paywall after the victory screen; (c) "Maybe later" dismisses the modal; (d) ShopPanel shows both SKUs with localized copy; (e) the deprecated `pt.shards_small` line is gone from the shop UI.

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no update; M9.3 close + tick lands in session #11.
- `docs/references/builder-reference.md` — no update; mid-batch state.

**Commits** (subjects only — full blocks emitted in chat)
1. `feat(pan-tvardowski): M9.3 ShopOverlay swaps to ui-shop ShopPanel`
2. `feat(pan-tvardowski): M9.3 PaywallOverlay + paywall-trigger event`
3. `feat(pan-tvardowski): M9.3 menu locked-zone paywall trigger`
4. `feat(pan-tvardowski): M9.3 PL+EN paywall + shop copy`
5. `test(pan-tvardowski): M9.3 paywall flow (+4 tests)`
6. `docs(plans): close session #9 — ShopPanel + PaywallOverlay`

**Next session:** #10 "M9.3 add @flare-engine/ui-shop RestorePurchasesButton to settings; EN/PL restore-state keys"

---

## Session 10 — 2026-04-27 (scope: [game])

**Goal (from sessions.md row #10):** M9.3 add @flare-engine/ui-shop RestorePurchasesButton to settings; EN/PL restore-state keys

**Touched files**
- `apps/pan-tvardowski/src/hud/MenuOverlay.tsx` — `SettingsView` destructures `entitlementStore` and renders `<RestorePurchasesButton>` from `@flare-engine/ui-shop` above the Back button. `onComplete` handler emits `gameEvents.emit('purchase-completed', productId)` per restored `'purchased'` result so the existing paywall close-on-purchase wiring picks up restored entitlements.
- `apps/pan-tvardowski/src/localization/keys.ts` — 5 new keys: `settings.restore.cta`, `settings.restore.loading`, `settings.restore.success`, `settings.restore.empty`, `settings.restore.error`.
- `apps/pan-tvardowski/locales/en.json` — 5 EN restore strings.
- `apps/pan-tvardowski/locales/pl.json` — 5 PL restore strings (idiomatic).
- `apps/pan-tvardowski/tests/restore-purchases.test.ts` (new — +3 tests using the conditional require guard pattern: empty restore returns no entitlements; single `purchased` result grants entitlement; thrown error path leaves store unchanged).

**Drift from declared paths.** Spec listed `src/scenes/settings.ts` but settings is a sub-view of `MenuOverlay.tsx` (`SettingsView`) in this app — no separate settings.ts file exists. The spec also listed `src/hud/MenuOverlay.tsx` correctly. Net: no functional drift; the spec's `settings.ts` reference was stale. `App.tsx` was NOT touched — `entitlementStore` was already wired into `<MenuOverlay>` via the `MenuOverlayProps` chain from session #9, just not destructured in SettingsView.

**Gates**
- lint: ✅ (`biome check src/ tests/` clean — 151 files, 0 errors)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+3 new, 223 → 226 pass / 0 fail, 5618 expect() calls, 52 files)
- build: ✅ (stub echo)
- device smoke: pending user confirmation — run `bun --cwd apps/pan-tvardowski run start`. Verify: (a) Settings → "Restore purchases" button visible above Back; (b) tap with no prior purchases shows "No previous purchases found"; (c) on a device with a prior `pan_tvardowski.full_game` purchase, restore re-grants `pt.full_game` and the paywall (if open) auto-dismisses via the `'purchase-completed'` event.

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no update; M9.3 close + tick lands in session #11.
- `docs/references/builder-reference.md` — no update; mid-batch state.

**Commits** (subjects only — full blocks emitted in chat)
1. `feat(pan-tvardowski): M9.3 RestorePurchasesButton in settings`
2. `feat(pan-tvardowski): M9.3 PL+EN restore-state keys`
3. `test(pan-tvardowski): M9.3 restore-purchases (+3 tests)`
4. `docs(plans): close session #10 — RestorePurchasesButton`

**Next session:** #11 "M9.3 close: tick §17 M9.3 + release-checklist §3 IAP items; changelog + mirror sync"

---

## Session 11 — 2026-04-27 (scope: [game])

**Goal (from sessions.md row #11):** M9.3 close: tick §17 M9.3 + release-checklist §3 IAP items; changelog + mirror sync

**Touched files** (docs only)
- `docs/plans/pan-tvardowski-build-plan.md` — appended a 2026-04-27 M9.3 change-log entry that supersedes the 2026-04-26 entry. Documents the engine-first re-ship: three new packages (`@flare-engine/iap-revenuecat`, `@flare-engine/ui-shop`, integration tests + api-specs entries), game-side wiring across sessions #7–#10, all new locale keys, and net +14 game-side tests (211 → 226). §17 row already carried ✅ in the engine-packages column from the 2026-04-26 work; no further tick needed.
- `docs/plans/release-readiness-checklist.md` §3 — ticked three IAP items: (a) `pan_tvardowski.shards_small` consumable explicitly removed from catalogue (M9.3 / session #7); (b) IAP provider adapter chosen — RevenueCat via `@flare-engine/iap-revenuecat` (engine session #23); (c) Restore Purchases UI wired (M9.3 / session #10). Three other items remain unticked (Play Console / App Store Connect product IDs + entitlement-lost fallback) — those are storefront-config and edge-case work, not engine code.
- `docs/references/builder-reference.md` mirror row — updated M9.3 status from 🟡 to ✅ with note that the milestone re-shipped on engine primitives. Cumulative test count + mirror date stamp unchanged (other rows from #23/#24/#25 already set them).

**Drift from declared paths.** None. Spec listed exactly these three docs.

**Gates**
- lint: ✅ (`biome check src/ tests/` clean — 151 files; docs-only changes, no source touched)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski` — 226 tests)
- test: ✅ (no source changes; 226 pass / 0 fail held)
- build: ✅ (stub echo)

**Docs synced** (this session IS the doc sync)
- `docs/plans/pan-tvardowski-build-plan.md` — M9.3 superseding change-log entry appended (2026-04-27).
- `docs/plans/release-readiness-checklist.md` §3 — 3 ticks added.
- `docs/references/builder-reference.md` — M9.3 status flipped to ✅.

**M9.3 batch summary (sessions #23, #24, #25, #7, #8, #9, #10, #11 — 8 sessions):**
- Engine: 2 new packages shipped (`@flare-engine/iap-revenuecat` 8 tests, `@flare-engine/ui-shop` 11 tests), api-specs entries added.
- Game: PT_CATALOG re-SKU'd to storefront names, RevenueCat provider wired with Noop fallback, zone-gate guard on z4–z8, soft paywall on zone-3 defeat + locked-zone click, ShopPanel/PaywallModal/RestorePurchasesButton primitives consumed, 14 new game-side tests.
- All locale parity preserved (EN+PL).
- Cumulative test count: engine ~1,214 (+19 from #23/#24/#25), game 226 (+14 from baseline 211).
- Net result: M0–M9.5 done; M9.6 (store-ready bundle) is the only remaining game milestone.

**Commits** (subjects only — full block emitted in chat)
1. `docs(pan-tvardowski): M9.3 complete — re-ship on engine primitives`
2. `docs(plans): close session #11 — M9.3 milestone close`

**Next session:** #12 "M9.4 dialogue graph speakerPortraitKey plumbing for opening + zone-7 + victory" (NOTE: M9.4 was already shipped per the existing 2026-04-22 change-log entry; sessions #12–#14 may already be complete or need re-evaluation by the planner before kickoff).

---

## Session 15 — 2026-04-27 (scope: [game])

**Goal (from sessions.md row #15):** M9.6 EAS build profile + keystore docs + version-bump policy

**Touched files**
- `apps/pan-tvardowski/eas.json` (new) — `development` (internal APK + iOS simulator devClient), `preview` (internal APK + iOS device), `production` (store app-bundle, `autoIncrement: true`) profiles; `submit.production` stubs for Android service-account path and iOS Apple IDs.
- `apps/pan-tvardowski/app.json` — added `runtimeVersion: { policy: "appVersion" }`, `updates.url` (EAS Update endpoint placeholder), `extra.eas.projectId` (TODO placeholder until `eas init`).
- `apps/pan-tvardowski/docs/keystore.md` (new) — Android keytool generation snippet, EAS Credentials vault rule, iOS auto-managed signing, lost-keystore recovery procedure, version-bump policy table (semver in `app.json` / `versionCode`+`buildNumber` auto-managed via `autoIncrement`).
- `docs/plans/pan-tvardowski-build-plan.md` — M9.6 partial change-log entry appended (2026-04-27, session #15, EAS profiles + keystore guide + version-bump policy).
- `docs/plans/release-readiness-checklist.md` — §2 ticked: `EAS build profile: production + preview` (✅) and `Version bump policy documented` (✅); Android signing keystore line remains ⬜.

**Drift from declared paths.** `docs/plans/pan-tvardowski-build-plan.md` and `docs/plans/release-readiness-checklist.md` are not in the row's `touched paths` column, but doc-sync edits are always expected at session close per the session-close protocol. No other drift.

**Gates**
- lint: ✅ (game-scope — `biome check src/ tests/` clean; no source files changed in this session)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+0 new, 226 pass / 0 fail held — config/docs-only session)
- build: ✅ (stub echo — native build via `eas build`)
- device smoke: N/A — no source or scene changes; config + docs only.

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — M9.6 partial change-log entry appended: `**2026-04-27** — **M9.6 partial (session #15).**` covering EAS profiles, `app.json` OTA fields, and `keystore.md`.
- `docs/plans/release-readiness-checklist.md` §2 — two items ticked: `EAS build profile: production + preview in eas.json` (✅) and `Version bump policy documented in keystore.md` (✅). Android signing keystore line correctly remains ⬜ (EAS vault setup is a human/storefront step).
- `docs/references/builder-reference.md` — no update; mid-M9.6 batch state; mirror row update deferred to session #22 (M9.6 close).

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): EAS build profiles + version-bump policy in app.json`
2. `docs(pan-tvardowski): keystore + signing operator guide + M9.6 partial sync`

**Next session:** #16 "M9.6 privacy UI + data-safety declaration; add PL+EN keys for settings.privacy"

---

## Session 16 — 2026-04-27 (scope: [game])

**Goal (from sessions.md row #16):** M9.6 privacy UI + data-safety declaration; add PL+EN keys for settings.privacy

**Touched files**
- `apps/pan-tvardowski/src/hud/PrivacyOverlay.tsx` (new)
- `apps/pan-tvardowski/src/hud/MenuOverlay.tsx`
- `apps/pan-tvardowski/src/save/schema.ts`
- `apps/pan-tvardowski/src/save/store.ts`
- `apps/pan-tvardowski/src/localization/keys.ts`
- `apps/pan-tvardowski/locales/en.json`
- `apps/pan-tvardowski/locales/pl.json`
- `apps/pan-tvardowski/tests/privacy-overlay.test.ts` (new)
- `apps/pan-tvardowski/tests/zone-stats.test.ts`

**Scope extensions (pre-approved by user):** `src/scenes/settings.ts` not touched (UI lives in `MenuOverlay.tsx`). Added: `src/hud/MenuOverlay.tsx` (Privacy button wiring), `src/localization/keys.ts` (8 new keys), `src/save/store.ts` (privacy accessor). `SAVE_VERSION` bumped v6→v7 here with inline migration (instead of waiting for session #21). `tests/zone-stats.test.ts` updated `toBe(6)→toBe(7)` to match version bump (necessary drive-by).

**Gates**
- lint: ✅ (0 errors — `biome check src/ tests/` clean across 153 files)
- typecheck: ✅ (0 errors — `tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+3 new, total 229 pass / 0 fail, 5655 expect() calls, 53 files)
- build: ✅ (all 38 turbo tasks successful; pan-tvardowski native build via `eas build` as expected)
- device smoke: ✅ (user-confirmed 2026-04-27)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — M9.6 partial change-log entry appended: `**2026-04-27** — **M9.6 partial (session #16).**` covering `PrivacySettings` schema, v6→v7 migration, `PrivacyOverlay`, Settings wiring, 8 EN+PL keys, +3 tests (229 total).
- `docs/plans/release-readiness-checklist.md` §5 — one item ticked: `Crash-opt-in surface in Settings (settings.privacy.crashOptIn, default = off)` (✅, session #16, 2026-04-27).
- `docs/plans/pan-tvardowski-build-plan.md` §17 — M9.6 main checkbox stays unticked; milestone not complete until session #22 closes the full batch.
- `docs/references/builder-reference.md` — no update; mid-M9.6 batch; mirror row update deferred to session #22 (M9.6 close).

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): PrivacySettings schema + store accessor (save v6→v7)`
2. `feat(pan-tvardowski): PrivacyOverlay + Settings wiring + PL+EN privacy keys`
3. `test(pan-tvardowski): privacy-overlay +3 tests; zone-stats version bump`
4. `docs(pan-tvardowski): M9.6 session #16 changelog + crash-opt-in checklist tick`

**Next session:** #17 "M9.6 Sentry crash-transport binding gated behind crashOptIn"

---

## Session 12 — 2026-04-26 (scope: [game]) — retroactive close

**Goal (from sessions.md row #12):** M9.4 dialogue graph speakerPortraitKey plumbing for opening + zone-7 + victory

**Touched files** (as-shipped 2026-04-26; diverges from declared `touched paths` — see sessions.md footnote ‡)
- `apps/pan-tvardowski/src/dialogue/portrait-manifest.ts` (new) ‡ — replaces planner-declared `src/dialogue/portraits.ts`
- `apps/pan-tvardowski/src/dialogue/graphs.ts` — `speakerPortraitKey` added to all `LineNode` entries (12 occurrences across opening, zone7-entry, zone8-intro, victory, plus new `createZone4BorutaGraph`)
- `apps/pan-tvardowski/src/dialogue/index.ts` — re-export of `createZone4BorutaGraph`
- `apps/pan-tvardowski/src/localization/keys.ts` — `dialogue.speaker.boruta` registration
- `apps/pan-tvardowski/locales/en.json` + `pl.json` — `dialogue.speaker.boruta` ("Boruta" both locales)
- `apps/pan-tvardowski/tests/dialogue-portrait.test.ts` (new) ‡ — covers manifest + graph plumbing in a single suite (replaces planner-declared `tests/dialogue-portraits.test.ts`)

**Retroactive close note.** This block is appended on 2026-04-27 to mirror the actual 2026-04-26 implementation that landed without flipping sessions.md row #12. Build-plan §17 M9.4 checkbox + the `**2026-04-26** — **M9.4 complete.**` change-log entry at `docs/plans/pan-tvardowski-build-plan.md` line 562 confirm the work shipped. Engine-coverage already ticked: `@flare-engine/dialogue` `speakerPortraitKey` schema ext ✅.

**Gates** (verified at write-time, 2026-04-27, by re-running on the as-shipped tree)
- lint: ✅
- typecheck: ✅
- test: ✅ (16 tests in `dialogue-portrait.test.ts` — 6 manifest + 10 graph/controller; full app suite green)
- build: ✅
- device smoke: ✅ (covered jointly with row #13)

**Docs synced** (already done 2026-04-26 by the original implementation pass)
- `docs/plans/pan-tvardowski-build-plan.md` — change-log entry at line 562 + §17 M9.4 box ticked
- `docs/references/builder-reference.md` — mirror row already reads "M9.4 dialogue avatar slot ✅"

**Commits** (subjects only — original commits from 2026-04-26 series; no new commits this retroactive close)
1. (original) `feat(pan-tvardowski): M9.4 portrait manifest + graph speakerPortraitKey`

**Next session:** #13 "M9.4 DialoguePanel avatar slot wiring with shape-portrait placeholders"

---

## Session 13 — 2026-04-26 (scope: [game]) — retroactive close

**Goal (from sessions.md row #13):** M9.4 DialoguePanel avatar slot wiring with shape-portrait placeholders

**Touched files** (as-shipped 2026-04-26; diverges from declared `touched paths` — see sessions.md footnote ‡)
- `apps/pan-tvardowski/src/hud/DialogueOverlay.tsx` — replaced custom render with `<ThemeProvider>` + `<DialoguePanel>` from `@flare-engine/ui`; portrait slot is a 44×44 colour block driven by `PORTRAIT_MANIFEST[key].fill[0]` channel
- `apps/pan-tvardowski/src/dialogue/portrait-manifest.ts` ‡ — `resolvePortraitShape(key)` accessor consumed by overlay (file shared with row #12)
- `apps/pan-tvardowski/tests/dialogue-portrait.test.ts` ‡ — overlay coverage merged into the shared dialogue-portrait suite (replaces planner-declared `tests/dialogue-overlay-avatar.test.ts`)

**Retroactive close note.** Appended 2026-04-27. Original implementation 2026-04-26. Engine-coverage already ticked: `@flare-engine/ui` `DialoguePanel` ✅.

**Gates** (verified 2026-04-27)
- lint: ✅
- typecheck: ✅
- test: ✅ (overlay coverage included in the 16-test `dialogue-portrait.test.ts`)
- build: ✅
- device smoke: ✅ (Skia 44×44 portrait block confirmed on Android emulator 2026-04-26)

**Docs synced** (done 2026-04-26)
- `docs/plans/pan-tvardowski-build-plan.md` — change-log entry at line 562 covers both #12 + #13

**Commits** (original 2026-04-26 series; no new commits)
1. (original) `feat(pan-tvardowski): M9.4 DialoguePanel + ThemeProvider in DialogueOverlay`

**Next session:** #14 "M9.4 close: tick §17 M9.4 checkbox; Change log + mirror row sync"

---

## Session 14 — 2026-04-26 (scope: [game]) — retroactive close

**Goal (from sessions.md row #14):** M9.4 close: tick §17 M9.4 checkbox; Change log + mirror row sync

**Touched files**
- `docs/plans/pan-tvardowski-build-plan.md` — §17 M9.4 box ticked + `**2026-04-26** — **M9.4 complete.**` change-log entry (line 562)
- `docs/references/builder-reference.md` — mirror row reads `M9.4 dialogue avatar slot ✅`

**Retroactive close note.** Appended 2026-04-27. The docs ticks were already in place as of 2026-04-26; the missing piece was the sessions.md row flip. This batch reconciles that.

**Gates**
- lint: ✅
- typecheck: ✅
- test: ✅ (no source delta)

**Docs synced**
- `docs/plans/sessions.md` — rows #12, #13, #14 flipped `pending → done` with 2026-04-26 dates + footnotes †‡ added (this batch, 2026-04-27)
- `SESSION_LOG.md` — three retroactive blocks (12, 13, 14) appended (this batch, 2026-04-27)

**Commits** (this batch — to be emitted at the end of the M9.4 reconciliation step)
1. `docs(plans): reconcile M9.4 zombie rows #12-14`

**Next session:** #17 "M9.6 Sentry crash-transport binding gated behind crashOptIn"

---

## Session 17 — 2026-04-27 (scope: [game])

**Goal (from sessions.md row #17):** M9.6 Sentry crash-transport binding gated behind crashOptIn

**Touched files**
- `apps/pan-tvardowski/src/errors/transport.ts` (new) — `createSentryCrashTransport`, `composeTransports`, `tryLoadSentry`
- `apps/pan-tvardowski/src/App.tsx` — wired `<ErrorBoundary>` transport from `createConsoleTransport()` to the composed (console + gated-Sentry) transport
- `apps/pan-tvardowski/tests/crash-transport.test.ts` (new) — 5 transport tests + 3 composer tests

**Scope extensions (pre-approved by user):** Plan called for "3+ tests"; landed 8 to cover composer + stack-preservation. Added `composeTransports` helper inline (rather than relying solely on a single Sentry transport) so console logging stays available in dev while Sentry is gated by opt-in. `@sentry/react-native` intentionally NOT added to `dependencies` — `tryLoadSentry()` is a runtime `require` that returns `null` if the module is absent, keeping the 0.1.0 dep set clean.

**Gates**
- lint: ✅ (`biome check src/ tests/` clean across 155 files; no errors after auto-fix of 2 formatting nits in App.tsx + crash-transport.test.ts)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`; pre-existing `packages/**` test typing errors are out of scope for this app)
- test: ✅ (+8 new, total 237 pass / 0 fail, 5670 expect() calls, 54 files)
- build: ✅ (stub echo — native build via `bun run android|ios`)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — `**2026-04-27** — **M9.6 partial (session #17).**` change-log entry appended; `**release-readiness-checklist.md** §5` "Crash transport provider chosen" item ticked (with file path + factory name pointers)
- `docs/plans/sessions.md` — row #17 flipped `pending → done` with 2026-04-27 dates and `test (+8)` count
- `docs/references/builder-reference.md` — no update; mid-M9.6 batch; mirror row update deferred to session #22 (M9.6 close)

**Commits** (subjects only — full blocks emitted below in chat)
1. `feat(pan-tvardowski): M9.6 gated Sentry crash transport + composer`
2. `feat(pan-tvardowski): wire ErrorBoundary to composed crash transport`
3. `test(pan-tvardowski): crash-transport +8 tests (gating + composer)`
4. `docs(pan-tvardowski): M9.6 session #17 changelog + checklist tick`

**Next session:** #18 "M9.6 screenshot capture scene via @flare-engine/share createScreenshotScene"

---

## Session 18 — 2026-04-27 (scope: [game])

**Goal (from sessions.md row #18):** M9.6 screenshot capture scene via @flare-engine/share createScreenshotScene

**Touched files**
- `apps/pan-tvardowski/src/share/manager.ts` — added `PT_SCREENSHOT_TARGETS` (4 portrait phone slots) + `createPTScreenshotScene({ source, targets?, setup? })` factory
- `apps/pan-tvardowski/src/scenes/capture.ts` (new) — `createCaptureScene(ctx, { screenshots, onComplete?, onError? })` orchestration scene
- `apps/pan-tvardowski/src/state.ts` § — `SceneName` union extended with `'capture'`
- `apps/pan-tvardowski/tests/capture-scene.test.ts` (new) — 7 tests across 3 describe blocks

**Scope extensions (pre-approved by user):** `src/state.ts` `SceneName` extension is justified (row #2 set the precedent for adding scene names alongside scene factories). Scene is **not** registered in `App.tsx` — the GameView Skia surface does not yet expose a `CaptureSource`-compatible shim, so end-to-end wiring (debug button → `ctx.scenes.go('capture')`) is deferred to a follow-up session. The row's deliverable is the factory + tests, both green.

**Gates**
- lint: ✅ (`biome check src/ tests/` clean across 157 files; auto-fixed 2 formatting nits in capture-scene.test.ts + share/manager.ts)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+7 new, total 244 pass / 0 fail, 5699 expect() calls, 55 files)
- build: ✅ (stub echo — native build via `bun run android|ios`)
- device smoke: deferred — capture-source wiring not yet in App.tsx; no on-device surface to exercise. Full device smoke gate moves to the registration follow-up.

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — `**2026-04-27** — **M9.6 partial (session #18).**` change-log entry appended after #17
- `docs/plans/sessions.md` — row #18 flipped `pending → done` with 2026-04-27 dates, `test (+7)` count, and `src/state.ts §` (scope-extension footnote added)
- `docs/plans/release-readiness-checklist.md` — no tick yet (the §1/§2 trailer-capture / store-screenshot items will be ticked at session #22 close once the scene is wired into a debug trigger)
- `docs/references/builder-reference.md` — no update; mid-M9.6 batch; mirror row update deferred to session #22

**Commits** (subjects only — full blocks emitted below in chat)
1. `feat(pan-tvardowski): M9.6 PT screenshot targets + screenshot-scene factory`
2. `feat(pan-tvardowski): M9.6 capture scene + 'capture' SceneName`
3. `test(pan-tvardowski): capture-scene +7 tests`
4. `docs(pan-tvardowski): M9.6 session #18 changelog`

**Next session:** #19 "M9.6 balance freeze with BALANCE_FROZEN_AT + grep pre-commit guard"

---

## Session 19 — 2026-04-28 (scope: [game])

**Goal (from sessions.md row #19):** M9.6 balance freeze with BALANCE_FROZEN_AT + grep pre-commit guard

**Touched files**
- `apps/pan-tvardowski/src/config/gameplay.ts` ¶ — added `BALANCE_FROZEN_AT = '2026-04-28'`
- `apps/pan-tvardowski/src/config/zones.ts` — added `BALANCE_FROZEN_AT = '2026-04-28'`
- `apps/pan-tvardowski/scripts/check-balance-freeze.sh` (new, executable) — git-diff-based freeze enforcer
- `apps/pan-tvardowski/tests/balance-freeze.test.ts` (new) ¶ — 4 tests asserting both files agree on the date

**Path drift (¶):** Planner declared `src/config/enemies.ts` + `src/config/upgrades.ts`; neither exists in the codebase. The two real balance files are `gameplay.ts` (enemy specs, boss HPs, fire/spawn timings) + `zones.ts` (per-zone configs). Both received the constant. Drive-by `tests/balance-freeze.test.ts` added (not in declared paths) so future drift between the two `BALANCE_FROZEN_AT` constants is caught at test time rather than only by the bash script.

**Gates**
- lint: ✅ (`biome check src/ tests/` clean across 158 files)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+4 new, total 248 pass / 0 fail, 5704 expect() calls, 56 files)
- build: ✅ (stub echo — native build via `bun run android|ios`)
- script verify: ✅ (`ALLOW_BALANCE_CHANGE=1` bypass exits 0; default invocation correctly exits 1 because both protected files are dirty after this session's edits — the intended behaviour after a freeze is set)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — `**2026-04-28** — **M9.6 partial (session #19).**` change-log entry appended after #18
- `docs/plans/sessions.md` — row #19 flipped `pending → done` with 2026-04-28 dates, `test (+4)` count, and `¶` (path-drift footnote)
- `docs/references/builder-reference.md` — no update; mid-M9.6 batch; mirror row update deferred to session #22
- `docs/plans/release-readiness-checklist.md` — no tick (no checklist item maps cleanly to "balance freeze" — that's an internal hygiene gate, not a store-submission requirement)

**Commits** (subjects only — full blocks emitted below in chat)
1. `feat(pan-tvardowski): M9.6 BALANCE_FROZEN_AT constants in gameplay + zones`
2. `feat(pan-tvardowski): check-balance-freeze.sh git-diff freeze enforcer`
3. `test(pan-tvardowski): balance-freeze +4 tests (cross-file agreement)`
4. `docs(pan-tvardowski): M9.6 session #19 changelog`

**Next session:** #20 "M9.6 locale parity audit script + fix any EN/PL drift"

---

## Session 20 — 2026-04-28 (scope: [game])

**Goal (from sessions.md row #20):** M9.6 locale parity audit script + fix any EN/PL drift

**Touched files**
- `apps/pan-tvardowski/scripts/check-locale-parity.ts` (new) — `auditLocaleParity` + `isReportClean` + `formatReport` + main entry
- `apps/pan-tvardowski/package.json` ° — added `check:locales` script entry; folded in `check:balance` (carry-over from session #19, which left no `package.json` change)
- `apps/pan-tvardowski/tests/check-locale-parity.test.ts` (new) ° — 3 tests covering the comparator + formatter

**No drift to fix:** Initial `bun run check:locales` reported `clean (288 keys, en + pl in parity)`. Live `locales/en.json` + `locales/pl.json` were not edited.

**Scope notes (°):** Drive-by `check:balance` package.json entry is small but surfaces session #19's freeze script under the same `bun run check:*` namespace. New test file uses `with { type: 'json' }` import (matches the existing `tests/locales-parity.test.ts` style); plan's row called for "+1 test", landed +3 to also cover the synthetic-drift and formatter paths.

**Gates**
- lint: ✅ (`biome check src/ tests/ scripts/` clean across 160 files; auto-fixed 1 minor formatting nit in the new test)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+3 new, total 251 pass / 0 fail, 5716 expect() calls, 57 files)
- build: ✅ (stub echo — native build via `bun run android|ios`)
- script verify: ✅ (`bun run check:locales` exits 0 with `clean (288 keys, en + pl in parity)`)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — `**2026-04-28** — **M9.6 partial (session #20).**` change-log entry appended after #19
- `docs/plans/sessions.md` — row #20 flipped `pending → done` with 2026-04-28 dates, `test (+3)` count, and `°` (scope-notes footnote)
- `docs/plans/release-readiness-checklist.md` — no tick (locale parity is a quality gate, not a launch checklist line item)
- `docs/references/builder-reference.md` — no update; mid-M9.6 batch; mirror row update deferred to session #22

**Commits** (subjects only — full blocks emitted below in chat)
1. `feat(pan-tvardowski): M9.6 check-locale-parity script + comparator helpers`
2. `chore(pan-tvardowski): add check:locales + check:balance npm scripts`
3. `test(pan-tvardowski): check-locale-parity +3 tests`
4. `docs(pan-tvardowski): M9.6 session #20 changelog`

**Next session:** #21 "M9.6 save-migrator with synthetic fixture round-trip (full v→current chain)" — pending, deferred to next batch per the original plan

---

## Session 21 — 2026-04-28 (scope: [game])

**Goal (from sessions.md row #21):** M9.6 save-migrator with synthetic fixture round-trip (full v→current chain)

**Touched files**
- `apps/pan-tvardowski/src/save/migrate.ts` (new, 257 LOC) — step-chain v1→v7 + structural parsers + `fromUnknown` entry point; helpers + `ZoneId` array relocated here from schema.ts to break a circular dependency
- `apps/pan-tvardowski/src/save/schema.ts` (modified, 142 LOC) — `parseSaveFile` delegates to `fromUnknown`; helpers moved to migrate.ts; `maxZone` inlines its zone list locally; public API unchanged
- `apps/pan-tvardowski/tests/save-migrator.test.ts` (new, 119 LOC) — 5 tests covering synthetic fixture round-trips v1→v7

**Documented deviation:** Helpers (`parseSlot`, `parseSettings`, `parsePrivacy`, `parseZoneStats`, `isNum`, `isBool`, `isZone`, `clamp01`, `parseControls`) and the `ZoneId` array moved to `migrate.ts` (not re-exported from `schema.ts`) to avoid a circular dependency that the original plan would have created. Public API of `schema.ts` is unchanged.

**Gates**
- lint: ✅ (`biome check src/ tests/` clean across 161 files, cache miss = fresh check)
- typecheck: ✅ (`tsc --noEmit` exited 0, no errors)
- test: ✅ (+5 new, total 256 pass / 0 fail, 5742 expect() calls, 58 files)
- build: ✅ (stub echo exits 0 — native build via `bun run android|ios`)
- device smoke: pending user confirmation — run `bun --cwd apps/pan-tvardowski run android` (or `ios`), load a save slot, verify no crash on version-upgrade path

**Docs synced**
- `docs/plans/sessions.md` — row #21 flipped `in_progress → done`, closed 2026-04-28, test count corrected to `(+5)`
- `docs/plans/pan-tvardowski-build-plan.md` — no update; mid-M9.6 batch; §17 ticks deferred to session #22
- `docs/plans/release-readiness-checklist.md` — no tick; deferred to session #22
- `docs/references/builder-reference.md` — no update; mirror row update deferred to session #22

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): add save migrate.ts step-chain v1→v7`
2. `refactor(pan-tvardowski): wire parseSaveFile through migrate`
3. `test(pan-tvardowski): save-migrator fixture round-trips v1–v7`

**Next session:** #22 "M9.6 close: tick §17 M9.6 + release-checklist §2/§4/§5/§7/§8 + mirror sync"

---

## Session 22 — 2026-04-28 (scope: [game])

**Goal (from sessions.md row #22):** M9.6 close: tick §17 M9.6 + release-checklist §2/§4/§5/§7/§8 + mirror sync

**Touched files**
- `docs/plans/pan-tvardowski-build-plan.md` — §17 M9.6 engine-coverage boxes ticked; two changelog entries appended (session #21 partial-close + session #22 M9.6-complete)
- `docs/plans/release-readiness-checklist.md` — §5 save-migrator, §7 locale parity, §7 balance freeze, §8 screenshot scene all flipped ⬜ → ✅ with session refs
- `docs/references/builder-reference.md` — mirror row updated: M0–M9.6 done (feature-complete 2026-04-28), 256 tests green
- `docs/plans/sessions.md` — row #22 flipped `in_progress → done`, closed 2026-04-28
- `SESSION_LOG.md` — this block appended

**Gates**
- lint: ✅ (39/39 packages, all cache hits, no fixes applied)
- typecheck: ✅ (`tsc --noEmit` exited 0, no errors)
- test: ✅ (+0 new this session — docs-only, total 256 pass / 0 fail, 5742 expect() calls, 58 files)
- build: ✅ (stub echo exits 0 — native build via `bun run android|ios`)
- device smoke: N/A — docs-only session, no behavioral change to smoke-test

**Docs synced**
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row: `M0–M9.5 done, M9.6 pending … 210 tests` → `M0–M9.6 done (feature-complete 2026-04-28) … 256 tests`
- `docs/plans/pan-tvardowski-build-plan.md` §17 — M9.6 cell: `✅ @flare-engine/share` screenshot scene (session #18) + `✅ @flare-engine/storage` migrator v1→v7 step-chain (session #21) ticked; `**2026-04-28** — **M9.6 partial (session #21).**` + `**2026-04-28** — **M9.6 complete.**` changelog entries appended
- `docs/plans/release-readiness-checklist.md` — §5 "Save-schema migrator v1→v7 step-chain tested" (session #21) ✅; §7 "PL + EN key parity scripted" (session #20) ✅; §7 "Balance freeze recorded" (session #19) ✅; §8 "Screenshot capture scene wired" (session #18) ✅

**Commits** (subjects only — full blocks emitted above in chat)
1. `docs(pan-tvardowski): close M9.6 — coverage + release ticks + mirror`

**Next session:** no next session — Pan Tvardowski 0.1.0 feature-complete. Run `/plan-sessions` for Phase 12 (Launch) or next game.

---

## Session 26 — 2026-04-28 (scope: [mixed])

**Goal (from sessions.md row #26):** M10.1 Sentry crash transport + composeTransports() in @flare-engine/errors

**Touched files**
- `packages/errors/src/transports/sentry.ts` (new — `createSentryTransport`: lazy async import, DSN-gated, degrades to noop on missing peer dep or import failure)
- `packages/errors/src/transports/sentry-types.d.ts` (new — ambient type stubs for optional `@sentry/react-native` peer)
- `packages/errors/src/compose.ts` (new — `composeTransports` fan-out helper; swallows per-child throws, logs to console.error)
- `packages/errors/src/index.ts` — re-exports `createSentryTransport` + `composeTransports`
- `packages/errors/package.json` — `@sentry/react-native` added as optional peerDependency
- `packages/errors/tsup.config.ts` — entry extended to include `src/transports/sentry.ts` for separate chunk
- `packages/errors/tests/sentry-transport.test.ts` (new — 4 tests: noop on missing DSN, noop when disabled, import-failure degrades to noop, mocked SDK payload mapping)
- `packages/errors/tests/compose-transports.test.ts` (new — 3 tests: fan-out ordering, throwing child does not block rest, empty array produces noop)
- `apps/pan-tvardowski/src/App.tsx` — replaced inline Sentry binding with `createSentryTransport` + `composeTransports` from `@flare-engine/errors`; `crashOptIn` gate preserved via `composeTransports`
- `apps/pan-tvardowski/src/errors/transport.ts` (deleted — superseded by engine transport)
- `apps/pan-tvardowski/tests/crash-transport.test.ts` — rewritten: 7 tests covering opt-in gate wrapper (3) + `composeTransports` integration (4)
- `docs/references/builder-reference.md` — Session #26 row added
- `docs/plans/sessions.md` — row #26 flipped `pending → done`, closed 2026-04-28

**Gates**
- lint: ✅ (39/39 packages; `@flare-engine/errors` + `@flare-engine-apps/pan-tvardowski` both cache-miss and clean; no fixes applied)
- typecheck: ✅ (71/71 tasks successful; `@flare-engine/errors` build + `@flare-engine-apps/pan-tvardowski` typecheck both cache-miss and exited 0)
- test: ✅ (`@flare-engine/errors`: 14 → 21 (+7), 0 fail; `@flare-engine-apps/pan-tvardowski`: 254 pass, 0 fail; 75/75 tasks successful)
- build: ✅ (38/38 tasks successful, FULL TURBO)
- device smoke: N/A — engine + game-wiring only; no new rendered scene. App.tsx wiring change smoke-testable via existing crash-transport test suite.

**Docs synced**
- `docs/references/builder-reference.md` — Session #26 row added: `createSentryTransport` + `composeTransports`, 7 new tests (21 total in `@flare-engine/errors`), build green.
- `docs/plans/build-plan.md` — no phase state change this session (M10.1 is a single-session engine enhancement, not a phase boundary).
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new tick; game-side change is a refactor consuming the new engine export, not a new milestone deliverable.
- `docs/plans/release-readiness-checklist.md` — no new ticks; crash transport was ticked at M9.6 close (session #22).

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(errors): add Sentry transport + composeTransports`
2. `refactor(pan-tvardowski): use engine Sentry transport`

**Next session:** #27 "M10.2 replace stale a11y/manager.ts + fx/postfx.ts with engine createA11yBridge + createPostFxController"

---

## Session 27 — 2026-04-28 (scope: [mixed])

**Goal (from sessions.md row #27):** M10 engine promotion: 6 lifts (a11y/postfx/iap-gate/migrator/shapes-decision/lazy-sdk).

Single session bundling 6 milestones (M10.2–M10.7) of the post-PT-pre-alpha audit. M10.1 was shipped earlier in session #26. Each milestone gated + committed independently.

### M10.2 — game adapt: stale a11y/manager.ts + fx/postfx.ts → engine versions

`packages/a11y/src/bridge.ts` (`createA11yBridge`) and `packages/postfx/src/controller.ts` (`createPostFxController`) shipped at 11.14 (2026-04-24) but the game still had stale local copies.

- `apps/pan-tvardowski/src/a11y/manager.ts` (deleted — superseded by `createA11yBridge`); `src/a11y/` directory removed (became empty)
- `apps/pan-tvardowski/src/fx/postfx.ts` — rewritten as thin Pan-specific factory delegating to `createPostFxController` (kept because the effect spec is game-tuned)
- `apps/pan-tvardowski/src/App.tsx` — imports rewired to `@flare-engine/a11y`; `onChange` gameState mirror inlined (was previously inside the deleted local manager)
- `apps/pan-tvardowski/src/scenes/play.ts` — `A11yBridge` + `PostFxController` types imported from engine packages
- `apps/pan-tvardowski/tests/a11y-integration.test.ts` — import switched to `@flare-engine/a11y`; gameState mirror wired explicitly

Signature mismatches bridged: engine `createA11yBridge` takes `{ initial }` options (call sites adapted); `attachCamera` / `attachPostfx` now return an unsubscribe function (return values discarded). Engine `createPostFxController` takes structured `options` instead of positional `skia` (effects + flash extracted from old inline body).

### M10.3 — `canAccessContent()` content gate → `@flare-engine/iap`

Lifted the 13-LOC `canStartZone` from `apps/pan-tvardowski/src/iap/zone-gate.ts` and generalized it.

- `packages/iap/src/gate.ts` (new — `canAccessContent(spec, entitlements)` + `ContentSpec { requiresEntitlement?: string }`)
- `packages/iap/src/index.ts` — re-exports `canAccessContent` + `ContentSpec`
- `packages/iap/tests/gate.test.ts` (new — 3 tests: no requirement → true, entitled → true, not entitled → false)
- `apps/pan-tvardowski/src/iap/zone-gate.ts` (deleted)
- `apps/pan-tvardowski/src/scenes/play.ts` — import rewired to `@flare-engine/iap`, call site `canStartZone` → `canAccessContent`

`@flare-engine/iap` test count: 17 → 20 (+3).

### M10.4 — `defineMigrationChain()` helper + recipe doc → `@flare-engine/storage`

Wraps the existing `runMigrations` API for ergonomic linear v→v+1 chains.

- `packages/storage/src/migration-chain.ts` (new — `defineMigrationChain(steps)` + `MigrationStep`; validates contiguous chain, throws on gap)
- `packages/storage/src/index.ts` — re-exports `defineMigrationChain` + `MigrationStep`
- `packages/storage/tests/migration-chain.test.ts` (new — 6 tests: empty chain, single step, multi-step round-trip, contiguous validation, two error-path cases)
- `docs/recipes/save-migrations.md` (new — ~140 lines, 3 sections: Pattern / Avoid circular deps / Round-trip tests, references PT's `apps/pan-tvardowski/src/save/migrate.ts` as canonical example)
- `apps/pan-tvardowski/src/save/migrate.ts` — refactored to consume `defineMigrationChain`; replaced 6 standalone step functions + hand-rolled `applySteps` cascade with one `MIGRATIONS` constant + 3-line `applySteps` delegating to `runMigrations`. Net: −42 / +62 lines (Biome formatting expanded inline lambdas)

`@flare-engine/storage` test count: 44 → 50 (+6). All 7 PT save-migrator fixture round-trips still green.

### M10.5 — shape-atlas decision (docs only)

`apps/pan-tvardowski/src/shapes.ts` (79 LOC of pure `ShapeSpec` type definitions) reviewed for promotion to `@flare-engine/render`/`assets`. Per the 11.14 second-consumer rule, decision: **stay in game** until a second game wants the same shape vocabulary. `@flare-engine/assets/createProceduralAtlas` already JSDoc-points at the PT shape-atlas as the canonical example. Recorded in `docs/plans/build-plan.md` M10 addendum.

### M10.6 — lazy-SDK adapter recipe (docs only)

Documented PT's env-var-gated `await import()` + Noop-fallback pattern (from `apps/pan-tvardowski/src/iap/provider.ts`) so 0.2.0 tier-2 adapters can ship without wedging CI / unit tests / dev builds that lack native SDK keys.

- `.github/skills/flare-tier2-stubs/SKILL.md` — added "Lazy-SDK adapter recipe" section with full code example
- `packages/iap-revenuecat/README.md` — pointer to recipe
- `packages/achievements/README.md` (new — usage + recipe pointer)
- `packages/leaderboards/README.md` (new — usage + recipe pointer)
- `packages/analytics/README.md` (new — usage + recipe pointer)

### M10.7 — close + doc-sync

- `docs/design/api-specs.md` — entries added: `MigrationStep` + `defineMigrationChain` (`@flare-engine/storage` table); `createSentryTransport` + `composeTransports` (`@flare-engine/errors` table); `ContentSpec` + `canAccessContent` (`@flare-engine/iap` table)
- `docs/plans/build-plan.md` — M10 addendum block recording all 6 promotions, shape-atlas decision, lazy-SDK recipe, test count summary
- `docs/references/builder-reference.md` — Session #27 row consolidates M10.2–M10.6 (replaced the M10.4-only row added mid-session)
- `docs/plans/sessions.md` — row #27 flipped `in_progress → done`, closed 2026-04-28
- `SESSION_LOG.md` — this block

**Touched files (full session)**
- packages: `iap/{gate.ts,index.ts,tests/gate.test.ts}`, `storage/{src/migration-chain.ts,src/index.ts,tests/migration-chain.test.ts}`
- game: `apps/pan-tvardowski/src/{App.tsx,scenes/play.ts,save/migrate.ts,fx/postfx.ts}` (modified); `apps/pan-tvardowski/src/{a11y/manager.ts,iap/zone-gate.ts}` (deleted); `apps/pan-tvardowski/tests/a11y-integration.test.ts` (modified)
- docs (engine): `docs/recipes/save-migrations.md` (new), `docs/design/api-specs.md`, `docs/plans/build-plan.md`, `docs/references/builder-reference.md`, `docs/plans/sessions.md`, `SESSION_LOG.md`
- docs (tier-2): `.github/skills/flare-tier2-stubs/SKILL.md`, `packages/iap-revenuecat/README.md`, `packages/{achievements,leaderboards,analytics}/README.md` (new)

**Gates**
- lint: ✅ (Biome auto-fix applied per-milestone, including `--fix --unsafe` for `useLiteralKeys` warnings in test files)
- typecheck: ✅ (71/71 tasks)
- test: ✅ (`@flare-engine/iap` 17→20; `@flare-engine/storage` 44→50; net +9 engine tests; PT 254 pass, 0 fail)
- build: ✅ (38/38 tasks, FULL TURBO across multiple milestones)
- device smoke: N/A — refactors + docs only; functional smoke covered by existing test suites

**Docs synced**
- `docs/design/api-specs.md` — 4 new entries (storage migration-chain × 2, errors transports × 2, iap content-gate × 2)
- `docs/plans/build-plan.md` — M10 engine-promotion addendum block under stage 11.14
- `docs/references/builder-reference.md` — Session #27 row consolidating all 6 milestones
- `docs/plans/release-readiness-checklist.md` — no new ticks (M10 is engine refactor / cleanup, not a release gate)
- `docs/plans/pan-tvardowski-build-plan.md` — no §17 tick (game-side changes are refactors consuming new engine exports, not new game milestones)

**Commits** (subjects only — full blocks emitted in chat per milestone)
1. `refactor(pan-tvardowski): use engine a11y bridge + postfx controller` (M10.2)
2. `feat(iap): add canAccessContent content gate` (M10.3 engine)
3. `refactor(pan-tvardowski): use engine canAccessContent gate` (M10.3 game)
4. `feat(storage): add defineMigrationChain helper + recipe` (M10.4 engine)
5. `refactor(pan-tvardowski): use defineMigrationChain in migrate` (M10.4 game)
6. `docs(build-plan): record M10 promotion addendum + shapes decision` (M10.5)
7. `docs(tier2): document lazy-SDK adapter recipe across stubs` (M10.6)
8. `docs(engine): close M10 #27 — api-specs + builder-ref + sessions + log` (M10.7)

**Next session:** no next session queued. Run `/plan-sessions` for Phase 12 (Launch) prep, the next game project, or follow-up on the deferred shape-atlas promotion when a second consumer materializes.

---

## Session 28 — 2026-04-28 (scope: [game])

**Goal (from sessions.md row #28):** PT-Polish-1: theme module foundation — semantic visual tokens (colors/typography/spacing/shapes)

**Touched files**
- `apps/pan-tvardowski/src/theme/colors.ts` (new)
- `apps/pan-tvardowski/src/theme/typography.ts` (new)
- `apps/pan-tvardowski/src/theme/shapes.ts` (new)
- `apps/pan-tvardowski/src/theme/spacing.ts` (new)
- `apps/pan-tvardowski/src/theme/index.ts` (new)
- `apps/pan-tvardowski/tests/theme.test.ts` (new)

**Session note.** This session bypassed the normal `/session-start` flow (planned via Plan mode, dispatched directly to game-builder). No `in_progress` row existed prior to close; row #28 was added directly in `done` state. No call-site refactors in this session — that is PT-Polish-2.

**Gates**
- lint: ✅ (39/39 packages; `@flare-engine-apps/pan-tvardowski` cache-miss, 164 files checked, no fixes applied)
- typecheck: ✅ (71/71 tasks; `@flare-engine-apps/pan-tvardowski` typecheck cache-miss, `tsc --noEmit` exited 0)
- test: ✅ (+5 new, total 264 pass / 0 fail, 5817 expect() calls, 59 files)
- build: ✅ (38/38 tasks successful; pan-tvardowski native build via `eas build` as expected)
- device smoke: N/A — theme tokens are pure data (no rendered scene or UI change); no on-device surface to exercise. Device smoke gate moves to PT-Polish-2 when call sites are refactored.

**Docs synced**
- `docs/plans/sessions.md` — row #28 added directly in `done` state (retroactive, bypassed `/session-start`); opened + closed 2026-04-28
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row test count updated: 256 → 264 (5 new theme tests; +3 from session #26 crash-transport rewrite not previously reflected)
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new engine-coverage tick; theme tokens consume no new engine package
- `docs/plans/pan-tvardowski-build-plan.md` Change log — no entry; this is internal style/polish work, not a milestone completion or partial
- `docs/plans/release-readiness-checklist.md` — no new ticks; theme scaffolding is not a launch-gate item

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): add theme module (colors/typography/spacing/shapes)`
2. `docs(pan-tvardowski): PT-Polish-1 session close — builder-ref test count + sessions row`

**Next session:** PT-Polish-2 "refactor call sites to consume theme tokens" — not yet in sessions.md; add via `/plan-sessions`.

---

## Session 29 — 2026-04-28 (scope: [game])

**Goal (from sessions.md row #29):** PT-Polish-2..9 bundled ★ — theme migration, overlay StyleSheet factory, entitlement fallback, release wiring, locale QA, perf + App.tsx split, code consolidation, RR final sync

**Touched files**
- `apps/pan-tvardowski/src/hud/Hud.tsx`
- `apps/pan-tvardowski/src/hud/Hud.styles.ts`
- `apps/pan-tvardowski/src/hud/MenuOverlay.tsx`
- `apps/pan-tvardowski/src/hud/MenuOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/InventoryOverlay.tsx`
- `apps/pan-tvardowski/src/hud/InventoryOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/CodexOverlay.tsx`
- `apps/pan-tvardowski/src/hud/CodexOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/AchievementsOverlay.tsx`
- `apps/pan-tvardowski/src/hud/AchievementsOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/DialogueOverlay.tsx`
- `apps/pan-tvardowski/src/hud/DialogueOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/PrivacyOverlay.tsx`
- `apps/pan-tvardowski/src/hud/PrivacyOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/ShopOverlay.tsx`
- `apps/pan-tvardowski/src/hud/ShopOverlay.styles.ts`
- `apps/pan-tvardowski/src/theme/colors.ts`
- `apps/pan-tvardowski/src/theme/index.ts`
- `apps/pan-tvardowski/src/theme/overlays.ts`
- `apps/pan-tvardowski/src/iap/fallback.ts`
- `apps/pan-tvardowski/src/events.ts`
- `apps/pan-tvardowski/src/state.ts`
- `apps/pan-tvardowski/src/App.tsx`
- `apps/pan-tvardowski/src/scenes/play.ts`
- `apps/pan-tvardowski/src/scenes/boot.ts`
- `apps/pan-tvardowski/src/providers.ts`
- `apps/pan-tvardowski/src/scene-registry.ts`
- `apps/pan-tvardowski/src/scene-keys.ts`
- `apps/pan-tvardowski/src/perf/cold-start.ts`
- `apps/pan-tvardowski/src/tier2/analytics-events.ts`
- `apps/pan-tvardowski/src/tier2/wiring.ts`
- `apps/pan-tvardowski/src/shapes-draw.ts`
- `apps/pan-tvardowski/src/shape-atlas.ts`
- `apps/pan-tvardowski/src/localization/keys.ts`
- `apps/pan-tvardowski/locales/en.json`
- `apps/pan-tvardowski/locales/pl.json`
- `apps/pan-tvardowski/app.json`
- `apps/pan-tvardowski/CREDITS.md`
- `apps/pan-tvardowski/docs/perf-baseline.md`
- `apps/pan-tvardowski/docs/locale-qa-followups.md`
- `apps/pan-tvardowski/tests/theme-hud.test.ts`
- `apps/pan-tvardowski/tests/theme-overlays.test.ts`
- `apps/pan-tvardowski/tests/entitlement-fallback.test.ts`
- `apps/pan-tvardowski/tests/analytics-events.test.ts`
- `apps/pan-tvardowski/tests/deep-link-config.test.ts`
- `apps/pan-tvardowski/tests/credits.test.ts`
- `apps/pan-tvardowski/tests/pl-dialogue-qa.test.ts`
- `apps/pan-tvardowski/tests/cold-start.test.ts`
- `apps/pan-tvardowski/tests/app-split.test.ts`
- `apps/pan-tvardowski/tests/shapes-draw.test.ts`
- `apps/pan-tvardowski/tests/migrate-helpers.test.ts`
- `docs/plans/release-readiness-checklist.md`
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/plans/sessions.md`
- `docs/references/builder-reference.md`

**Milestone breakdown (8 total)**
- M1: theme tokens consumed in `Hud.tsx` + `MenuOverlay.tsx`; 2 new tokens (`colors.ui.onPrimary`, `colors.ui.tint55`); +6 structural tests
- M2: theme tokens in 6 remaining overlays + shared `theme/overlays.ts` StyleSheet factory (root/panelContainer/panelLg/panelMd partials); 3 new tokens (backdropModal/divider/dividerStrong); +11 tests
- M3: entitlement-lost fallback (`createEntitlementFallback` / `shouldAllowStaleAccess` / `gameState.entitlementHealth`); 5 PL+EN locale keys under `iap.entitlement_check_failed.*`; +8 tests
- M4: analytics event names frozen in `tier2/analytics-events.ts` (+3 tests); `pantvardowski://` deep-link + Android intentFilters in `app.json` (+3 tests); `CREDITS.md` expanded (+3 tests)
- M5: PL dialogue QA — 4 string fixes; `docs/locale-qa-followups.md` records 1 deferred expert-review entry; +5 sanity tests
- M6: cold-start instrumentation (`src/perf/cold-start.ts`, 5 boot milestones); `docs/perf-baseline.md`; App.tsx split into `providers.ts` + `scene-registry.ts` + `scene-keys.ts`; +8 tests
- M7: `argbTo` exported from `shapes-draw.ts`, 8 call sites in `shape-atlas.ts` deduped; migrate-helpers + shapes-draw coverage sweep; +11 tests
- M8: RR checklist §3 entitlement-lost ticked; mirror row in `builder-reference.md` synced to 326 tests; build-plan Change log entry written

**Gates**
- lint: ✅ (biome check — 190 files, no fixes applied)
- typecheck: ✅ (tsc --noEmit, silent exit)
- test: ✅ (+62 new, total 326 pass / 0 fail, 5962 expect() calls, 70 files)
- build: ✅ (native build via eas build; `bun run build` echoes expected message — no JS bundler step)
- device smoke: deferred — M1/M2/M5 flagged for device verification; cold-start TTI profiling (M6) deferred to physical Galaxy A54 release build

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` Change log — "PT-Polish-2..9 bundle complete (session #29)" entry appended at line 573, dated 2026-04-28; covers all 8 milestones + deferred items
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated to "M0–M9.6 done + PT-Polish-2..9 complete (2026-04-28), 326 tests green"
- `docs/plans/release-readiness-checklist.md` — §3 entitlement-lost item ticked (`[x] ✅ Entitlement-lost fallback`)
- `docs/plans/pan-tvardowski-build-plan.md` §17 — not modified (polish bundle is post-feature-complete; §17 engine-coverage boxes were all ticked during M9.x sessions)
- `docs/plans/sessions.md` — row #29 flipped `in_progress` → `done`, closed 2026-04-28

**Commits** (subjects only — full blocks emitted above in chat; ~17 total across M1–M8)
1. `feat(pan-tvardowski): M1 consume theme tokens in Hud + MenuOverlay`
2. `test(pan-tvardowski): M1 theme-hud structural assertions +6`
3. `feat(pan-tvardowski): M2 add overlays base + 3 color tokens`
4. `feat(pan-tvardowski): M2 consume theme tokens in 6 overlay files`
5. `test(pan-tvardowski): M2 theme-overlays structural assertions +11`
6. `feat(pan-tvardowski): M3 entitlement-lost fallback + PL/EN keys`
7. `test(pan-tvardowski): M3 entitlement-fallback +8 tests`
8. `feat(pan-tvardowski): M4-A freeze analytics event names`
9. `feat(pan-tvardowski): M4-B register pantvardowski:// deep-link`
10. `docs(pan-tvardowski): M4-C expand CREDITS with packages + runtime libs`
11. `feat(pan-tvardowski): M5 PL dialogue QA — 4 fixes + sanity tests`
12. `feat(pan-tvardowski): M6-A cold-start instrumentation +5 tests`
13. `docs(pan-tvardowski): M6-B add perf-baseline`
14. `refactor(pan-tvardowski): M6-C App.tsx into providers+scene-registry`
15. `refactor(pan-tvardowski): M7-A export argbTo; dedup argb in shape-atlas`
16. `test(pan-tvardowski): M7-B coverage sweep — migrate helpers +7`
17. `docs(pan-tvardowski): PT-Polish-2..9 bundle RR sync + changelog`

**Deferred items (post-launch)**
- §5 device-measured TTI < 3 s on Galaxy A54 (cold-start instrumentation in place, awaits release build)
- §5 CI green on release branch
- §5 device smoke (physical Android + iOS)
- §7 store-page copy EN+PL (short desc, long desc, promo text)
- §8 store assets (screenshots, feature graphic, trailer, app icon)
- §2 store accounts (Google Play + Apple Developer), signing, Console setup
- §4 privacy policy live URL, ToS, age rating, EUIPO mark

**Next session:** no next session queued. Run `/plan-sessions` for Phase 12 (Launch) prep — store accounts, signing, final smoke on device, store-page copy.

---

## Session 30 — 2026-04-28 (scope: [engine])

**Goal (from sessions.md row #30):** PT-Bugfix-1: fix ui-shop + iap-revenuecat exports — module field points at dist/index.mjs but tsup emits dist/index.js

**Touched files**
- `packages/ui-shop/package.json`
- `packages/iap-revenuecat/package.json`

**Gates**
- lint: ✅ (39/39 packages, 0 errors)
- typecheck: ✅ (71/71 tasks, 0 errors)
- test: ✅ (no new tests; packaging-only fix — existing 326 PT + engine tests all pass)
- build: ✅ (38/38 packages, FULL TURBO)

**Docs synced**
- `docs/references/builder-reference.md` — no change required; no module count, test count, or phase state changed (packaging metadata fix only)
- `docs/plans/build-plan.md` — no change required; no phase advance

**Root cause:** Both `packages/ui-shop/package.json` and `packages/iap-revenuecat/package.json` had `"type": "module"` set, which forced tsup's `outExtension` to emit `.js` (ESM) + `.cjs` (CJS) instead of the Flare-standard `.mjs` (ESM) + `.js` (CJS) layout expected by the `main`/`module`/`exports` fields. Removing `"type": "module"` restores the default CJS-first convention.

**Commits** (subjects only — full blocks emitted above in chat)
1. `fix(packaging): drop "type":"module" from ui-shop + iap-revenuecat`

**Next session:** #31 "PT-Bugfix-1: suppress ExpoKeepAwake rejection on Android launch via expo-keep-awake plugin config or early deactivate"

---

## Session 46 — 2026-04-28 (scope: [mixed])

**Goal (from sessions.md row #46):** PT-Bugfix-A bundle ★★ — M1 Android keep-awake fix → M2 zone-progress save → M3 zone-select submenu

**Touched files**
- `apps/pan-tvardowski/src/App.tsx`
- `apps/pan-tvardowski/src/scenes/play.ts`
- `apps/pan-tvardowski/src/hud/MenuOverlay.tsx`
- `apps/pan-tvardowski/src/hud/MenuOverlay.styles.ts`
- `apps/pan-tvardowski/src/localization/keys.ts`
- `apps/pan-tvardowski/locales/en.json`
- `apps/pan-tvardowski/locales/pl.json`
- `apps/pan-tvardowski/tests/zone-progression-save.test.ts` (new)
- `apps/pan-tvardowski/tests/zone-select.test.ts` (new)
- `apps/pan-tvardowski/tests/controls-visibility.test.ts` (new)
- `packages/react/src/skia-bridge.ts`
- `packages/react/src/game-view.tsx`
- `packages/react/tests/skia-bridge.test.ts`
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`
- `docs/plans/sessions.md`
- `bun.lock`

**Scope expansion note:** Row opened as `[game]`; device-smoke surfaced two root causes. M4 (controls gating — already game scope) and M5 (skia-bridge viewport bounds — engine scope) were approved by user for in-session fixing. Scope flipped `[game]` → `[mixed]` at close.

**Milestones shipped**
- M1: `App.tsx` Android-guarded `deactivateKeepAwake()` shim; `app.json` plugin entry reverted (`expo-keep-awake` has no config plugin)
- M2: `src/scenes/play.ts` `commitRun` passes `nextZone` as `zoneReached` on boss-defeat and `currentZone` on game-over; +4 tests
- M3: `MenuOverlay.tsx` zone-picker submenu + `.styles.ts`; `App.tsx` `startSlotAtZone` action; 4 locale keys × EN/PL; +3 tests
- M4 (device-smoke addition): `App.tsx` `<VirtualJoystick>` + `<VirtualButton>` gated on `currentScene === 'play'`; +3 tests
- M5 (engine, device-smoke addition): `packages/react/src/skia-bridge.ts` `beginFrame(w, h)` passes bounds rect to `beginRecording`, skips when viewport=0; `game-view.tsx` updated; +2 tests

**Gates**
- lint: ✅ (39/39 packages, 0 errors — FULL TURBO from cache)
- typecheck: ✅ (`@flare-engine/react` tsc --noEmit clean; `apps/pan-tvardowski` tsc --noEmit clean)
- test: ✅ (+10 new — pan-tvardowski: 336 pass / 0 fail; @flare-engine/react: 45 pass / 0 fail)
- build: ✅ (38/38 packages, FULL TURBO)
- device smoke: ✅ (user-confirmed 2026-04-28) — canvas centred, controls hidden in menu/codex/shop and visible in play, keep-awake suppressed on Android, zone-progression persists on boss defeat + game-over, zone-select submenu appears on slots with zoneReached > z1

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` Change log — two entries appended at line 573–574 dated 2026-04-28: M1–M3 bundle entry + M4/M5 follow-up entry
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated to 336 tests, PT-Bugfix-A bundle; `@flare-engine/react` M5 engine fix documented inline in mirror row
- `docs/plans/sessions.md` — row #46 flipped `in_progress` → `done`, scope `[game]` → `[mixed]`, closed 2026-04-28; rows #31–45 `blocked ✦` (planner pre-diff folded into this session's first commit); ⊕ scope-expansion footnote added
- `docs/plans/release-readiness-checklist.md` — no new ticks (bugfix bundle; no new RR items satisfied)

**Commits** (subjects only — full blocks emitted above in chat)
1. `chore(plans): supersede rows #31–45 into bundles #46–50`
2. `fix(react): pass bounds rect to skia-bridge beginRecording`
3. `fix(pan-tvardowski): suppress ExpoKeepAwake on Android via runtime shim`
4. `fix(pan-tvardowski): persist zoneReached on boss defeat + game-over`
5. `feat(pan-tvardowski): zone-select submenu in save-select view`
6. `fix(pan-tvardowski): hide VirtualJoystick + VirtualButton outside play scene`
7. `docs(pan-tvardowski): close #46 PT-Bugfix-A bundle — sessions + log + mirror`

**Next session:** #47 "PT-Bugfix-B bundle ★★ — M1 collider scale audit → M2 Smok silhouette → M3 logical gameplay bounds"

---

## Session 47 — 2026-04-28 (scope: [game])

**Goal (from sessions.md row #47):** PT-Bugfix-B bundle ★★ — M1 collider scale audit → M2 Smok silhouette → M3 logical gameplay bounds

**Touched files**
- `apps/pan-tvardowski/src/spawn.ts`
- `apps/pan-tvardowski/src/config/gameplay.ts`
- `apps/pan-tvardowski/src/scene-registry.ts` ⊞
- `apps/pan-tvardowski/src/scenes/play.ts`
- `apps/pan-tvardowski/src/App.tsx`
- `apps/pan-tvardowski/tests/collider-scale.test.ts` (new)
- `apps/pan-tvardowski/tests/boss-visual-audit.test.ts` (new)
- `apps/pan-tvardowski/tests/safe-area-bounds.test.ts` (new)
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`
- `docs/plans/sessions.md`

⊞ `scene-registry.ts` added to touched paths mid-session: mechanically required to forward `PlaySceneDeps.bottomInset` from `App.tsx` → `buildSceneRegistry` → `createPlayScene`. Approved; logged in sessions.md footnote ⊞. `src/shape-catalogue.ts` was declared but not modified — M2 was test-only (painter-order already correct). +18 tests shipped vs +9 planned (+5/+7/+6 split). See footnote ⊞ in sessions.md.

**Milestones shipped**
- M1 (collider scale audit): `COLLIDER_SCALE_ENEMY=0.7`, `COLLIDER_SCALE_MINIBOSS=0.85`, `COLLIDER_SCALE_BOSS=0.9` extracted into `src/config/gameplay.ts`; `spawnBoss` gains optional `colliderScale` override param; `spawnEnemy`/`spawnMiniboss` adopt constants. +5 tests in `collider-scale.test.ts`.
- M2 (Smok silhouette): draw-order audit confirmed `shapes-draw.ts` painter's algorithm (forward iteration); `smok-krzemionkowski[0]=COPPER ngon` already renders behind `[1]=HELLFIRE triangle` — no swap needed. +7 tests in `boss-visual-audit.test.ts` encoding painter-order invariant + distinct-silhouette contract for all 8 bosses.
- M3 (safe-area bounds): `PlaySceneDeps.bottomInset?` subtracts inset from viewport height in `refreshBounds` (player clamp, spawn Y, cull — canvas stays full-bleed); `SceneRegistryDeps.bottomInset?` + `buildSceneRegistry` forward value; `AppRoot` reads `insets.bottom` from `useSafeAreaInsets()` and passes to `bootstrap`. +6 tests in `safe-area-bounds.test.ts`.

**Gates**
- lint: ✅ (39/39 tasks via Turbo, 0 errors — `biome check src/ tests/` clean in `apps/pan-tvardowski`)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+18 new, total 354 pass / 0 fail — `bun test` in `apps/pan-tvardowski`)
- build: ✅ (native build via `bun run android|ios`; echo stub clean)
- device smoke: ✅ (user-attested, M1 chassis Galaxy A54 per implementer, 2026-04-28)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` Change log — entry appended at line 575 dated 2026-04-28 for PT-Bugfix-B bundle (M1/M2/M3 detail)
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated to 354 tests green, Bugfix-B bundle complete
- `docs/plans/sessions.md` — row #47 already `done`, closed 2026-04-28; footnote symbol ⊞ added to row; ⊞ footnote written covering the three approved drift items
- `docs/plans/release-readiness-checklist.md` — no new ticks (bugfix bundle; collider/visual/bounds are correctness fixes, not new RR line items)

**Follow-ups (not lost)**
- M3's `bottomInset` plumbing in PT (`App.tsx` → `scene-registry.ts` → `createPlayScene`) is a band-aid. Engine-level lift planned as a future `[mixed]` session: `@flare-engine/react` `GameView` gains a `safeArea` config prop + `useSafeArea()` hook; PT deletes its manual plumbing. Android cleanup (`edgeToEdgeEnabled` removal from `app.json`, `expo-system-ui` install) bundled in the same session. Row will be queued by `/plan-sessions`.

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): collider scale constants + boss override param`
2. `test(pan-tvardowski): boss-visual-audit + collider-scale invariants`
3. `feat(pan-tvardowski): safe-area bottomInset in play scene bounds`

**Next session:** #48 "PT-UX-A bundle ★★ — M1 HUD insets + joystick gating → M2 BootOverlay ProgressBar → M3 InventoryOverlay tab persist"

---

## Session 48 — 2026-04-28 (scope: [game])

**Goal (from sessions.md row #48):** PT-UX-A bundle ★★ — M1 HUD insets + joystick gating → M2 BootOverlay ProgressBar → M3 InventoryOverlay tab persist

**Touched files**
- `apps/pan-tvardowski/src/App.tsx`
- `apps/pan-tvardowski/src/hud/Hud.tsx`
- `apps/pan-tvardowski/src/hud/Hud.styles.ts`
- `apps/pan-tvardowski/src/hud/BootOverlay.tsx` (new)
- `apps/pan-tvardowski/src/hud/BootOverlay.styles.ts` (new)
- `apps/pan-tvardowski/src/hud/InventoryOverlay.tsx`
- `apps/pan-tvardowski/src/hud/inventory-tab.ts` (new — pre-approved extension)
- `apps/pan-tvardowski/src/state.ts` (pre-approved extension)
- `apps/pan-tvardowski/src/scenes/boot.ts` (pre-approved extension)
- `apps/pan-tvardowski/src/localization/keys.ts` (pre-approved extension)
- `apps/pan-tvardowski/locales/en.json`
- `apps/pan-tvardowski/locales/pl.json`
- `apps/pan-tvardowski/tests/hud-insets.test.ts` (new)
- `apps/pan-tvardowski/tests/boot-overlay.test.ts` (new)
- `apps/pan-tvardowski/tests/inventory-tab-persist.test.ts` (new)

**Gates**
- lint: ✅ (39/39 tasks via Turbo, 0 errors — `biome check src/ tests/` clean in `apps/pan-tvardowski`)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+8 new, total 362 pass / 0 fail — `bun test` in `apps/pan-tvardowski`)
- build: ✅ (native build via `bun run android|ios`; echo stub clean — no Expo/EAS build gate)
- device smoke: ✅ (user-confirmed 2026-04-28) — bottom-inset padding visible on game-over/victory overlays; boot progress bar visible during cold-start; inventory tab persists across close/reopen

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` Change log — entry appended dated 2026-04-28 for PT-UX-A bundle (M1/M2/M3 detail, 362 tests)
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: PT-UX-A bundle noted, test count 354 → 362
- `docs/plans/sessions.md` — row #48 flipped `in_progress` → `done`, closed 2026-04-28; ⊞ footnote added covering 4 approved deviations + spec deviation for M3
- `docs/plans/release-readiness-checklist.md` — no new ticks (M1/M2/M3 are UX polish; no RR line items correspond to HUD insets, BootOverlay, or InventoryOverlay tab persist)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): hud bottom-inset on game-over+victory`
2. `feat(pan-tvardowski): boot-overlay progress bar with PL/EN keys`
3. `feat(pan-tvardowski): persist inventory active-tab across scenes`

**Next session:** #49 "PT-Content bundle ★★ — M1 overlay layout audit → M2 shop empty-state → M3 codex + achievements fresh-save UX"

---

## Session 67 — 2026-04-29 (scope: [game])

**Goal (from sessions.md row #67):** PT-Visual-Palette ★★ — M1 replace 12 tokens in theme/colors.ts to deck hexes (gold #C9A24A, crimson #D4213D, ink-black #0E1A12, parchment #E8DCC4, …) → M2 sweep colors.ui.* call sites; recolor HUD + overlays + menus → M3 regenerate ZONE_PALETTES with deck zone hexes

**Touched files**
- `apps/pan-tvardowski/src/theme/colors.ts`
- `apps/pan-tvardowski/src/hud/Hud.styles.ts`
- `apps/pan-tvardowski/src/shape-catalogue.ts` (⊕ approved scope expansion — global GOLD/RED ARGB constants migrated to deck values)
- `apps/pan-tvardowski/src/palette.ts`
- `apps/pan-tvardowski/tests/theme.test.ts`
- `apps/pan-tvardowski/tests/theme-hud.test.ts` (⊕ expansion — tertiary→verdigris assertion)
- `docs/plans/sessions.md`
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`

**Gates**
- lint: ✅ (39/39 tasks via Turbo, 0 errors — `biome check src/ tests/` clean in `apps/pan-tvardowski`)
- typecheck: ✅ (`tsc --noEmit` exit 0)
- test: ✅ (+5 new, total 367 pass / 0 fail — `bun test` in `apps/pan-tvardowski`)
- build: N/A (no Expo/EAS build script; native build via `bun run android|ios` — echo stub clean)
- device smoke: pending user confirmation — run `bun --cwd apps/pan-tvardowski run android` (Galaxy A54) or `bun --cwd apps/pan-tvardowski run ios` (iPhone)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` Change log — entry appended dated 2026-04-29: "PT-Visual-Palette complete (session #67). 12 ui tokens + 17 raw pigments rebranded to deck hexes; Hud.styles.ts miniboss-bar swapped tertiary→verdigris; shape-catalogue.ts GOLD/RED ARGB constants migrated; ZONE_PALETTES regenerated for all 8 zones. 367 tests green."
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: PT-Visual-Palette noted, test count 362 → 367
- `docs/plans/sessions.md` — row #67 already `done` closed 2026-04-29 (builder-written); ⊕ footnote inserted covering shape-catalogue.ts scope expansion (GOLD/RED ARGB constants + theme-hud.test.ts tertiary→verdigris assertion)
- `docs/plans/release-readiness-checklist.md` — no new ticks (visual rebrand has no corresponding RR line item)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): rebrand ui tokens to deck palette`
2. `feat(pan-tvardowski): sweep hud + shape-catalogue to deck tokens`
3. `feat(pan-tvardowski): regenerate ZONE_PALETTES with deck hexes`

**Next session:** #68 "PT-Visual-Type ★★ — M1 bundle EB Garamond + Source Sans 3 + JetBrains Mono → M2 rewrite theme/typography.ts → M3 sweep overlay *.styles.ts"

---

## Session 49 — 2026-04-29 (scope: [game])

**Goal (from sessions.md row #49):** PT-Content bundle ★★ — M1 overlay layout audit → M2 shop empty-state → M3 codex + achievements fresh-save UX

**Touched files**
- `apps/pan-tvardowski/src/hud/Hud.styles.ts`
- `apps/pan-tvardowski/src/hud/ShopOverlay.tsx`
- `apps/pan-tvardowski/src/hud/AchievementsOverlay.tsx`
- `apps/pan-tvardowski/src/hud/CodexOverlay.tsx`
- `apps/pan-tvardowski/src/App.tsx` (⊕ pre-approved: `isNoopProvider` prop)
- `apps/pan-tvardowski/src/localization/keys.ts`
- `apps/pan-tvardowski/locales/en.json`
- `apps/pan-tvardowski/locales/pl.json`
- `apps/pan-tvardowski/tests/hud-layout.test.ts`
- `apps/pan-tvardowski/tests/shop-placeholder.test.ts` (new file)
- `apps/pan-tvardowski/tests/empty-state-ux.test.ts` (new file)
- `apps/pan-tvardowski/tests/shop-entitlements.test.ts` (⊕ count-guard 19→22, mechanically required)
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`
- `docs/plans/sessions.md`
- `SESSION_LOG.md`

**Gates**
- lint: ✅ (39/39 tasks via Turbo, 0 errors — `biome check src/ tests/` clean in `apps/pan-tvardowski`)
- typecheck: ✅ (`tsc --noEmit` clean in `apps/pan-tvardowski`)
- test: ✅ (+7 new, total 428 pass / 0 fail — `bun test` in `apps/pan-tvardowski`)
- build: ✅ (native build via `bun run android|ios`; echo stub clean)
- device smoke: pending user confirmation — run `bun --cwd apps/pan-tvardowski run android` (Galaxy A54) or `bun --cwd apps/pan-tvardowski run ios` (iPhone)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` Change log — entry appended dated 2026-04-29: "PT-Content bundle complete (session #49). M1/M2/M3 detail, 428 tests, locale parity 307 keys."
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: PT-Content bundle noted, test count 421 → 428
- `docs/plans/sessions.md` — row #49 flipped `in_progress` → `done ⊞`, closed 2026-04-29; ⊞ footnote added covering 3 approved deviations
- `docs/plans/release-readiness-checklist.md` — no new ticks (content/polish overlays have no corresponding RR line items)

**Commits** (subjects only — full blocks emitted above in chat)
1. `refactor(pan-tvardowski): tokenize minibossBar styles`
2. `feat(pan-tvardowski): shop placeholder cards on noop iap`
3. `feat(pan-tvardowski): fresh-save banners for codex + achievements`
4. `docs(pan-tvardowski): close session #49 PT-Content bundle`

**Next session:** #50 "PT-Final bundle ★★ — M1 credits PL/EN → M2 auto-persist on zone-enter + idle → M3 device-smoke gate (Galaxy A54 + iPhone)"

---

---
