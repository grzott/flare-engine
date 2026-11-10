---
'@flare-engine/progression': patch
---

Internal refactor: `resolveTier` now delegates to `resolveTierIndex`, so the threshold scan and its last-wins tie rule live in one place. No behaviour or API change.
