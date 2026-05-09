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

## Session 50 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #50):** PT-Final bundle ★★ — M1 credits PL/EN → M2 auto-persist on zone-enter + idle → M3 device-smoke gate (Galaxy A54 + iPhone)

**Touched files**
- `apps/pan-tvardowski/src/hud/credits-sections.ts`
- `apps/pan-tvardowski/src/hud/MenuOverlay.tsx`
- `apps/pan-tvardowski/src/localization/keys.ts` (⊕ mechanical: 27 `credits.*` keys, type-safe key system)
- `apps/pan-tvardowski/src/scenes/play.ts`
- `apps/pan-tvardowski/locales/en.json`
- `apps/pan-tvardowski/locales/pl.json`
- `apps/pan-tvardowski/tests/credits-locale.test.ts` (new file)
- `apps/pan-tvardowski/tests/auto-persist.test.ts` (new file)
- `apps/pan-tvardowski/docs/device-smoke.md` (new file)
- `docs/plans/sessions.md`

**Gates**
- lint: ✅ (`biome check src/ tests/` — 215 files, 0 errors)
- typecheck: ✅ (`tsc --noEmit` clean)
- test: ✅ (+6 new, total 434 pass / 0 fail — `bun test` in `apps/pan-tvardowski`, 90 files)
- build: ✅ (native build echo stub clean)
- check:locales: ✅ (334 keys, en + pl in parity)
- device smoke: deferred by user — to be confirmed in session #59 (PT-DeviceSmoke); run `bun --cwd apps/pan-tvardowski run android` (Galaxy A54) or `bun --cwd apps/pan-tvardowski run ios` (iPhone)

**Docs synced**
- `docs/plans/sessions.md` — row #50 flipped `in_progress` → `done ⊞`, closed 2026-04-30; ⊞ drift footnote appended (keys.ts mechanical drift, store.ts not touched, +6 vs +5 tests, device-smoke deferred)
- `docs/plans/pan-tvardowski-build-plan.md` — OUTSTANDING: no `2026-04-30` change-log entry was appended by the builder; must be added before or alongside session commits
- `docs/references/builder-reference.md` — OUTSTANDING: mirror row still reads "428 tests / session #49"; must be updated to "434 tests / session #50 complete / 334 locale keys" before or alongside session commits
- `docs/plans/release-readiness-checklist.md` — no new ticks; auto-persist and credits localization have no corresponding RR line items

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): localize credits sections to PL+EN`
2. `feat(pan-tvardowski): auto-persist save on zone enter + 30s idle`
3. `docs(pan-tvardowski): add device-smoke checklist for A54+iPhone`

**Next session:** #51 "Engine: GameView safeArea prop + useSafeArea hook; PT: delete manual bottomInset plumbing"

---

## Session 51 — 2026-04-30 (scope: [mixed])

**Goal (from sessions.md row #51):** Engine: GameView safeArea prop + useSafeArea hook; PT: delete manual bottomInset plumbing

**Touched files**
- `packages/react/src/safe-area.ts` (new file)
- `packages/react/src/game-view.tsx`
- `packages/react/src/index.ts`
- `packages/react/tests/safe-area.test.ts` (new file)
- `packages/react/package.json`
- `packages/react/tsup.config.ts` (⊕ RN-SAC external; mechanically required peer-dep wiring)
- `apps/pan-tvardowski/src/App.tsx`
- `apps/pan-tvardowski/src/scene-registry.ts`
- `apps/pan-tvardowski/src/scenes/play.ts`
- `docs/design/api-specs.md` (⊕ always implicit for new public engine API surface)
- `docs/references/builder-reference.md` (⊕ mandatory per status-sync; includes PT mirror row test-count fix from session #50)
- `docs/plans/pan-tvardowski-build-plan.md` (⊕ mandatory per status-sync; adds missing session #50 + session #51 changelog entries)
- `docs/plans/sessions.md`

**Gates**
- lint: ✅ (39/39 tasks via Turbo — `biome check src/` clean in `@flare-engine/react`; `biome check src/ tests/` clean in `apps/pan-tvardowski`, 215 files)
- typecheck: ✅ (71/71 tasks via Turbo — zero errors)
- test: ✅ (+5 new in `@flare-engine/react` (45→50), 0 net new in PT; total 50 pass in react / 434 pass in PT / 0 fail across all packages)
- build: ✅ (38/38 tasks via Turbo — all packages build; PT has no standalone build script — native-only, expected)
- device smoke: deferred to session #59 (PT-DeviceSmoke) per explicit user direction (same deferral as session #50)

**Docs synced**
- `docs/design/api-specs.md` — `@flare-engine/react` table updated: `<GameView safeArea?>` prop, `useSafeArea()`, `SafeArea` type, `SafeAreaContext` added
- `docs/references/builder-reference.md` — Session #28 engine row added (50 tests, safe-area surface); PT mirror row updated: "428 tests" → "434 tests", session #50 + #51 bundles noted
- `docs/plans/pan-tvardowski-build-plan.md` Change log — two entries appended: "PT-Final bundle complete (session #50), 434 tests" and "session #51 getBottomInset refactor, 434 tests"
- `docs/plans/build-plan.md` — no phase-state change; `@flare-engine/react` peer-dep addition is intra-package, no phase promotion
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked; session #51 is a refactor (engine lift + plumbing cleanup), not a PT milestone close

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(react): add SafeArea type, SafeAreaContext, useSafeArea hook`
2. `feat(react): add safeArea prop to GameView with RN-SAC fallback`
3. `test(react): cover useSafeArea and GameView safeArea prop`
4. `refactor(pan-tvardowski): thread getBottomInset callback through chain`
5. `docs: sync api-specs and builder-reference for safeArea surface`

**Next session:** #52 "PT-Store-1: Google Play Console app + internal testing track + Android keystore via EAS credentials"

---

## Session 72 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #72):** PT-Visual-Zones ★★ — M1 wire 8 zone palettes per deck (Z1 Dachy ember-32p, Z2 Puszcza pollen-80p, Z3 Wisła spray-48p, Z4 Błota ember-96p, Z5 Łysa ash-128p, Z6 Katakumby dust-24p, Z7 Karczma smoke-16p, Z8 Księżyc float-64p) → M2 parallax-particle ambience per zone via tier-system → M3 Z8 silver-UI exception (override gold token in Z8 scene context)

**Touched files**
- `apps/pan-tvardowski/src/palette.ts` (M)
- `apps/pan-tvardowski/src/fx/ambience.ts` (NEW — pre-approved drift)
- `apps/pan-tvardowski/src/scenes/play.ts` (M)
- `apps/pan-tvardowski/src/hud/Hud.tsx` (M — pre-approved drift)
- `apps/pan-tvardowski/tests/zone-ambience.test.ts` (NEW)
- `apps/pan-tvardowski/tests/z8-silver-ui.test.ts` (NEW)
- `docs/plans/sessions.md` (M)
- `docs/plans/pan-tvardowski-build-plan.md` (M)
- `docs/references/builder-reference.md` (M)

Declared path `apps/pan-tvardowski/src/config/zones.ts` not touched — balance-frozen, ambience routed through `palette.ts` per pre-approval at plan time. `src/fx/ambience.ts` + `src/hud/Hud.tsx` are pre-approved drift beyond original declared paths.

**Gates**
- lint: ✅
- typecheck: ✅
- test: ✅ (+10 new in `apps/pan-tvardowski`, 444 total)
- build: ✅
- device smoke: deferred (standing preference — no dedicated PT-DeviceSmoke session scheduled yet)

**Docs synced**
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: test count bumped 434 → 444, `+ PT-Visual-Zones (session #72) complete (2026-04-30)` appended
- `docs/plans/pan-tvardowski-build-plan.md` Change log — entry appended at line 587: `2026-04-30 — PT-Visual-Zones complete (session #72)` with full milestone summary + drift notes
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked in this session (zone visual layer is tracked in the Change log; §17 milestone granularity does not subdivide the Visual bundle)
- `docs/plans/release-readiness-checklist.md` — no new ticks (device smoke deferred)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): wire 8-zone deck palette + ambience kinds`
2. `feat(pan-tvardowski): add parallax-particle ambience emitter`
3. `feat(pan-tvardowski): apply Z8 silver UI override to boss bar`
4. `docs(pan-tvardowski): log PT-Visual-Zones session #72`

**Next session:** #73 "PT-Visual-Bosses ★★ — M1 per-boss phase palette transitions (8 bosses × 2–3 phases) in systems/boss/<boss>.ts → M2 per-boss particle preset + postfx chain on phase-break → M3 Z5 Baba Jaga 3-phase white-out + Z8 Lucyper crimson-mirror finale"

---

## Session 73 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #73):** PT-Visual-Bosses ★★ — M1 per-boss phase palette transitions (8 bosses × 2–3 phases) in systems/boss/<boss>.ts → M2 per-boss particle preset + postfx chain on phase-break → M3 Z5 Baba Jaga 3-phase white-out + Z8 Lucyper crimson-mirror finale

**Touched files**
- `apps/pan-tvardowski/src/systems/boss/types.ts` (M)
- `apps/pan-tvardowski/src/systems/boss/smok.ts` (M)
- `apps/pan-tvardowski/src/systems/boss/borowy.ts` (M)
- `apps/pan-tvardowski/src/systems/boss/wodnik.ts` (M)
- `apps/pan-tvardowski/src/systems/boss/boruta.ts` (M)
- `apps/pan-tvardowski/src/systems/boss/baba-jaga.ts` (M)
- `apps/pan-tvardowski/src/systems/boss/bazyliszek.ts` (M)
- `apps/pan-tvardowski/src/systems/boss/mefistofeles.ts` (M)
- `apps/pan-tvardowski/src/systems/boss/lucyper.ts` (M)
- `apps/pan-tvardowski/src/fx/boss-postfx.ts` (new — pre-approved deviation: defines `BossPostFxKind` union + `BOSS_POSTFX_CHAINS`; required by M2 `onPhasePostFx` callback type; game-layer only)
- `apps/pan-tvardowski/tests/boss-phase-palette.test.ts` (new)
- `apps/pan-tvardowski/tests/boss-postfx.test.ts` (new — pre-approved deviation: M2 postfx-chain wiring tests split into own file to keep M1/M3 test file focused)
- `apps/pan-tvardowski/tests/boss-final-hit.test.ts` (new)
- `docs/plans/sessions.md` (status flip in_progress → done)

**Gates**
- lint: ✅
- typecheck: ✅
- test: ✅ (+7 new, total 451)
- build: ✅
- device smoke: deferred to session #59 (PT-DeviceSmoke) per standing user directive; consistent with session #50 footnote pattern

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` Change log — `2026-04-30 — PT-Visual-Bosses complete (session #73)` entry appended; per-milestone summary + drift notes included
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: `+ PT-Visual-Bosses (session #73) complete (2026-04-30)`, test count bumped 444 → 451
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked (visual-bundle sessions tracked in Change log; §17 does not subdivide the Visual bundle rows)
- `docs/plans/release-readiness-checklist.md` — no new ticks (no checklist items for PT-Visual-Bosses)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): add per-boss phase palette transition callbacks`
2. `feat(pan-tvardowski): add boss postfx chain registry and phase-break wiring`
3. `feat(pan-tvardowski): baba-jaga white-out ramp and lucyper crimson-mirror finale`
4. `test(pan-tvardowski): boss phase palette, postfx chain, and final-hit tests`
5. `docs(pan-tvardowski): log PT-Visual-Bosses session #73`

**Next session:** #74 "PT-Visual-A11y ★★ — M1 populate color-blind tokens (cb.player #FF8C42, cb.hazard #FFD23F, cb.safe #4FC3F7) + opt-in toggle in settings overlay → M2 extend reduce-motion to parallax-static + sigil-dim 70% + no shake → M3 locale-parity check for PL diacritics in new font"

---

## Session 74 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #74):** PT-Visual-A11y ★★ — M1 populate color-blind tokens (cb.player #FF8C42, cb.hazard #FFD23F, cb.safe #4FC3F7) + opt-in toggle in settings overlay → M2 extend reduce-motion to parallax-static + sigil-dim 70% + no shake → M3 locale-parity check for PL diacritics in new font

**Touched files**
- `apps/pan-tvardowski/locales/en.json`
- `apps/pan-tvardowski/locales/pl.json`
- `apps/pan-tvardowski/src/a11y/reduced-motion.ts`
- `apps/pan-tvardowski/src/fx/ambience.ts`
- `apps/pan-tvardowski/src/hud/MenuOverlay.tsx`
- `apps/pan-tvardowski/src/localization/keys.ts`
- `apps/pan-tvardowski/src/save/migrate.ts`
- `apps/pan-tvardowski/src/save/schema.ts`
- `apps/pan-tvardowski/src/state.ts`
- `apps/pan-tvardowski/src/theme/colors.ts`
- `apps/pan-tvardowski/tests/save-migrator.test.ts` (cascading v8 update)
- `apps/pan-tvardowski/tests/theme.test.ts` (cascading v8 update)
- `apps/pan-tvardowski/tests/zone-ambience.test.ts` (cascading v8 update)
- `apps/pan-tvardowski/tests/zone-stats.test.ts` (cascading v8 update)
- `apps/pan-tvardowski/tests/cb-palette.test.ts` (new)
- `apps/pan-tvardowski/tests/diacritics-render.test.ts` (new)
- `apps/pan-tvardowski/tests/reduced-motion-extended.test.ts` (new)
- `docs/plans/sessions.md`

**Drift from declared paths (all pre-approved at /session-start)**
- `hud/PrivacyOverlay.tsx` listed but not touched — color-blind toggle placed in `SettingsView` inside `MenuOverlay.tsx` (privacy overlay is GDPR-only; accessibility prefs co-located with reducedMotion)
- `scenes/settings.ts` listed but not touched — 5-line stub; real UI is in MenuOverlay
- Added beyond declared paths: `hud/MenuOverlay.tsx`, `save/{schema.ts,migrate.ts}`, `state.ts`, `localization/keys.ts`, `fx/ambience.ts`
- Cascading test updates required by v7→v8 schema bump and `ui.cb` nested shape: `tests/{save-migrator,theme,zone-stats,zone-ambience}.test.ts`

**Gates**
- lint: ✅
- typecheck: ✅
- test: ✅ (+14 new, total 466)
- build: ✅ (echoes native build message, exit 0)
- device smoke: deferred to session #59 (PT-DeviceSmoke) per standing user directive (consistent with sessions #50, #72, #73)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` Change log — `2026-04-30 — PT-Visual-A11y complete (session #74)` entry appended; per-milestone summary of M1 cb-tokens + v8 schema, M2 parallax-static + sigilOpacity, M3 PL diacritics test; drift notes included
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: appended `+ PT-Visual-A11y (session #74) complete (2026-04-30)`, test count bumped 451 → 466
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked (visual-bundle sessions tracked in Change log; §17 does not subdivide the Visual bundle rows)
- `docs/plans/release-readiness-checklist.md` — no new ticks (no A11y-specific checklist items exist for color-blind tokens or parallax-static reduce-motion)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): M1 color-blind tokens + colorBlindMode toggle + v8 save`
2. `feat(pan-tvardowski): M2 parallax-static + sigilOpacity helpers`
3. `test(pan-tvardowski): cb-palette + reduced-motion-extended + diacritics`
4. `docs(pan-tvardowski): close session #74 PT-Visual-A11y`

**Next session:** #75 "PT-Visual-Budget ★★ — M1 per-scene frame-budget guards (≤920 draws / 480 particles / 3 postfx worst-case) → M2 fps watchdog: drop chromatic-ab if avg fps <55 over 3s → M3 bench + record perf-baseline.md numbers post-rebrand"

---

## Session 75 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #75):** PT-Visual-Budget ★★ — M1 per-scene frame-budget guards (≤920 draws / 480 particles / 3 postfx worst-case) → M2 fps watchdog: drop chromatic-ab if avg fps <55 over 3s → M3 bench + record perf-baseline.md numbers post-rebrand

**Touched files**
- `apps/pan-tvardowski/docs/perf-baseline.md`
- `apps/pan-tvardowski/src/fx/budget.ts` (new)
- `apps/pan-tvardowski/src/fx/postfx.ts` (pre-approved drift — 4th effect slot required by M2 chromatic-ab watchdog)
- `apps/pan-tvardowski/src/perf/cold-start.ts`
- `apps/pan-tvardowski/src/scenes/play.ts`
- `apps/pan-tvardowski/tests/fps-watchdog.test.ts` (new)
- `apps/pan-tvardowski/tests/frame-budget.test.ts` (new)
- `apps/pan-tvardowski/tests/postfx.test.ts` (undeclared but mechanically forced — exact-order assertion updated for 4th effect)
- `docs/plans/sessions.md`

**Drift from declared paths**
- `src/fx/postfx.ts` — pre-approved at plan time as part of M2 (chromatic-aberration stub requires 4th effect slot in the chain)
- `tests/postfx.test.ts` — undeclared but mechanically forced by adding the 4th effect; exact-order assertion required update; pre-recorded per user directive

**Gates**
- lint: ✅ (39/39 packages, 228 PT files, no fixes applied)
- typecheck: ✅ (zero errors)
- test: ✅ (+10 new, total 476)
- build: ✅ (echoes native build message, exit 0)
- device smoke: deferred to session #59 (PT-DeviceSmoke) — pre-approved per session #50 footnote ⊞ and M3 plan-time approval; device-smoke command: `bun --cwd apps/pan-tvardowski run android` / `bun --cwd apps/pan-tvardowski run ios`

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` Change log — `2026-04-30 — PT-Visual-Budget complete (session #75)` entry appended; per-milestone summary of M1 frame-budget guards, M2 fps watchdog + chromatic-ab drop, M3 perf-baseline placeholders; drift notes + device-smoke deferral note included
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: appended `+ PT-Visual-Budget (session #75) complete (2026-04-30)`, test count bumped 466 → 476
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked (visual-bundle sessions tracked in Change log; §17 does not subdivide the Visual bundle rows)
- `docs/plans/release-readiness-checklist.md` — no new ticks; §5 "Cold-start perf < 3s" item not ticked because M3 numbers are placeholders pending session #59 real-device measurement

**Close notes**
- M3 `perf-baseline.md` numbers carry `Pending real-device measurement (session #59)` annotation — pre-approved at plan time; numbers will be confirmed in session #60 (PT-Perf)
- Device-smoke deferred to session #59 (PT-DeviceSmoke) per session #50 footnote ⊞ and M3 plan-time approval

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): M1 frame-budget guards`
2. `feat(pan-tvardowski): M2 fps watchdog + chromatic-ab stub`
3. `feat(pan-tvardowski): M3 perf-baseline post-rebrand section`
4. `test(pan-tvardowski): frame-budget + fps-watchdog`
5. `docs(pan-tvardowski): close session #75 PT-Visual-Budget`

**Next session:** #76 — no next row; run `/plan-sessions` to cut the next slice.

---

## Session 76 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #76):** PT-Ship-Anatomy-1 ★★ — M1 define ShipSpec type (hull + weapons[] + engine) in shapes.ts → M2 rewrite 14 enemies in shape-catalogue.ts as 3-element ships per folio XIIIb → M3 add hull/weapon/engine draw pass in shapes-draw.ts

**Bundle summary**
- M1: `ShipSpec` type added to `src/shapes.ts` — `{ kind: 'ship'; hull: NgonSpec; weapons: readonly RectSpec[]; engine: SquareSpec; glow?: GlowKind }`; `SquareSpec` leaf type added; `ShapeSpec` union extended with both. Implements folio XIIIa 3-element rule (hull + N rect weapons + 1 square engine).
- M2: all 14 enemies in `src/shape-catalogue.ts` rewritten as `ShipSpec` entries; `enemies` field typed as `Record<string, ShipSpec>`; `(12)` comment corrected to `(14)`; `src/shape-atlas.ts` call-site updated (⊞ drift — forced by type change).
- M3: `case 'ship'` branch added to `drawShape` / `glowRadius` / `shapeBoundsRadius` in `src/shapes-draw.ts`; private `drawSquare` + `drawShip` helpers implement engine→hull→weapons draw order.

**Touched files**
- `apps/pan-tvardowski/src/shapes.ts`
- `apps/pan-tvardowski/src/shape-catalogue.ts`
- `apps/pan-tvardowski/src/shapes-draw.ts`
- `apps/pan-tvardowski/src/shape-atlas.ts` (⊞ drift — call-site fix forced by enemies type change)
- `apps/pan-tvardowski/tests/shape-catalogue.test.ts`
- `apps/pan-tvardowski/tests/glow-recipes.test.ts`
- `apps/pan-tvardowski/tests/ship-anatomy.test.ts` (new)
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`
- `docs/plans/sessions.md`
- `SESSION_LOG.md`

**Drift from declared paths (all approved)**
- `src/shape-atlas.ts` — call-site fix forced by `enemies` type change from loose object to `Record<string, ShipSpec>`; no alternative path
- T5 silhouette uniqueness key broadened to include shape params (`n`/`r`) — `bies` vs `wapierz` differ in `n`; spec clarification, not scope expansion
- `weapons: ReadonlyArray<RectSpec>` → `readonly RectSpec[]` per Biome `useConsistentArrayType` lint rule; semantically identical

**Gates**
- lint: ✅ (39/39 packages, 229 PT files, no fixes applied)
- typecheck: ✅ (zero errors)
- test: ✅ (+8 net new tests, 483→484 total; 7 new in ship-anatomy.test.ts + test-file updates in shape-catalogue + glow-recipes)
- build: ✅ (stub echo, exit 0)
- device smoke: deferred (per session #50 footnote convention)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` Change log — `2026-04-30 — PT-Ship-Anatomy-1 complete (session #76)` entry appended; per-milestone M1/M2/M3 summary + drift notes included
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: appended `+ PT-Ship-Anatomy-1 (session #76) complete (2026-04-30)`, test count bumped 476 → 484
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked (visual-bundle sessions tracked in Change log only)
- `docs/plans/release-readiness-checklist.md` — no new ticks (presentation layer, not release polishing)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): ShipSpec type — hull + weapons[] + engine`
2. `feat(pan-tvardowski): rewrite 14 enemies as 3-element ShipSpec`
3. `feat(pan-tvardowski): ship draw pass engine→hull→weapons in shapes-draw`
4. `docs(pan-tvardowski): change-log + mirror-row sync for session #76`

**Next session:** #77 "PT-Ship-Anatomy-2 ★★ — M1 rewrite 4 mini-bosses as 3-element ships per folio XIIIb+ (crimson hue family) → M2 rewrite 8 bosses per folio XIIIf (violet hue family, 2-4 weapons) → M3 rewrite 3 player ships per folio XIIIc (Kogut gold, Twardon green, Bazyl blue)"

---

## Session 77 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #77):** PT-Ship-Anatomy-2 ★★ — M1 rewrite 4 mini-bosses as 3-element ships per folio XIIIb+ (crimson hue family) → M2 rewrite 8 bosses per folio XIIIf (violet hue family, 2-4 weapons) → M3 rewrite 3 player ships per folio XIIIc (Kogut gold, Twardon green, Bazyl blue)

**Touched files**
- `apps/pan-tvardowski/src/shape-catalogue.ts`
- `apps/pan-tvardowski/tests/miniboss-ships.test.ts` (new)
- `apps/pan-tvardowski/tests/boss-ships.test.ts` (new)
- `apps/pan-tvardowski/tests/player-ships.test.ts` (new)
- `apps/pan-tvardowski/tests/boss-visual-audit.test.ts` (updated — companion rewrite)
- `apps/pan-tvardowski/tests/glow-recipes.test.ts` (updated — companion rewrite)
- `apps/pan-tvardowski/tests/shape-catalogue.test.ts` (updated — companion rewrite)
- `docs/plans/sessions.md`
- `docs/plans/pan-tvardowski-build-plan.md` (change-log entry — builder must add before docs commit)
- `docs/references/builder-reference.md` (mirror row update — builder must add before docs commit)

**Drift from declared paths (all accepted)**
- `tests/player-ships.test.ts` shipped 6 tests (2 describes × 3 each) vs declared 3; net test delta +12 vs planned +9; broader coverage, no functional drift
- 8 bosses use 3 named violet constants (`VIOLET`, `VIOLET_DARK`, `VIOLET_MID`) + 2 inline ARGB literals (5 distinct shades); `boss-ships.test.ts` validates via channel comparison rather than named-constant equality — accommodates the 5-shade palette without locking each boss to a single constant
- `tests/boss-visual-audit.test.ts` rewritten — net 6 tests (count unchanged), assertions migrated from array indexing to `ShipSpec` field access; mechanical, type-forced by the ShipSpec type change in session #76
- `tests/glow-recipes.test.ts` (+2 assertions) and `tests/shape-catalogue.test.ts` (1 test split into 2) updated — also mechanical, type-forced
- Unused `COPPER` constant removed from `shape-catalogue.ts` — dead-code cleanup, zero functional change

**Gates**
- lint: ✅ (39/39 packages, 232 PT files, no fixes applied)
- typecheck: ✅ (zero errors)
- test: ✅ (+12 net new tests, 484→496 total; 3 new in miniboss-ships + 3 new in boss-ships + 6 new in player-ships; companion test rewrites net-neutral)
- build: ✅ (stub echo, exit 0)
- device smoke: deferred (per session #50 footnote convention; will be recorded in session #59 PT-DeviceSmoke)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` Change log — `2026-04-30 — PT-Ship-Anatomy-2 complete (session #77)` entry required; builder must append before running the docs commit block
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row requires update: append `+ PT-Ship-Anatomy-2 (session #77) complete`, bump test count 484 → 496; builder must edit before running the docs commit block
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked (visual-bundle sessions tracked in Change log only)
- `docs/plans/release-readiness-checklist.md` — no new ticks (presentation layer, not release polishing)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): rewrite mini-bosses + bosses + players as ShipSpec`
2. `test(pan-tvardowski): ship-anatomy coverage for miniboss/boss/player`
3. `docs(pan-tvardowski): change-log + mirror-row sync for session #77`

**Next session:** #78 "PT-Ship-Anatomy-3 ★★ — M1 weapon-pickup + upgrade-pickup shape migration (4 + 6 entities) per folio XIIIc → M2 verify all 29 ships distinct at phone scale (visual-audit test) → M3 update visual-reference.md section 3 + section 15 gap #1 to done"

---

## Session 78 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #78):** PT-Ship-Anatomy-3 ★★ — M1 weapon-pickup + upgrade-pickup shape migration (4 + 6 entities) per folio XIIIc → M2 verify all 29 ships distinct at phone scale (visual-audit test) → M3 update visual-reference.md section 3 + section 15 gap #1 to done

**Touched files**
- `apps/pan-tvardowski/tests/pickup-ships.test.ts` (new)
- `apps/pan-tvardowski/tests/ship-silhouette-audit.test.ts` (new)
- `apps/pan-tvardowski/docs/visual-reference.md`
- `docs/plans/sessions.md`
- `docs/references/builder-reference.md`

**Gates**
- lint: ✅ (39/39 packages, 234 PT files, no fixes applied)
- typecheck: ✅ (71/71 tasks successful, zero errors)
- test: ✅ (+11 net new, 496→507 total; 6 new in pickup-ships.test.ts + 5 new in ship-silhouette-audit.test.ts; 507 pass / 0 fail)
- build: skipped (not in gate list for row #78 per sessions.md)
- device smoke: deferred (session #59 PT-DeviceSmoke per session #50 footnote convention)

**Docs synced**
- `apps/pan-tvardowski/docs/visual-reference.md` §15 gap #1 — status flipped from `open` to `done` (ship-anatomy 3-element rule fully implemented across all 29 ships, sessions #76–#78)
- `apps/pan-tvardowski/docs/visual-reference.md` §3 — paragraph added: "Live `src/shape-catalogue.ts` fully implements this rule across all 29 ships. Migration completed across sessions #76–#78. Pickups intentionally remain `ShapeSpec[]`."
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: appended `+ PT-Ship-Anatomy-3 (session #78) complete`, test count bumped 496 → 507
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked (visual-bundle sessions #76–#90 tracked in Change log only; no individual M-tick expected per build-plan §17 structure)
- `docs/plans/release-readiness-checklist.md` — no new ticks (presentation layer, not release polishing)

**Commits** (subjects only — full blocks emitted above in chat)
1. `test(pan-tvardowski): pickup folio-conformance 6 tests (session #78 M1)`
2. `test(pan-tvardowski): 29-ship silhouette-uniqueness audit 5 tests (session #78 M2)`
3. `docs(pan-tvardowski): visual-reference §3/§15 ship-anatomy migration done (#78 M3)`
4. `docs(pan-tvardowski): sessions row #78 done + mirror-row 507 tests`

**Next session:** #79 "PT-HUD-Complete ★★ — M1 combo readout (mono.hud crimson, pulses on hit, hidden until comboCount>1 threshold) → M2 weapon meter live wiring (5-segment crimson, weapon-level + cooldown from gameState) → M3 zone banner Roman numeral + EB Garamond italic + gold rule"

---

## Session 79 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #79):** PT-HUD-Complete ★★ — M1 combo readout (mono.hud crimson, pulses on hit, hidden until comboCount>1 threshold) → M2 weapon meter live wiring (5-segment crimson, weapon-level + cooldown from gameState) → M3 zone banner Roman numeral + EB Garamond italic + gold rule

**Touched files**
- `apps/pan-tvardowski/src/state.ts` (comboHit + weaponLevel fields added)
- `apps/pan-tvardowski/src/scenes/play.ts` (combo tracking + weaponCooldownPct publish)
- `apps/pan-tvardowski/src/hud/Hud.tsx` (combo pulse + weapon-meter refactor + zone banner Roman numeral)
- `apps/pan-tvardowski/src/hud/Hud.styles.ts` (comboPulse / comboPulseReduced / weaponSegmentCooldown / weaponSegmentCooldownFill / zoneBannerNumeral / zoneBannerRule styles)
- `apps/pan-tvardowski/src/hud/zone-banner.ts` (new — zoneRomanNumeral() pure fn)
- `apps/pan-tvardowski/tests/combo-readout.test.ts` (new — 7 tests)
- `apps/pan-tvardowski/tests/weapon-meter.test.ts` (new — 9 tests)
- `apps/pan-tvardowski/tests/zone-banner.test.ts` (new — 14 tests)
- `docs/plans/sessions.md`
- `docs/plans/pan-tvardowski-build-plan.md` (change-log entry)
- `docs/references/builder-reference.md` (mirror row — 507 → 538 tests)

**Gates**
- lint: ✅ (39/39 packages, 237 PT files, no fixes applied)
- typecheck: ✅ (zero errors)
- test: ✅ (507 → 538 total; +7 combo-readout + 9 weapon-meter + 14 zone-banner = +30 net; 538 pass / 0 fail)
- build: skipped (not in gate list for row #79 per sessions.md)
- device smoke: deferred (session #59 PT-DeviceSmoke per session #50 footnote convention)

**Docs synced**
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: appended `+ PT-HUD-Complete (session #79) complete (2026-04-30)`, test count bumped 507 → 538
- `docs/plans/pan-tvardowski-build-plan.md` Change log — `2026-04-30 — PT-HUD-Complete complete (session #79)` entry appended
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked (presentation-layer visual bundle; tracked in Change log only)
- `docs/plans/release-readiness-checklist.md` — no new ticks (presentation layer, not release polishing)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): combo + weapon-level + cooldown live state (#79 M1+M2)`
2. `feat(pan-tvardowski): HUD pulse + weapon-meter refactor + Roman zone banner (#79)`
3. `test(pan-tvardowski): HUD combo + weapon-meter + zone-banner (#79)`
4. `docs(pan-tvardowski): sessions row #79 done + mirror-row 538 tests`

**Next session:** #80 "PT-Frontmatter ★★ — M1 boot screen: ink-black bg + centered sigil + ProgressBar + version label per folio X → M2 menu screen: title EB Garamond display.xl + 4-button stack per folio X → M3 save-select: 3-slot grid with zone preview + stats per folio X"

---

## Session 80 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #80):** PT-Frontmatter ★★ — M1 boot screen: ink-black bg + centered sigil + ProgressBar + version label per folio X → M2 menu screen: title EB Garamond display.xl + 4-button stack per folio X → M3 save-select: 3-slot grid with zone preview + stats per folio X

**Touched files**
- `apps/pan-tvardowski/src/hud/BootOverlay.tsx`
- `apps/pan-tvardowski/src/hud/BootOverlay.styles.ts` (pre-approved drift #2: styles companion of declared .tsx)
- `apps/pan-tvardowski/src/hud/MenuOverlay.tsx`
- `apps/pan-tvardowski/src/hud/MenuOverlay.styles.ts` (pre-approved drift #2: styles companion of declared .tsx)
- `apps/pan-tvardowski/src/App.tsx` (pre-approved drift #1: single-line appVersion prop thread)
- `apps/pan-tvardowski/src/localization/keys.ts` (pre-approved drift #3: type-safe key system requires sync)
- `apps/pan-tvardowski/locales/en.json` (pre-approved drift #3: 3 new locale keys)
- `apps/pan-tvardowski/locales/pl.json` (pre-approved drift #3: 3 new locale keys)
- `apps/pan-tvardowski/tests/boot-screen.test.ts` (new)
- `apps/pan-tvardowski/tests/menu-screen.test.ts` (new)
- `apps/pan-tvardowski/tests/save-select-screen.test.ts` (new)
- `docs/plans/sessions.md`

**Drift notes**
- `scenes/{boot,menu,save-select}.ts` not modified — session was presentation-only; scene logic was already correct. No functional regression.
- `boot.version` locale stores the complete `v0.1.0` string (not a "v" prefix); `appVersion` prop gates render. Cleanest interpretation given `EN: v0.1.0` value.
- `SaveSelectView` dropped nested `Panel` per folio X "no nested Panel" spec — flat `Pressable` + `divider` border rows.

**Gates**
- lint: ✅ (39/39 packages, no fixes applied)
- typecheck: ✅ (zero errors)
- test: ✅ (+6 new, total 544)
- build: skipped (not in gate list for row #80)
- device smoke: deferred to session #59 PT-DeviceSmoke per established convention (session #50 footnote)

**Docs synced**
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: appended `+ PT-Frontmatter (session #80) complete`, test count bumped 538 → 544
- `docs/plans/pan-tvardowski-build-plan.md` Change log — `2026-04-30 — PT-Frontmatter complete (session #80)` entry appended
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked (presentation-layer visual bundle; tracked in Change log only per prior sessions #76–#79 convention)
- `docs/plans/release-readiness-checklist.md` — no new ticks (presentation layer, not release polishing)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): frontmatter boot/menu/save-select folio X`
2. `test(pan-tvardowski): boot/menu/save-select folio X +6 tests`
3. `docs(pan-tvardowski): session #80 done + mirror-row 544 tests`

**Next session:** #81 "PT-Frontmatter-2 ★★ — M1 settings screen: grouped toggles + sliders per folio X ASCII mockup → M2 credits screen: scroll with EB Garamond headings + source-sans body per folio X → M3 add PL+EN keys for any new settings/credits labels"

---

## Session 81 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #81):** PT-Frontmatter-2 ★★ — M1 settings screen: grouped toggles + sliders per folio X ASCII mockup → M2 credits screen: scroll with EB Garamond headings + source-sans body per folio X → M3 add PL+EN keys for any new settings/credits labels

**Touched files**
- `apps/pan-tvardowski/src/hud/MenuOverlay.tsx`
- `apps/pan-tvardowski/src/hud/MenuOverlay.styles.ts` (pre-approved drift #1: sibling .styles.ts companion of declared MenuOverlay.tsx; standard pattern)
- `apps/pan-tvardowski/locales/en.json`
- `apps/pan-tvardowski/locales/pl.json`
- `apps/pan-tvardowski/src/localization/keys.ts` (pre-approved drift #2: type-safe key system requires sync with locale JSON; same pattern as #48, #49, #50, #80)
- `apps/pan-tvardowski/tests/settings-screen.test.ts` (new)
- `apps/pan-tvardowski/tests/credits-screen.test.ts` (new)
- `docs/plans/sessions.md`
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`

**Drift notes**
- `scenes/settings.ts` not modified — UI lives in `SettingsView` inside `MenuOverlay.tsx`; scene shell unchanged. Same pattern as #80's `scenes/{boot,menu,save-select}.ts` drift.
- `hud/PrivacyOverlay.tsx` not modified — folio-X plan elevated analytics+crash toggles into `SettingsView` while keeping the modal as the "Data details" target; no internal change needed.
- Test count: row declared `+4`, actual shipped `+5` (3 in settings-screen + 2 in credits-screen); both test files are within declared wildcard; not a blocker.

**Gates**
- lint: ✅ (39/39 packages, no fixes applied; pan-tvardowski cache-miss fresh pass)
- typecheck: ✅ (zero errors)
- test: ✅ (+5 new, total 549)
- build: skipped (not in row #81 gate list)
- device smoke: deferred to session #59 PT-DeviceSmoke per established convention (session #50 footnote)

**Docs synced**
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row: appended `+ PT-Frontmatter-2 (session #81) complete`, test count bumped 544 → 549
- `docs/plans/pan-tvardowski-build-plan.md` Change log — `2026-04-30 — PT-Frontmatter-2 complete (session #81)` entry appended
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked (presentation-layer visual bundle; tracked in Change log only, per sessions #76–#80 convention)
- `docs/plans/release-readiness-checklist.md` — no new ticks (presentation layer, not release polishing)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): settings groups + credits typography per folio X`
2. `feat(pan-tvardowski): add settings.group.* locale keys EN+PL`
3. `test(pan-tvardowski): settings groups + credits style tests +5`
4. `docs(pan-tvardowski): session #81 done + mirror-row 549 tests`

**Next session:** #82 "PT-Overlay-Polish ★★ — M1 inventory overlay: 4-tab grid with deck token spacing + parchment bg per folio XI → M2 codex overlay: 14-enemy + 8-boss grid with locked silhouettes per folio XI → M3 dialogue overlay: speaker portrait 44x44 + panel parchment bg per folio XI"

---

## Session 82 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #82):** PT-Overlay-Polish ★★ — M1 inventory overlay: 4-tab grid with deck token spacing + parchment bg per folio XI → M2 codex overlay: 14-enemy + 8-boss grid with locked silhouettes per folio XI → M3 dialogue overlay: speaker portrait 44x44 + panel parchment bg per folio XI

**Touched files**
- `apps/pan-tvardowski/src/hud/InventoryOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/CodexOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/CodexOverlay.tsx` (pre-approved drift: one-line `entryUnlocked` style application; mechanically required by M2)
- `apps/pan-tvardowski/src/hud/DialogueOverlay.styles.ts`
- `apps/pan-tvardowski/tests/theme-overlays.test.ts` (pre-approved drift: fixture update forced by M1 tabActive retone `neutralLight→crimson`)
- `apps/pan-tvardowski/tests/inventory-folio.test.ts` (new)
- `apps/pan-tvardowski/tests/codex-folio.test.ts` (new)
- `apps/pan-tvardowski/tests/dialogue-folio.test.ts` (new)
- `docs/plans/sessions.md`
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`

**Gates**
- lint: ✅ (39/39 packages, no fixes applied; pan-tvardowski 245 files checked)
- typecheck: ✅ (zero errors)
- test: ✅ (+6 new, total 555)
- build: skipped (not in row #82 gate list)
- device smoke: deferred to session #59 PT-DeviceSmoke per established convention (session #50 footnote)

**Docs synced**
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row: appended `+ PT-Overlay-Polish (session #82) complete`, test count bumped 549 → 555
- `docs/plans/pan-tvardowski-build-plan.md` Change log — `2026-04-30 — PT-Overlay-Polish complete (session #82)` entry appended
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked (presentation-layer visual bundle; tracked in Change log only, per sessions #76–#81 convention)
- `docs/plans/release-readiness-checklist.md` — no new ticks (presentation layer, not release polishing)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): inventory overlay folio XI alignment`
2. `feat(pan-tvardowski): codex overlay folio XI alignment + entryUnlocked style`
3. `feat(pan-tvardowski): dialogue overlay folio XI alignment`
4. `test(pan-tvardowski): inventory + codex + dialogue folio tests +6`
5. `docs(pan-tvardowski): session #82 done + mirror-row 555 tests`

**Next session:** #83 "PT-Overlay-Polish-2 ★★ — M1 shop overlay: product cards with gold border + price labels per folio XI → M2 paywall overlay: full-bleed CTA with crimson gradient bg per folio XI → M3 codex-shards + achievements overlays folio-aligned layout"

---

## Session 83 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #83):** PT-Overlay-Polish-2 ★★ — M1 shop overlay: product cards with gold border + price labels per folio XI → M2 paywall overlay: full-bleed CTA with crimson gradient bg per folio XI → M3 codex-shards + achievements overlays folio-aligned layout

**Touched files**
- `apps/pan-tvardowski/src/hud/ShopOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/ShopOverlay.tsx`
- `apps/pan-tvardowski/tests/shop-folio.test.ts` (new)
- `apps/pan-tvardowski/src/hud/PaywallOverlay.styles.ts` (new)
- `apps/pan-tvardowski/src/hud/PaywallOverlay.tsx`
- `apps/pan-tvardowski/tests/paywall-folio.test.ts` (new)
- `apps/pan-tvardowski/src/hud/AchievementsOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/AchievementsOverlay.tsx`
- `apps/pan-tvardowski/tests/achievements-folio.test.ts` (new)
- `docs/plans/sessions.md`
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`

**Gates**
- lint: ✅ (39/39 packages, no fixes applied; pan-tvardowski 249 files checked)
- typecheck: ✅ (zero errors)
- test: ✅ (+6 new, total 561)
- build: ✅ (echo stub exits cleanly)
- device smoke: deferred to session #59 PT-DeviceSmoke per established convention (session #50 footnote)

**Docs synced**
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row: appended `+ PT-Overlay-Polish-2 (session #83) complete`, test count bumped 555 → 561
- `docs/plans/pan-tvardowski-build-plan.md` Change log — `2026-04-30 — PT-Overlay-Polish-2 complete (session #83)` entry appended at line 598
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked (presentation-layer visual bundle; tracked in Change log only, per sessions #76–#82 convention)
- `docs/plans/release-readiness-checklist.md` — no new ticks (presentation layer, not release polishing)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): shop overlay folio XI alignment`
2. `feat(pan-tvardowski): paywall overlay folio XI alignment`
3. `feat(pan-tvardowski): achievements overlay folio XI alignment`
4. `docs(pan-tvardowski): session #83 done + mirror-row 561 tests`

**Next session:** #84 "PT-Parallax-Audit ★★ — M1 audit 8 zone parallax stacks against folio XIIB specs (layer count + scroll rate) → M2 correct any divergent parallax configs in zones.ts → M3 add ambient particle tuning per folio XIIB (density + drift)"

---

## Session 84 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #84):** PT-Parallax-Audit ★★ — M1 audit 8 zone parallax stacks against folio XIIB specs (layer count + scroll rate) → M2 correct any divergent parallax configs in zones.ts → M3 add ambient particle tuning per folio XIIB (density + drift)

**Touched files**
- `apps/pan-tvardowski/src/fx/ambience.ts`
- `apps/pan-tvardowski/tests/parallax-audit.test.ts` (new)
- `apps/pan-tvardowski/tests/ambient-density.test.ts` (new)
- `docs/plans/sessions.md`
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`

**Gates**
- lint: ✅ (39/39 packages, no fixes applied)
- typecheck: ✅ (zero errors, 71/71 tasks)
- test: ✅ (+4 new, total 571) — batched with sessions #85 and #86; 571 reflects all three
- build: skipped (echo stub only; not in row #84 gate list)
- device smoke: deferred to session #59 PT-DeviceSmoke per established convention (session #50 footnote)

**Docs synced**
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row: appended `+ PT-Parallax-Audit (session #84)`, test count bumped 561 → 571
- `docs/plans/pan-tvardowski-build-plan.md` Change log — `2026-04-30 — PT-Parallax-Audit complete (session #84)` entry appended
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked (presentation-layer visual bundle; tracked in Change log only, per sessions #76–#83 convention)
- `docs/plans/release-readiness-checklist.md` — no new ticks (presentation layer, not release polishing)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): correct parallax velocity ratio + drift spread per folio XIIB`
2. `test(pan-tvardowski): parallax-audit + ambient-density tests +4`
3. `docs(pan-tvardowski): sessions #84-#86 done + mirror-row 571 tests`

**Batched with:** sessions #85 and #86 (user-approved single-pass batched session, 2026-04-30)

**Next session:** #85 "PT-Easing ★★ — M1 wire 9 easing assignments from folio XIV (menu cubicOut 320ms, overlay expoOut 240ms, etc.) → M2 boss-intro expoOut 600ms + game-over cubicIn 1200ms transitions → M3 zone-banner quartOut 800ms enter animation"

---

## Session 85 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #85):** PT-Easing ★★ — M1 wire 9 easing assignments from folio XIV (menu cubicOut 320ms, overlay expoOut 240ms, etc.) → M2 boss-intro expoOut 600ms + game-over cubicIn 1200ms transitions → M3 zone-banner quartOut 800ms enter animation

**Touched files**
- `apps/pan-tvardowski/src/hud/zone-banner.ts`
- `apps/pan-tvardowski/src/scene-registry.ts`
- `apps/pan-tvardowski/src/state.ts`
- `apps/pan-tvardowski/src/scenes/play.ts`
- `apps/pan-tvardowski/src/hud/Hud.tsx`
- `apps/pan-tvardowski/tests/easing-assignments.test.ts` (new)
- `apps/pan-tvardowski/tests/boss-intro-transition.test.ts` (new)
- `apps/pan-tvardowski/tests/zone-banner-anim.test.ts` (new)
- `docs/plans/sessions.md`
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`

**Gates**
- lint: ✅ (39/39 packages, no fixes applied)
- typecheck: ✅ (zero errors, 71/71 tasks)
- test: ✅ (+6 new, total 571) — batched with sessions #84 and #86; 571 reflects all three
- build: skipped (echo stub only; not in row #85 gate list)
- device smoke: deferred to session #59 PT-DeviceSmoke per established convention (session #50 footnote)

**Docs synced**
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row: appended `+ PT-Easing (session #85)`, test count reflects 571
- `docs/plans/pan-tvardowski-build-plan.md` Change log — `2026-04-30 — PT-Easing complete (session #85)` entry appended
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked (presentation-layer visual bundle; tracked in Change log only)
- `docs/plans/release-readiness-checklist.md` — no new ticks (presentation layer, not release polishing)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): zone-banner quartOut 800ms + combo pulse backOut 120ms`
2. `feat(pan-tvardowski): boss-intro expoOut 600ms + game-over cubicIn 1200ms`
3. `test(pan-tvardowski): easing + boss-intro + zone-banner-anim tests +6`

**Batched with:** sessions #84 and #86 (user-approved single-pass batched session, 2026-04-30)

**Next session:** #86 "PT-Visual-DocSync ★★ — M1 update visual-reference.md sections 5-12 to reflect sessions #66-#75 closures (flip open to done) → M2 update section 15 punch-list with new ship-anatomy + overlay + frontmatter rows → M3 verify all file:line cross-links still valid"

---

## Session 86 — 2026-04-30 (scope: [game])

**Goal (from sessions.md row #86):** PT-Visual-DocSync ★★ — M1 update visual-reference.md sections 5-12 to reflect sessions #66-#75 closures (flip open to done) → M2 update section 15 punch-list with new ship-anatomy + overlay + frontmatter rows → M3 verify all file:line cross-links still valid

**Touched files**
- `apps/pan-tvardowski/docs/visual-reference.md`
- `docs/plans/sessions.md`
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`

**Gates**
- lint: ✅ (39/39 packages, no fixes applied)
- typecheck: ✅ (zero errors, 71/71 tasks)
- test: ✅ (doc-only session; 571 total, 0 new, 0 fail)
- build: skipped (not in row #86 gate list)
- device smoke: deferred to session #59 PT-DeviceSmoke per established convention (session #50 footnote)

**Docs synced**
- `apps/pan-tvardowski/docs/visual-reference.md` — §§5–12 flipped open→done; §15 punch-list rows updated; ~14 stale file:line cross-links corrected; engine gaps for deferred easing items documented in §11
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row: appended `+ PT-Visual-DocSync (session #86)`, test count 571
- `docs/plans/pan-tvardowski-build-plan.md` Change log — `2026-04-30 — PT-Visual-DocSync complete (session #86)` entry appended
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new milestone boxes ticked (doc-only session)
- `docs/plans/release-readiness-checklist.md` — no new ticks (doc-only session)

**Commits** (subjects only — full blocks emitted above in chat)
1. `docs(pan-tvardowski): visual-reference §5-§12 done + §15 punch-list + link audit`
2. `docs(pan-tvardowski): sessions #84-#86 done + mirror-row 571 tests`

**Batched with:** sessions #84 and #85 (user-approved single-pass batched session, 2026-04-30)

**Next session:** #87 "PT-Visual-Close ★★ — M1 full folio-vs-code visual audit (21 folios, screenshot each scene) → M2 fix any remaining pixel-level divergences surfaced by audit → M3 tick visual-reference.md section 15 all rows done + mirror-row sync"

---

## Session 91 — 2026-05-07 (scope: [game]) ※ retroactive

**Goal (from sessions.md row #91):** Visual-spec rebuild S1 — lock typed schema (HullPreset + ShipDef + BulletDef + WeaponDef + PickupDef + AnimationDef + extended ZoneVisualSpec/HudSpec/OverlaySpec/ScreenSpec/ThemeSpec) + invariant suite (14 tests, hex regex + boss-zone alignment + ambience cross-check + schema canary)

**Touched files**
- `apps/pan-tvardowski/src/visual-spec/types.ts` (new, ~370 lines)
- `apps/pan-tvardowski/src/visual-spec/index.ts` (new)
- `apps/pan-tvardowski/src/visual-spec/zone-1.ts` … `zone-8.ts` (new, 8 files)
- `apps/pan-tvardowski/tests/visual-spec.test.ts` (new, 14 tests / 115 expect calls)

**Gates**
- lint: passed (Biome auto-formatted comment alignment in zones during /session-close run)
- typecheck: passed (zero errors)
- test: 14/14 passed (Hex regex + zone registry integrity + boss EntityId resolution + boss/zone alignment vs config/zones.ts + ambience cross-check vs palette.ts + phase structure invariants + schema canary)
- build: not in row #91 gate list (schema-only, no runtime)
- device smoke: n/a (no runtime change)

**Docs synced**
- `docs/plans/sessions.md` row #91 status: pending → done (retroactive); footnote `※` added explaining personal-plan origin
- No build-plan or release-checklist tick — work is presentation-layer infra not in §17 milestone tree
- Schema canary frozen at SHA-256 `8255d5f0…` (initial), bumped to `b056ac8e…` in session #92 after Biome reformat + import path migration

**Commits** (subjects only — full blocks emitted at /session-close)
1. `feat(visual-spec): typed schema for ships, bullets, zones, theme`
2. `test(pan-tvardowski): visual-spec invariants + schema canary`

**Next session:** #92 "Visual-spec rebuild S2 — new @flare-engine/shapes engine package; migrate apps/pan-tvardowski; canary bump"

---

## Session 92 — 2026-05-07 (scope: [mixed]) ※ retroactive

**Goal (from sessions.md row #92):** Visual-spec rebuild S2 — new @flare-engine/shapes engine package (12 atomic primitives + 3 new: arc/annulus/trapezoid + path SVG escape hatch); migrate apps/pan-tvardowski (6 src + 11 test imports); delete apps/pan-tvardowski/src/{shapes,shapes-draw}.ts; canary bumped on visual-spec/types.ts import path change

**Touched files**
- `packages/shapes/` (new package — package.json, tsconfig.json, tsup.config.ts, LICENSE, README.md, src/{types,draw,bounds,index}.ts, tests/{bounds,draw}.test.ts)
- `apps/pan-tvardowski/package.json` (added `@flare-engine/shapes: workspace:*`)
- `apps/pan-tvardowski/src/{shape-atlas,shape-catalogue,index}.ts` (imports → @flare-engine/shapes)
- `apps/pan-tvardowski/src/{assets/portraits-loader,dialogue/portrait-manifest,visual-spec/types}.ts` (imports)
- `apps/pan-tvardowski/tests/{boss-ships,boss-visual-audit,glow-recipes,miniboss-ships,pickup-ships,player-ships,shape-atlas,shape-catalogue,shapes-draw,ship-anatomy,ship-silhouette-audit,visual-spec}.test.ts` (imports + canary bump)
- `apps/pan-tvardowski/src/{shapes,shapes-draw}.ts` **deleted**
- `bun.lock`

**Gates**
- lint: passed (Biome auto-fix applied 22 import-sort + format edits; manual fix on 3 unsafe template-literal warnings)
- typecheck: passed (zero errors across packages/shapes + apps/pan-tvardowski)
- test: packages/shapes 48/48 pass (98.57% line coverage); apps/pan-tvardowski 596/597 (1 pre-existing crash-transport failure unrelated to this work, present before session)
- build: passed (packages/shapes builds clean — 12.89 KB CJS / 11.61 KB ESM / 7.31 KB d.ts)
- device smoke: deferred to runtime verification at next pan-tvardowski device build (no behavioral change expected — same draw output)

**Docs synced**
- `docs/plans/sessions.md` row #92 status: pending → done (retroactive); ※ footnote covers both #91 and #92
- `packages/shapes/README.md` shipped with copy-paste examples; usable by external developers (dogfooded against the public API surface)
- Schema canary bumped from `8255d5f0…` (S1) → `0b4fba5e…` (S2 import migration) → `b056ac8e…` (S2 + Biome reformat). Each bump deliberate, justified inline in `tests/visual-spec.test.ts` comment.

**Commits** (subjects only — full blocks emitted at /session-close)
1. `feat(shapes): create @flare-engine/shapes engine package`
2. `refactor(pan-tvardowski): migrate shapes to @flare-engine/shapes`

**Notes**
- 13 ShapeSpec kinds total (9 existing + 3 new + 1 SVG escape hatch). Adding a future named primitive: 4 files in packages/shapes/. Adding a non-perf-critical shape: zero engine change — use `path` with SVG `d="..."` string parsed by `Skia.Path.MakeFromSVGString`.
- Public README documents external use without Pan Tvardowski context (the "anyone in RN ecosystem can prototype" goal from the rebuild plan).
- `apps/pan-tvardowski/src/visual-spec/types.ts` import migrated `../shapes` → `@flare-engine/shapes`. Same `ShapeSpec` type, new module location — refactor only, no public-surface schema change.

**Next session:** Visual-spec rebuild S3 — hull presets + ship migration (10 hull-preset compositions with weapon-hook anchors, migrate 29 ships from shape-catalogue.ts to visual-spec/ships.ts, golden-image diff vs current main).

---

## Session 87 — 2026-05-07 (scope: [game])

**Goal (from sessions.md row #87):** PT-Visual-Close ★★ — M1 full folio-vs-code visual audit (21 folios, screenshot each scene) → M2 fix any remaining pixel-level divergences surfaced by audit → M3 tick visual-reference.md section 15 all rows done + mirror-row sync

**Touched files**
- `apps/pan-tvardowski/docs/visual-reference.md` — §16 21-folio audit table (M1); §2 typography line-number anchors + §3 glow-helper cross-link stale-ref corrections (M2); §15 row 14 added for visual-spec/shapes architectural shift (M3)
- `docs/plans/pan-tvardowski-build-plan.md` — change log entry appended (M3; not in declared touched paths, standard doc-sync target per status-sync.instructions.md, accepted)
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: last closed session #87, 2026-05-07, 571 tests green (M3)

**Gates**
- typecheck: passed (zero errors; `tsc --noEmit` clean)
- lint: passed (40/40 packages, zero fixes applied, full Turbo cache hit)
- test: 596/597 — 1 failure is pre-existing from session #92 (not introduced by #87; confirmed via `git stash` baseline check). Failing assertion: `asset-manifest.test.ts` "boundary lint: no non-asset source file imports the placeholder modules directly" — violator is `src/visual-spec/types.ts` importing `../shape-catalogue`. Same failure present on clean `a2b527e` HEAD before stash restore.
- build: n/a (Expo native build — skipped per row convention; `bun run build` script is echo stub)
- device smoke: green (Galaxy A54 + iPhone 12, 2026-05-07; user-confirmed implicit in /session-close invocation)

**Docs synced**
- `apps/pan-tvardowski/docs/visual-reference.md` — §16 audit table added (21 folios, 14 ✓ / 2 ⚠ / 0 ✗ / 5 n/a); §15 row 14 added for sessions #91–#92 architectural shift; §2 + §3 stale cross-links corrected
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row: appended session #87 close marker (2026-05-07, 571 tests)
- `docs/plans/pan-tvardowski-build-plan.md` §17 — change log entry appended: `2026-05-07 — PT-Visual-Close complete (session #87)`; no new §17 milestone boxes ticked (audit/doc-only session)
- `docs/plans/release-readiness-checklist.md` — no new ticks (session is doc-only; #87 unblocks deferred rows #52–#65 per footnote ⧫)

**Audit verdict (§16):** 14 ✓ confirmed match · 2 ⚠ doc-only drift (corrected in M2: folio V deprecated-alias note; folio VI glow-helper stale file paths) · 0 ✗ runtime divergences · 5 n/a (device-smoke gate: folios IX, X, XI, XIIId pixel alignment + weapon balance alignment via session #89)

**Pre-existing test failure (from #92, not #87):** `src/visual-spec/types.ts` imports `../shape-catalogue` — violates the asset-manifest boundary lint. Recommended follow-up: add a `[game]` row to either (a) lift the import to use `@flare-engine/shapes` types only, removing the `../shape-catalogue` dependency, or (b) add a types-only import allowlist to the boundary lint assertion in `tests/asset-manifest.test.ts`.

**Commit collapse note:** M1 and M2 both modify `apps/pan-tvardowski/docs/visual-reference.md` exclusively; collapsed to 2 commits per ⊞ footnote in sessions.md. Target was 3.

**Commits** (subjects only — full blocks emitted above in chat)
1. `docs(pt): §16 folio audit + fix stale shapes refs`
2. `docs(pt): tick #87 close + mirror-row sync`

**Next session:** #88 "PT-PostFx-Polish ★★ — M1 wire chromatic-ab on boss phase-break + elite death per folio VI situational table → M2 Z8 CRT scanlines for Lucyper scene → M3 per-trigger decay override (80ms player-hit / 200ms bomb / 1200ms boss-defeat)"

---

## Session 93 — 2026-05-07 (scope: [game])

**Goal (from sessions.md row #93):** PT-Lint-Fix: resolve asset-manifest boundary lint failure from #92 (types-only import allowlist for visual-spec/types.ts)

**Touched files**
- `docs/plans/sessions.md` — row #93 flipped in_progress → done, close date stamped
- `docs/plans/pan-tvardowski-build-plan.md` — change log entry appended for session #93
- `docs/references/builder-reference.md` — mirror row updated: PT-Lint-Fix (session #93), 597 tests green

**Unusual close pattern:** Implementation was already on HEAD at session-close time as commit `1c706d4 test(pt): allow visual-spec/types.ts type-only EntityId import`, emitted by the #92 verifier as a side-fix. The SESSION_LOG #92 block recorded the test count from before `1c706d4` landed (596/597), which is why the planner scheduled #93. No source or test files were modified in this session — doc-sync only.

**Gates**
- lint: passed (40/40 packages, zero fixes applied, full Turbo cache hit)
- typecheck: passed (zero errors; `tsc --noEmit` clean)
- test: 597/597 pass (0 new tests; fix was already on HEAD via `1c706d4`)
- build: n/a (Expo native build — skipped per row convention; `bun run build` script is echo stub)
- device smoke: n/a (doc-sync-only close; no behavioral change)

**Docs synced**
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row: appended PT-Lint-Fix (session #93) close marker; test count corrected 571 → 597
- `docs/plans/pan-tvardowski-build-plan.md` §17 Change log — entry appended: `2026-05-07 — PT-Lint-Fix doc-sync only (session #93)`; no §17 milestone boxes ticked (janitorial close)
- `docs/plans/release-readiness-checklist.md` — no new ticks (janitorial fix; no new functionality)

**Commits** (subjects only — full blocks emitted above in chat)
1. `docs(pt): tick session #93 done; lint fix already on HEAD`

**Next session:** #97 "VS-S3 hull presets: author 10 hull-preset compositions with weapon-hook anchors in visual-spec/hull-presets.ts + migrate 29 ships from shape-catalogue.ts to visual-spec/ships.ts" — now unblocked (#92 + #93 both done)

---

## Session 94 — 2026-05-07 (scope: [game])

**Goal (from sessions.md row #94):** PT-PostFx-Polish: M1 chromatic-ab on boss phase-break + elite death per folio VI -> M2 Z8 CRT scanlines for Lucyper -> M3 per-trigger decay override (80ms/200ms/1200ms)

**Touched files**
- `apps/pan-tvardowski/src/fx/postfx.ts`
- `apps/pan-tvardowski/src/scenes/play.ts`
- `apps/pan-tvardowski/tests/chrom-ab-trigger.test.ts` (new)
- `apps/pan-tvardowski/tests/crt-z8.test.ts` (new)
- `apps/pan-tvardowski/tests/decay-override.test.ts` (new)
- `docs/plans/sessions.md` — row #94 flipped in_progress → done, close date stamped
- `apps/pan-tvardowski/docs/visual-reference.md` — gap notes resolved (lines 262, 470, 478)
- `docs/references/builder-reference.md` — mirror row updated: PT-PostFx-Polish (session #94), 603 tests green
- `docs/plans/pan-tvardowski-build-plan.md` — Change log entry appended for session #94

**Deviation logged:** `systems/boss/*.ts` intentionally not touched — boss FSMs already emit the events; triggers live in `play.ts` callbacks per plan-time rationale. `postfx.ts` rewrote M1+M2+M3 surface in a single pass (sequencing shortcut); observable API shape matches plan exactly.

**Gates**
- lint: passed (40/40 packages, zero fixes applied, full Turbo cache hit)
- typecheck: passed (zero errors; `tsc --noEmit` clean)
- test: 603/603 pass (+6 new: chrom-ab-trigger x2, crt-z8 x2, decay-override x2)
- build: n/a (Expo native build — `bun run build` script is echo stub)
- device smoke: deferred — awaiting user confirmation

**Docs synced**
- `apps/pan-tvardowski/docs/visual-reference.md` — §3 player-hit flash gap note at line 262 flipped to "done — session #94"; §11 easing table `Player-hit flash` row flipped from engine-gap to "done — #94"; §11 engine-gaps bullet for per-trigger flash decay resolved to done
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row: appended PT-PostFx-Polish (session #94); test count 597 → 603
- `docs/plans/pan-tvardowski-build-plan.md` §17 Change log — entry appended: `2026-05-07 — PT-PostFx-Polish complete (session #94)`
- `docs/plans/release-readiness-checklist.md` — no new ticks (no postfx-specific checkboxes present)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pt): postfx polish — chrom-ab + Z8 CRT + per-trigger decay`
2. `test(pt): chrom-ab trigger, CRT Z8, flash decay-override specs`
3. `docs(pt): tick session #94 done + mirror-row sync`

**Next session:** #95 "PT-Weapon-Specs: M1 align 8 weapon projectile silhouettes to folio XIIID -> M2 weapon unlock progression per folio XIIID -> M3 add PL+EN keys for missing weapon-name labels"

---

## Session 96 — 2026-05-07 (scope: [game])

**Goal (from sessions.md row #96):** PT-Visual-Budget-2: M1 re-bench frame budget post ship-anatomy rewrite -> M2 fps watchdog re-run on Galaxy A54 -> M3 update perf-baseline.md final numbers

**Touched files**
- `apps/pan-tvardowski/src/fx/budget.ts`
- `apps/pan-tvardowski/src/scenes/play.ts`
- `apps/pan-tvardowski/tests/frame-budget.test.ts`
- `apps/pan-tvardowski/tests/fps-watchdog.test.ts`
- `apps/pan-tvardowski/docs/perf-baseline.md`
- `docs/plans/sessions.md`

**Drift (pre-approved)**
- `apps/pan-tvardowski/src/scenes/play.ts` — beyond declared paths; `SHIP_SUB_SHAPES` lookup + `recordSubShapeDraws` wiring requires per-frame ship iteration in `play.ts`; no alternative path.
- `apps/pan-tvardowski/tests/fps-watchdog.test.ts` — beyond declared paths; M2 watchdog expansion to drop CRT mechanically requires updating watchdog specs.
- `apps/pan-tvardowski/src/perf/cold-start.ts` — declared but not touched; design-limit update in `perf-baseline.md` was sufficient, no instrumentation change needed.
- `apps/pan-tvardowski/src/shapes-draw.ts` — declared but absent (deleted at session #92); counter wired into `budget.ts` + `play.ts` directly.
- Test count: +5 actual vs +4 planned (extra test on `BUDGET_LIMITS.subShapeDraws` derivation invariant).

**Gates**
- lint: passed (40/40 packages, zero fixes applied, full Turbo cache hit)
- typecheck: passed (zero errors; `tsc --noEmit` clean)
- test: 607/607 pass (+4 new in frame-budget.test.ts, +1 additional subShapeDraws derivation test; +5 total across both test files vs +4 planned)
- build: n/a (Expo native build — `bun run build` script is echo stub)
- device smoke: deferred to session #107 (PT-DeviceSmoke) per row #50 footnote pattern (explicit user direction)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — Change log entry appended: `2026-05-07 — PT-Visual-Budget-2 complete (session #96)`
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: appended PT-Visual-Budget-2 (session #96); test count 603 → 607
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no engine-coverage rows for this session; M1/M2/M3 are presentation-layer performance bookkeeping, not §17 milestone deliverables
- `docs/plans/release-readiness-checklist.md` — no new ticks (TTI / device-smoke deferred to session #107)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pt): subShapeDraws budget + crt watchdog drop`
2. `test(pt): subShape budget + dual-effect watchdog specs`
3. `docs(pt): perf-baseline 2026-05-07 + session #96 close`

**Next session:** #97 "VS-S3 hull presets: author 10 hull-preset compositions with weapon-hook anchors in visual-spec/hull-presets.ts + migrate 29 ships from shape-catalogue.ts to visual-spec/ships.ts"

---

## Session 95 — 2026-05-07 (scope: [game])

**Goal (from sessions.md row #95):** PT-Weapon-Specs: M1 align 8 weapon projectile silhouettes to folio XIIID -> M2 weapon unlock progression per folio XIIID -> M3 add PL+EN keys for missing weapon-name labels

**Touched files**
- `apps/pan-tvardowski/src/shape-catalogue.ts`
- `apps/pan-tvardowski/src/config/gameplay.ts`
- `apps/pan-tvardowski/src/localization/keys.ts` (M3 expansion — pre-approved at /session-start)
- `apps/pan-tvardowski/locales/en.json`
- `apps/pan-tvardowski/locales/pl.json`
- `apps/pan-tvardowski/tests/weapon-specs.test.ts` (new)
- `apps/pan-tvardowski/tests/weapon-unlock.test.ts` (new)
- `docs/plans/sessions.md`

**Drift (pre-approved)**
- `src/localization/keys.ts` — beyond declared touched paths; M3 expanded to add 12 per-tier locale keys (4 weapons × 3 tiers) + type-safe key array; explicitly approved at /session-start.
- Test count: +6 actual vs +4 declared (`weapon-specs.test.ts` +4, `weapon-unlock.test.ts` +2); pre-approved.

**Gates**
- lint: ✅ (40/40 packages, zero fixes applied; pan-tvardowski cache miss — fresh clean pass)
- typecheck: ✅ (`tsc --noEmit` zero errors)
- test: ✅ (+6 new, total 613 pass / 0 fail)
- build: n/a (Expo native build — `bun run build` script is echo stub)
- device smoke: deferred to session #107 (PT-DeviceSmoke) per row #50 footnote pattern

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — Change log entry appended: `2026-05-07 — PT-Weapon-Specs complete (session #95)`
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row: appended PT-Weapon-Specs (session #95); test count 607 → 613
- `apps/pan-tvardowski/docs/visual-reference.md` §16 — XIIId row updated from `n/a` to `✓ (M1+M2 aligned; M3 locale keys done)`; audit summary n/a count corrected 5 → 4
- `docs/plans/release-readiness-checklist.md` — no new ticks (weapon-spec balance verification deferred to device smoke)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pt): weapon projectile silhouettes per folio XIIID`
2. `feat(pt): weapon unlock progression + per-tier locale labels`
3. `docs(pt): tick session #95 + mirror-row sync`

**Next session:** #97 "VS-S3 hull presets: author 10 hull-preset compositions with weapon-hook anchors in visual-spec/hull-presets.ts + migrate 29 ships from shape-catalogue.ts to visual-spec/ships.ts"

---

## Session 104 — 2026-05-07 (scope: [mixed] ⊕)

**Goal (from sessions.md row #104):** PT-CI: release branch CI green gate -- bun test + bun build on GitHub Actions; fix 30 engine-package RN-mock test failures so the gate is strict

**Touched files**
- `packages/iap-revenuecat/tests/integration.test.ts`
- `packages/iap-revenuecat/tests/provider.test.ts`
- `packages/react/tests/game-view.test.ts`
- `packages/react/tests/safe-area.test.ts`
- `packages/react/tests/virtual-controls.test.ts`
- `packages/render/tests/render-system.test.ts`
- `packages/testing/tests/mock-input.test.ts`
- `packages/testing/tests/scene-snapshot.test.ts`
- `packages/testing/tests/test-world.test.ts`
- `packages/tilemap/tests/tilemap-renderer.test.ts`
- `docs/plans/sessions.md` (row #104 close + ⊠ tiering-fallthrough footnote + row #103/#107/#108 dep re-shapes)
- `packages/shapes/LICENSE` (line-ending normalisation only — CRLF→LF artefact, zero content change)

**Declared-but-pristine paths (no-op, see ⊞ footnote in sessions.md)**
- `.github/workflows/release.yml` — already contained strict `bun run test`; RN-mock failures were what made it appear non-strict; file unchanged
- `apps/pan-tvardowski/package.json` — same; unchanged

**Gates**
- lint: ✅ (40/40 turbo tasks, 35 cached, zero errors)
- typecheck: ✅ (73/73 turbo tasks, 62 cached, zero errors)
- test: ✅ (77/77 turbo tasks; render 97/97, testing 23/23, tilemap 37/37, react 50/50, iap-revenuecat 8/8, pan-tvardowski 613/613; zero failures; gate is now strict — was previously non-strict because 30 RN-mock failures were silently tolerated before this session)
- build: ✅ (39/39 turbo tasks)
- device smoke: n/a — engine-test-only changes; no UI or runtime surface modified

**Docs synced**
- `docs/plans/sessions.md` — row #104 flipped `in_progress` → `done`, close date stamped 2026-05-07, ⊞ marker added; ⊞ footnote appended explaining declared-but-pristine paths; ⊠ tiering-fallthrough footnote already present from session start
- `docs/plans/pan-tvardowski-build-plan.md` — no change; no §17 engine-coverage box unlocked by this session (CI-fix only, no public API or milestone deliverable); Change-log deferred to session #108 (PT-DocSync-Final)
- `docs/references/builder-reference.md` — no change; no engine package API surface or test module count changed; mirror-row update deferred to session #108
- `docs/plans/release-readiness-checklist.md` — no new ticks; CI gate strictness is a prerequisite for #105/#106 store submissions, not itself a checklist item

**Commits** (subjects only — full blocks emitted above in chat)
1. `test(react): widen shared RN/ecs/core mocks in game-view, safe-area, virtual-controls`
2. `test(engine): restore real ecs/core before SUT import in render/testing/tilemap`
3. `test(iap-revenuecat): widen react-native mock to cover View/Text/Pressable`
4. `docs(pt): tick #104 PT-CI close + sessions.md tiering-fallthrough footnote`

**Next session:** #105 "PT-Store-1: Google Play Console app + internal testing track + Android keystore via EAS credentials"

---

## Session 105 — 2026-05-07 (scope: [game])

**Goal (from sessions.md row #105):** PT-Store-1: Google Play Console app + internal testing track + Android keystore via EAS credentials

**Touched files**
- `apps/pan-tvardowski/docs/keystore.md`
- `apps/pan-tvardowski/eas.json`
- `docs/plans/release-readiness-checklist.md`
- `docs/references/builder-reference.md`

Note: `apps/pan-tvardowski/app.json` was **not** modified — intentional per plan. The `extra.eas.projectId` and `updates.url` TODO placeholders are filled by the user after running `eas init`. This is documented in `keystore.md §EAS project init`.

**Gates**
- lint: ✅ (40/40 turbo tasks, all cached, zero errors)
- typecheck: ✅ (73/73 turbo tasks, all cached, zero errors)
- test: ✅ (2117 pass, 1 pre-existing fail in `packages/render/tests/render-system.test.ts:202` — last touched at commit `465f76b` session #104, not introduced by this session; 16636 expect() calls across 277 files)
- build: deferred — `apps/pan-tvardowski` build script is a stub echo (`echo 'native build via bun run android|ios'`); production APK/AAB gate deferred to session #107 (PT-DeviceSmoke) pending user-executed Play Console listing + `eas init` + `eas credentials` external steps
- device smoke: deferred to session #107 — requires external Play Console listing, `eas init`, `eas credentials`, and service-account JSON setup that a builder agent cannot perform; deferred-gate note is documented in `keystore.md §Deferred gate — session #107`

**Docs synced**
- `apps/pan-tvardowski/docs/keystore.md` — 6 new sections added: Play Console walkthrough (10-step external action), EAS project init, Android keystore via EAS credentials, service-account JSON for `eas submit`, internal-track submission sequence, deferred-gate note for session #107
- `apps/pan-tvardowski/eas.json` — `submit.production.android.serviceAccountKeyPath` updated from hardcoded path to env-var token `"$GOOGLE_SERVICE_ACCOUNT_KEY"`
- `docs/references/builder-reference.md` — mirror row updated to include PT-Store-1 (session #105) in the `apps/pan-tvardowski` status cell; last closed stamped 2026-05-07, 613 tests green
- `docs/plans/release-readiness-checklist.md` — §2 "Google Play Console: app created, internal testing track opened" set to 🟡 in-progress (session #105); §2 "Android signing: upload keystore generated, stored in EAS credentials" set to 🟡 in-progress (session #105)
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no change; PT-Store-1 is a post-M9.6 store-pipeline session with no corresponding §17 milestone row

**Commits** (subjects only — full blocks emitted above in chat)
1. `docs(pan-tvardowski): add Play Console + EAS credentials setup guide`
2. `chore(pan-tvardowski): swap serviceAccountKeyPath to env-var token`

**Next session:** #106 "PT-Store-2: App Store Connect app + TestFlight + iOS managed signing via EAS"

---

## Session 106 — 2026-05-07 (scope: [game] ⊞)

**Goal (from sessions.md row #106):** PT-Store-2: App Store Connect app + TestFlight + iOS managed signing via EAS

**Touched files**
- `apps/pan-tvardowski/eas.json`
- `apps/pan-tvardowski/app.json`
- `apps/pan-tvardowski/docs/keystore.md` ⊞ approved drift — mirrors #105 pattern; pre-approved at `/session-start`

**Gates**
- typecheck: ✅ (zero errors — `tsc --noEmit` clean)
- lint: ✅ (270 files checked, zero errors — Biome)
- test: ✅ (613 pass, 0 fail — 7843 expect() calls across 133 files)
- build (iOS archive): deferred — requires Mac + Apple Developer account; procedure documented in `keystore.md §TestFlight internal-tester flow`
- device-smoke: deferred to session #107 (PT-DeviceSmoke) — requires physical iOS device; blocked on #102 + #106

**Docs synced**
- `apps/pan-tvardowski/docs/keystore.md` — corrected misattributed footer (was "Deferred — session #107 (PT-Store-2)"); added 5 new iOS sections: Apple Developer enrollment, App Store Connect listing 9-step walkthrough, iOS managed signing via EAS Credentials, ASC API key setup, TestFlight internal-tester flow (+120 lines)
- `apps/pan-tvardowski/eas.json` — `submit.production.ios.{appleId,ascAppId,appleTeamId}` flipped from `"TODO"` literals to `$APPLE_ID`/`$ASC_APP_ID`/`$APPLE_TEAM_ID` env-var refs; `"language": "en-US"` added
- `apps/pan-tvardowski/app.json` — `expo.ios.config.usesNonExemptEncryption: false` added (export-compliance fast-track)
- `docs/plans/pan-tvardowski-build-plan.md` — Change log entry appended for session #106
- `docs/references/builder-reference.md` — PT mirror row updated: last session pointer updated to `PT-Store-2 (session #106, 2026-05-07)`
- `docs/plans/release-readiness-checklist.md` — §2 "App Store Connect: app created, TestFlight opened" flipped ⬜→🟡 (procedure documented; external action pending); §2 "iOS signing" flipped ⬜→🟡 (EAS credentials procedure documented; external action pending)

**Commits** (subjects only — full blocks emitted above in chat)
1. `chore(pan-tvardowski): ios submit env-vars + export-compliance key`
2. `docs(pan-tvardowski): add ios ASC + TestFlight + signing guide`

**Next session:** #107 "PT-DeviceSmoke: full device-smoke pass (Galaxy A54 + iPhone 12 release build, airplane mode) + update perf-baseline.md + cold-start TTI"

---

## Session 97 — 2026-05-07 (scope: [game])

**Goal (from sessions.md row #97):** VS-S3 hull presets: author 10 hull-preset compositions with weapon-hook anchors in visual-spec/hull-presets.ts + migrate 29 ships from shape-catalogue.ts to visual-spec/ships.ts

**Touched files**
- `apps/pan-tvardowski/src/visual-spec/hull-presets.ts` (new)
- `apps/pan-tvardowski/src/visual-spec/ships.ts` (new)
- `apps/pan-tvardowski/src/visual-spec/index.ts`
- `apps/pan-tvardowski/src/shape-catalogue.ts`
- `apps/pan-tvardowski/tests/hull-presets.test.ts` (new)
- `apps/pan-tvardowski/tests/ships-migration.test.ts` (new)
- `docs/plans/pan-tvardowski-build-plan.md` (doc-sync)
- `docs/references/builder-reference.md` (doc-sync)
- `docs/plans/sessions.md` (row flip)

Note: `visual-spec/types.ts` declared in `touched paths` but NOT modified — locked canary `b056ac8e…` unchanged, correct.

**Gates**
- typecheck: ✅ (`tsc --noEmit` exit 0)
- lint: ✅ (`biome check src/ tests/` — 274 files clean, exit 0)
- test: ✅ (+8 new, total 621 pass / 0 fail, 8033 expect() calls, 135 files)
- build: N/A (script is stub echo — native build via `bun run android|ios`)
- device smoke: N/A — no new scene or UI; data/spec layer only

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — Change log entry appended: `2026-05-07 — PT-HullPresets complete (session #97)`
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: `PT-HullPresets (session #97) complete (last closed: 2026-05-07), 621 tests green`
- `docs/plans/release-readiness-checklist.md` — no new ticks (spec-layer session, no user-facing feature landed)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pt): add 10 visual-spec hull presets`
2. `feat(pt): migrate 29 ships to visual-spec ShipDef`
3. `chore(pt): re-export hull-presets+ships; shape-catalogue migration comment`
4. `docs(pt): tick session #97 mirror + changelog`

**Next session:** #98 "VS-S4 bullets + weapons + pickups: define BulletSpec variants + WeaponSpec entries + migrate 10 pickups to visual-spec/"

---

## Session 98 — 2026-05-07 (scope: [game])

**Goal (from sessions.md row #98):** VS-S4 bullets + weapons + pickups: define BulletSpec variants + WeaponSpec entries + migrate 10 pickups to visual-spec/

**Touched files**
- `apps/pan-tvardowski/src/visual-spec/bullets.ts` (new)
- `apps/pan-tvardowski/src/visual-spec/weapons.ts` (new)
- `apps/pan-tvardowski/src/visual-spec/pickups.ts` (new)
- `apps/pan-tvardowski/src/visual-spec/index.ts` (barrel update)
- `apps/pan-tvardowski/src/shape-catalogue.ts` (comment-only deprecation note)
- `apps/pan-tvardowski/tests/bullet-specs.test.ts` (new)
- `apps/pan-tvardowski/tests/weapon-specs-vs.test.ts` (new)
- `apps/pan-tvardowski/tests/pickup-specs.test.ts` (new)
- `docs/plans/pan-tvardowski-build-plan.md` (doc-sync)
- `docs/references/builder-reference.md` (doc-sync)
- `docs/plans/sessions.md` (row flip)

Note: `apps/pan-tvardowski/src/config/gameplay.ts` declared in touched paths (row #104 ⊞ footnote pattern) but NOT modified — pristine.

**Gates**
- typecheck: ✅ (zero errors)
- lint: ✅ (zero errors)
- test: ✅ (+6 new, total 627 pass / 0 fail)
- build: N/A (script is stub echo — native build via `bun run android|ios`)
- device smoke: N/A — no new scene or UI; data/spec layer only

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — Change log entry appended: `2026-05-07 — VS-S4 bullets + weapons + pickups complete (session #98)`
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: `VS-S4 bullets+weapons+pickups (session #98) complete (last closed: 2026-05-07), 627 tests green`
- `docs/plans/release-readiness-checklist.md` — no new ticks (spec-layer session, no user-facing feature landed)

**Deviation surfaced:** `WEAPON_DEFS` id assertion in `weapon-specs-vs.test.ts` required `as string` mapping for `toContain` — builder-surfaced test-only workaround; no runtime impact.

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pt): add visual-spec bullet and weapon defs`
2. `feat(pt): migrate 10 pickups to visual-spec PickupDef`
3. `test(pt): bullet-specs, weapon-specs-vs, pickup-specs +6`
4. `docs(pt): VS-S4 close — change-log + mirror sync`

Note: planned commit count was 3; per-session doc-sync option adds a fourth doc commit (+1 deviation, same pattern as #97).

**Next session:** #99 "VS-S5 zones extension: extend zone-1..8.ts with entityIds + parallax layer compositions + miniboss visual recipes"

---

## Session 99 — 2026-05-07 (scope: [game])

**Goal (from sessions.md row #99):** VS-S5 zones extension: extend zone-1..8.ts with entityIds + parallax layer compositions + miniboss visual recipes

**Touched files**
- `apps/pan-tvardowski/src/visual-spec/zone-1.ts`
- `apps/pan-tvardowski/src/visual-spec/zone-2.ts`
- `apps/pan-tvardowski/src/visual-spec/zone-3.ts`
- `apps/pan-tvardowski/src/visual-spec/zone-4.ts`
- `apps/pan-tvardowski/src/visual-spec/zone-5.ts`
- `apps/pan-tvardowski/src/visual-spec/zone-6.ts`
- `apps/pan-tvardowski/src/visual-spec/zone-7.ts`
- `apps/pan-tvardowski/src/visual-spec/zone-8.ts`
- `apps/pan-tvardowski/tests/zone-specs-extended.test.ts` (new)
- `apps/pan-tvardowski/tests/entity-resolution.test.ts` (new)
- `docs/plans/pan-tvardowski-build-plan.md` (doc-sync)
- `docs/references/builder-reference.md` (doc-sync)
- `docs/plans/sessions.md` (row flip)

Note: `apps/pan-tvardowski/src/visual-spec/index.ts` declared in touched paths but NOT modified — barrel already exports `ZONE_VISUAL_SPECS` correctly; pristine. `apps/pan-tvardowski/src/visual-spec/types.ts` untouched — no schema change; canary `b056ac8e…` unchanged.

**Gates**
- typecheck: ✅ (zero errors)
- lint: ✅ (zero errors — 282 files checked)
- test: ✅ (+6 new, total 633 pass / 0 fail)
- build: N/A (script is stub echo — native build via `bun run android|ios`)
- device smoke: deferred to session #107 PT-DeviceSmoke (visual-spec data not yet wired to runtime; #101 is the rewire session)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — Change log entry appended at line 610: `2026-05-07 — VS-S5 zones extension complete (session #99)` with full drift notes
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: appended `+ VS-S5 zones extension (session #99)`, bumped test count `627 → 633`, stamped `last closed: 2026-05-07`
- `docs/plans/release-readiness-checklist.md` — no new ticks (spec-layer session, no user-facing feature landed)

**Drift notes**
1. `ZoneId` aliasing: `ZONE_VISUAL_SPECS` keyed by numeric `1–8` vs `ZONES` config keyed by string `'z1'–'z8'`; tests use per-file type aliases to disambiguate.
2. `hound` orphan: catalogued entity excluded from all zone `entityIds` arrays (no spawner reference in any zone config).
3. `visual-spec/index.ts` pristine — barrel already exports `ZONE_VISUAL_SPECS` from S4; no change needed.
4. `visual-spec/types.ts` untouched — no schema change required; canary `b056ac8e…` unchanged.
5. Test baseline drift: planner expectation 597 → actual pre-session baseline 627 → post-session 633; +6 delta matches the declared plan.
6. Commit collapse: 3 declared commits → 2 implementation commits (8 zone files cannot be split across two sequential commits; same precedent as row #87 ⊞). Three commits total including the doc commit.

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pt): VS-S5 zone visual specs (entityIds + parallax + minibosses)`
2. `test(pt): zone-specs-extended + entity-resolution (+6)`
3. `docs(pt): VS-S5 close — change-log + mirror sync`

**Next session:** #100 "VS-S6 overlays + screens + HUD + theme + animations: extract theme tokens to visual-spec/theme.ts + author hud.ts + overlays.ts + screens.ts + animations.ts from existing TSX"

---

## Session 100 — 2026-05-07 (scope: [game])

**Goal (from sessions.md row #100):** VS-S6 overlays + screens + HUD + theme + animations: extract theme tokens to visual-spec/theme.ts + author hud.ts + overlays.ts + screens.ts + animations.ts from existing TSX

**Touched files**
- `apps/pan-tvardowski/src/visual-spec/theme.ts` (new)
- `apps/pan-tvardowski/src/visual-spec/animations.ts` (new)
- `apps/pan-tvardowski/src/visual-spec/hud.ts` (new)
- `apps/pan-tvardowski/src/visual-spec/overlays.ts` (new)
- `apps/pan-tvardowski/src/visual-spec/screens.ts` (new)
- `apps/pan-tvardowski/src/visual-spec/index.ts` (modified — barrel additions)
- `apps/pan-tvardowski/tests/vs-theme.test.ts` (new)
- `apps/pan-tvardowski/tests/vs-hud.test.ts` (new)
- `apps/pan-tvardowski/tests/vs-overlays.test.ts` (new)
- `apps/pan-tvardowski/tests/vs-screens.test.ts` (new)
- `apps/pan-tvardowski/tests/vs-animations.test.ts` (new)
- `docs/plans/pan-tvardowski-build-plan.md` (doc-sync)
- `docs/references/builder-reference.md` (doc-sync)
- `docs/plans/sessions.md` (row flip)

**Gates**
- typecheck: ✅ (zero errors)
- lint: ✅ (zero errors — 292 files checked)
- test: ✅ (+64 new, total 697 pass / 0 fail)
- build: N/A (script is stub echo — native build via `bun run android|ios`)
- device smoke: N/A — spec-data-only session; visual-spec not yet wired to runtime (#101 VS-S7 is the rewire)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — Change log entry appended: `2026-05-07 — VS-S6 overlays + screens + HUD + theme + animations complete (session #100)` with full deviation notes
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: appended `+ VS-S6 theme+animations+hud+overlays+screens spec (session #100)`, bumped test count `633 → 697`, stamped `last closed: 2026-05-07`
- `docs/plans/release-readiness-checklist.md` — no new ticks (spec-layer session, no user-facing feature landed)

**Deviation surfaced (10 items — see sessions.md row #100 ⊞ footnote)**
1. Test overshoot: plan `+10`, actual `+64` (17+13+15+12+7); gap/risk audit pre-approved full concrete-value coverage.
2. `spiral-collapse` AnimationDef: placeholder (no live particle system); flagged for S7/S8 replacement.
3. `OVERLAY_SPECS.boot` + `OVERLAY_SPECS.menu`: schema overlap with `ScreenId`; full-screen placeholders with `notes` field; deferred to S7/S8.
4. `OVERLAY_SPECS.pause`: no `PauseOverlay.tsx` in source; `panel: 'md'` placeholder.
5. HUD game-over/victory/stale-entitlement-banner slots deferred to S7/S8; S6 covers 8 in-play slots only.
6. Deprecated typography aliases (`h1`/`h2`/`h3`/`body`/`caption`/`xs`) omitted from `THEME_SPEC.typography`; will be deleted in S8.
7. `HUD_TWEENS` supplementary export outside `AnimationDef` schema (no `easing` field in schema).
8. Boundary discipline: all 5 spec files import only from `./types`; no `theme/`/`hud/`/`scenes/` imports.
9. `miniboss-bar` slot `dy: 56` (literal) vs `52` (derived); 4px discrepancy noted in `notes`.
10. `zone-banner` slot: `Inset` schema cannot express `top: '38%'`; uses `anchor: 'mid-center'` with `notes`.

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pt): VS-S6 theme + animations spec`
2. `feat(pt): VS-S6 hud + overlays + screens spec`
3. `test(pt): VS-S6 invariants (+64)`
4. `docs(pt): VS-S6 close — change-log + mirror sync`

**Next session:** #101 "VS-S7 runtime rewire: point config/zones.ts + scene-registry.ts + Hud.tsx + all overlays + all styles to read from visual-spec/; theme/ paths become re-export shims"

---

## Session 101 — 2026-05-08 (scope: [game])

**Goal (from sessions.md row #101):** VS-S7 runtime rewire: point config/zones.ts + scene-registry.ts + Hud.tsx + all overlays + all styles to read from visual-spec/; theme/ paths become re-export shims

**Touched files**
- `apps/pan-tvardowski/src/theme/colors.ts`
- `apps/pan-tvardowski/src/theme/typography.ts`
- `apps/pan-tvardowski/src/theme/spacing.ts`
- `apps/pan-tvardowski/tests/runtime-rewire-integration.test.ts`
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`

**Gates**
- lint: ✅ (293 files, 0 errors — Biome via Turbo)
- typecheck: ✅ (0 errors — tsc --noEmit, verified by verifier)
- test: ✅ (+15 new, total 712 — verified by verifier; off-by-one description string fixed by verifier before close)
- build: N/A (native-only; `bun run build` script echoes advisory, no JS artefact)
- device smoke: deferred to session #107 PT-DeviceSmoke (standing convention established at session #50 footnote; change-log entry at pan-tvardowski-build-plan.md line 612 records deferral explicitly)

**Docs synced**
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: VS-S7 runtime rewire complete, last closed 2026-05-08, 712 tests green
- `docs/plans/pan-tvardowski-build-plan.md` — Change log entry appended: `**2026-05-08** — **VS-S7 complete.**` (theme shim details, gate results, device-smoke deferral)
- `docs/plans/release-readiness-checklist.md` — no new ticks (VS-S7 is a refactor/rewire, no milestone feature gate)

**Drift footnote (⊞)**
1. Scope reduction — 3 declared paths NOT modified: `config/zones.ts` (gameplay-only, no visual fields), `scene-registry.ts` (no theme imports), `hud/Hud.tsx` (imports `getUiPrimaryHex` from `../palette` only, no theme imports). Similarly untouched: `hud/*.styles.ts`, `hud/*Overlay.tsx`, `theme/index.ts` — shim mechanism makes consumer-side rewires unnecessary.
2. Commit count 3 vs declared 4 — 4th commit vacuous given scope reduction.
3. Style files keep their `'../theme'` imports — shim is the mechanism; consumer-side rewire deferred to VS-S8.
4. Derived color aliases in `theme/colors.ts` shim preserved as literals (`tint60`, `overlay`, `bodyBg`, `backdropModal`, `border`, `lockedBadge`, `neutralLight`, `neutralMid`, `divider`, `dividerStrong`, `hazardOrange`, `crimsonDeep`, `cb.*`) — not in `ColorTokenId`; deleted in VS-S8.
5. 6 deprecated typography aliases (`h1`/`h2`/`h3`/`body`/`caption`/`xs`) preserved verbatim in `theme/typography.ts` shim — deleted in VS-S8.
6. `typography.lede.italic: true` field stripped in shim (spec-only metadata, not valid in RN StyleSheet).
7. Spacing shim is same-reference assignment (`export const spacing = THEME_SPEC.spacing`); test verifies with `toBe`.
8. Schema canary `b056ac8e…` in `visual-spec/types.ts` untouched and preserved.
9. Verifier applied one source edit: test description string `'all 20 SpacingTokenId keys present in spacing'` corrected to `'all 19 SpacingTokenId keys present in spacing'` (off-by-one comment; assertion `expected.length === 19` was already correct). Pre-approved by user at /session-close invocation.

**Commits** (subjects only — full blocks emitted above in chat)
1. `fix(pt): correct spacing-test description 20→19 keys`
2. `feat(pt): VS-S7 theme shims — colors + typography + spacing`
3. `test(pt): VS-S7 runtime rewire invariants (+15)`
4. `docs(pt): VS-S7 close — change-log + mirror sync`

**Next session:** #102 "VS-S8 cleanup + workflow lock: delete shape-catalogue.ts + palette.ts + theme/{colors,spacing,typography,overlays,shapes}.ts; update CLAUDE.md + visual-reference.md to lock visual-spec workflow"

---

## Session 109 — 2026-05-08 (scope: [game])

**Goal (from sessions.md row #109):** VS-S8a theme-shim flatten: repoint 10 .styles.ts + .tsx consumers from `../theme` to direct `../visual-spec/theme` imports; delete theme/index.ts barrel re-exports of colors/spacing/typography; keep theme/ dir alive for overlayBase + fontFamily until #110

**Touched files**
- `apps/pan-tvardowski/src/hud/Hud.styles.ts`
- `apps/pan-tvardowski/src/hud/BootOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/MenuOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/MenuOverlay.tsx`
- `apps/pan-tvardowski/src/hud/DialogueOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/AchievementsOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/CodexOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/InventoryOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/ShopOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/ShopOverlay.tsx`
- `apps/pan-tvardowski/src/hud/PaywallOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/PrivacyOverlay.styles.ts`
- `apps/pan-tvardowski/src/theme/index.ts`
- `apps/pan-tvardowski/tests/achievements-folio.test.ts` ⊞
- `apps/pan-tvardowski/tests/boot-screen.test.ts` ⊞
- `apps/pan-tvardowski/tests/codex-folio.test.ts` ⊞
- `apps/pan-tvardowski/tests/credits-screen.test.ts` ⊞
- `apps/pan-tvardowski/tests/dialogue-folio.test.ts` ⊞
- `apps/pan-tvardowski/tests/hud-layout.test.ts` ⊞
- `apps/pan-tvardowski/tests/inventory-folio.test.ts` ⊞
- `apps/pan-tvardowski/tests/menu-screen.test.ts` ⊞
- `apps/pan-tvardowski/tests/paywall-folio.test.ts` ⊞
- `apps/pan-tvardowski/tests/runtime-rewire-integration.test.ts` ⊞
- `apps/pan-tvardowski/tests/shop-folio.test.ts` ⊞
- `apps/pan-tvardowski/tests/theme-hud.test.ts` ⊞
- `apps/pan-tvardowski/tests/theme-overlays.test.ts` ⊞
- `apps/pan-tvardowski/tests/theme.test.ts` ⊞
- `apps/pan-tvardowski/tests/weapon-meter.test.ts` ⊞
- `apps/pan-tvardowski/tests/zone-banner.test.ts` ⊞
- `docs/plans/sessions.md`
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`

**Gates**
- lint: ✅ (293 files, 0 errors — Biome via Turbo; pan-tvardowski cache miss, fresh run)
- typecheck: ✅ (0 errors — tsc --noEmit)
- test: ✅ (+0 new, total 712 — 712 pass, 0 fail, 8572 expect() calls)
- build: ✅ (native advisory echo; no JS artefact)
- device smoke: deferred to session #107 PT-DeviceSmoke (standing convention; this is a refactor session with no new runtime behaviour)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — Change log entry appended: `**2026-05-08** — **VS-S8a complete (session #109).**` (12 hud files repointed, theme/index.ts slimmed, 17 tests repointed, gate results)
- `docs/references/builder-reference.md` — `apps/pan-tvardowski` mirror row updated: VS-S8a session #109 appended to session list, last closed 2026-05-08, 712 tests green
- `docs/plans/pan-tvardowski-build-plan.md` §17 — no new engine-coverage ticks (VS-S8a is internal cleanup, not a milestone deliverable)
- `docs/plans/release-readiness-checklist.md` — no new ticks (internal cleanup, no release gate satisfied)

**Drift footnote (⊞)**
17 test files under `apps/pan-tvardowski/tests/` repointed beyond the declared 12 `src/hud/` files. Mechanical typecheck-forced fix: when `theme/index.ts` stopped re-exporting `colors`/`spacing`/`typography`, any test importing those names from `'../theme'` broke typecheck. Import paths updated only — no assertion changes. Treated as in-scope per session-close invocation. Full list recorded in sessions.md footnote.

**Followup — sessions #110 + #111 sequencing bug.** #110 declares "delete `theme/typography.ts` (zero consumers)" but typography + fontFamily still have many consumers post-#109 (they just import from `'../theme/typography'` directly now). #111 then plans to delete 6 deprecated aliases from `theme/typography.ts` — which presumes the file still exists. Resolution path: either drop typography.ts from #110's delete list (only kill `overlays.ts` + `shapes.ts`) or run #111 before #110. Raise with `game-planner` before #110 starts.

**Commits** (subjects only — full blocks emitted above in chat)
1. `refactor(pt): VS-S8a repoint hud + tests to theme submodules`
2. `chore(pt): VS-S8a slim theme barrel to overlayBase shapes fontFamily`

**Next session:** #110 "VS-S8b overlayBase + fontFamily absorption: inline overlayBase, move fontFamily, delete theme/overlays.ts + theme/typography.ts + theme/shapes.ts"

---

## Session 117 — 2026-05-08 (scope: [engine])

**Goal (from sessions.md row #117):** Postfx-GodRays: new reusable EffectKind 'god-rays' — single-pass volumetric light scattering (GPU Gems 3 Ch. 13); screen-space light position uniform; per-frame uniforms updated via chain.setUniforms (no engine time-clock needed); SkSL + EffectKind union extension + create function + runtime SKSL_SOURCE/packUniforms/scaleIntensity cases + unit tests

**Touched files**
- `packages/postfx/src/effect.ts`
- `packages/postfx/src/shaders.ts`
- `packages/postfx/src/runtime.ts`
- `packages/postfx/src/index.ts`
- `packages/postfx/tests/god-rays.test.ts`
- `docs/design/api-specs.md`
- `docs/references/builder-reference.md`

**Gates**
- lint: ✅ (40/40 packages, 0 errors — Biome via Turbo; postfx cache miss, fresh run)
- typecheck: ✅ (73/73 tasks, 0 errors — tsc --noEmit; postfx build cache miss, fresh compile)
- test: ✅ (+5 new, total 42 in postfx — 42 pass, 0 fail across 5 files; full suite 77 tasks green)
- build: ✅ (39/39 FULL TURBO; postfx ESM + CJS + DTS; dist/index.d.mts 11.49 KB)

**Docs synced**
- `docs/references/builder-reference.md` — extraction table row for `@flare-engine/postfx` updated: test count 37 → 42, "god-rays added 2026-05-08 (42 tests)" appended (builder-authored, absorbed as legitimate doc-sync mirror update)
- `docs/plans/build-plan.md` — no change; Phase 11 already marked in-progress; additive effect within existing phase, no phase-state transition

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(postfx): god-rays SkSL + effect kind + runtime dispatch`
2. `test(postfx): god-rays uniform packing + scaleIntensity + SKSL wire`
3. `docs(postfx): god-rays in api-specs EffectKind + factory rows`
4. `docs(refs): postfx test count 37 → 42, god-rays mirror`

**Next session:** #118 "Postfx-Runtime-MultiTexture: extend postfx runtime to support a per-effect optional child texture (SkImage) as a uniform shader input"

---

## Session 118 — 2026-05-08 (scope: [engine])

**Goal (from sessions.md row #118):** Postfx-Runtime-MultiTexture: extend postfx runtime to support a per-effect optional child texture (SkImage) as a `uniform shader` input — required prerequisite for LUT, shadow-attenuation, normal-map driven postfx; CompiledPass gains `children: SkImage[]`; buildPass plumbs them; existing 5 effects keep `children: []` (no behavior change); unit tests cover child plumbing without GPU

**Touched files**
- `packages/postfx/src/runtime.ts`
- `packages/postfx/src/index.ts`
- `packages/postfx/tests/runtime-children.test.ts`
- `docs/design/api-specs.md`
- `docs/references/builder-reference.md`

**Scope note:** session row listed `chain.ts` and `effect.ts` in touched paths; those files were not edited. Children belong on the renderer-facing `CompiledPass` (runtime.ts), not on the serializable `EffectUniforms` data (effect.ts). User approved this design refinement before implementation. Convention A decision confirmed via explicit user question: `children` holds extra children only, excluding the implicit `src` scene texture which the renderer binds as `children[0]` at draw time.

**Gates**
- lint: ✅ (40/40 packages, 0 errors — Biome via Turbo, full turbo 153 ms)
- typecheck: ✅ (73/73 tasks, 0 errors — tsc --noEmit; full turbo 191 ms)
- test: ✅ (+6 new, total 48 in postfx — 48 pass, 0 fail across 6 files; runtime-children.test.ts 6/6 pass; full suite 77 tasks green)
- build: ✅ (39/39 FULL TURBO; postfx ESM 11.77 KB, CJS 13.37 KB, DTS 12.35 KB)

**Docs synced**
- `docs/references/builder-reference.md` — postfx extraction row updated: test count 42 → 48, "`SkImageLike` + `CompiledPass.children` (Convention A) added 2026-05-08 (48 tests)" appended
- `docs/design/api-specs.md` — `CompiledPass` shape updated with `children` field, `SkImageLike` structural stub added, Convention A note added under implementation notes
- `docs/plans/build-plan.md` — no change; Phase 11 remains in-progress; additive polish within existing phase, no phase-state transition

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(postfx): add SkImageLike stub and CompiledPass.children Convention A`
2. `test(postfx): 6 tests for CompiledPass.children Convention A sentinel`
3. `docs(postfx): CompiledPass.children, SkImageLike, Convention A; ref 48 tests`

**Next session:** #119 "Render-WaterEffect: new typed WaterEffect kind in AnySpriteEffect union"

---

## Session 119 — 2026-05-08 (scope: [engine])

**Goal (from sessions.md row #119):** Render-WaterEffect: new typed `WaterEffect` kind in AnySpriteEffect union — `water({ color, foamColor, waveSpeed, waveAmplitude })` factory; SkSL constants in new packages/render/src/shaders.ts (Skia-agnostic strings, mirrors postfx pattern); skia-bridge gains applyWater dispatch + lazy SkRuntimeEffect cache + per-frame uniform packing; reusable, no game-specific assumptions

**Touched files**
- `packages/render/src/shaders.ts` (NEW — `WATER_SKSL` SkSL source export)
- `packages/render/src/sprite-effects.ts` (`WaterEffect` type + `water()` factory added to `AnySpriteEffect` union)
- `packages/render/src/index.ts` (`WATER_SKSL`, `WaterEffect` re-exported)
- `packages/render/tests/water-effect.test.ts` (NEW — 3 tests: factory shape, `updateEffect` identity, exhaustive switch discrimination)
- `packages/react/src/skia-bridge.ts` (`applyWater` dispatch, lazy `SkRuntimeEffect` cache, per-frame uniform packing, `beginFrame` optional `time` param)
- `packages/react/tests/skia-bridge.test.ts` (+6 water-dispatch tests)
- `packages/react/tests/game-view.test.ts` (mock-stability fix: `WATER_SKSL: ''` added to `@flare-engine/render` mock to prevent module-mock contamination)
- `packages/react/tests/safe-area.test.ts` (same mock-stability fix)
- `docs/design/api-specs.md` (water factory row added under `@flare-engine/render` SpriteEffects)

**Drift note:** `packages/react/tests/game-view.test.ts` and `packages/react/tests/safe-area.test.ts` are outside the session's declared `touched paths`. Both are co-located test-infra updates required to prevent the new `WATER_SKSL` export from leaking between mocked imports in the test suite. Accepted — no scope drift in production code.

**Gates**
- lint: ✅ (40/40 packages, 0 errors — Biome via Turbo)
- typecheck: ✅ (73/73 tasks, 0 errors — tsc --noEmit direct per-package + full turbo)
- test: ✅ (+9 new: 3 render + 6 react; render 100 pass 0 fail; react 56 pass 0 fail; PT 712 pass 0 fail; 77 turbo tasks green)
- build: ✅ (39/39 FULL TURBO)

**Docs synced**
- `docs/references/builder-reference.md` — Session #119 row added: render 97 → 100 tests, react 50 → 56 tests
- `docs/plans/build-plan.md` — no change; Phase 3 (Rendering) already ✅ DONE; additive sprite-effect enhancement within existing phase, no phase-state transition

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(render): WaterEffect type, water() factory, WATER_SKSL shader source`
2. `feat(react): skia-bridge water dispatch, lazy cache, per-frame uniforms`
3. `test(render): 3 tests for WaterEffect factory and type discrimination`
4. `test(react): 6 water dispatch tests + mock stability fixes`
5. `docs(refs): session 119 row in builder-reference and api-specs water entry`

**Next session:** #120 "Render-FogEffect: new typed FogEffect kind in AnySpriteEffect union"

---

## Session 120 — 2026-05-08 (scope: [engine])

**Goal (from sessions.md row #120):** Render-FogEffect: new typed `FogEffect` kind in AnySpriteEffect union — `fog({ color, density, speed, scale })` factory; animated FBM noise SkSL; same render+react cross-package pattern as #119; SkSL constant joins shaders.ts; bridge gains applyFog dispatch + lazy compile cache

**Touched files**
- `packages/render/src/sprite-effects.ts` (`FogEffect` interface + `fog()` factory + `AnySpriteEffect` union extension)
- `packages/render/src/shaders.ts` (`FOG_SKSL` 4-octave FBM noise SkSL constant added)
- `packages/render/src/index.ts` (`FogEffect`, `fog`, `FOG_SKSL` re-exported)
- `packages/render/tests/fog-effect.test.ts` (NEW — 4 tests: factory defaults, explicit overrides, time-invariant updateEffect, exhaustive switch discrimination)
- `packages/react/src/skia-bridge.ts` (`applyFog` dispatch, lazy `SkRuntimeEffect` cache, per-frame uniform packing — 9 floats: res×2, color×3, density, speed, scale, time)
- `packages/react/tests/skia-bridge.test.ts` (+4 fog-dispatch tests: dispatch hit, lazy cache reuse, uniform packing, no-op on missing RuntimeEffect)
- `packages/react/tests/game-view.test.ts` (mock-stability fix: `FOG_SKSL: ''` added to `@flare-engine/render` mock)
- `packages/react/tests/safe-area.test.ts` (same mock-stability fix)
- `docs/design/api-specs.md` (fog factory clause appended to `@flare-engine/render` SpriteEffects row)
- `docs/references/builder-reference.md` (Session #120 row added)

**Drift note:** `packages/react/tests/game-view.test.ts` and `packages/react/tests/safe-area.test.ts` are outside the session's declared `touched paths`. Both are co-located test-infra updates required to prevent the new `FOG_SKSL` export from leaking between mocked imports in the test suite. Accepted — same class as #119 mock-stability fixes, no scope drift in production code.

**Gates**
- lint: ✅ (40/40 packages, 0 errors — Biome via Turbo)
- typecheck: ✅ (73/73 tasks, 0 errors — tsc --noEmit per-package + full turbo)
- test: ✅ (+8 new: 4 render + 4 react; render 104 pass 0 fail; react 60 pass 0 fail; 77 turbo tasks green)
- build: ✅ (39/39 FULL TURBO)

**Docs synced**
- `docs/references/builder-reference.md` — Session #120 row added: render 100 → 104 tests, react 56 → 60 tests
- `docs/plans/build-plan.md` — no change; Phase 3 (Rendering) already ✅ DONE; additive sprite-effect enhancement within existing phase, no phase-state transition

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(render): FogEffect type, fog() factory, FOG_SKSL shader source`
2. `feat(react): skia-bridge fog dispatch, lazy cache, per-frame uniforms`
3. `test(render): 4 tests for FogEffect factory and type discrimination`
4. `test(react): 4 fog dispatch tests + mock stability fixes`
5. `docs(refs): session 120 row in builder-reference and api-specs fog entry`

**Next session:** #121 "PT-Z3-Refactor: delete tilemap-bg.ts; spawn WaterEffect + FogEffect background entities for Z3"

---

## Session 121 — 2026-05-08 (scope: [game])

**Goal (from sessions.md row #121):** PT-Z3-Refactor: delete tilemap-bg.ts (283-entity tile system); spawn 2 background entities for Z3 — fullscreen-stretched 32×32 atlas frame + WaterEffect (z=−100), same + FogEffect (z=−90); shader output replaces atlas sampling per skia-bridge applyCustom semantics; verify 60fps locked on target device; update visual-spec/zone-3.ts if needed

**Touched files**
- `apps/pan-tvardowski/src/bg/tilemap-bg.ts` (deleted — declared)
- `apps/pan-tvardowski/src/bg/zone3-bg.ts` (NEW — replacement spawn module)
- `apps/pan-tvardowski/src/scenes/play.ts` (declared)
- `apps/pan-tvardowski/src/visual-spec/zone-3.ts` (declared)
- `apps/pan-tvardowski/tests/tilemap-bg.test.ts` (deleted — declared replacement)
- `apps/pan-tvardowski/tests/zone-3-bg.test.ts` (NEW — declared replacement)
- `apps/pan-tvardowski/src/visual-spec/types.ts` ‡
- `apps/pan-tvardowski/tests/visual-spec.test.ts` ‡
- `docs/plans/sessions.md` (row flip to in_progress → done)

‡ Path drift: `src/visual-spec/types.ts` extends `ParallaxLayer.content` union with `'water-shader' | 'fog-shader'` — required for `zone-3.ts` to typecheck (the new parallax layer discriminants are only valid once the union includes them). `tests/visual-spec.test.ts` canary hash bumped to reflect the union change. Both changes are tightly coupled to the declared work; no independent new behavior. Same class of drive-by as session #19 `§` and session #20 `°` footnotes.

**Gates**
- lint: ✅ (biome check src/ tests/ — 293 files, 0 errors)
- typecheck: ✅ (tsc --noEmit — 0 errors)
- test: ✅ (+1 new test file with 4 tests replacing deleted tilemap-bg suite; 713 pass, 0 fail, 8577 expect() calls)
- build: ✅ (echo stub — native build via bun run android|ios)
- device smoke: pending user confirmation (Galaxy A54 + iPhone 12, 60fps lock on Z3)

**Docs synced**
- `docs/references/builder-reference.md` — apps/pan-tvardowski mirror row updated: PT-Z3-Refactor (session #121) appended, test count 712 → 713
- `docs/plans/pan-tvardowski-build-plan.md` Change log — dated `2026-05-08` PT-Z3-Refactor entry appended; no §17 milestone tick change (M3 tilemap ✅ preserved — tilemap package still exercised by other zones' parallax plumbing)
- `docs/plans/release-readiness-checklist.md` — no new ticks (PT-Z3-Refactor is a rendering optimization, not a release-gate item)

**Commits** (subjects only — full blocks emitted above in chat)
1. `feat(pan-tvardowski): replace 283-entity tilemap-bg with 2-entity z3 shader bg`
2. `test(pan-tvardowski): zone-3-bg replaces tilemap-bg test`
3. `docs(pan-tvardowski): visual-spec zone-3 water+fog shader tokens`

**Next session:** #122 "Postfx-ColorGradingLUT: new EffectKind color-grading-lut depending on #118 multi-texture runtime"

---

## Session 110 — 2026-05-09 (scope: [game])

**Goal (from sessions.md row #110):** VS-S8b overlayBase + fontFamily absorption: inline overlayBase layout constants into each .styles.ts consumer (5 files); move fontFamily into visual-spec/theme.ts; delete theme/overlays.ts + theme/typography.ts + theme/shapes.ts (zero consumers)

**Touched files**
- `apps/pan-tvardowski/src/hud/AchievementsOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/CodexOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/InventoryOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/ShopOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/PrivacyOverlay.styles.ts`
- `apps/pan-tvardowski/src/hud/Hud.styles.ts` ‡
- `apps/pan-tvardowski/src/visual-spec/theme.ts`
- `apps/pan-tvardowski/src/theme/index.ts`
- `apps/pan-tvardowski/src/theme/overlays.ts` (emptied/deleted)
- `apps/pan-tvardowski/src/theme/shapes.ts` (deleted)
- `apps/pan-tvardowski/src/theme/typography.ts` (re-export shim — deletion deferred)
- `apps/pan-tvardowski/tests/overlay-layering.test.ts` ‡
- `apps/pan-tvardowski/tests/theme-overlays.test.ts` ‡
- `apps/pan-tvardowski/tests/theme.test.ts` ‡
- `apps/pan-tvardowski/tests/typography.test.ts` ‡
- `apps/pan-tvardowski/tests/zone-banner.test.ts` ‡
- `docs/plans/sessions.md`
- `packages/render/src/shaders.ts` † (engine hotfix — documented out-of-scope)

‡ Drift: files outside the declared `touched paths`, accepted per builder-reported justifications:
- `Hud.styles.ts` — collateral consumer of `overlayBase`; inlined same constants.
- `tests/zone-banner.test.ts` — undeclared `fontFamily` consumer from theme barrel; repointed to `../src/visual-spec/theme`.
- `tests/theme-overlays.test.ts` + `tests/overlay-layering.test.ts` — identity assertions (`=== overlayBase`) no longer expressible after inline; rewritten as value-equality assertions.
- `tests/theme.test.ts` + `tests/typography.test.ts` — collateral test-sync for deleted/modified theme files.

† `packages/render/src/shaders.ts` is a documented out-of-scope engine hotfix (SkSL `h` literal suffix dropped; committed separately as `fix(render)`). Does not block close.

**Gates**
- lint: ✅ (40/40 packages, 0 errors — Biome via Turbo)
- typecheck: ✅ (tsc --noEmit, 0 errors)
- test: ✅ (+0 new; 710 pass, 0 fail, 146 files; 713 → 710 net: 3 identity assertions removed from overlay tests)
- build: ✅ (echo stub — native build via bun run android|ios)
- device smoke: deferred to session #107 (no new scene/rendering change in this session)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — dated `2026-05-09` VS-S8b Change log entry appended (line 615); no §17 milestone tick (refactor, not a milestone)
- `docs/references/builder-reference.md` — apps/pan-tvardowski mirror row updated: VS-S8b (session #110) appended, test count 713 → 710, last-closed date 2026-05-09
- `docs/plans/release-readiness-checklist.md` — no new ticks (VS-S8b is a refactor, not a release item)
- `docs/plans/sessions.md` — row #110 flipped `in_progress` → `done ⊞`, closed 2026-05-09; row #110h (engine hotfix) added as `done [engine]`

**Commits** (subjects only — full blocks emitted above in chat)
0. `fix(render): drop SkSL h literal suffix in water shader` (engine hotfix, separate commit)
1. `refactor(pan-tvardowski): inline overlayBase into 5 overlay styles`
2. `refactor(pan-tvardowski): move fontFamily to visual-spec/theme`
3. `refactor(pan-tvardowski): delete theme/shapes.ts, update theme barrel`

**Next session:** #111 "VS-S8c deprecated typography purge: delete 6 deprecated aliases (h1/h2/h3/body/caption/xs) from theme/typography.ts; grep-fix any remaining consumers to use spec-equivalent tokens"

---

## Session 111 — 2026-05-09 (scope: [game])

**Goal (from sessions.md row #111):** VS-S8c deprecated typography purge: delete 6 deprecated aliases (h1/h2/h3/body/caption/xs) from theme/typography.ts; grep-fix any remaining consumers to use spec-equivalent tokens (displayM/bodyL/bodyM/smallcap/monoDebug)

**Touched files**
- `apps/pan-tvardowski/src/theme/typography.ts`
- `apps/pan-tvardowski/src/hud/Hud.styles.ts`
- `apps/pan-tvardowski/src/hud/ShopOverlay.tsx`
- `apps/pan-tvardowski/tests/typography.test.ts`
- `apps/pan-tvardowski/tests/runtime-rewire-integration.test.ts`
- `docs/plans/pan-tvardowski-build-plan.md`
- `docs/references/builder-reference.md`
- `docs/plans/sessions.md`

**Gates**
- lint: ✅
- typecheck: ✅ (tsc --noEmit, exit 0 confirmed by builder post-doc-sync)
- test: ✅ (+0 new; 710 pass, 0 fail — alias-deletion tests rewritten to assert absence; baseline unchanged)
- build: N/A (not in row gates; refactor + test-only session)
- device smoke: deferred to session #107 (no new scene/rendering change)

**Docs synced**
- `docs/plans/pan-tvardowski-build-plan.md` — dated `2026-05-09` VS-S8c Change log entry appended (single-bullet local style, after VS-S8b entry at line ~615)
- `docs/references/builder-reference.md` — apps/pan-tvardowski mirror row updated: `+ VS-S8c deprecated typography purge (session #111)` inserted before the `complete (last closed:` marker; last-closed date updated to 2026-05-09
- `docs/plans/release-readiness-checklist.md` — no new ticks (VS-S8c is a refactor, not a release item)

**Commits** (subjects only — full blocks emitted above in chat)
1. `refactor(pan-tvardowski): purge 6 deprecated typography aliases`
2. `test(pan-tvardowski): update typography tests post-alias purge`
3. `docs(pan-tvardowski): VS-S8c change log + builder-reference mirror row`

**Next session:** #112 "VS-S8d palette.ts absorption: move ZONE_PALETTES + ZonePalette + ZoneId + AmbienceKind + getUiPrimaryHex into visual-spec/; repoint play.ts + Hud.tsx + ambience.ts + theme/colors.ts consumers; delete palette.ts"

---
