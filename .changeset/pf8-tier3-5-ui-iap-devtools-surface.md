---
"@flare-engine/iap-revenuecat": patch
"@flare-engine/ui-shop": patch
"@flare-engine/ui": patch
"@flare-engine/leaderboards": patch
"@flare-engine/devtools": patch
---

PF-8: settle the published surface of `iap-revenuecat`, `ui-shop`, `ui`, `leaderboards` and
`devtools` before the 0.4.0 freeze. Per ADR-0004.

- `iap-revenuecat`'s structural `RevenueCatEntitlement` type declared a `purchaseDateMillis` field
  the real SDK never sends on an entitlement (verified against `react-native-purchases`' own
  `.d.ts` — it only has `latestPurchaseDateMillis`), so `purchasedAt` on a restored or
  transaction-streamed entitlement was always `Date.now()`, never the real purchase date. The
  adapter now reads `latestPurchaseDateMillis`. Store-transaction `purchasedAt` was already correct
  at runtime (hybrid-common's mappers do emit `purchaseDateMillis` there); the local type now also
  declares the SDK's ISO `purchaseDate` string and falls back to `Date.parse(purchaseDate)` when
  the millis field is absent, folding a malformed date to `undefined` first so it can't leak `NaN`
  past the final `Date.now()` fallback.
- `ui-shop`'s `PaywallModal` called `entitlementStore.grant(entitlementKey)` instead of
  `grantProduct(productId)`, so a multi-entitlement product (e.g. a season pass) bought through the
  paywall granted only one key — the rest appeared only after the next restore, so the same
  purchase yielded a different entitlement set depending on which `ui-shop` component performed it.
  `PaywallModal` now calls `grantProduct(productId)`, matching `ShopScreen` and
  `RestorePurchasesButton`; the now-redundant `entitlementKey` prop is removed from
  `PaywallModalProps`.
- `ui`'s `List` treated a `{items.map(...)}` child sitting alongside JSX siblings as a single item
  (a manual `Array.isArray` split only unwraps one level), so mapped children shared one visual
  slot with no gap between them. `List` now flattens `children` with `Children.toArray`, which also
  drops `null`/`undefined`/boolean the same way the old manual filter did.
- `ui`'s `ShopPanel`/`ShopItem` — a second, unrelated shop-list component with zero consumers
  anywhere in the repo (`ui-shop`'s `ShopScreen` is the catalog/entitlement-aware one actually used)
  — is removed. This was flagged and deliberately left undecided once before
  (`package-findings-2026-07.md`); this row is the decision: keep the IAP-wired `ui-shop` surface,
  drop the lower-tier duplicate.
- `leaderboards`' `MemoryLeaderboards` was a type alias adding nothing over `LeaderboardsProvider`.
  `createMemoryLeaderboards` now returns `LeaderboardsProvider` directly; the alias and its
  `index.ts` export are gone.
- `devtools`' `DevtoolsContextValue` exposed `pause()` / `step()` / `resume()` directly, alongside
  the `scrubber` it was built from and the `useTimeScrub()` hook wrapping that same `scrubber` —
  three routes to one set of controls, and the direct context methods had no consumer (`<DevtoolsHUD>`
  and `<DevtoolsPanel>` both already use `useTimeScrub()`). `pause`/`step`/`resume` are removed from
  `DevtoolsContextValue`; `scrubber` and `useTimeScrub()` are unchanged.
