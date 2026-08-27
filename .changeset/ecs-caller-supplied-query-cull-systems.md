---
'@flare-engine/ecs': patch
---

Add optional `query?` parameter to `createLifetimeSystem` and `createBoundsCullSystem`. When supplied, the system uses the caller's pre-registered `Query` instead of minting its own, eliminating duplicate query registration cost and allowing consumers to restrict the scanned entity set to a narrower component mask.
