---
"@flare-engine/core": patch
---

Internal refactor: `Pool.acquire` and `Pool.tryAcquire` now share one private pop-or-create helper instead of two copies of the same body. No behaviour or API change.
