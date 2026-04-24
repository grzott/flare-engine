# Release Readiness Checklist

Single source of truth for "what's left before Pan Tvardowski can be submitted to Google Play + App Store." Every M9.x milestone in [pan-tvardowski-build-plan.md](./pan-tvardowski-build-plan.md) ticks relevant boxes here. Review rule enforced by [release-readiness.instructions.md](../../.github/instructions/release-readiness.instructions.md).

This list is **scoped to a single game ship** (PT 0.1.0). Reusable items are tracked separately in [build-plan.md §11.14](./build-plan.md#1114--extraction--reusability--demo-retirement).

Legend: ⬜ not started · 🟡 in progress · ✅ done · ❌ rejected.

---

## 1. Creative assets (swap slots — ready to drop)

All slots must be manifest-driven so non-engineer collaborators can swap files without code changes. See M9.5 in [pan-tvardowski-build-plan.md §17](./pan-tvardowski-build-plan.md#17--milestones).

- [ ] ⬜ Sprite atlas manifest schema shipped (`apps/pan-tvardowski/assets/sprites.manifest.json`) — placeholder = current shape atlas; production atlas dropped in same path.
- [ ] ⬜ Audio atlas manifest schema shipped (`apps/pan-tvardowski/assets/audio.manifest.json`) — placeholder = procedural sine tracks (current); production MP3/OGG dropped in same path.
- [ ] ⬜ Avatar portrait manifest shipped (`apps/pan-tvardowski/assets/portraits.manifest.json`) — placeholder = shape-portraits; production portraits same keys.
- [ ] ⬜ Zero hardcoded asset paths outside the three manifests (enforced by lint rule or grep pre-commit).
- [ ] ⬜ Drop-in swap dry-run: replace one placeholder sprite + one placeholder audio with real file → game runs unchanged.

## 2. Store accounts + build pipeline

- [ ] ⬜ Google Play developer account (one-time $25).
- [ ] ⬜ Apple Developer Program ($99/yr).
- [ ] ⬜ Google Play Console: app created, internal testing track opened.
- [ ] ⬜ App Store Connect: app created, TestFlight opened.
- [ ] ⬜ EAS build profile: `production` + `preview` in `apps/pan-tvardowski/eas.json`.
- [ ] ⬜ Android signing: upload keystore generated, stored in EAS credentials (never committed).
- [ ] ⬜ iOS signing: distribution cert + provisioning profile via EAS.
- [ ] ⬜ Version bump policy documented (semver in `app.json` + build number monotonic).

## 3. IAP products (all three future Flare games covered)

The engine must support **three ship modes** without branching: (a) 100 % free, (b) buy-once, (c) freemium with content gates. PT is mode (c); see [pan-tvardowski-build-plan.md §20](./pan-tvardowski-build-plan.md#20--monetization-model).

- [ ] ⬜ `ProductCatalog` type + `EntitlementStore` shipped in `@flare-engine/iap` (Phase 11.14).
- [ ] ⬜ PT catalogue defined in `apps/pan-tvardowski/src/iap/catalog.ts` (single source; referenced by ShopPanel + zone-gate logic).
- [ ] ⬜ Google Play Console: `pan_tvardowski.full_game` (non-consumable) created; price set; localized name + description.
- [ ] ⬜ Google Play Console: `pan_tvardowski.supporter_pack` (non-consumable) created.
- [ ] ⬜ Google Play Console: `pan_tvardowski.shards_small` / `_large` (consumable) created — **or explicitly disabled in catalogue**.
- [ ] ⬜ App Store Connect: matching product IDs + metadata + screenshots.
- [ ] ⬜ IAP provider adapter chosen (RevenueCat / native StoreKit + Play Billing / other) — recorded in [pan-tvardowski-build-plan.md §20](./pan-tvardowski-build-plan.md#20--monetization-model).
- [ ] ⬜ Restore Purchases UI wired in Settings.
- [ ] ⬜ Entitlement-lost fallback: if user owned zones 4–8 and entitlement lapses (edge case), app gracefully returns them to free-mode without data loss.

## 4. Legal

- [ ] ⬜ Domains registered: `pantvardowski.com`, `.pl`, `.eu` (~€30) — per [pan-tvardowski-build-plan.md §19](./pan-tvardowski-build-plan.md#19--trademark-plan).
- [ ] ⬜ Social handles grabbed: `@pantvardowski` on X, YouTube, TikTok.
- [ ] ⬜ EUIPO word mark filed (Class 9 + 41, ~€900 DIY).
- [ ] ⬜ Privacy policy live on flare-engine.dev (single policy covers PT since no PII leaves device at 0.1.0).
- [ ] ⬜ Terms of Service published (IAP refund policy, age rating).
- [ ] ⬜ Age rating certificates (IARC via Play Console; App Store rating).
- [ ] ⬜ Credits file up to date (`apps/pan-tvardowski/CREDITS.md`) — every asset + library attributed.

## 5. Build + reliability

- [ ] ⬜ Crash transport provider chosen (Sentry / Bugsnag / custom) — wired in PT, not just the Noop transport.
- [ ] ⬜ Crash-opt-in surface in Settings (`settings.privacy.crashOptIn`, default = off).
- [ ] ⬜ Save-schema migrator v1 → v2 pathway tested with synthetic old save.
- [ ] ⬜ Deep-link registration in `app.json` / `Info.plist` / `AndroidManifest.xml` — `pantvardowski://zone/N` routes wired end-to-end in prod build.
- [ ] ⬜ `bun run test` + `bun run build` green in CI on the release branch.
- [ ] ⬜ Device smoke test on one physical Android + one physical iOS (release build, airplane mode ok).
- [ ] ⬜ Cold-start perf: time-to-first-interactive < 3 s on Galaxy A54 / iPhone 12.

## 6. Analytics + leaderboards + achievements

All three ship as Noop at 0.1.0 unless explicitly swapped. Consent gates live with crash consent.

- [ ] ⬜ Analytics provider decision recorded (default: Noop at launch; PostHog/Amplitude at 0.2.0).
- [ ] ⬜ Leaderboard provider decision recorded (default: Noop; Game Center / Play Games at 0.2.0).
- [ ] ⬜ Achievements provider decision recorded (default: Noop; Game Center / Play Games at 0.2.0).
- [ ] ⬜ Analytics event list frozen in `apps/pan-tvardowski/src/tier2/events.ts` — every event + schema reviewed.

## 7. Localization + content

- [ ] ⬜ PL + EN key parity audit (every EN key has a PL value and vice-versa) — scripted check.
- [ ] ⬜ Native-speaker QA pass on PL dialogue (all zones).
- [ ] ⬜ Store-page copy ready in EN + PL (short description, long description, promo text).
- [ ] ⬜ Balance freeze recorded in [pan-tvardowski-build-plan.md](./pan-tvardowski-build-plan.md) changelog (HP / fire rates / upgrade costs locked).

## 8. Store assets

- [ ] ⬜ Screenshot capture scene wired (`@flare-engine/share` `createScreenshotScene`, extracted at Phase 11.14).
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
