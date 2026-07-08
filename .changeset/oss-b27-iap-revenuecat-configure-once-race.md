---
"@flare-engine/iap-revenuecat": minor
---

iap-revenuecat: configure exactly once under concurrent first calls.

`ensureConfigured` gated on a boolean that flips only after two awaits (`getSDK()` +
`import('react-native')`), so concurrent first callers — e.g. `Promise.all([getProducts(),
restore()])` — all passed the guard and each called `Purchases.configure`, which RevenueCat
rejects as a double-configure. The boolean is replaced by a memoized `configurePromise`
awaited by every entrypoint, so `configure` runs exactly once for all in-flight callers. A
failed configure clears the memo so a later call retries (preserving the old flag's
stay-unset-on-throw behavior). No API-surface change.
