---
"@flare-engine/iap-revenuecat": minor
---

restore maps active entitlements only (no re-granting expired); onTransaction listener lifecycle is leak-free + idempotent and emits every active entitlement; honest transaction id from the store transaction with a documented date fallback; getProducts takes an optional productCategory (fixes Android one-time empty catalog) + an onError hook on both getProducts/restore; peer deps drop phantom react and declare react-native >=0.79.0.
