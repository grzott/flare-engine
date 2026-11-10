---
'@flare-engine/iap': patch
---

Internal refactor: `getGrantsForProduct` now delegates to `getCatalogEntry`, so the catalog scan lives in one place, and `CatalogEntry.type` now derives its union from `Product.type` instead of repeating it. No behaviour or API change.
