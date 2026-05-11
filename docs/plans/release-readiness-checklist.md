# Release Readiness Checklist

Single source of truth for "what's left before Pan Tvardowski can be submitted to Google Play + App Store." Every M9.x milestone in [pan-tvardowski-build-plan.md](./pan-tvardowski-build-plan.md) ticks relevant boxes here. Review rule enforced by [release-readiness.instructions.md](../../.github/instructions/release-readiness.instructions.md).

This list is **scoped to a single game ship** (PT 0.1.0). Reusable items are tracked separately in [build-plan.md §11.14](./build-plan.md#1114--extraction--reusability--demo-retirement).

Legend: ⬜ not started · 🟡 in progress · ✅ done · ❌ rejected.

> **Status (2026-05-11 — manual launch tier deferred, no schedule).** Release infra is the **final stage** — store accounts, legal filings, app icon, screenshots/trailer, store-page copy, RR walk, production submits. None of these are actively planned. They open as a batch **after the presentation arc closes** (sessions #182–#191 in [`sessions.md`](./sessions.md): remaining shader bgs + sequenced postfx + budget recheck + visual-ref refresh), followed by the engine-promotion harvest (#192–#196). The session picker explicitly skips manual-tier rows; tracked here for completeness only. Owner runs these directly outside the session loop when triggered.
>
> **Test pipeline (locked since 2026-05-09 / session #154).** EAS cloud build → TestingBot Maestro flows on Pixel 10 (Android canonical) + iPhone 16 Pro (iOS canonical, deferred behind §2 Apple Developer account). Maestro YAML in `apps/pan-tvardowski/.maestro/`. Manual 13-row checklist at [`apps/pan-tvardowski/docs/device-smoke.md`](../../apps/pan-tvardowski/docs/device-smoke.md) is now fallback only.

---

## 1. Creative assets (swap slots — ready to drop)

All slots must be manifest-driven so non-engineer collaborators can swap files without code changes. See M9.5 in [pan-tvardowski-build-plan.md §17](./pan-tvardowski-build-plan.md#17--milestones).

- [x] ✅ Sprite atlas manifest schema shipped (`apps/pan-tvardowski/assets/sprites.manifest.json`) — placeholder = current shape atlas; production atlas dropped in same path.
- [x] ✅ Audio atlas manifest schema shipped (`apps/pan-tvardowski/assets/audio.manifest.json`) — placeholder = procedural sine tracks (current); production MP3/OGG dropped in same path.
- [x] ✅ Avatar portrait manifest shipped (`apps/pan-tvardowski/assets/portraits.manifest.json`) — placeholder = shape-portraits; production portraits same keys.
- [x] ✅ Zero hardcoded asset paths outside the three manifests (enforced by lint rule or grep pre-commit).
- [x] ✅ Drop-in swap dry-run: replace one placeholder sprite + one placeholder audio with real file → game runs unchanged.

## 2. Store accounts + build pipeline

- [ ] ⬜ Google Play developer account (one-time $25).
- [ ] ⬜ Apple Developer Program ($99/yr).
- [x] 🟡 Google Play Console: app created, internal testing track opened — procedural steps documented in `apps/pan-tvardowski/docs/keystore.md §Play Console` (session #105); external actions not yet executed.
- [x] 🟡 App Store Connect: app created, TestFlight opened — 9-step listing procedure + TestFlight internal-tester flow documented in `apps/pan-tvardowski/docs/keystore.md §App Store Connect listing` (session #106); external actions not yet executed.
- [x] ✅ EAS build profile: `production` + `preview` in `apps/pan-tvardowski/eas.json` (session #15, 2026-04-27).
- [x] 🟡 Android signing: upload keystore generated, stored in EAS credentials (never committed) — `eas credentials` procedure documented in `apps/pan-tvardowski/docs/keystore.md §Android keystore via EAS credentials` (session #105); external action not yet executed.
- [x] 🟡 iOS signing: distribution cert + provisioning profile via EAS — `eas credentials --platform ios` procedure documented in `apps/pan-tvardowski/docs/keystore.md §iOS managed signing via EAS Credentials` (session #106); external action not yet executed.
- [x] ✅ Version bump policy documented in `apps/pan-tvardowski/docs/keystore.md` (semver in `app.json`, EAS `autoIncrement` for `versionCode`/`buildNumber`) — session #15, 2026-04-27.

## 3. IAP products (all three future Flare games covered)

The engine must support **three ship modes** without branching: (a) 100 % free, (b) buy-once, (c) freemium with content gates. PT is mode (c); see [pan-tvardowski-build-plan.md §20](./pan-tvardowski-build-plan.md#20--monetization-model).

- [x] ✅ `ProductCatalog` type + `EntitlementStore` shipped in `@flare-engine/iap` (Phase 11.14).
- [x] ✅ PT catalogue defined in `apps/pan-tvardowski/src/iap/catalog.ts` (single source; referenced by ShopPanel + zone-gate logic).
- [ ] ⬜ Google Play Console: `pan_tvardowski.full_game` (non-consumable) created; price set; localized name + description.
- [ ] ⬜ Google Play Console: `pan_tvardowski.supporter_pack` (non-consumable) created.
- [x] ✅ `pan_tvardowski.shards_small` consumable explicitly removed from catalogue (M9.3 / session #7) — supporter_pack non-consumable replaces it.
- [ ] ⬜ App Store Connect: matching product IDs + metadata + screenshots.
- [x] ✅ IAP provider adapter chosen — **RevenueCat** via `@flare-engine/iap-revenuecat` (engine session #23, 2026-04-27); env-var gated (`EXPO_PUBLIC_REVENUECAT_API_KEY_IOS/_ANDROID`) with `NoopIAPProvider` fallback for CI/dev.
- [x] ✅ Restore Purchases UI wired (M9.3 / session #10) — `<RestorePurchasesButton>` from `@flare-engine/ui-shop` in Settings; `'purchase-completed'` event auto-dismisses paywall after restore.
- [x] ✅ Entitlement-lost fallback: if user owned zones 4–8 and entitlement lapses (edge case), app gracefully returns them to free-mode without data loss.

## 4. Legal

- [ ] ⬜ Domains registered: `pantvardowski.com`, `.pl`, `.eu` (~€30) — per [pan-tvardowski-build-plan.md §19](./pan-tvardowski-build-plan.md#19--trademark-plan).
- [ ] ⬜ Social handles grabbed: `@pantvardowski` on X, YouTube, TikTok.
- [ ] ⬜ EUIPO word mark filed (Class 9 + 41, ~€900 DIY).
- [ ] ⬜ Privacy policy live on flare-engine.dev (single policy covers PT since no PII leaves device at 0.1.0).
- [ ] ⬜ Terms of Service published (IAP refund policy, age rating).
- [ ] ⬜ Age rating certificates (IARC via Play Console; App Store rating).
- [x] ✅ Credits file up to date (`apps/pan-tvardowski/CREDITS.md`) — every asset + library attributed.

## 5. Build + reliability

- [x] ✅ Crash transport provider chosen (Sentry / Bugsnag / custom) — wired in PT, not just the Noop transport. — `createSentryCrashTransport` (gated by `crashOptIn`) + `composeTransports` in `apps/pan-tvardowski/src/errors/transport.ts`, wired in `App.tsx`; `@sentry/react-native` loads lazily and falls back to noop when missing/DSN unset. Session #17, 2026-04-27.
- [x] ✅ Crash-opt-in surface in Settings (`settings.privacy.crashOptIn`, default = off) — `PrivacyOverlay` wired in Settings, session #16, 2026-04-27.
- [x] ✅ Save-schema migrator v1→v7 step-chain tested with synthetic fixtures (session #21, 2026-04-28).
- [x] ✅ Deep-link registration in `app.json` / `Info.plist` / `AndroidManifest.xml` — `pantvardowski://zone/N` routes wired end-to-end in prod build.
- [ ] ⬜ `bun run test` + `bun run build` green in CI on the release branch.
- [ ] ⬜ Device smoke test on Pixel 10 (Android) + iPhone 16 Pro (iOS) via TestingBot OSS free tier (release build). — Android cold-start TTI gate passed; functional smoke blocked (#156); iOS deferred (#137).
- [x] Android (Pixel 10): gate passed, 2026-05-10
- [ ] iOS (iPhone 16 Pro): deferred (#137)

## 6. Analytics + leaderboards + achievements

All three ship as Noop at 0.1.0 unless explicitly swapped. Consent gates live with crash consent.

- [x] ✅ Analytics provider decision recorded (default: Noop at launch; PostHog/Amplitude at 0.2.0).
- [x] ✅ Leaderboard provider decision recorded (default: Noop; Game Center / Play Games at 0.2.0).
- [x] ✅ Achievements provider decision recorded (default: Noop; Game Center / Play Games at 0.2.0).
- [x] ✅ Analytics event list frozen in `apps/pan-tvardowski/src/tier2/analytics-events.ts` — every event + schema reviewed.

## 7. Localization + content

- [x] ✅ PL + EN key parity scripted (`check:locales`); 288 keys in parity (session #20, 2026-04-28).
- [x] ✅ Native-speaker QA pass on PL dialogue (all zones) — 3 fixes applied (M5, 2026-04-28); one entry (`codex.smok-krzemionkowski.lore`) deferred to expert review, see `apps/pan-tvardowski/docs/locale-qa-followups.md`.
- [ ] ⬜ Store-page copy ready in EN + PL (short description, long description, promo text).
- [x] ✅ Balance freeze recorded: `BALANCE_FROZEN_AT = '2026-04-28'` in `gameplay.ts` + `zones.ts`; `check:balance` script enforces it (session #19, 2026-04-28).

## 8. Store assets

- [x] ✅ Screenshot capture scene wired via `@flare-engine/share` `createScreenshotScene`; `createPTScreenshotScene` factory + `createCaptureScene` orchestration scene shipped (session #18, 2026-04-28). Manual App.tsx scene-registration trigger remains a post-launch follow-up.
- [ ] ⬜ Google Play: 8 screenshots (1080 × 1920) per language.
- [ ] ⬜ Google Play: feature graphic (1024 × 500).
- [ ] ⬜ Google Play: 30 s trailer (from in-game capture).
- [ ] ⬜ App Store: 10 screenshots per device class (6.7″, 6.5″, 5.5″) per language.
- [ ] ⬜ App Store: 30 s preview video per device class.
- [ ] ⬜ App icon final (1024 × 1024 master; platform variants generated).

---

## Review cadence

- **Every M9.x milestone** ticks items here + syncs the milestone's changelog line in [pan-tvardowski-build-plan.md](./pan-tvardowski-build-plan.md).
- **Stage 11.14 extraction review** (architect) confirms each extraction's engine landing doesn't regress any ticked item here.
- **Stage 11.13 RC gate** (builder + architect) walks the full list; any ⬜ blocks the RC cut unless explicitly rejected with rationale.
